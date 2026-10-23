import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SignalKeyStore } from 'baileys';
import { SessionManager } from '../../src/services/session.manager.ts';
import { WhatsAppService } from '../../src/services/whatsapp.service.ts';

type Auth = Awaited<ReturnType<SessionManager['getAuthState']>>;
interface SocketConfig { auth: { keys: SignalKeyStore } }
const mocks = vi.hoisted(() => ({
    sockets: [] as Array<{ config: SocketConfig; handlers: Map<string, (value: unknown) => Promise<void>>; end: ReturnType<typeof vi.fn> }>,
    makeWASocket: vi.fn()
}));
vi.mock('baileys', async importOriginal => ({
    ...await importOriginal<Record<string, unknown>>(),
    makeCacheableSignalKeyStore: (keys: SignalKeyStore) => keys,
    makeWASocket: mocks.makeWASocket
}));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return { promise, resolve };
}
class FixtureSession extends SessionManager {
    authReads = 0;
    keyWrites = 0;
    saves = 0;
    statusValue: ReturnType<SessionManager['getStatus']> = 'disconnected';
    authGate?: ReturnType<typeof deferred<Auth>>;
    saveGate?: ReturnType<typeof deferred<void>>;
    keyGate?: ReturnType<typeof deferred<void>>;
    readonly keyStarted = deferred<void>();
    readonly authStarted = deferred<void>();
    readonly saveStarted = deferred<void>();
    override async getAuthState(): Promise<Auth> {
        this.authReads++;
        this.authStarted.resolve();
        return this.authGate ? this.authGate.promise : this.auth();
    }
    auth(): Auth {
        return {
            state: {
                creds: { me: { id: '15550000001:1@s.whatsapp.net' }, registered: true } as Auth['state']['creds'],
                keys: { get: async () => ({}), set: async () => {
                    this.keyWrites++; this.keyStarted.resolve();
                    if (this.keyGate) await this.keyGate.promise;
                } }
            },
            saveCreds: async () => {
                this.saves++;
                this.saveStarted.resolve();
                if (this.saveGate) await this.saveGate.promise;
            }
        };
    }
    override getStatus() { return this.statusValue; }
    override async setStatus(value: ReturnType<SessionManager['getStatus']>) { this.statusValue = value; }
}
let directory: string;
let sessions: FixtureSession[];
let services: WhatsAppService[];
async function fixture(name = 'shared') {
    const root = join(directory, name);
    await mkdir(join(root, 'auth'), { recursive: true });
    const session = new FixtureSession(root, root);
    const service = new WhatsAppService(session);
    sessions.push(session); services.push(service);
    return { session, service };
}
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'wa-ownership-test-'));
    sessions = []; services = []; mocks.sockets.length = 0;
    mocks.makeWASocket.mockReset().mockImplementation((config: SocketConfig) => {
        const handlers = new Map<string, (value: unknown) => Promise<void>>();
        const socket = { config, handlers, end: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), ev: {
            on(event: string, handler: (value: unknown) => Promise<void>) { handlers.set(event, handler); },
            removeAllListeners(event: string) { handlers.delete(event); }
        } };
        mocks.sockets.push(socket);
        return socket;
    });
});
afterEach(async () => {
    for (const session of sessions) {
        session.authGate?.resolve(session.auth()); session.saveGate?.resolve(); session.keyGate?.resolve();
    }
    await Promise.allSettled(services.map(service => service.stop()));
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('per-profile transport ownership', () => {
    it('rejects a competing instance before its auth load or socket construction', async () => {
        const first = await fixture(); const second = await fixture();
        await first.service.start();
        await expect(second.service.start()).rejects.toThrow(/profile.*(?:use|lock|owner)/i);
        expect(second.session.authReads).toBe(0);
        expect(mocks.makeWASocket).toHaveBeenCalledTimes(1);
        await first.service.stop();
        await second.service.start();
        expect(second.session.authReads).toBe(1);
    });
    it('keeps independent profiles independent', async () => {
        const first = await fixture('a'); const second = await fixture('b');
        await first.service.start(); await second.service.start();
        expect(mocks.makeWASocket).toHaveBeenCalledTimes(2);
    });
    it('does not construct a socket when stopped during pending auth startup', async () => {
        const first = await fixture(); const second = await fixture();
        first.session.authGate = deferred<Auth>();
        const starting = first.service.start(); await first.session.authStarted.promise;
        const stopping = first.service.stop();
        await expect(second.service.start()).rejects.toThrow(/profile.*(?:use|lock|owner)/i);
        first.session.authGate.resolve(first.session.auth());
        await starting; await stopping;
        expect(mocks.makeWASocket).not.toHaveBeenCalled();
        await second.service.start();
        expect(mocks.makeWASocket).toHaveBeenCalledTimes(1);
    });
    it('fences delayed key-store calls after stop without writing auth', async () => {
        const { session, service } = await fixture();
        await service.start();
        const keys = mocks.sockets[0].config.auth.keys;
        await service.stop();
        await expect(keys.set({})).rejects.toThrow(/closed|retired|stopped/i);
        expect(session.keyWrites).toBe(0);
    });
    it('retains ownership while an admitted credential write is unsettled', async () => {
        const first = await fixture(); const second = await fixture();
        first.session.saveGate = deferred<void>();
        await first.service.start();
        const saving = mocks.sockets[0].handlers.get('creds.update')!({});
        await first.session.saveStarted.promise;
        const stopping = first.service.stop();
        await expect(second.service.start()).rejects.toThrow(/profile.*(?:use|lock|owner)/i);
        first.session.saveGate.resolve(); await saving; await stopping;
        await second.service.start();
        expect(second.session.authReads).toBe(1);
    });
    it('releases its own claim after startup failure', async () => {
        const first = await fixture(); const second = await fixture();
        mocks.makeWASocket.mockImplementationOnce(() => { throw new Error('synthetic socket failure'); });
        await expect(first.service.start()).rejects.toThrow('synthetic socket failure');
        await second.service.start();
        expect(second.session.authReads).toBe(1);
    });
    it('does not let an unowned disconnected instance delete another owner\'s auth', async () => {
        const first = await fixture(); const second = await fixture();
        const creds = join(first.session.getAuthStateDir(), 'creds.json');
        await writeFile(creds, '{"synthetic":true}', { mode: 0o600 });
        await first.service.start();
        await expect(second.service.logout()).rejects.toThrow(/profile.*(?:use|lock|owner)/i);
        expect((await stat(creds)).isFile()).toBe(true);
    });
    it('keeps retired keys fenced after a replacement socket becomes active', async () => {
        const { session, service } = await fixture();
        await service.start();
        const oldKeys = mocks.sockets[0].config.auth.keys;
        const oldCreds = mocks.sockets[0].handlers.get('creds.update')!;
        await service.start();
        const saves = session.saves;
        await oldCreds({});
        await expect(oldKeys.get('session', ['synthetic'])).rejects.toThrow(/closed/i);
        await expect(oldKeys.set({})).rejects.toThrow(/closed/i);
        expect(session.saves).toBe(saves);
        await mocks.sockets[1].config.auth.keys.set({});
        expect(session.keyWrites).toBe(1);
    });
    it('does not delete auth or unlock logout before admitted key writes settle', async () => {
        const first = await fixture(); const second = await fixture();
        const creds = join(first.session.getAuthStateDir(), 'creds.json');
        await writeFile(creds, '{"synthetic":true}', { mode: 0o600 });
        first.session.keyGate = deferred<void>();
        await first.service.start();
        const keys = mocks.sockets[0].config.auth.keys;
        const writing = keys.set({}); await first.session.keyStarted.promise;
        const loggingOut = first.service.logout();
        await expect(second.service.start()).rejects.toThrow(/profile.*(?:use|lock|owner)/i);
        expect((await stat(creds)).isFile()).toBe(true);
        first.session.keyGate.resolve(); await writing; await loggingOut;
        await expect(stat(creds)).rejects.toThrow();
        await expect(keys.set({})).rejects.toThrow(/closed/i);
        await second.service.start();
        expect(second.session.authReads).toBe(1);
    });
    it('creates owner-only storage/config under a permissive process umask', async () => {
        const previous = process.umask(0o022);
        try {
            const root = join(directory, 'permissions');
            const session = new SessionManager(root, root);
            await session.ensureInitialized(); await session.saveConfig();
            expect((await stat(root)).mode & 0o777).toBe(0o700);
            expect((await stat(join(root, 'auth'))).mode & 0o777).toBe(0o700);
            expect((await stat(join(root, 'config.json'))).mode & 0o777).toBe(0o600);
            await chmod(join(root, 'config.json'), 0o644);
            await session.ensureInitialized();
            expect((await stat(join(root, 'config.json'))).mode & 0o777).toBe(0o600);
        } finally { process.umask(previous); }
    });
});
