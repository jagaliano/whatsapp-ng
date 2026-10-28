import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WhatsAppService as ServiceUnderTest } from '../../src/services/whatsapp.service.ts';

let profileRoot: string;
const liveServices = new Set<ServiceUnderTest>();

const baileysMocks = vi.hoisted(() => {
    const socket = {
        ev: {
            on: vi.fn(),
            removeAllListeners: vi.fn()
        },
        end: vi.fn()
    };

    return {
        socket,
        makeWASocket: vi.fn((_options: unknown) => socket),
        fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 3000, 0] }),
        makeCacheableSignalKeyStore: vi.fn((_keys, _logger) => _keys)
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

describe('WhatsAppService console filtering', () => {
    beforeEach(() => {
        profileRoot = mkdtempSync(join(tmpdir(), 'wa-console-'));
        vi.clearAllMocks();
        const start = ServiceUnderTest.prototype.start;
        vi.spyOn(ServiceUnderTest.prototype, 'start').mockImplementation(function (this: ServiceUnderTest, options) {
            liveServices.add(this);
            return start.call(this, options);
        });
    });
    afterEach(async () => {
        await Promise.allSettled([...liveServices].map(service => service.stop()));
        liveServices.clear();
        rmSync(profileRoot, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

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
        setStatus: vi.fn().mockResolvedValue(undefined)
    });

    it('suppresses known Baileys decrypt noise after socket startup in quiet mode', async () => {
        const { WhatsAppService } = await import('../../src/services/whatsapp.service.ts');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const service = new WhatsAppService(createSessionManager() as any);

        await service.start();

        console.error('Failed to decrypt message with any known session...');
        console.error('[WhatsApp-NG] real runtime error');

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('[WhatsApp-NG] real runtime error');

        await service.stop();
        errorSpy.mockRestore();
    });

    it('keeps the narrow noise filter through socket end and restores ordinary errors afterwards', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const service = new ServiceUnderTest(createSessionManager() as any); service.setVerboseMode(true); await service.start();
        baileysMocks.socket.end.mockImplementationOnce(() => console.error('Failed to decrypt message with any known session...'));
        await service.stop(); console.error('[WhatsApp-NG] ordinary error after stop');
        expect(errorSpy).toHaveBeenCalledExactlyOnceWith('[WhatsApp-NG] ordinary error after stop');
    });
    it('reports a send failure without printing the native error body', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { MessageSender } = await import('../../src/services/message.sender.ts');
        vi.spyOn(MessageSender.prototype, 'send').mockResolvedValueOnce({ success: false, attempts: 1, error: 'PRIVATE-C4-NATIVE-BODY' });
        const result = await new ServiceUnderTest(createSessionManager() as any).sendMessage('15550000001@s.whatsapp.net', 'PRIVATE-C4-ANSWER', true);
        expect(result.success).toBe(false); expect(errorSpy).toHaveBeenCalledExactlyOnceWith('[WhatsApp-NG] Message send failed');
    });
    it('does not blanket-mute ordinary errors during asynchronous socket construction', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        baileysMocks.makeWASocket.mockImplementationOnce(() => { console.error('[WhatsApp-NG] startup application error'); return baileysMocks.socket; });
        const service = new ServiceUnderTest(createSessionManager() as any); await service.start();
        expect(errorSpy).toHaveBeenCalledWith('[WhatsApp-NG] startup application error');
    });
    it('keeps secret-bearing protocol noise filtered even in metadata-verbose mode', async () => {
        const { WhatsAppService } = await import('../../src/services/whatsapp.service.ts');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const service = new WhatsAppService(createSessionManager() as any);
        service.setVerboseMode(true);

        await service.start();

        console.error('Failed to decrypt message with any known session...');

        console.error('[WhatsApp-NG] ordinary application error');
        expect(errorSpy).toHaveBeenCalledExactlyOnceWith('[WhatsApp-NG] ordinary application error');
        const options = baileysMocks.makeWASocket.mock.calls[0]?.[0] as any;
        expect(options.logger.level).toBe('silent');

        await service.stop();
        errorSpy.mockRestore();
    });
});
