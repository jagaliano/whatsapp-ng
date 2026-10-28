import { describe, expect, it, vi, onTestFinished } from 'vitest';
import { GroupMessagePolicy, validateGroupReplies } from '../../src/services/group-message.policy.ts';

const chat = '120363000001@g.us'; const own = '15550000001@s.whatsapp.net'; const lid = '90000000001@lid';
const isOwn = (jid: string) => jid === own || jid === lid;
function fixture() {
    let now = 0; const policy = new GroupMessagePolicy(() => now); onTestFinished(() => policy.reset());
    const base = { chat, scope: 'account/runtime', revision: 0, admission: 'initial', settings: { mode: 'mentions-or-replies' as const, context: false }, isOwn };
    return { policy, base, advance: (ms: number) => { now += ms; } };
}
describe('group automatic message policy', () => {
    it('validates snapshots without interpreting strings as consent', () => {
        expect(validateGroupReplies(undefined)).toEqual({ mode: 'mentions-or-replies', context: false });
        for (const value of [null, [], { mode: 'all', context: 'true' }, { mode: 'broken', context: false }, { mode: 'all', context: false, extra: true }]) expect(() => validateGroupReplies(value)).toThrow('group');
    });
    it('matches verified mention/reply fields, not rendered text or a foreign quoted chat', () => {
        const h = fixture(); const run = (content: any, mode = h.base.settings.mode as string) => h.policy.evaluate({ ...h.base, settings: { mode, context: false } as any, content });
        expect(run({ conversation: '@15550000001 reply please' }).admit).toBe(false);
        const mention = { extendedTextMessage: { text: 'hello', contextInfo: { mentionedJid: [lid] } } };
        const reply = { extendedTextMessage: { text: 'reply', contextInfo: { stanzaId: 'known', participant: own } } };
        expect(run(mention).admit).toBe(true); expect(run(reply).admit).toBe(true);
        expect(run(mention, 'replies').admit).toBe(false); expect(run(reply, 'mentions').admit).toBe(false);
        expect(run({ conversation: 'ordinary' }, 'all').admit).toBe(true);
        expect(run({ extendedTextMessage: { contextInfo: { stanzaId: 'foreign', participant: own, remoteJid: '120363000002@g.us' } } }).admit).toBe(false);
    });
    it('bounds preceding text, excludes media and consumes context exactly once', () => {
        const h = fixture(); const settings = { mode: 'mentions' as const, context: true };
        for (let i = 0; i < 25; i++) h.policy.evaluate({ ...h.base, settings, content: { conversation: 'ordinary' }, plainText: `${i}:` + 'x'.repeat(3000) });
        h.policy.evaluate({ ...h.base, settings, content: { imageMessage: { caption: 'not downloaded' } } });
        const trigger = { ...h.base, settings, content: { extendedTextMessage: { contextInfo: { mentionedJid: [own] } } } };
        const result = h.policy.evaluate(trigger); expect(result.preceding).toHaveLength(20); expect(result.preceding[0]).toMatch(/^5:/);
        expect(result.preceding.every(text => text.length <= 2000)).toBe(true); expect(h.policy.evaluate(trigger).preceding).toEqual([]);
    });
    it.each(['scope', 'revision', 'admission', 'expiry', 'disable', 'reset'])('never revives context after %s changes', change => {
        const h = fixture(); const settings = { mode: 'mentions' as const, context: true };
        const request = { ...h.base, settings, content: { conversation: 'old context' }, plainText: 'old context' };
        h.policy.evaluate(request);
        const updated = { ...request, content: { extendedTextMessage: { contextInfo: { mentionedJid: [own] } } } };
        if (change === 'scope') updated.scope = 'another-account'; if (change === 'revision') updated.revision++;
        if (change === 'admission') updated.admission = 'pause-reenable'; if (change === 'expiry') h.advance(30 * 60 * 1000);
        if (change === 'disable') h.policy.evaluate({ ...request, revision: 1, settings: { ...settings, context: false } });
        if (change === 'reset') h.policy.reset();
        expect(h.policy.evaluate(updated).preceding).toEqual([]);
    });
    it('expires idle context with one cancellable timer and does not keep stale scope data', () => {
        vi.useFakeTimers();
        const policy = new GroupMessagePolicy();
        try {
            const input = { chat, scope: 'old', revision: 0, admission: 'initial', settings: { mode: 'mentions' as const, context: true }, isOwn,
                content: { conversation: 'idle text' }, plainText: 'idle text' };
            policy.evaluate(input); policy.evaluate(input); expect(vi.getTimerCount()).toBe(1);
            vi.advanceTimersByTime(30 * 60 * 1000); expect((policy as any).contexts.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
            policy.evaluate(input); policy.reset(); expect(vi.getTimerCount()).toBe(0);
        } finally { policy.reset(); vi.useRealTimers(); }
    });
    it('keeps chats separate and bounds retained groups', () => {
        const h = fixture(); const settings = { mode: 'mentions' as const, context: true };
        for (let i = 0; i < 51; i++) h.policy.evaluate({ ...h.base, settings, chat: `120363${i}@g.us`, plainText: 'retained', content: { conversation: 'retained' } });
        expect(h.policy.evaluate({ ...h.base, settings, chat: '1203630@g.us', content: { extendedTextMessage: { contextInfo: { mentionedJid: [own] } } } }).preceding).toEqual([]);
    });
});
