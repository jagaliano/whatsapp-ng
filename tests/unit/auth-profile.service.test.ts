import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionManager } from '../../src/services/session.manager.ts';
import { TransportLease } from '../../src/services/transport-lease.service.ts';
import { createStoragePaths, migrateLegacyStorage } from '../../src/services/storage-path.ts';
import { syntheticCredentials, serializedCredentials } from '../fixtures/auth-creds.ts';

const mocks = vi.hoisted(() => ({
    home: '/__whatsapp_ng_uninitialized_fixture_home__',
    reads: [] as string[], load: vi.fn(), get: vi.fn(), set: vi.fn(),
    failImportCommit: false, failStableMarker: false, failResetRename: false
}));
vi.mock('os', async importOriginal => ({ ...await importOriginal<typeof import('node:os')>(), homedir: () => mocks.home }));
vi.mock('fs/promises', async importOriginal => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    return { ...actual, readFile: (...args: Parameters<typeof actual.readFile>) => {
        mocks.reads.push(String(args[0])); return actual.readFile(...args);
    }, rename: async (from: Parameters<typeof actual.rename>[0], to: Parameters<typeof actual.rename>[1]) => {
        if (mocks.failImportCommit && String(from).includes('.import-')) throw new Error('synthetic import commit failure');
        if (mocks.failResetRename && String(to).includes('.retired-')) throw new Error('synthetic reset rename failure');
        if (mocks.failStableMarker && String(to).endsWith('.auth-profile.json')) {
            const value = JSON.parse(await actual.readFile(from, 'utf8'));
            if (value.state === 'stable') throw new Error('synthetic stable-marker failure');
        }
        return actual.rename(from, to);
    } };
});
vi.mock('baileys', async importOriginal => ({ ...await importOriginal<typeof import('baileys')>(), useMultiFileAuthState: mocks.load }));
let root: string;
let target: string;
let legacy: string;
let leases: TransportLease[];
function session() { return new SessionManager(target, legacy); }
async function seed(directory: string, label: string) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, 'creds.json'), serializedCredentials(label), { mode: 0o600 });
    await writeFile(join(directory, `session-${label}.json`), JSON.stringify({ synthetic: label }), { mode: 0o600 });
}
async function claim(manager: SessionManager) {
    const lease = await TransportLease.acquire(manager.getAuthStateDir()); leases.push(lease); return lease;
}
const exists = async (path: string) => stat(path).then(() => true, () => false);
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wa-auth-profile-')); target = join(root, 'current'); legacy = join(root, 'legacy');
    mocks.home = join(root, 'empty-home'); mocks.reads.length = 0; leases = [];
    mocks.failImportCommit = false; mocks.failStableMarker = false; mocks.failResetRename = false;
    mocks.get.mockReset().mockImplementation(async (_type: string, ids: string[]) => Object.fromEntries(ids.map(id => [id, Uint8Array.of(1)])));
    mocks.set.mockReset().mockResolvedValue(undefined);
    mocks.load.mockReset().mockImplementation(async (folder: string) => ({
        state: { creds: syntheticCredentials('new'), keys: { get: mocks.get, set: mocks.set } },
        saveCreds: async () => { await writeFile(join(folder, 'creds.json'), serializedCredentials('new')); }
    }));
});
afterEach(async () => {
    await Promise.allSettled(leases.map(lease => lease.release()));
    await rm(root, { recursive: true, force: true });
});

describe('guarded connect-time auth adoption', () => {
    it('migrates config/history offline but leaves auth and runtime controls untouched', async () => {
        await seed(join(legacy, 'auth'), 'legacy');
        await writeFile(join(legacy, 'config.json'), '{"allowList":[{"number":"+15550000001"}]}');
        await mkdir(join(legacy, 'recents')); await writeFile(join(legacy, 'recents/recents.json'), '{"synthetic":true}');
        await writeFile(join(legacy, 'auth.transport-lock'), '{"synthetic":"process"}');
        await writeFile(join(legacy, 'auth.auth-profile.json'), '{"version":99}');
        const manager = session(); await manager.ensureInitialized();
        expect(manager.getAllowList()).toEqual([{ number: '+15550000001', name: undefined, sendNumber: undefined }]);
        expect(await exists(join(target, 'recents/recents.json'))).toBe(true);
        expect(await manager.isRegistered()).toBe(true);
        expect(await exists(join(target, 'auth/creds.json'))).toBe(false);
        expect(await exists(join(target, 'auth.transport-lock'))).toBe(false);
        expect(await exists(join(target, 'auth.auth-profile.json'))).toBe(false);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it('discovers current saved state through metadata, not credential reads', async () => {
        const manager = session(); await seed(manager.getAuthStateDir(), 'current');
        mocks.reads.length = 0;
        expect(await manager.isRegistered()).toBe(true);
        expect(mocks.reads.some(path => path.endsWith('/creds.json'))).toBe(false);
    });
    it('rejects auth loading without a profile owner', async () => {
        await expect(session().getAuthState()).rejects.toThrow(/profile.*owner/i);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it('does not merge legacy keys into initialized current auth', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy'); await seed(manager.getAuthStateDir(), 'current');
        await manager.ensureInitialized(); const lease = await claim(manager);
        await manager.getAuthState(lease);
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(serializedCredentials('current'));
        expect(await exists(join(manager.getAuthStateDir(), 'session-legacy.json'))).toBe(false);
    });
    it('does not import auth into an owned destination during offline initialization', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy'); await claim(manager);
        await session().ensureInitialized();
        expect(await readdir(manager.getAuthStateDir())).toEqual([]);
    });
    it('adopts one complete profile only after owner acquisition, preserving originals', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy');
        const lease = await claim(manager); await manager.getAuthState(lease);
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(serializedCredentials('legacy'));
        expect(await readFile(join(legacy, 'auth/creds.json'), 'utf8')).toBe(serializedCredentials('legacy'));
        expect((await stat(join(manager.getAuthStateDir(), 'session-legacy.json'))).mode & 0o777).toBe(0o600);
        expect(await exists(join(legacy, 'auth.transport-lock'))).toBe(false);
        expect(await exists(manager.getAuthStateDir() + '.transport-lock')).toBe(true);
        expect(mocks.load).toHaveBeenCalledWith(lease.profileDir);
    });
    it('does not bypass a source owner or fall back to fresh state', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy');
        const sourceLease = await TransportLease.acquire(join(legacy, 'auth')); leases.push(sourceLease);
        const lease = await claim(manager);
        await expect(manager.getAuthState(lease)).rejects.toThrow(/profile.*(?:use|owner|lock)/i);
        expect(mocks.load).not.toHaveBeenCalled();
        expect(await readdir(manager.getAuthStateDir())).toEqual([]);
    });
    it('selects the group profile without borrowing default-profile credentials', async () => {
        const manager = session(); manager.setGroupJidForAuth('120363000001@g.us');
        await seed(join(legacy, 'auth'), 'default');
        await seed(join(legacy, basename(manager.getAuthStateDir())), 'group');
        const lease = await claim(manager); await manager.getAuthState(lease);
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(serializedCredentials('group'));
        expect(await exists(join(manager.getAuthStateDir(), 'session-default.json'))).toBe(false);
    });
    it('does not re-adopt legacy auth after explicit reset and restart', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy');
        const lease = await claim(manager); await manager.getAuthState(lease); await manager.deleteAuthState(lease);
        await manager.ensureInitialized();
        expect(await manager.isRegistered()).toBe(false);
        await manager.getAuthState(lease);
        expect(await readdir(manager.getAuthStateDir())).toEqual([]);
        expect(await readFile(join(legacy, 'auth/creds.json'), 'utf8')).toBe(serializedCredentials('legacy'));
    });
    it('does not expose credential fragments or silently replace corrupt state', async () => {
        const manager = session(); const lease = await claim(manager);
        const content = '{"synthetic":"PRIVATE_FIXTURE_FRAGMENT'; await writeFile(join(manager.getAuthStateDir(), 'creds.json'), content);
        const error = await manager.getAuthState(lease).catch(value => value);
        expect(error).toBeInstanceOf(Error); expect(error.message).not.toContain('PRIVATE_FIXTURE_FRAGMENT');
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(content);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it('does not silently initialize partial auth that is missing creds', async () => {
        const manager = session(); const lease = await claim(manager);
        await writeFile(join(manager.getAuthStateDir(), 'session-partial.json'), '{}');
        await expect(manager.getAuthState(lease)).rejects.toThrow(/auth|profile/i);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it.each([{ version: 99, state: 'stable' }, { version: 1, state: 'adopting' }, { version: 1, state: 'resetting' }])(
        'preserves unsupported/interrupted profile metadata (%j)', async marker => {
            const manager = session(); const lease = await claim(manager); const path = lease.profileDir + '.auth-profile.json';
            const content = JSON.stringify(marker); await writeFile(path, content);
            await expect(manager.getAuthState(lease)).rejects.toThrow(/auth|profile/i);
            expect(await readFile(path, 'utf8')).toBe(content); expect(mocks.load).not.toHaveBeenCalled();
        }
    );
    it('requires retirement before direct reset and rejects a non-owning reset', async () => {
        const manager = session(); await seed(manager.getAuthStateDir(), 'current'); const lease = await claim(manager);
        await expect(session().deleteAuthState()).rejects.toThrow(/profile.*use/i);
        const scope = lease.createScope(manager.getAuthStateDir());
        await expect(manager.deleteAuthState(lease)).rejects.toThrow(/closed|retire|active/i);
        expect(await exists(join(manager.getAuthStateDir(), 'creds.json'))).toBe(true); await scope.close();
    });
    it('avoids native early-rejection fanout by issuing one-key reads/writes', async () => {
        const manager = session(); const lease = await claim(manager);
        mocks.set.mockImplementation(async data => {
            if (Object.values(data).reduce((count: number, group) => count + Object.keys(group as object).length, 0) > 1) throw new Error('synthetic batch fanout');
        });
        mocks.get.mockImplementation(async (_type: string, ids: string[]) => {
            if (ids.length > 1) throw new Error('synthetic read fanout');
            return Object.fromEntries(ids.map(id => [id, Uint8Array.of(1)]));
        });
        const auth = await manager.getAuthState(lease);
        await expect(auth.state.keys.set({ session: { a: null, b: null } })).resolves.toBeUndefined();
        await expect(auth.state.keys.get('session', ['a', 'b'])).resolves.toEqual({ a: Uint8Array.of(1), b: Uint8Array.of(1) });
        expect(mocks.set).toHaveBeenCalledTimes(2); expect(mocks.get).toHaveBeenCalledTimes(2);
    });
    it.each([{ version: 99, state: 'stable' }, { version: 1, state: 'adopting' }, { version: 1, state: 'resetting' }])(
        'does not import a source with unsupported/interrupted metadata (%j)', async marker => {
            const manager = session(); await seed(join(legacy, 'auth'), 'legacy');
            await writeFile(join(legacy, 'auth.auth-profile.json'), JSON.stringify(marker));
            const lease = await claim(manager);
            await expect(manager.getAuthState(lease)).rejects.toThrow(/auth|profile/i);
            expect(await readdir(manager.getAuthStateDir())).toEqual([]);
            expect(mocks.load).not.toHaveBeenCalled();
        }
    );
    it('honors a prior source reset instead of falling back to an older namespace', async () => {
        const manager = session(); await mkdir(join(legacy, 'auth'), { recursive: true });
        await writeFile(join(legacy, 'auth.auth-profile.json'), '{"version":1,"state":"empty"}');
        await seed(join(mocks.home, '.pi/whatsapp-ng/auth'), 'older');
        expect(await manager.isRegistered()).toBe(false);
        const lease = await claim(manager); await manager.getAuthState(lease);
        expect(await readdir(manager.getAuthStateDir())).toEqual([]);
    });
    it('preserves originals and blocks startup after a failed adoption commit', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy'); const lease = await claim(manager);
        mocks.failImportCommit = true;
        await expect(manager.getAuthState(lease)).rejects.toThrow('synthetic import commit failure');
        expect(await readdir(manager.getAuthStateDir())).toEqual([]);
        expect((await readdir(target)).some(name => name.includes('.import-'))).toBe(false);
        expect(await readFile(join(legacy, 'auth/creds.json'), 'utf8')).toBe(serializedCredentials('legacy'));
        mocks.failImportCommit = false;
        await expect(manager.getAuthState(lease)).rejects.toThrow(/interrupted/i);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it('does not guess that an adopted snapshot is committed when its final marker fails', async () => {
        const manager = session(); await seed(join(legacy, 'auth'), 'legacy'); const lease = await claim(manager);
        mocks.failStableMarker = true;
        await expect(manager.getAuthState(lease)).rejects.toThrow('synthetic stable-marker failure');
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(serializedCredentials('legacy'));
        mocks.failStableMarker = false;
        await expect(manager.getAuthState(lease)).rejects.toThrow(/interrupted/i);
        expect(mocks.load).not.toHaveBeenCalled();
    });
    it('does not reuse auth after an interrupted reset and permits a subsequent explicit reset', async () => {
        const manager = session(); await seed(manager.getAuthStateDir(), 'current'); const lease = await claim(manager);
        await manager.getAuthState(lease); mocks.load.mockClear(); mocks.failResetRename = true;
        await expect(manager.deleteAuthState(lease)).rejects.toThrow('synthetic reset rename failure');
        expect(await readFile(join(manager.getAuthStateDir(), 'creds.json'), 'utf8')).toBe(serializedCredentials('current'));
        await expect(manager.getAuthState(lease)).rejects.toThrow(/interrupted/i);
        expect(mocks.load).not.toHaveBeenCalled();
        mocks.failResetRename = false; await manager.deleteAuthState(lease);
        expect(await manager.isRegistered()).toBe(false);
    });
    it.each(['current', 'legacy'])('rejects incomplete %s credential objects before native loading', async location => {
        const manager = session(); const lease = await claim(manager);
        const directory = location === 'current' ? manager.getAuthStateDir() : join(legacy, 'auth');
        await mkdir(directory, { recursive: true });
        for (const content of ['{}', JSON.stringify({ ...syntheticCredentials(), noiseKey: undefined }), JSON.stringify({ ...syntheticCredentials(), signedPreKey: { keyPair: {}, signature: [] } })]) {
            await writeFile(join(directory, 'creds.json'), content);
            await expect(manager.getAuthState(lease)).rejects.toThrow(/auth|profile/i);
            expect(await readFile(join(directory, 'creds.json'), 'utf8')).toBe(content);
            expect(mocks.load).not.toHaveBeenCalled();
        }
    });
    it('keeps runtime lease metadata out of generic migration', async () => {
        await seed(join(legacy, 'auth'), 'legacy');
        const lease = await TransportLease.acquire(join(legacy, 'auth')); leases.push(lease);
        await migrateLegacyStorage(createStoragePaths(target, legacy));
        expect(await exists(join(target, 'auth.transport-lock'))).toBe(false);
        expect(await exists(join(target, 'auth/creds.json'))).toBe(false);
    });
});
