import { describe, expect, it, vi } from 'vitest';
import { ConversationRouter } from '../../src/services/conversation-router.service.ts';
import { RunReportService } from '../../src/services/run-report.service.ts';

const A = '15550000001@s.whatsapp.net'; const B = '15550000002@s.whatsapp.net';
function fixture(enabled = true) {
    let now = 0; let policyCurrent = true; let revision = 0;
    const router = new ConversationRouter(); const send = vi.fn().mockResolvedValue({ success: true, attempts: 1 }); const notify = vi.fn();
    const reports = new RunReportService({ router, policy: () => { const captured = revision; return { enabled, isCurrent: () => policyCurrent && captured === revision }; }, send, notify }, () => now);
    reports.startRun();
    const consume = (jid = A) => {
        const input = router.prepare('task', { id: 'incoming', remoteJid: jid, fromMe: false });
        router.observeInput({ source: 'extension', text: input.content }); router.consume({ role: 'user', content: input.content }); reports.noteInput();
    };
    const freeze = (signal?: AbortSignal) => { router.freeze(); const snapshot = router.snapshot()!; reports.capture(snapshot, signal); return snapshot; };
    const capture = (jid = A, signal?: AbortSignal) => { consume(jid); return freeze(signal); };
    return { router, reports, capture, consume, freeze, send, notify, advance: (ms: number) => { now += ms; }, revoke: () => { policyCurrent = false; },
        enable: () => { enabled = true; revision++; }, disable: () => { enabled = false; revision++; } };
}
const final = { role: 'assistant', content: [{ type: 'text', text: 'answer' }], stopReason: 'stop' };
describe('owned final reply stats', () => {
    it('is silent by default and never reports terminal/unowned output', async () => {
        const h = fixture(false); const snapshot = h.capture(); h.reports.finish(snapshot, final); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        const local = fixture(); local.router.consume({ role: 'user', content: 'local task' }); local.router.freeze();
        local.reports.capture(local.router.snapshot()!); local.reports.finish(local.router.snapshot(), final); await local.reports.settled(); expect(local.send).not.toHaveBeenCalled();
    });
    it('reports elapsed time and successful/failed observed calls once without tool data', async () => {
        const h = fixture(); const snapshot = h.capture();
        h.reports.toolStarted('one', snapshot); h.reports.toolStarted('two', snapshot);
        h.reports.toolEnded('one', false); h.reports.toolEnded('two', true); h.reports.toolEnded('two', true);
        h.advance(2500); h.reports.finish(snapshot, final); h.reports.finish(snapshot, final); await h.reports.settled();
        expect(h.send).toHaveBeenCalledOnce(); expect(h.send.mock.calls[0][0].target).toBe(A);
        expect(h.send.mock.calls[0][1]).toBe('Reply stats: 2.5s elapsed; tools 1 succeeded, 1 failed.');
    });
    it('never retroactively enables an existing reply or revives it after run reset', async () => {
        const h = fixture(false); const original = h.capture(); h.enable(); h.router.freeze();
        h.reports.capture(h.router.snapshot()!); h.reports.finish(h.router.snapshot(), final); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        h.reports.startRun(); h.reports.capture(original); h.reports.finish(original, final); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        const next = h.capture(); h.reports.finish(next, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce();
    });
    it.each(['disabled-enable', 'enabled-cycle'])('does not apply %s changes between input consumption and the first assistant frame', async mode => {
        const h = fixture(mode === 'enabled-cycle'); h.consume();
        if (mode === 'enabled-cycle') h.disable(); h.enable();
        const snapshot = h.freeze(); h.reports.finish(snapshot, final); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        const next = h.capture(); h.reports.finish(next, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce();
    });
    it('keeps ownership through multiple assistant frames and separates queued chats', async () => {
        const h = fixture(); const first = h.capture(); h.reports.toolStarted('a', first);
        h.router.freeze(); const later = h.router.snapshot()!; h.reports.capture(later); h.reports.toolEnded('a', false);
        h.reports.finish(later, final); const second = h.capture(B); h.reports.toolStarted('b', second); h.reports.toolEnded('b', true); h.reports.finish(second, final);
        await h.reports.settled(); expect(h.send.mock.calls.map(call => [call[0].target, call[1]])).toEqual([
            [A, 'Reply stats: 0.0s elapsed; tools 1 succeeded, 0 failed.'], [B, 'Reply stats: 0.0s elapsed; tools 0 succeeded, 1 failed.']]);
    });
    it('does not finalize tool batches, aborted responses or provider errors', async () => {
        const h = fixture(); const snapshot = h.capture();
        for (const message of [{ ...final, content: [{ type: 'toolCall', id: 'call' }] }, { ...final, stopReason: 'aborted' }, { ...final, stopReason: 'error' }]) h.reports.finish(snapshot, message);
        await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        h.reports.finish(snapshot, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce();
    });
    it.each(['policy', 'router', 'signal', 'reset'])('withdraws %s work without reviving a pending stats send', async kind => {
        const h = fixture(); const controller = new AbortController(); const snapshot = h.capture(A, controller.signal);
        if (kind === 'policy') h.revoke(); if (kind === 'router') h.router.reset(); if (kind === 'signal') controller.abort(); if (kind === 'reset') h.reports.reset();
        h.reports.finish(snapshot, final); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
    });
    it('fences sender pre-transmission work and cancels in-flight work on reset', async () => {
        const h = fixture(); const snapshot = h.capture(); let complete!: () => void; let capturedSignal!: AbortSignal; let capturedCurrent!: () => boolean;
        h.send.mockImplementation((_snapshot, _text, signal, current) => { capturedSignal = signal; capturedCurrent = current; return new Promise(resolve => { complete = () => resolve({ success: false, attempts: 0 }); }); });
        h.reports.finish(snapshot, final); await Promise.resolve(); expect(capturedCurrent()).toBe(true);
        h.reports.reset(); expect(capturedSignal.aborted).toBe(true); expect(capturedCurrent()).toBe(false); complete(); await h.reports.settled(); expect(h.notify).not.toHaveBeenCalled();
    });
    it.each(['unknown', 'throw'])('contains %s delivery failure without retry or report recreation', async failure => {
        const h = fixture(); const snapshot = h.capture();
        if (failure === 'unknown') h.send.mockResolvedValue({ success: false, delivery: 'unknown', attempts: 1 }); else h.send.mockRejectedValue(new Error('private transport body'));
        h.reports.finish(snapshot, final); await h.reports.settled(); h.reports.finish(snapshot, final); await h.reports.settled();
        expect(h.send).toHaveBeenCalledOnce(); expect(h.notify).toHaveBeenCalledOnce(); expect(JSON.stringify(h.notify.mock.calls)).not.toContain('private transport body');
    });
    it('retains at most eight pending-send leases through reset until actual sender settlement', async () => {
        const h = fixture(); const releases: Array<() => void> = [];
        h.send.mockImplementation((_snapshot, _text, _signal, _current, settled) => { releases.push(settled); return Promise.resolve({ success: false, delivery: 'unknown', attempts: 1 }); });
        for (let i = 0; i < 9; i++) { const snapshot = h.capture(); h.reports.finish(snapshot, final); await h.reports.settled(); }
        expect(h.send).toHaveBeenCalledTimes(8);
        h.reports.reset(); const blocked = h.capture(); h.reports.finish(blocked, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledTimes(8);
        releases[0](); const next = h.capture(); h.reports.finish(next, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledTimes(9);
        releases.forEach(release => release());
    });
    it('does not misattribute a reused tool identifier to a new reply scope', async () => {
        const h = fixture(); const first = h.capture(); h.reports.toolStarted('shared-id', first); h.reports.toolEnded('shared-id', false); h.reports.finish(first, final);
        const second = h.capture(B); h.reports.toolStarted('shared-id', second); h.reports.toolEnded('shared-id', false); h.reports.finish(second, final); await h.reports.settled();
        expect(h.send.mock.calls[1][1]).toContain('tools 0 succeeded'); expect(h.send.mock.calls[1][1]).toContain('partial');
    });
    it('bounds tracking and explicitly marks incomplete counts rather than fabricating precision', async () => {
        const h = fixture(); const snapshot = h.capture();
        for (let i = 0; i < 501; i++) h.reports.toolStarted(String(i), snapshot);
        for (let i = 0; i < 501; i++) h.reports.toolEnded(String(i), false);
        h.reports.finish(snapshot, final); await h.reports.settled();
        expect(h.send.mock.calls[0][1]).toContain('500 succeeded'); expect(h.send.mock.calls[0][1]).toContain('partial');
    });
});

function progressFixture(flags: { changedFiles?: boolean; interimText?: boolean; liveActivity?: boolean } = {}) {
    const router = new ConversationRouter(); let revision = 0;
    const send = vi.fn(async (_snapshot: unknown, _text: string, _signal: AbortSignal, _current: () => boolean, settled: () => void) => { settled(); return { success: true, attempts: 1, messageId: 'activity-1' }; });
    const edit = vi.fn(async (_snapshot: unknown, _id: string, _text: string, _signal: AbortSignal, _current: () => boolean, settled: () => void) => { settled(); return { success: true, attempts: 1 }; });
    const reports = new RunReportService({ router, policy: () => { const captured = revision; return { enabled: false, flags: { changedFiles: false, interimText: false, liveActivity: false, ...flags }, isCurrent: () => captured === revision }; }, send, edit, notify: vi.fn() } as any);
    reports.startRun();
    const prepare = (jid = A) => { const request = router.prepare('task', { id: 'fixture', remoteJid: jid, fromMe: false }); router.observeInput({ source: 'extension', text: request.content }); router.consume({ role: 'user', content: request.content }); reports.noteInput(); };
    const capture = (jid = A) => { prepare(jid); router.freeze(); const snapshot = router.snapshot()!; reports.capture(snapshot, undefined, '/workspace'); return snapshot; };
    return { router, reports, send, edit, capture, prepare, revise: () => { revision++; } };
}
describe('opt-in progress and observed files', () => {
    it('reports only successful safe workspace write/edit paths, independently from stats', async () => {
        const h = progressFixture({ changedFiles: true }); const s = h.capture();
        h.reports.toolStarted('one', s, 'write', { path: '/workspace/src/one.ts', content: 'PRIVATE-CONTENT' }); h.reports.toolEnded('one', false);
        h.reports.toolStarted('two', s, 'edit', { path: 'src/failed.ts' }); h.reports.toolEnded('two', true);
        for (const [id, path] of ['../outside.ts', '.env', '.pi/auth/creds.json', '/private/data.txt', '~/home.txt', 'C:\\private\\file.txt', 'credentials.json', 'bad\npath'].entries()) { h.reports.toolStarted('bad'+id, s, 'write', { path }); h.reports.toolEnded('bad'+id, false); }
        h.reports.finish(s, final); await h.reports.settled(); const text = h.send.mock.calls[0][1];
        expect(text).toContain('src/one.ts'); expect(text).not.toMatch(/PRIVATE|outside|failed\.ts|credentials|auth|Reply stats/); expect(text).toContain('partial');
    });
    it('bounds and deduplicates observed paths without claiming a repository-wide file inventory', async () => {
        const h = progressFixture({ changedFiles: true }); const s = h.capture();
        for (let i = 0; i < 25; i++) { h.reports.toolStarted('f'+i, s, 'write', { path: 'src/f'+i+'.ts' }); h.reports.toolEnded('f'+i, false); }
        h.reports.toolStarted('again', s, 'edit', { path: 'src/f0.ts' }); h.reports.toolEnded('again', false);
        h.reports.finish(s, final); await h.reports.settled(); const text = h.send.mock.calls[0][1];
        expect(text.match(/^- /gm)).toHaveLength(20); expect(text).toContain('Observed'); expect(text).toContain('partial');
    });
    it('projects only completed assistant interim text, never thinking, results or the final answer', async () => {
        const h = progressFixture({ interimText: true }); const s = h.capture();
        const message = { role: 'assistant', content: [{ type: 'thinking', thinking: 'PRIVATE-REASONING' }, { type: 'text', text: '**Checking**' }, { type: 'toolCall', id: 'a' }], stopReason: 'toolUse' };
        h.reports.interim(s, message); h.reports.interim(s, message); h.reports.interim(s, final); h.reports.interim(s, { role: 'toolResult', content: 'PRIVATE-RESULT' });
        await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce(); expect(h.send.mock.calls[0][1]).toContain('Checking'); expect(h.send.mock.calls[0][1]).not.toMatch(/PRIVATE|answer/);
    });
    it('creates one activity message, coalesces edits and stops after an unknown edit', async () => {
        vi.useFakeTimers(); const h = progressFixture({ liveActivity: true });
        try {
            const s = h.capture(); await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce();
            for (let i = 0; i < 5; i++) h.reports.toolStarted('t'+i, s, 'read', { path: 'PRIVATE-ARGS' });
            await vi.advanceTimersByTimeAsync(1999); expect(h.edit).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1); await h.reports.settled(); expect(h.edit).toHaveBeenCalledOnce(); expect(h.edit.mock.calls[0][1]).toBe('activity-1'); expect(h.edit.mock.calls[0][2]).not.toContain('PRIVATE');
            h.edit.mockResolvedValueOnce({ success: false, delivery: 'unknown', attempts: 1 } as any);
            h.reports.toolEnded('t0', false); await vi.advanceTimersByTimeAsync(2000); await h.reports.settled();
            h.reports.toolEnded('t1', false); await vi.advanceTimersByTimeAsync(8000); await h.reports.settled();
            expect(h.edit).toHaveBeenCalledTimes(2); expect(h.send).toHaveBeenCalledOnce();
        } finally { h.reports.reset(); vi.useRealTimers(); }
    });
    it('bounds completed interims and keeps queued chats distinct without suppressing finals', async () => {
        const h = progressFixture({ interimText: true, changedFiles: true }); const a = h.capture();
        const interim = { role: 'assistant', content: [{ type: 'text', text: 'A-only update' }, { type: 'toolCall', id: 't' }] };
        h.reports.interim(a, interim); await h.reports.settled();
        for (let i = 0; i < 6; i++) { h.router.freeze(); const s = h.router.snapshot()!; h.reports.capture(s, undefined, '/workspace'); h.reports.interim(s, interim); await h.reports.settled(); }
        expect(h.send.mock.calls.filter(call => call[1].startsWith('Progress:'))).toHaveLength(4);
        const b = h.capture(B); h.reports.toolStarted('b', b, 'write', { path: 'b-only.ts' }); h.reports.toolEnded('b', false);
        h.reports.finish(b, final); await h.reports.settled(); expect(h.send.mock.calls.at(-1)?.[0].target).toBe(B); expect(h.send.mock.calls.at(-1)?.[1]).toContain('b-only.ts');
        expect(h.send.mock.calls.filter(call => call[1].startsWith('Progress:')).every(call => call[0].target === A)).toBe(true);
        expect(h.router.canFinalize(b)).toBe(true);
    });
    it('omits oversized interims without truncation or exposing thinking-only frames', async () => {
        const h = progressFixture({ interimText: true }); const s = h.capture();
        h.reports.interim(s, { role: 'assistant', content: [{ type: 'text', text: 'x'.repeat(4096) }, { type: 'toolCall' }] });
        await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
        h.router.freeze(); const next = h.router.snapshot()!; h.reports.capture(next); h.reports.interim(next, { role: 'assistant', content: [{ type: 'thinking', thinking: 'private' }, { type: 'toolCall' }] }); await h.reports.settled(); expect(h.send).not.toHaveBeenCalled();
    });
    it('stops activity after an unknown initial send and never creates a replacement message', async () => {
        vi.useFakeTimers(); const h = progressFixture({ liveActivity: true }); h.send.mockResolvedValueOnce({ success: false, delivery: 'unknown', attempts: 1 } as any);
        try { const s = h.capture(); await h.reports.settled(); h.reports.toolStarted('t', s, 'read'); await vi.advanceTimersByTimeAsync(5000); h.reports.finish(s, final); await h.reports.settled(); expect(h.send).toHaveBeenCalledOnce(); expect(h.edit).not.toHaveBeenCalled(); }
        finally { h.reports.reset(); vi.useRealTimers(); }
    });
    it('withdraws pending activity/interims on reset and never applies a late opt-in', async () => {
        vi.useFakeTimers(); const h = progressFixture({ liveActivity: true });
        try { const s = h.capture(); await h.reports.settled(); h.reports.toolStarted('a', s, 'read'); h.reports.reset(); await vi.advanceTimersByTimeAsync(5000); expect(h.edit).not.toHaveBeenCalled(); }
        finally { h.reports.reset(); vi.useRealTimers(); }
        const stale = progressFixture({ interimText: true }); stale.prepare(); stale.revise(); stale.router.freeze(); const s = stale.router.snapshot()!; stale.reports.capture(s);
        stale.reports.interim(s, { role: 'assistant', content: [{ type: 'text', text: 'Do not send' }, { type: 'toolCall' }] }); await stale.reports.settled(); expect(stale.send).not.toHaveBeenCalled();
    });
});
