import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rename, stat, lstat, symlink, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateMigrationService } from '../../src/services/state-migration.service.js';
import { MessageStore } from '../../src/services/message-store.service.js';
import { JidResolver } from '../../src/services/jid-resolver.service.js';
import { SessionManager } from '../../src/services/session.manager.js';
import { WhatsAppService } from '../../src/services/whatsapp.service.js';
import { RecentsService } from '../../src/services/recents.service.js';

let root: string, source: string, destination: string;
const absent = async (path: string) => access(path).then(() => false, () => true);
async function fixture() {
    await mkdir(join(source, 'auth'), { recursive: true, mode: 0o700 });
    await mkdir(join(source, 'auth-group'), { mode: 0o700 });
    await mkdir(join(source, 'whatsapp-medias'), { mode: 0o700 });
    await writeFile(join(source, 'config.json'), JSON.stringify({ allowList: [{ number: '+15550000002', name: 'Fixture', sendNumber: '+15550000003' }], ignoredNumbers: [], status: 'disconnected', hasAuthState: true }), { mode: 0o600 });
    await writeFile(join(source, 'auth/creds.json'), 'SYNTHETIC_AUTH_BYTES_NOT_READ_OR_PARSED', { mode: 0o600 });
    await writeFile(join(source, 'auth-group/creds.json'), 'GROUP_SYNTHETIC_AUTH_BYTES', { mode: 0o600 });
    await writeFile(join(source, 'auth.auth-profile.json'), JSON.stringify({ version: 1, state: 'stable' }), { mode: 0o600 });
    await writeFile(join(source, 'whatsapp-medias/document.txt'), 'fixture artifact', { mode: 0o600 });
    await writeFile(join(source, 'source.log'), 'historical log bytes\n', { mode: 0o600 });
}
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ng-migration-')); source = join(root, 'source'); destination = join(root, 'whatsapp-ng'); await fixture(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('explicit full-state migration', () => {
    it('queues without moving or reading auth and blocks destination initialization', async () => {
        await StateMigrationService.queue(source, destination);
        expect(await absent(destination)).toBe(true);
        expect(await readFile(join(source, 'auth/creds.json'), 'utf8')).toBe('SYNTHETIC_AUTH_BYTES_NOT_READ_OR_PARSED');
        expect(() => StateMigrationService.assertReady(destination)).toThrow(/migration/i);
        expect((await stat(StateMigrationService.pendingPath(destination))).mode & 0o777).toBe(0o600);
    });
    it('atomically moves all state, preserves profile bytes and renames the derived log', async () => {
        const config = await readFile(join(source, 'config.json'));
        await StateMigrationService.queue(source, destination);
        expect(await StateMigrationService.runPending(destination)).toBe(true);
        expect(await absent(source)).toBe(true);
        expect(await readFile(join(destination, 'config.json'))).toEqual(config);
        expect(await readFile(join(destination, 'auth/creds.json'), 'utf8')).toBe('SYNTHETIC_AUTH_BYTES_NOT_READ_OR_PARSED');
        expect(await readFile(join(destination, 'auth-group/creds.json'), 'utf8')).toBe('GROUP_SYNTHETIC_AUTH_BYTES');
        expect(await readFile(join(destination, 'whatsapp-medias/document.txt'), 'utf8')).toBe('fixture artifact');
        expect(await readFile(join(destination, 'whatsapp-ng.log'), 'utf8')).toBe('historical log bytes\n');
        expect(await absent(StateMigrationService.pendingPath(destination))).toBe(true);
        expect((await stat(destination)).mode & 0o777).toBe(0o700);
        expect(() => StateMigrationService.assertReady(destination)).not.toThrow();
        expect(await StateMigrationService.runPending(destination)).toBe(false);
    });
    it('refuses even an empty existing destination rather than merging', async () => {
        await mkdir(destination);
        await expect(StateMigrationService.queue(source, destination)).rejects.toThrow(/destination/i);
        expect(await absent(join(source, 'auth/creds.json'))).toBe(false);
    });
    it('refuses destination creation after queuing and retains the request/source', async () => {
        await StateMigrationService.queue(source, destination); await mkdir(destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/destination/i);
        expect(await absent(source)).toBe(false);
        expect(await absent(StateMigrationService.pendingPath(destination))).toBe(false);
    });
    it.each(['auth.transport-lock', 'archive/fixture.lock'])('does not move or steal runtime lock %s', async name => {
        await StateMigrationService.queue(source, destination);
        await mkdir(join(source, 'archive'), { recursive: true });
        await writeFile(join(source, name), JSON.stringify({ pid: process.pid }), { mode: 0o600 });
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/lock|owner|busy/i);
        expect(await absent(join(source, name))).toBe(false);
        expect(await absent(destination)).toBe(true);
    });
    it('does not steal a sibling migration lock', async () => {
        await StateMigrationService.queue(source, destination);
        await writeFile(destination + '.migration-lock', JSON.stringify({ pid: process.pid }));
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/lock|owner|busy/i);
        expect(await absent(destination + '.migration-lock')).toBe(false);
        expect(await absent(source)).toBe(false);
    });
    it('rejects symlink roots and nested auth links without following them', async () => {
        const alias = join(root, 'alias'); await symlink(source, alias);
        await expect(StateMigrationService.queue(alias, destination)).rejects.toThrow(/symlink|directory|path/i);
        await symlink(join(root, 'outside'), join(source, 'auth/foreign.json'));
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/symlink|file|path/i);
        expect((await lstat(join(source, 'auth/foreign.json'))).isSymbolicLink()).toBe(true);
    });
    it('rejects overlapping roots', async () => {
        await expect(StateMigrationService.queue(source, join(source, 'nested'))).rejects.toThrow(/overlap|path/i);
        await expect(StateMigrationService.queue(source, source)).rejects.toThrow(/overlap|path/i);
    });
    it('preserves unknown or malformed requests without fallback', async () => {
        const path = StateMigrationService.pendingPath(destination);
        await writeFile(path, '{"version":99}', { mode: 0o600 });
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/request|metadata|version/i);
        expect(await readFile(path, 'utf8')).toBe('{"version":99}');
        expect(await absent(source)).toBe(false);
    });
    it('rejects replacing the queued source with another directory', async () => {
        await StateMigrationService.queue(source, destination);
        await rename(source, source + '-original'); await mkdir(source);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/identity|changed/i);
        expect(await absent(destination)).toBe(true);
    });
    it('resumes a crash between root rename and journal update using directory identity', async () => {
        await StateMigrationService.queue(source, destination); await rename(source, destination);
        expect(await StateMigrationService.runPending(destination)).toBe(true);
        expect(await readFile(join(destination, 'auth/creds.json'), 'utf8')).toBe('SYNTHETIC_AUTH_BYTES_NOT_READ_OR_PARSED');
        expect(await absent(StateMigrationService.pendingPath(destination))).toBe(true);
    });
    it('never treats an unrelated destination as interrupted success', async () => {
        await StateMigrationService.queue(source, destination); await rename(source, source + '-original'); await mkdir(destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/identity|destination|source/i);
        expect(await absent(StateMigrationService.pendingPath(destination))).toBe(false);
    });
    it.each(['adopting', 'resetting'])('refuses interrupted auth metadata %s', async state => {
        await writeFile(join(source, 'auth.auth-profile.json'), JSON.stringify({ version: 1, state }));
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/profile|metadata|interrupted/i);
        expect(await absent(source)).toBe(false);
    });
    it('blocks configuration/auth/archive startup while a migration is pending', async () => {
        await StateMigrationService.queue(source, destination);
        const session = new SessionManager(destination, destination);
        const service = new WhatsAppService(session);
        const recents = new RecentsService(session); service.setRecentsService(recents);
        await expect(session.ensureInitialized()).rejects.toThrow(/migration/i);
        await expect(session.saveConfig()).rejects.toThrow(/migration/i);
        await expect(recents.ensureInitialized()).rejects.toThrow(/migration/i);
        await expect(service.start()).rejects.toThrow(/migration/i);
        await service.stop();
        expect(await absent(destination)).toBe(true);
    });
    it('treats a dangling request symlink as blocked, not a missing request', async () => {
        await symlink(join(root, 'absent'), StateMigrationService.pendingPath(destination));
        expect(() => StateMigrationService.assertReady(destination)).toThrow(/migration/i);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/metadata|request/i);
        expect((await lstat(StateMigrationService.pendingPath(destination))).isSymbolicLink()).toBe(true);
    });
    it('does not create directories on normal first startup without a pending request', async () => {
        const fresh = join(root, 'missing-parent', 'whatsapp-ng');
        expect(await StateMigrationService.runPending(fresh)).toBe(false);
        expect(await absent(join(root, 'missing-parent'))).toBe(true);
    });
    it.each(['{broken', '{"allowList":"invalid"}'])('refuses malformed configuration without overwriting it', async content => {
        await writeFile(join(source, 'config.json'), content);
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/configuration/i);
        expect(await readFile(join(source, 'config.json'), 'utf8')).toBe(content);
        expect(await absent(destination)).toBe(true);
    });
    it('refuses conflicting log names before moving either root or log', async () => {
        await writeFile(join(source, 'whatsapp-ng.log'), 'new log exists');
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/log conflict/i);
        expect(await readFile(join(source, 'source.log'), 'utf8')).toBe('historical log bytes\n');
        expect(await absent(destination)).toBe(true);
    });
    it('keeps an interrupted moved root blocked when a log conflict appears', async () => {
        await StateMigrationService.queue(source, destination); await rename(source, destination);
        await writeFile(join(destination, 'whatsapp-ng.log'), 'conflicting file');
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/log conflict/i);
        expect(await absent(StateMigrationService.pendingPath(destination))).toBe(false);
        expect(await readFile(join(destination, 'auth/creds.json'), 'utf8')).toBe('SYNTHETIC_AUTH_BYTES_NOT_READ_OR_PARSED');
    });
    it('refuses incomplete native profiles before moving the root', async () => {
        await rm(join(source, 'auth/creds.json')); await writeFile(join(source, 'auth/session-fragment.json'), '{}');
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.runPending(destination)).rejects.toThrow(/profile|incomplete/i);
        expect(await absent(source)).toBe(false);
    });
    it('does not overwrite an existing request with another source', async () => {
        await StateMigrationService.queue(source, destination);
        const before = await readFile(StateMigrationService.pendingPath(destination));
        const other = join(root, 'other'); await mkdir(other);
        await expect(StateMigrationService.queue(other, destination)).rejects.toThrow(/source request/i);
        expect(await readFile(StateMigrationService.pendingPath(destination))).toEqual(before);
    });
    it('does not manufacture a log conflict when shutting down an interrupted moved root', async () => {
        const home = join(root, 'home'); const target = join(home, '.pi', 'agent', 'extensions', 'whatsapp-ng');
        await mkdir(dirname(target), { recursive: true });
        await StateMigrationService.queue(source, target); await rename(source, target);
        vi.stubEnv('HOME', home); vi.resetModules();
        try {
            const { WhatsAppService: FreshService } = await import('../../src/services/whatsapp.service.js');
            const service = new FreshService(new SessionManager(target, target));
            await service.stop();
            expect(await absent(join(target, 'whatsapp-ng.log'))).toBe(true);
            expect(await StateMigrationService.runPending(target)).toBe(true);
            expect(await readFile(join(target, 'whatsapp-ng.log'), 'utf8')).toBe('historical log bytes\n');
        } finally { vi.unstubAllEnvs(); }
    });
    it('preserves group auth profile markers without treating them as directories', async () => {
        const marker = JSON.stringify({ version: 1, state: 'stable' });
        const groupBytes = await readFile(join(source, 'auth-group/creds.json'));
        await writeFile(join(source, 'auth-group.auth-profile.json'), marker, { mode: 0o600 });
        await StateMigrationService.queue(source, destination);
        expect(await StateMigrationService.runPending(destination)).toBe(true);
        expect(await readFile(join(destination, 'auth-group.auth-profile.json'), 'utf8')).toBe(marker);
        expect(await readFile(join(destination, 'auth-group/creds.json'))).toEqual(groupBytes);
    });
    it('consumes startup migration once across module recreation', async () => {
        expect(await StateMigrationService.startOnce(destination, source)).toBe(true);
        vi.resetModules(); const { StateMigrationService: fresh } = await import('../../src/services/state-migration.service.js');
        expect(await fresh.startOnce(destination, source)).toBe(false);
        expect(await absent(source)).toBe(true);
    });
    it('does not accept a newly queued migration during a later session in the same process', async () => {
        expect(await StateMigrationService.startOnce(destination)).toBe(false);
        await StateMigrationService.queue(source, destination);
        await expect(StateMigrationService.startOnce(destination)).rejects.toThrow(/migration/i);
        expect(await absent(source)).toBe(false); expect(await absent(destination)).toBe(true);
    });
    it('keeps a failed cold-start attempt blocked until a fresh process', async () => {
        await writeFile(join(source, 'config.json'), '{broken');
        await expect(StateMigrationService.startOnce(destination, source)).rejects.toThrow(/configuration/i);
        await writeFile(join(source, 'config.json'), JSON.stringify({ allowList: [] }));
        await expect(StateMigrationService.startOnce(destination, source)).rejects.toThrow(/configuration/i);
        expect(await absent(destination)).toBe(true);
    });
    it('preserves archive scope and quote identity across the absolute root move', async () => {
        const account = '15550000001@s.whatsapp.net'; let scope = JSON.stringify([join(source, 'auth'), account]);
        const store = new MessageStore(new JidResolver(), () => scope);
        await store.initialize({ root: join(source, 'archive'), authProfile: 'auth', legacyPath: join(source, 'recents/recents.json') });
        await store.activate(account, scope);
        store.put({ key: { remoteJid: '15550000002@s.whatsapp.net', id: 'anchor', fromMe: true }, message: { conversation: 'fixture preserved quote' } });
        await store.flush(); const id = store.getArchiveState().scopeId; await store.close();
        await StateMigrationService.queue(source, destination); await StateMigrationService.runPending(destination);
        scope = JSON.stringify([join(destination, 'auth'), account]);
        const restored = new MessageStore(new JidResolver(), () => scope);
        await restored.initialize({ root: join(destination, 'archive'), authProfile: 'auth', legacyPath: join(destination, 'recents/recents.json') });
        expect(restored.getArchiveState().scopeId).toBe(id);
        expect(restored.find('15550000002@s.whatsapp.net', 'anchor', { fromMe: true })?.message).toEqual({ conversation: 'fixture preserved quote' });
        await restored.close();
    });
});
