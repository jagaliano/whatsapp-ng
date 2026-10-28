import { describe, expect, it, vi } from 'vitest';
import { ConversationRouter, type SendPurpose } from '../../src/services/conversation-router.service.ts';
import { JidResolver } from '../../src/services/jid-resolver.service.ts';
import type { WAMessageKey } from 'baileys';
import type { WhatsAppInputKind } from '../../src/models/whatsapp.types.ts';

const origin = (jid: string) => ({ id: 'original', remoteJid: jid, fromMe: false });
const A = '15550000001@s.whatsapp.net';
const B = '15550000002@s.whatsapp.net';

const consume = (router: ConversationRouter, jid: string, text = 'hello') => {
    const input = router.prepare(text, origin(jid));
    router.observeInput({ source: 'extension', text: input.content });
    router.consume({ role: 'user', content: [{ type: 'text', text: input.content }] });
    return input;
};

describe('ConversationRouter retired phone follow-ups', () => {
    it('retires stale admission before native inference and never revives it on re-enable', () => {
        const router = new ConversationRouter(); let revision = 0;
        const input = router.prepare('queued group text', origin(A), { admissionCurrent: () => revision === 0 });
        router.observeInput({ source: 'extension', text: input.content }); revision = 2;
        const message = { role: 'user', content: input.content }; expect(router.isRetiredInput(message)).toBe(true);
        revision = 0; expect(router.isRetiredInput(message)).toBe(true);
        const abort = vi.fn(); expect(router.abortRetiredInput(message, abort)).toBe(true); expect(abort).toHaveBeenCalledOnce();
    });
    it('remembers only exact withdrawn input hashes, not already-consumed or unrelated work', () => {
        const router = new ConversationRouter(); const active = consume(router, A);
        const queued = router.prepare('queued', origin(B));
        expect(router.isRetiredInput({ role: 'user', content: queued.content })).toBe(false);
        router.reset();
        expect(router.isRetiredInput({ role: 'user', content: queued.content })).toBe(true);
        expect(router.isRetiredInput({ role: 'user', content: active.content })).toBe(false);
        expect(router.isRetiredInput({ role: 'user', content: queued.content + 'different' })).toBe(false);
    });
    it.each(['interactive', 'rpc'])('does not cancel positively observed fresh local %s input', source => {
        const router = new ConversationRouter(); const queued = router.prepare('queued', origin(A)); router.reset();
        router.observeInput({ source, text: queued.content });
        expect(router.isRetiredInput({ role: 'user', content: queued.content })).toBe(false);
    });
    it('retains withdrawn inputs beyond request expiry until native consumption', () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        try {
            const router = new ConversationRouter(); const input = router.prepare('queued', origin(A)); router.reset();
            clock.mockReturnValue(1_800_000_000_000 + 86_400_001);
            expect(router.isRetiredInput({ role: 'user', content: input.content })).toBe(true);
        } finally { clock.mockRestore(); }
    });
});

describe('ConversationRouter retirement capacity', () => {
    it('releases a reserved slot only after successful abort at exact native consumption', () => {
        const router = new ConversationRouter();
        const queued = Array.from({ length: 500 }, () => router.prepare('queued', origin(A)));
        router.reset(); const message = { role: 'user', content: queued[0].content };
        expect(() => router.abortRetiredInput(message, () => { throw new Error('abort failed'); })).toThrow('abort failed');
        expect(() => router.prepare('overflow', origin(A))).toThrow();
        const abort = vi.fn(); expect(router.abortRetiredInput(message, abort)).toBe(true);
        expect(abort).toHaveBeenCalledOnce(); expect(router.isRetiredInput(message)).toBe(false);
        expect(() => router.prepare('new', origin(A))).not.toThrow(); router.reset();
        expect(router.isRetiredInput({ role: 'user', content: queued[1].content })).toBe(true);
    });
    it('preserves hash-only withdrawal evidence across extension-factory recreation', () => {
        const shared = new Set<string>();
        const previous = new ConversationRouter(undefined, undefined, undefined, undefined, undefined, undefined, shared);
        const input = previous.prepare('queued', origin(A)); previous.reset();
        const replacement = new ConversationRouter(undefined, undefined, undefined, undefined, undefined, undefined, shared);
        expect(replacement.isRetiredInput({ role: 'user', content: input.content })).toBe(true);
        expect([...shared][0]).toMatch(/^[a-f0-9]{64}$/);
    });
    it('reserves pending plus retired capacity without reviving the oldest withdrawn input', () => {
        const router = new ConversationRouter();
        const queued = Array.from({ length: 500 }, (_, index) => router.prepare(`queued ${index}`, origin(A)));
        router.reset();
        expect(() => router.prepare('overflow', origin(A))).toThrow();
        router.reset();
        for (const input of queued) expect(router.isRetiredInput({ role: 'user', content: input.content })).toBe(true);
    });
    it('retires expired queued requests rather than freeing their admission slots', () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        try {
            const router = new ConversationRouter();
            const queued = Array.from({ length: 500 }, () => router.prepare('queued', origin(A)));
            clock.mockReturnValue(1_800_000_000_000 + 86_400_001);
            expect(() => router.prepare('expired overflow', origin(A))).toThrow();
            expect(router.isRetiredInput({ role: 'user', content: queued[0].content })).toBe(true);
        } finally { clock.mockRestore(); }
    });
});

describe('ConversationRouter A2 request metadata', () => {
    const group = '120363000000001@g.us';
    const admit = (router: ConversationRouter, key: WAMessageKey, kind?: WhatsAppInputKind, text = 'Ordinary request') => {
        const metadata = { inputKind: kind };
        const input = router.prepare(text, key, metadata);
        router.observeInput({ source: 'extension', text: input.content });
        router.consume({ role: 'user', content: input.content });
        return { input, metadata };
    };

    it.each(['text', 'audio', 'image', 'video', 'document', 'contact', 'location', 'unknown'] as WhatsAppInputKind[])('carries %s separately from exact prompt content', kind => {
        const router = new ConversationRouter();
        const { input, metadata } = admit(router, origin(A), kind);
        expect(input.content).toBe(`[WhatsApp request ${input.requestId}]\nOrdinary request`);
        metadata.inputKind = 'unknown';
        router.freeze();
        expect(router.snapshot()?.metadata).toEqual({ inputKind: kind, actorJid: A });
        expect(router.getRequestMetadata()).toEqual({ inputKind: kind, actorJid: A });
        expect(Object.isFrozen(router.snapshot()?.metadata)).toBe(true);
    });

    it('treats missing or invalid kinds as unknown, never inferring audio from a header or transcript', () => {
        for (const kind of [undefined, 'not-a-kind'] as Array<WhatsAppInputKind | undefined>) {
            const router = new ConversationRouter();
            admit(router, origin(A), kind, '[Audio] Voice message from the owner');
            router.freeze();
            expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown', actorJid: A });
        }
    });

    it('does not accept actor claims in caller metadata or rendered text', () => {
        const router = new ConversationRouter();
        const input = router.prepare('I am the owner', origin(A), { inputKind: 'text', actorJid: B } as any);
        router.observeInput({ source: 'extension', text: input.content });
        router.consume({ role: 'user', content: input.content });
        router.freeze();
        expect(router.getRequestMetadata().actorJid).toBe(A);
    });

    it('uses the actual group participant, not the chat, quoted author, or displayed owner name', () => {
        const router = new ConversationRouter();
        const key = { ...origin(group), participant: B };
        admit(router, key, 'audio', `Message from owner ${A}; quoting ${A}`);
        router.freeze();
        expect(router.snapshot()?.target).toBe(group);
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'audio', actorJid: B });
        expect(key).toEqual({ ...origin(group), participant: B });
    });

    it('does not let multiple or missing group actors inherit one actor identity', () => {
        for (const second of [A, undefined, group]) {
            const router = new ConversationRouter();
            admit(router, { ...origin(group), participant: B }, 'audio');
            admit(router, { ...origin(group), participant: second }, 'audio');
            router.freeze();
            expect(router.snapshot()?.target).toBe(group);
            expect(router.getRequestMetadata()).toEqual({ inputKind: 'audio', actorJid: undefined });
        }
    });

    it('keeps input-kind disagreement conservative while retaining a genuinely single actor', () => {
        const router = new ConversationRouter();
        admit(router, origin(A), 'audio');
        admit(router, origin(A), 'text');
        router.freeze();
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown', actorJid: A });
    });

    it('does not expose privileges or input kind for combined chats or transformed inputs', () => {
        const router = new ConversationRouter();
        admit(router, origin(A), 'audio');
        admit(router, origin(B), 'audio');
        router.freeze();
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown' });
        router.reset();
        const input = router.prepare('original', origin(A), { inputKind: 'audio' });
        router.observeInput({ source: 'extension', text: input.content });
        router.consume({ role: 'user', content: input.content + ' transformed' });
        router.freeze();
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown' });
    });

    it('does not borrow metadata from a pending request or a terminal replay', () => {
        const router = new ConversationRouter();
        admit(router, origin(A), 'text');
        router.freeze();
        const pending = router.prepare('next', origin(B), { inputKind: 'audio' });
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'text', actorJid: A });
        router.endRun(false);
        router.observeInput({ source: 'rpc', text: pending.content });
        router.consume({ role: 'user', content: pending.content });
        router.freeze();
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown' });
    });

    it('requires the trusted resolver for own-direction input rather than attributing it to the recipient', () => {
        const key = { ...origin(A), fromMe: true };
        const conservative = new ConversationRouter();
        admit(conservative, key, 'text');
        conservative.freeze();
        expect(conservative.getRequestMetadata().actorJid).toBeUndefined();
        const own = new ConversationRouter(undefined, undefined, undefined, undefined, undefined, () => B);
        admit(own, key, 'text');
        own.freeze();
        expect(own.getRequestMetadata().actorJid).toBe(B);
    });

    it('canonicalizes verified late actor aliases without replacing participant transport keys', () => {
        const resolver = new JidResolver();
        const router = new ConversationRouter(jid => resolver.canonical(jid));
        const lid = '90000000001@lid';
        const key = { ...origin(group), participant: lid };
        admit(router, key, 'audio');
        admit(router, { ...origin(group), participant: A }, 'audio');
        resolver.bind(lid, A);
        router.freeze();
        expect(router.getRequestMetadata().actorJid).toBe(A);
        expect(key.participant).toBe(lid);
        resolver.bind(lid, B); // verified conflict invalidates the actor
        expect(router.getRequestMetadata().actorJid).toBeUndefined();
    });

    it('revalidates late actor aliases and returns defensive metadata without mutating its frozen snapshot', () => {
        const resolver = new JidResolver();
        const router = new ConversationRouter(jid => resolver.canonical(jid));
        const lid = '90000000001@lid';
        admit(router, { ...origin(group), participant: lid }, 'audio');
        router.freeze();
        const snapshot = router.snapshot()!;
        resolver.bind(lid, A);
        const metadata = router.getRequestMetadata();
        expect(metadata.actorJid).toBe(A);
        (metadata as any).inputKind = 'text';
        expect(router.getRequestMetadata().inputKind).toBe('audio');
        expect(snapshot.metadata.actorJid).toBe(lid);
    });

    it('preserves retry metadata but rejects stale account generations and runtime snapshots', () => {
        let scope = 'account:generation-1';
        const router = new ConversationRouter(undefined, () => scope);
        admit(router, origin(A), 'audio');
        router.freeze();
        router.endRun(true);
        router.freeze();
        const snapshot = router.snapshot()!;
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'audio', actorJid: A });
        scope = 'account:generation-2';
        expect(router.getRequestMetadata(snapshot)).toEqual({ inputKind: 'unknown' });
        scope = 'account:generation-1';
        router.reset();
        expect(router.getRequestMetadata(snapshot)).toEqual({ inputKind: 'unknown' });
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'unknown' });
    });
});

describe('ConversationRouter A1 delivery purposes', () => {
    const setup = (legacy = false) => {
        const router = new ConversationRouter(undefined, undefined, undefined, undefined, () => !legacy);
        consume(router, A);
        router.freeze();
        return router;
    };
    const answer = (router: ConversationRouter) => router.buffer({ role: 'assistant', content: 'Useful explanation', stopReason: 'stop' });

    it.each(['accepted', 'in-flight', 'unknown'] as const)('keeps the final explanation after an %s attachment', outcome => {
        const router = setup();
        const token = router.beginSend(router.snapshot(), A, 'attachment');
        if (outcome !== 'in-flight') router.finishSend(token, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
        answer(router);
        expect(router.mirror()?.text).toBe('Useful explanation');
    });

    it.each(['explicit-text', 'final-text', 'final-voice'] as SendPurpose[])('still suppresses accepted, in-flight and unknown %s sends', purpose => {
        for (const outcome of ['accepted', 'in-flight', 'unknown']) {
            const router = setup();
            const token = router.beginSend(router.snapshot(), A, purpose);
            if (outcome !== 'in-flight') router.finishSend(token, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
            answer(router);
            expect(router.mirror()).toBeUndefined();
        }
    });

    it.each(['accepted', 'in-flight', 'unknown'])('never treats %s progress as a final answer, even in legacy mode', outcome => {
        const router = setup(true);
        const token = router.beginSend(router.snapshot(), A, 'progress');
        if (outcome !== 'in-flight') router.finishSend(token, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
        answer(router);
        expect(router.mirror()?.text).toBe('Useful explanation');
    });

    it.each(['accepted', 'in-flight', 'unknown'])('never treats an %s projected tool image as the final answer in legacy mode', outcome => {
        const router = setup(true);
        const token = router.beginSend(router.snapshot(), A, 'tool-image' as SendPurpose);
        if (outcome !== 'in-flight') router.finishSend(token, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
        answer(router); expect(router.mirror()?.text).toBe('Useful explanation');
    });
    it.each(['accepted', 'in-flight', 'unknown'])('preserves legacy suppression for an %s attachment', outcome => {
        const router = setup(true);
        const token = router.beginSend(router.snapshot(), A, 'attachment');
        if (outcome !== 'in-flight') router.finishSend(token, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
        answer(router);
        expect(router.mirror()).toBeUndefined();
    });

    it('does not erase successful text coverage when a parallel attachment fails', () => {
        const router = setup();
        const text = router.beginSend(router.snapshot(), A, 'explicit-text');
        const attachment = router.beginSend(router.snapshot(), A, 'attachment');
        router.finishSend(text, { success: true });
        router.finishSend(attachment, { success: false });
        answer(router);
        expect(router.mirror()).toBeUndefined();
    });

    it('claims a final response synchronously, before a send starts or settles', () => {
        const router = setup();
        answer(router);
        expect(router.mirror()?.text).toBe('Useful explanation');
        expect(router.mirror()).toBeUndefined();
        answer(router); // replayed message_end for the same response
        expect(router.mirror()).toBeUndefined();
        router.freeze(); // a distinct assistant response, even with identical text
        answer(router);
        expect(router.mirror()?.text).toBe('Useful explanation');
    });

    it('retains the request policy when the terminal setting changes during a run', () => {
        let explain = true;
        const router = new ConversationRouter(undefined, undefined, undefined, undefined, () => explain);
        consume(router, A);
        router.freeze();
        explain = false;
        router.finishSend(router.beginSend(router.snapshot(), A, 'attachment'), { success: true });
        answer(router);
        expect(router.mirror()).toBeDefined();
        router.endRun(false);
        consume(router, A);
        router.freeze();
        router.finishSend(router.beginSend(router.snapshot(), A, 'attachment'), { success: true });
        answer(router);
        expect(router.mirror()).toBeUndefined();
    });

    it('invalidates captured snapshots on reset even when the account scope is unchanged', () => {
        const router = setup();
        const snapshot = router.snapshot()!;
        router.reset();
        expect(router.isCurrent(snapshot)).toBe(false);
        expect(router.beginSend(snapshot, A, 'final-text')).toBeUndefined();
    });

    it('exposes only verified consumed origins for one fixed ambiguity notice per epoch', () => {
        const router = new ConversationRouter();
        consume(router, A);
        consume(router, B);
        router.freeze();
        answer(router);
        expect(router.mirror()).toBeUndefined();
        expect(router.takeAmbiguityNotice()?.targets).toEqual([A, B]);
        expect(router.takeAmbiguityNotice()).toBeUndefined();
        router.freeze();
        answer(router);
        expect(router.takeAmbiguityNotice()).toBeUndefined();
    });

    it.each(['accepted', 'in-flight', 'unknown'])('does not hide a mixed-chat retry notice after an %s legacy attachment', outcome => {
        const router = new ConversationRouter(undefined, undefined, undefined, undefined, () => false);
        consume(router, A);
        consume(router, B);
        router.freeze();
        const attachment = router.beginSend(router.snapshot(), A, 'attachment');
        if (outcome !== 'in-flight') router.finishSend(attachment, outcome === 'accepted' ? { success: true } : { success: false, delivery: 'unknown' });
        answer(router);
        expect(router.takeAmbiguityNotice()?.targets).toEqual([A, B]);
    });

    it('does not add retry notices to a mixed chat already covered by explicit text', () => {
        const router = new ConversationRouter();
        consume(router, A);
        consume(router, B);
        router.freeze();
        router.finishSend(router.beginSend(router.snapshot(), A), { success: true });
        answer(router);
        expect(router.takeAmbiguityNotice()?.targets).toEqual([B]);
    });

    it('never guesses an ambiguity-notice destination for terminal-only or stale work', () => {
        const router = new ConversationRouter();
        router.consume({ role: 'user', content: 'terminal' });
        router.freeze();
        answer(router);
        expect(router.takeAmbiguityNotice()).toBeUndefined();
        router.reset();
        consume(router, A);
        consume(router, B);
        router.freeze();
        answer(router);
        router.reset();
        expect(router.takeAmbiguityNotice()).toBeUndefined();
    });
});

describe('ConversationRouter sidecar provenance', () => {
    it('recognizes only a pending exact submission that passed extension input observation', () => {
        const router = new ConversationRouter();
        const input = router.prepare('hello', origin(A));
        router.startRun();
        router.consume({ role: 'user', content: [{ type: 'text', text: input.content }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
    });

    it('captures A despite B arriving while A is processing', () => {
        const router = new ConversationRouter();
        router.startRun();
        consume(router, A);
        router.freeze();
        const snapshot = router.snapshot()!;
        router.prepare('next', origin(B));
        expect(snapshot.target).toBe(A);
        expect(router.snapshot()?.target).toBe(A);
    });

    it('fails closed for mixed chats, terminal input and transformed content', () => {
        const router = new ConversationRouter();
        router.startRun();
        consume(router, A);
        consume(router, B);
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
        router.consume({ role: 'user', content: [{ type: 'text', text: 'terminal' }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
        const input = router.prepare('changed', origin(A));
        router.observeInput({ source: 'extension', text: input.content });
        router.consume({ role: 'user', content: [{ type: 'text', text: `${input.content}!` }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
    });

    it('does not mirror before tools complete and suppresses the whole owned epoch after a send', () => {
        const router = new ConversationRouter();
        router.startRun();
        consume(router, A);
        router.freeze();
        router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'comment' }, { type: 'toolCall' }], stopReason: 'toolUse' });
        expect(router.mirror()).toBeUndefined();
        const send = router.beginSend(router.snapshot(), A);
        router.finishSend(send, { success: true });
        router.freeze();
        router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'duplicate' }], stopReason: 'stop' });
        expect(router.mirror()).toBeUndefined();
    });

    it('does not suppress A for a definite failure or a send to C, but does for unknown acceptance', () => {
        const router = new ConversationRouter();
        router.startRun();
        consume(router, A);
        router.freeze();
        router.finishSend(router.beginSend(router.snapshot(), B), { success: true });
        router.finishSend(router.beginSend(router.snapshot(), A), { success: false });
        router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'answer' }], stopReason: 'stop' });
        expect(router.mirror()?.text).toBe('answer');
        router.finishSend(router.beginSend(router.snapshot(), A), { success: false, delivery: 'unknown' });
        expect(router.mirror()).toBeUndefined();
    });

    it('keeps retry ownership without a new input but never restores it after reset or a completed run', () => {
        const router = new ConversationRouter();
        router.startRun();
        const input = consume(router, A);
        router.freeze();
        router.endRun(true);
        router.startRun();
        router.freeze();
        expect(router.snapshot()?.target).toBe(A);
        router.endRun(false);
        router.startRun();
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
        router.reset();
        router.consume({ role: 'user', content: [{ type: 'text', text: input.content }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
    });

    it('keeps suppression valid when a verified alias changes after the send', () => {
        let mapped = false;
        const lid = '999999@lid';
        const router = new ConversationRouter(jid => mapped && jid === lid ? A : jid);
        router.startRun();
        consume(router, lid);
        router.freeze();
        router.finishSend(router.beginSend(router.snapshot(), lid), { success: true });
        mapped = true;
        router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'duplicate' }] });
        expect(router.mirror()).toBeUndefined();
    });

    it('does not lose a successful concurrent send when another call fails', () => {
        const router = new ConversationRouter();
        consume(router, A);
        router.freeze();
        const first = router.beginSend(router.snapshot(), A);
        const second = router.beginSend(router.snapshot(), A);
        router.finishSend(first, { success: true });
        router.finishSend(second, { success: false });
        router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'duplicate' }] });
        expect(router.mirror()).toBeUndefined();
    });

    it('does not correlate changed image bytes to the original submitted request', () => {
        const router = new ConversationRouter();
        const input = router.prepare([{ type: 'text', text: 'image' }, { type: 'image', mimeType: 'image/png', data: 'original' }], origin(A));
        const text = input.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        router.observeInput({ source: 'extension', text, images: [{ type: 'image', mimeType: 'image/png', data: 'original' }] });
        router.consume({ role: 'user', content: [{ type: 'text', text }, { type: 'image', mimeType: 'image/png', data: 'changed' }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
    });

    it('rejects a terminal replay of a pending marker', () => {
        const router = new ConversationRouter();
        const input = router.prepare('hello', origin(A));
        router.observeInput({ source: 'rpc', text: input.content });
        router.consume({ role: 'user', content: [{ type: 'text', text: input.content }] });
        router.freeze();
        expect(router.snapshot()?.target).toBeUndefined();
    });
});
