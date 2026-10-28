import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IncomingMessageEnvelope } from '../../src/models/whatsapp.types.ts';
import type { WAMessageKey } from 'baileys';
import type { SessionManager } from '../../src/services/session.manager.ts';
import { WhatsAppService } from '../../src/services/whatsapp.service.ts';

const message = (id: string, jid = '15550000001@s.whatsapp.net') => ({
    key: { id, remoteJid: jid, fromMe: false } as WAMessageKey,
    message: { conversation: `Text ${id}` },
    messageTimestamp: 1_700_000_000
});

describe('WhatsAppService intake', () => {
    let service: WhatsAppService;
    let callback: Mock<[IncomingMessageEnvelope], void | Promise<void>>;
    const session = {
        getStatus: () => 'connected',
        isConversationAllowed: (sender: string) => sender === '+15550000001',
        trackIgnoredNumber: vi.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new WhatsAppService(session as unknown as SessionManager);
        callback = vi.fn<[IncomingMessageEnvelope], void | Promise<void>>();
        service.setMessageCallback(callback);
    });

    it('routes native command votes through admitted live intake without storing protocol material or prompting', async () => {
        const poll = vi.fn(); service.setPollVoteCallback(poll);
        const vote = { ...message('vote'), message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'menu', remoteJid: '15550000001@s.whatsapp.net', fromMe: true },
            vote: { encIv: Buffer.alloc(12), encPayload: Buffer.alloc(32) } } } };
        const store = (service as any).messageStore;
        const put = vi.spyOn(store, 'put'); const recorder = vi.fn(); service.setIncomingMessageRecorder(recorder);
        await service.handleIncomingMessages({ type: 'notify', messages: [vote, vote] });
        expect(poll).toHaveBeenCalledOnce(); expect(callback).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(recorder).not.toHaveBeenCalled();
        expect(service.getIncomingProcessingState(vote.key)).toBe('consumed');
    });

    it('ignores imported, unallowed and wrong-bound-group votes and poll creation echoes', async () => {
        const poll = vi.fn(); service.setPollVoteCallback(poll);
        const vote = { ...message('vote'), message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'menu' } } } };
        await service.handleIncomingMessages({ type: 'append', messages: [vote] });
        await service.handleIncomingMessages({ type: 'notify', messages: [{ ...vote, key: { ...vote.key, remoteJid: '15550000002@s.whatsapp.net' } }] });
        await service.handleIncomingMessages({ type: 'notify', messages: [{ ...message('poll'), message: { pollCreationMessageV3: { name: 'Menu' }, messageContextInfo: { messageSecret: Buffer.alloc(32) } } }] });
        service.setGroupBinding('120363000000@g.us');
        await service.handleIncomingMessages({ type: 'notify', messages: [vote] });
        expect(poll).not.toHaveBeenCalled(); expect(callback).not.toHaveBeenCalled();
    });

    it('resolves direct authors from transport keys, never displayed sender or participant claims', () => {
        const peer = '15550000001@s.whatsapp.net';
        expect(service.resolveIncomingActor({ remoteJid: peer, fromMe: false, participant: '15559999999@s.whatsapp.net' })).toBe(peer);
        expect(service.resolveIncomingActor({ remoteJid: peer })).toBeUndefined();
        expect(service.resolveIncomingActor({ remoteJid: 'status@broadcast', fromMe: false })).toBeUndefined();
    });

    it('requires an actual person participant for incoming group authors', () => {
        const group = '120363000000001@g.us';
        expect(service.resolveIncomingActor({ remoteJid: group, fromMe: false, participant: '90000000001@lid' })).toBe('90000000001@lid');
        expect(service.resolveIncomingActor({ remoteJid: group, fromMe: false })).toBeUndefined();
        expect(service.resolveIncomingActor({ remoteJid: group, fromMe: false, participant: group })).toBeUndefined();
    });

    it('attributes own-direction messages to the verified account rather than the recipient', () => {
        const recipient = '15550000001@s.whatsapp.net';
        expect(service.resolveIncomingActor({ remoteJid: recipient, fromMe: true })).toBeUndefined();
        Object.assign(service, { socket: { user: { id: '15559999999:7@s.whatsapp.net' } } });
        expect(service.resolveIncomingActor({ remoteJid: recipient, fromMe: true })).toBe('15559999999@s.whatsapp.net');
        expect(service.resolveIncomingActor({ remoteJid: '120363000000001@g.us', participant: recipient, fromMe: true })).toBe('15559999999@s.whatsapp.net');
    });

    it('reuses only a retained same-group image, not quoted payloads or foreign authors/chats', () => {
        const group = '120363000001@g.us'; const participant = '15550000001@s.whatsapp.net';
        const image = { url: 'https://fixture.invalid/retained', mediaKey: Buffer.alloc(32), mimetype: 'image/png' };
        (service as any).messageStore.put({ key: { id: 'image', remoteJid: group, participant, fromMe: false }, message: { imageMessage: image }, messageTimestamp: Math.floor(Date.now() / 1000) });
        const request = (contextInfo: any) => ({ ...message('reply', group), message: { extendedTextMessage: { text: 'explain', contextInfo } } });
        const context = { stanzaId: 'image', participant, quotedMessage: { imageMessage: { url: 'https://untrusted.invalid' } } };
        expect(service.getIncomingQuotedImage(request(context))?.url).toBe(image.url);
        expect(service.getIncomingQuotedImage(request({ ...context, stanzaId: 'missing' }))).toBeUndefined();
        expect(service.getIncomingQuotedImage(request({ ...context, participant: '15550000002@s.whatsapp.net' }))).toBeUndefined();
        expect(service.getIncomingQuotedImage(request({ ...context, remoteJid: '120363000002@g.us' }))).toBeUndefined();
    });
    it.each(['view-once', 'expired', 'deleted'])('does not recover %s quote image content', kind => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_900_000_000_000);
        try {
            const group = '120363000001@g.us'; const participant = '15550000001@s.whatsapp.net';
            const key = { id: 'restricted', remoteJid: group, participant, fromMe: false };
            (service as any).messageStore.put({ key, message: { imageMessage: { url: 'https://fixture.invalid', mediaKey: Buffer.alloc(32), viewOnce: kind === 'view-once', contextInfo: { expiration: 1 } } }, messageTimestamp: Date.now() / 1000 });
            if (kind === 'deleted') service.invalidateMessage(key); if (kind === 'expired') clock.mockReturnValue(1_900_000_001_001);
            expect(service.getIncomingQuotedImage({ ...message('reply', group), message: { extendedTextMessage: { contextInfo: { stanzaId: key.id, participant } } } })).toBeUndefined();
        } finally { clock.mockRestore(); }
    });
    it('recognizes authenticated own PN/LID aliases without guessing digits', () => {
        Object.assign(service, { socket: { user: { id: '15550000001:4@s.whatsapp.net', lid: '90000000001:2@lid' } } });
        expect(service.isOwnJid('15550000001@s.whatsapp.net')).toBe(true); expect(service.isOwnJid('90000000001@lid')).toBe(true);
        expect(service.isOwnJid('15550000001@lid')).toBe(false); expect(service.isOwnJid('15550000002@s.whatsapp.net')).toBe(false);
        expect(service.isOwnJid('120363000000@g.us')).toBe(false);
    });
    it.each(['socket', 'transport'])('accepts manual self Pi-suffix text using %s aliases and rejects registered echoes', async aliases => {
        Object.assign(service, { socket: { user: { id: '15550000001@s.whatsapp.net', ...(aliases === 'socket' ? { lid: '90000000001@lid' } : {}) } } });
        const manual = { ...message('manual-self'), key: { id: 'manual-self', remoteJid: '90000000001@lid', fromMe: true, ...(aliases === 'transport' ? { remoteJidAlt: '15550000001@s.whatsapp.net' } : {}) }, message: { conversation: 'Explain π' } };
        await service.handleIncomingMessages({ type: 'notify', messages: [manual] }); expect(callback).toHaveBeenCalledOnce();
        service.registerOutgoing('90000000001@lid', 'registered-self');
        await service.handleIncomingMessages({ type: 'notify', messages: [{ ...manual, key: { ...manual.key, id: 'registered-self' } }] });
        expect(callback).toHaveBeenCalledOnce();
    });
    it('delivers each eligible item as one message, not a batch', async () => {
        await service.handleIncomingMessages({ type: 'notify', messages: [message('A'), message('B')] });
        expect(callback.mock.calls.map(([item]) => item.key.id)).toEqual(['A', 'B']);
    });

    it('does not lose a valid item after malformed or unauthorized items', async () => {
        await service.handleIncomingMessages({ type: 'notify', messages: [
            { key: {}, message: { conversation: 'Malformed' } },
            message('ignored', '15550000002@s.whatsapp.net'),
            message('valid')
        ] });
        expect(callback.mock.calls.map(([item]) => item.key.id)).toEqual(['valid']);
    });

    it('imports append and requestId resends without live callbacks', async () => {
        const record = vi.fn();
        service.setIncomingMessageRecorder(record);
        await service.handleIncomingMessages({ type: 'append', messages: [message('history')] });
        await service.handleIncomingMessages({ type: 'notify', requestId: 'resend', messages: [message('resend')] });
        expect(callback).not.toHaveBeenCalled();
        expect(record).toHaveBeenCalledTimes(2);
    });

    it('reserves before awaiting processing and suppresses concurrent redelivery', async () => {
        let finish!: () => void;
        let entered!: () => void;
        const callbackEntered = new Promise<void>(resolve => { entered = resolve; });
        callback.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; entered(); }));
        const batch = { type: 'notify' as const, messages: [message('same')] };
        const processing = service.handleIncomingMessages(batch);
        await callbackEntered;
        await service.handleIncomingMessages(batch);
        expect(callback).toHaveBeenCalledTimes(1);
        finish();
        await processing;
    });

    it('isolates processing failures and does not replay a failed ID automatically', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        callback.mockRejectedValueOnce(new Error('Preparation failed'));
        await service.handleIncomingMessages({ type: 'notify', messages: [message('fails'), message('next')] });
        await service.handleIncomingMessages({ type: 'notify', messages: [message('fails')] });
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[1][0].key.id).toBe('next');
        vi.restoreAllMocks();
    });

    it('distinguishes preparation, fire-and-forget handoff and observed consumption', async () => {
        const item = message('states');
        callback.mockImplementation(() => {
            expect(service.getIncomingProcessingState(item.key)).toBe('reserved');
            service.markIncomingProcessing(item.key, 'prepared');
            service.markIncomingProcessing(item.key, 'handed-off');
        });
        await service.handleIncomingMessages({ type: 'notify', messages: [item] });
        expect(service.getIncomingProcessingState(item.key)).toBe('handed-off');
        service.markIncomingProcessing(item.key, 'consumed');
        expect(service.getIncomingProcessingState(item.key)).toBe('consumed');
    });

    it('expires replay protection after 24 hours without an age cutoff on ordinary notify', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        try {
            const batch = { type: 'notify' as const, messages: [message('old-notify')] };
            await service.handleIncomingMessages(batch);
            await service.handleIncomingMessages(batch);
            expect(callback).toHaveBeenCalledTimes(1);
            now.mockReturnValue(1_800_000_000_000 + 24 * 60 * 60 * 1000);
            await service.handleIncomingMessages(batch);
            expect(callback).toHaveBeenCalledTimes(2);
        } finally {
            now.mockRestore();
        }
    });

    it('uses a verified alternate phone for authorization but keeps the LID transport key', async () => {
        const first = message('alias', '999999999@lid');
        first.key = { ...first.key, remoteJidAlt: '15550000001@s.whatsapp.net' };
        await service.handleIncomingMessages({ type: 'notify', messages: [first] });
        await service.handleIncomingMessages({ type: 'notify', messages: [message('alias')] });
        expect(callback).toHaveBeenCalledOnce();
        expect(callback.mock.calls[0][0]).toMatchObject({
            key: { remoteJid: '999999999@lid' }, senderNumber: '+15550000001'
        });
    });

    it('never treats an unmapped LID as an allowed phone number', async () => {
        await service.handleIncomingMessages({ type: 'notify', messages: [message('unknown', '15550000001@lid')] });
        expect(callback).not.toHaveBeenCalled();
        expect(session.trackIgnoredNumber).toHaveBeenCalledWith('15550000001@lid', undefined);
    });

    it('suppresses an extension-owned image echo before a send response exists', async () => {
        const item = message('own-echo');
        item.key.fromMe = true;
        service.registerOutgoing(item.key.remoteJid!, item.key.id!);
        await service.handleIncomingMessages({ type: 'notify', messages: [{ ...item, message: { imageMessage: { caption: 'no branding' } } }] });
        expect(callback).not.toHaveBeenCalled();
    });

    it('uses complete group keys for read receipts and refuses missing participants', async () => {
        const readMessages = vi.fn().mockResolvedValue(undefined);
        Object.assign(service, { socket: { readMessages } });
        const key = { remoteJid: '120363000000@g.us', id: 'group', fromMe: false, participant: '999@lid', participantAlt: '15550000001@s.whatsapp.net' };
        await service.markRead(key);
        expect(readMessages).toHaveBeenCalledWith([key]);
        await service.markRead({ ...key, participant: undefined });
        expect(readMessages).toHaveBeenCalledOnce();
    });

    it.each(['new-account', 'back-to-original'])('does not revive an old batch after %s account transitions', async mode => {
        const socket = { user: { id: '15559999991@s.whatsapp.net' } };
        Object.assign(service, { socket });
        let firstStarted!: () => void;
        let finishFirst!: () => void;
        const started = new Promise<void>(resolve => { firstStarted = resolve; });
        callback.mockImplementationOnce(async () => {
            firstStarted();
            await new Promise<void>(resolve => { finishFirst = resolve; });
        });
        const processing = service.handleIncomingMessages({ type: 'notify', messages: [message('first'), message('stale-second')] });
        await started;
        socket.user.id = '15559999992@s.whatsapp.net';
        await service.handleIncomingMessages({ type: 'notify', messages: [] });
        if (mode === 'back-to-original') {
            socket.user.id = '15559999991@s.whatsapp.net';
            await service.handleIncomingMessages({ type: 'notify', messages: [] });
        }
        finishFirst();
        await processing;
        expect(callback).toHaveBeenCalledOnce();
    });

    it('preserves admitted batch work across a same-account transport reconnect', async () => {
        Object.assign(service, { socket: { user: { id: '15559999991:1@s.whatsapp.net' } } });
        let firstStarted!: () => void;
        let finishFirst!: () => void;
        const started = new Promise<void>(resolve => { firstStarted = resolve; });
        callback.mockImplementationOnce(async () => {
            firstStarted();
            await new Promise<void>(resolve => { finishFirst = resolve; });
        });
        const processing = service.handleIncomingMessages({ type: 'notify', messages: [message('first'), message('second')] });
        await started;
        Object.assign(service, { socket: { user: { id: '15559999991:2@s.whatsapp.net' } } });
        await service.handleIncomingMessages({ type: 'notify', messages: [] });
        finishFirst();
        await processing;
        expect(callback.mock.calls.map(([item]) => item.key.id)).toEqual(['first', 'second']);
    });

    it.each(['different-account', 'same-account'])('rejects a late LID lookup from the previous socket after %s reconnect', async mode => {
        let lookupStarted!: () => void;
        let finishLookup!: (phone: string) => void;
        const started = new Promise<void>(resolve => { lookupStarted = resolve; });
        const getPNForLID = vi.fn(() => {
            lookupStarted();
            return new Promise<string>(resolve => { finishLookup = resolve; });
        });
        Object.assign(service, { socket: {
            user: { id: '15559999991@s.whatsapp.net' }, signalRepository: { lidMapping: { getPNForLID } }
        } });
        const lid = '999999999@lid';
        const processing = service.handleIncomingMessages({ type: 'notify', messages: [message('late-lookup', lid)] });
        await started;
        Object.assign(service, { socket: { user: { id: mode === 'same-account' ? '15559999991:2@s.whatsapp.net' : '15559999992@s.whatsapp.net' } } });
        await service.handleIncomingMessages({ type: 'notify', messages: [] });
        finishLookup('15550000001@s.whatsapp.net');
        await processing;
        expect(service.canonicalConversation(lid)).toBe(lid);
        await service.handleIncomingMessages({ type: 'notify', messages: [message('new-account-unmapped', lid)] });
        expect(callback).not.toHaveBeenCalled();
    });

    it('accepts ordinary incoming text ending in π', async () => {
        const record = vi.fn();
        service.setIncomingMessageRecorder(record);
        await service.handleIncomingMessages({ type: 'notify', messages: [{ ...message('math'), message: { conversation: 'Calculate 2π' } }] });
        expect(callback).toHaveBeenCalledOnce();
        expect(record).toHaveBeenCalledWith(expect.objectContaining({ text: 'Calculate 2π' }));
    });

    it('never prompts for system or reaction updates', async () => {
        await service.handleIncomingMessages({ type: 'notify', messages: [
            { ...message('protocol'), message: { protocolMessage: { type: 0 } } },
            { ...message('reaction'), message: { reactionMessage: { text: '👍', key: message('target').key } } }
        ] });
        expect(callback).not.toHaveBeenCalled();
    });
});
