import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WhatsAppService as ServiceUnderTest } from '../../src/services/whatsapp.service.ts';

let profileRoot: string;
const liveServices = new Set<ServiceUnderTest>();

async function settleStartedReconnect() {
    // Advancing fake timers does not itself await the real filesystem lease work.
    const result = vi.mocked(ServiceUnderTest.prototype.start).mock.results.at(-1);
    if (result?.type === 'return') await result.value.catch(() => {});
}

const baileysMocks = vi.hoisted(() => {
    const sockets: any[] = [];

    const createSocket = () => {
        const handlers = new Map<string, (event: any) => Promise<void>>();
        const socket = {
            handlers,
            ev: {
                on: vi.fn((event: string, handler: (event: any) => Promise<void>) => {
                    handlers.set(event, handler);
                }),
                removeAllListeners: vi.fn()
            },
            end: vi.fn()
        };
        sockets.push(socket);
        return socket;
    };

    return {
        sockets,
        makeWASocket: vi.fn(() => createSocket()),
        fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 3000, 0] }),
        makeCacheableSignalKeyStore: vi.fn((_keys, _logger) => _keys),
        reset() {
            sockets.length = 0;
            this.makeWASocket.mockReset().mockImplementation(() => createSocket());
            this.fetchLatestBaileysVersion.mockReset().mockResolvedValue({ version: [2, 3000, 0] });
            this.makeCacheableSignalKeyStore.mockReset().mockImplementation((_keys, _logger) => _keys);
        }
    };
});

vi.mock('baileys', () => ({
    makeWASocket: baileysMocks.makeWASocket,
    fetchLatestBaileysVersion: baileysMocks.fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore: baileysMocks.makeCacheableSignalKeyStore,
    DisconnectReason: {
        loggedOut: 401,
        badSession: 500,
        connectionReplaced: 440
    }
}));

const createSessionManager = () => ({
    getAuthStateDir: vi.fn().mockReturnValue(join(profileRoot, 'auth')),
    getAuthState: vi.fn().mockResolvedValue({
        state: {
            creds: {},
            keys: {}
        },
        saveCreds: vi.fn().mockResolvedValue(undefined)
    }),
    markAuthStateAvailable: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue('connected'),
    setStatus: vi.fn().mockResolvedValue(undefined),
    deleteAuthState: vi.fn().mockResolvedValue(undefined),
    isAllowed: vi.fn().mockReturnValue(true),
    isConversationAllowed: vi.fn().mockReturnValue(true)
});

describe('WhatsAppService auth failure handling', () => {
    beforeEach(() => {
        profileRoot = mkdtempSync(join(tmpdir(), 'wa-auth-failure-'));
        resetI18n();
        baileysMocks.reset();
        const start = ServiceUnderTest.prototype.start;
        vi.spyOn(ServiceUnderTest.prototype, 'start').mockImplementation(function (this: ServiceUnderTest, options) {
            liveServices.add(this);
            return start.call(this, options);
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(async () => {
        await Promise.allSettled([...liveServices].map(service => service.stop()));
        liveServices.clear();
        vi.useRealTimers();
        rmSync(profileRoot, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('clears rejected saved auth and restarts pairing on manual connect failure', async () => {
        const { WhatsAppService } = await import('../../src/services/whatsapp.service.ts');
        const sessionManager = createSessionManager();
        const service = new WhatsAppService(sessionManager as any);
        const statusCallback = vi.fn();
        service.setStatusCallback(statusCallback);

        await service.start();
        await baileysMocks.sockets[0].handlers.get('connection.update')!({
            connection: 'close',
            lastDisconnect: {
                error: {
                    message: 'logged out',
                    output: { statusCode: 401 }
                }
            }
        });

        expect(sessionManager.deleteAuthState).toHaveBeenCalledOnce();
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(2);
        expect(statusCallback).toHaveBeenCalledWith('Session rejected [401] - clearing auth state and starting pairing');
        expect(statusCallback).toHaveBeenCalledWith('| WhatsApp: Connecting...');

        await service.stop();
    });

    it('does not clear auth or start pairing on auto-connect auth failure', async () => {
        const { WhatsAppService } = await import('../../src/services/whatsapp.service.ts');
        const sessionManager = createSessionManager();
        const service = new WhatsAppService(sessionManager as any);
        const statusCallback = vi.fn();
        service.setStatusCallback(statusCallback);

        await service.start({ allowPairingOnAuthFailure: false });
        await baileysMocks.sockets[0].handlers.get('connection.update')!({
            connection: 'close',
            lastDisconnect: {
                error: {
                    message: 'logged out',
                    output: { statusCode: 401 }
                }
            }
        });

        expect(sessionManager.deleteAuthState).not.toHaveBeenCalled();
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(1);
        expect(sessionManager.setStatus).toHaveBeenCalledWith('logged-out');
        expect(statusCallback).toHaveBeenCalledWith('| WhatsApp: Disconnected');

        await service.stop();
    });

    it('backs off reconnect attempts and preserves credentials before replacing socket', async () => {
        vi.useFakeTimers();
        const { WhatsAppService } = await import('../../src/services/whatsapp.service.ts');
        const authState = await createSessionManager().getAuthState();
        const sessionManager = {
            ...createSessionManager(),
            getAuthState: vi.fn().mockResolvedValue(authState)
        };
        const service = new WhatsAppService(sessionManager as any);
        const statusCallback = vi.fn();
        service.setStatusCallback(statusCallback);

        await service.start();
        await baileysMocks.sockets[0].handlers.get('connection.update')!({
            connection: 'close',
            lastDisconnect: {
                error: {
                    message: 'connection lost',
                    output: { statusCode: 408 }
                }
            }
        });

        expect(authState.saveCreds).toHaveBeenCalledOnce();
        expect(baileysMocks.sockets[0].end).toHaveBeenCalledOnce();
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(4_999);
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        await settleStartedReconnect();
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(2);

        await baileysMocks.sockets[1].handlers.get('connection.update')!({
            connection: 'close',
            lastDisconnect: {
                error: {
                    message: 'connection lost',
                    output: { statusCode: 408 }
                }
            }
        });

        await vi.advanceTimersByTimeAsync(9_999);
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1);
        await settleStartedReconnect();
        expect(baileysMocks.makeWASocket).toHaveBeenCalledTimes(3);
        expect(statusCallback).toHaveBeenCalledWith('| WhatsApp: Reconnecting...');

        await service.stop();
    });
});
