import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { ReactionSender } from '../../src/services/reaction.sender.ts';

describe('ReactionSender', () => {
    beforeEach(() => {
        resetI18n();
    });

    it('sends reaction successfully', async () => {
        const mockSocket = {
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'reaction123' } })
        };
        const sender = new ReactionSender(mockSocket as any);

        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: '👍'
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('reaction123');
        expect(mockSocket.sendMessage).toHaveBeenCalledWith(
            '123@s.whatsapp.net',
            {
                react: {
                    text: '👍',
                    key: {
                        remoteJid: '123@s.whatsapp.net',
                        id: 'msg123',
                        fromMe: false
                    }
                }
            }
        );
    });

    it('rejects invalid emoji', async () => {
        const sender = new ReactionSender({} as any);

        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: 'invalid'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid emoji');
    });

    it('returns error when not connected', async () => {
        const sender = new ReactionSender(null);

        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: '👍'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('not connected');
    });

    it('handles socket sendMessage error', async () => {
        const mockSocket = {
            sendMessage: vi.fn().mockRejectedValue(new Error('Network error'))
        };
        const sender = new ReactionSender(mockSocket as any);

        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: '❤️'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
    });

    it('accepts empty string emoji to remove reaction', async () => {
        const mockSocket = {
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'reaction456' } })
        };
        const sender = new ReactionSender(mockSocket as any);

        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: ''
        });

        expect(result.success).toBe(true);
        expect(mockSocket.sendMessage).toHaveBeenCalledWith(
            '123@s.whatsapp.net',
            {
                react: {
                    text: '',
                    key: {
                        remoteJid: '123@s.whatsapp.net',
                        id: 'msg123',
                        fromMe: false
                    }
                }
            }
        );
    });

    it('validates various standard emojis', async () => {
        const mockSocket = {
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'reaction' } })
        };
        const sender = new ReactionSender(mockSocket as any);

        const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

        for (const emoji of validEmojis) {
            const result = await sender.sendReaction({
                jid: '123@s.whatsapp.net',
                messageId: 'msg123',
                emoji
            });
            expect(result.success).toBe(true);
        }
    });
});
