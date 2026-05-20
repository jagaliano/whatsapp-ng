import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { showMessageReplyView } from '../../src/ui/message-reply.view.ts';

const createContext = (edits: Array<string | undefined>) => {
    const queue = [...edits];

    return {
        ui: {
            editor: vi.fn(async () => queue.shift()),
            notify: vi.fn(),
            setWidget: vi.fn()
        }
    };
};

describe('showMessageReplyView', () => {
    beforeEach(() => {
        resetI18n();
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    it('sends the reply to the selected conversation and records it', async () => {
        const ctx = createContext(['Obrigada!']);
        const whatsappService = {
            resolveOutboundRecipientJid: vi.fn((recipient: string) => recipient.includes('@') ? recipient : `${recipient.slice(1)}@s.whatsapp.net`),
            sendMenuMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG-REPLY' })
        };
        const recentsService = {
            recordMessage: vi.fn().mockResolvedValue(undefined)
        };

        await showMessageReplyView(ctx as any, {
            selectedMessage: {
                messageId: 'MSG-1',
                senderNumber: '+5511999998888',
                senderName: 'Ana',
                text: 'Original message',
                direction: 'incoming',
                timestamp: 1111
            },
            whatsappService: whatsappService as any,
            recentsService: recentsService as any
        });

        expect(ctx.ui.setWidget).toHaveBeenCalledWith('message-reply-context', expect.any(Array), { placement: 'belowEditor' });
        expect(ctx.ui.editor).toHaveBeenCalledWith('Reply to Ana (+5511999998888)');
        expect(whatsappService.sendMenuMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Obrigada!');
        expect(recentsService.recordMessage).toHaveBeenCalledWith({
            messageId: 'MSG-REPLY',
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            text: 'Obrigada!',
            direction: 'outgoing',
            timestamp: 1234567890
        });
        expect(ctx.ui.notify).toHaveBeenCalledWith('Sent reply to Original message', 'info');
        expect(ctx.ui.setWidget).toHaveBeenCalledWith('message-reply-context', undefined);
    });

    it('rejects empty reply submissions and keeps the composer open', async () => {
        const ctx = createContext(['   ', 'Tudo certo']);
        const whatsappService = {
            resolveOutboundRecipientJid: vi.fn((recipient: string) => recipient.includes('@') ? recipient : `${recipient.slice(1)}@s.whatsapp.net`),
            sendMenuMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG-REPLY' })
        };
        const recentsService = {
            recordMessage: vi.fn().mockResolvedValue(undefined)
        };

        await showMessageReplyView(ctx as any, {
            selectedMessage: {
                messageId: 'MSG-1',
                senderNumber: '+5511999998888',
                senderName: 'Ana',
                text: 'Original message',
                direction: 'incoming',
                timestamp: 1111
            },
            whatsappService: whatsappService as any,
            recentsService: recentsService as any
        });

        expect(ctx.ui.notify).toHaveBeenCalledWith('Please enter a message before sending.', 'error');
        expect(whatsappService.sendMenuMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Tudo certo');
        expect(recentsService.recordMessage).toHaveBeenCalledOnce();
    });

    it('returns to the detail view when the user cancels', async () => {
        const ctx = createContext([undefined]);
        const whatsappService = {
            resolveOutboundRecipientJid: vi.fn((recipient: string) => recipient.includes('@') ? recipient : `${recipient.slice(1)}@s.whatsapp.net`),
            sendMenuMessage: vi.fn()
        };
        const recentsService = {
            recordMessage: vi.fn()
        };

        await showMessageReplyView(ctx as any, {
            selectedMessage: {
                messageId: 'MSG-1',
                senderNumber: '+5511999998888',
                senderName: 'Ana',
                text: 'Original message',
                direction: 'incoming',
                timestamp: 1111
            },
            whatsappService: whatsappService as any,
            recentsService: recentsService as any
        });

        expect(whatsappService.sendMenuMessage).not.toHaveBeenCalled();
        expect(recentsService.recordMessage).not.toHaveBeenCalled();
        expect(ctx.ui.setWidget).toHaveBeenCalledWith('message-reply-context', undefined);
    });

    it('resolves an allowed contact LID reply to its configured phone number', async () => {
        const ctx = createContext(['Oi pelo numero']);
        const whatsappService = {
            resolveOutboundRecipientJid: vi.fn().mockReturnValue('5511999998888@s.whatsapp.net'),
            sendMenuMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG-REPLY' })
        };
        const recentsService = {
            recordMessage: vi.fn().mockResolvedValue(undefined)
        };

        await showMessageReplyView(ctx as any, {
            selectedMessage: {
                messageId: 'MSG-1',
                senderNumber: '123456789@lid',
                senderName: 'Ana',
                text: 'Original message',
                direction: 'incoming',
                timestamp: 1111
            },
            whatsappService: whatsappService as any,
            recentsService: recentsService as any
        });

        expect(whatsappService.resolveOutboundRecipientJid).toHaveBeenCalledWith('123456789@lid');
        expect(whatsappService.sendMenuMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Oi pelo numero');
        expect(recentsService.recordMessage).toHaveBeenCalledWith(expect.objectContaining({
            senderNumber: '+5511999998888'
        }));
    });
});
