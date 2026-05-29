import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RecentConversationMessage, RecentConversationSummary } from '../../src/models/whatsapp.types.js';

/**
 * Unit tests for the read-only inbox tools:
 *   - list_wa_conversations
 *   - get_wa_conversation_history
 *   - check_wa_new_messages
 *
 * The tools' execute functions are closures over the RecentsService. We
 * replicate the exact logic here with a mocked service so it can be tested
 * in isolation, matching the pattern of send-wa-message.tool.test.ts.
 */

interface MockRecentsService {
    getRecentConversations: () => Promise<RecentConversationSummary[]>;
    getConversationHistory: (senderNumber: string) => Promise<RecentConversationMessage[]>;
}

function parse(result: { isError: boolean; content: { type: 'text'; text: string }[] }) {
    return JSON.parse(result.content[0].text);
}

async function listConversations(
    params: { onlyIncoming?: boolean; onlyAllowed?: boolean; limit?: number },
    recentsService: MockRecentsService
) {
    try {
        const conversations = await recentsService.getRecentConversations();
        let filtered = conversations;
        if (params.onlyIncoming) {
            filtered = filtered.filter(c => c.lastMessageDirection === 'incoming');
        }
        if (params.onlyAllowed) {
            filtered = filtered.filter(c => c.isAllowed);
        }
        const limit = typeof params.limit === 'number' ? params.limit : 20;
        filtered = filtered.slice(0, limit);
        return {
            isError: false,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true, count: filtered.length, conversations: filtered }) }]
        };
    } catch (error) {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }) }]
        };
    }
}

async function getHistory(
    params: { senderNumber: string; limit?: number },
    recentsService: MockRecentsService
) {
    if (!params.senderNumber || !params.senderNumber.trim()) {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'senderNumber is required' }) }]
        };
    }
    try {
        const messages = await recentsService.getConversationHistory(params.senderNumber);
        const limit = typeof params.limit === 'number' ? params.limit : 20;
        const sliced = messages.slice(-limit);
        return {
            isError: false,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true, count: sliced.length, messages: sliced }) }]
        };
    } catch (error) {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }) }]
        };
    }
}

async function checkNew(
    params: { sinceTimestamp?: number },
    recentsService: MockRecentsService
) {
    try {
        const conversations = await recentsService.getRecentConversations();
        const since = typeof params.sinceTimestamp === 'number' ? params.sinceTimestamp : 0;
        const pending = conversations.filter(c =>
            c.lastMessageDirection === 'incoming' && c.lastMessageTime > since
        );
        return {
            isError: false,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: true, count: pending.length, conversations: pending }) }]
        };
    } catch (error) {
        return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }) }]
        };
    }
}

const fixtureConversations: RecentConversationSummary[] = [
    {
        senderNumber: '+199210011996322',
        senderName: 'Alan Snoodles',
        lastMessagePreview: 'Who am I talking to',
        lastMessageTime: 2000,
        lastMessageDirection: 'incoming',
        messageCount: 1,
        isAllowed: false
    },
    {
        senderNumber: '+14152253544',
        lastMessagePreview: 'A reply from the agent',
        lastMessageTime: 1500,
        lastMessageDirection: 'outgoing',
        messageCount: 4,
        isAllowed: true
    },
    {
        senderNumber: '+223072330207416',
        senderName: 'AlanB',
        lastMessagePreview: 'This is an ack',
        lastMessageTime: 1000,
        lastMessageDirection: 'incoming',
        messageCount: 1,
        isAllowed: true
    }
];

describe('list_wa_conversations tool', () => {
    let recentsService: MockRecentsService;

    beforeEach(() => {
        recentsService = {
            getRecentConversations: vi.fn().mockResolvedValue(fixtureConversations),
            getConversationHistory: vi.fn()
        };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('returns all recent conversations by default', async () => {
        const result = await listConversations({}, recentsService);
        expect(result.isError).toBe(false);
        const parsed = parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.count).toBe(3);
        expect(parsed.conversations).toEqual(fixtureConversations);
    });

    it('filters to incoming-only when onlyIncoming is true', async () => {
        const result = await listConversations({ onlyIncoming: true }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(2);
        expect(parsed.conversations.every((c: RecentConversationSummary) => c.lastMessageDirection === 'incoming')).toBe(true);
    });

    it('filters to allowed-only when onlyAllowed is true', async () => {
        const result = await listConversations({ onlyAllowed: true }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(2);
        expect(parsed.conversations.every((c: RecentConversationSummary) => c.isAllowed)).toBe(true);
    });

    it('respects the limit parameter', async () => {
        const result = await listConversations({ limit: 1 }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(1);
        expect(parsed.conversations[0].senderNumber).toBe('+199210011996322');
    });

    it('combines onlyIncoming + limit correctly', async () => {
        const result = await listConversations({ onlyIncoming: true, limit: 1 }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(1);
        expect(parsed.conversations[0].lastMessageDirection).toBe('incoming');
    });

    it('returns an error result if the recents service throws', async () => {
        vi.mocked(recentsService.getRecentConversations).mockRejectedValue(new Error('disk read failed'));
        const result = await listConversations({}, recentsService);
        expect(result.isError).toBe(true);
        const parsed = parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('disk read failed');
    });
});

describe('get_wa_conversation_history tool', () => {
    let recentsService: MockRecentsService;
    const messages: RecentConversationMessage[] = Array.from({ length: 5 }, (_, i) => ({
        messageId: `MSG${i}`,
        senderNumber: '+14152253544',
        text: `message ${i}`,
        direction: i % 2 === 0 ? 'incoming' : 'outgoing',
        timestamp: 1000 + i
    }));

    beforeEach(() => {
        recentsService = {
            getRecentConversations: vi.fn(),
            getConversationHistory: vi.fn().mockResolvedValue(messages)
        };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('returns all messages for a sender', async () => {
        const result = await getHistory({ senderNumber: '+14152253544' }, recentsService);
        expect(result.isError).toBe(false);
        const parsed = parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.count).toBe(5);
        expect(parsed.messages).toHaveLength(5);
        expect(recentsService.getConversationHistory).toHaveBeenCalledWith('+14152253544');
    });

    it('forwards JIDs to the service unchanged (service normalizes)', async () => {
        await getHistory({ senderNumber: '14152253544@s.whatsapp.net' }, recentsService);
        expect(recentsService.getConversationHistory).toHaveBeenCalledWith('14152253544@s.whatsapp.net');
    });

    it('truncates to the requested limit (returns latest)', async () => {
        const result = await getHistory({ senderNumber: '+14152253544', limit: 2 }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(2);
        expect(parsed.messages.map((m: RecentConversationMessage) => m.messageId)).toEqual(['MSG3', 'MSG4']);
    });

    it('returns an error if senderNumber is empty', async () => {
        const result = await getHistory({ senderNumber: '   ' }, recentsService);
        expect(result.isError).toBe(true);
        const parsed = parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('senderNumber is required');
        expect(recentsService.getConversationHistory).not.toHaveBeenCalled();
    });

    it('returns an error result if the recents service throws', async () => {
        vi.mocked(recentsService.getConversationHistory).mockRejectedValue(new Error('store missing'));
        const result = await getHistory({ senderNumber: '+14152253544' }, recentsService);
        expect(result.isError).toBe(true);
        const parsed = parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('store missing');
    });
});

describe('check_wa_new_messages tool', () => {
    let recentsService: MockRecentsService;

    beforeEach(() => {
        recentsService = {
            getRecentConversations: vi.fn().mockResolvedValue(fixtureConversations),
            getConversationHistory: vi.fn()
        };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('returns conversations whose last message is incoming', async () => {
        const result = await checkNew({}, recentsService);
        expect(result.isError).toBe(false);
        const parsed = parse(result);
        expect(parsed.success).toBe(true);
        expect(parsed.count).toBe(2);
        expect(parsed.conversations.every((c: RecentConversationSummary) => c.lastMessageDirection === 'incoming')).toBe(true);
    });

    it('excludes outgoing-last conversations', async () => {
        const result = await checkNew({}, recentsService);
        const parsed = parse(result);
        expect(parsed.conversations.find((c: RecentConversationSummary) => c.senderNumber === '+14152253544')).toBeUndefined();
    });

    it('filters by sinceTimestamp (strictly greater than)', async () => {
        const result = await checkNew({ sinceTimestamp: 1000 }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(1);
        expect(parsed.conversations[0].senderNumber).toBe('+199210011996322');
    });

    it('returns empty when no incoming messages newer than sinceTimestamp', async () => {
        const result = await checkNew({ sinceTimestamp: 9999 }, recentsService);
        const parsed = parse(result);
        expect(parsed.count).toBe(0);
        expect(parsed.conversations).toEqual([]);
    });

    it('returns an error result if the recents service throws', async () => {
        vi.mocked(recentsService.getRecentConversations).mockRejectedValue(new Error('boom'));
        const result = await checkNew({}, recentsService);
        expect(result.isError).toBe(true);
        const parsed = parse(result);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('boom');
    });
});
