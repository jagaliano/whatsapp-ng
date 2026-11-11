import { describe, expect, it, vi } from 'vitest';
import { ConversationRouter } from '../../src/services/conversation-router.service.ts';
import { OptionalOutputService, validateOptionalOutputs, type OptionalOutputs } from '../../src/services/optional-output.service.ts';

const owner = '15550000001@s.whatsapp.net'; const group = '120363000001@g.us';
const image = { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' };
function fixture(origin = 'whatsapp', settings: any = { imageTools: ['screenshot'], terminal: { ownerJid: owner, accountScope: 'fixture' } }) {
    const router = new ConversationRouter(); let valid = true; let disposed = 0;
    const send = vi.fn(async (_snapshot: any, request: any) => { const result = { success: true, attempts: 1 }; await request.onSettled?.(result); return result; });
    const prepare = vi.fn(async () => ({ content: { image: { url: 'private-snapshot' } }, metadata: { type: 'image' }, dispose: async () => { disposed++; } }));
    const notify = vi.fn();
    const service = new OptionalOutputService({ router, policy: () => ({ settings, ownerJid: owner, accountScope: 'fixture', isCurrent: () => valid }),
        allowed: () => true, prepareImage: prepare, send, notify });
    router.startRun();
    if (origin === 'whatsapp') { const input = router.prepare('input', { remoteJid: group, id: 'm', fromMe: false, participant: owner }); router.observeInput({ source: 'extension', text: input.content }); router.consume({ role: 'user', content: input.content }); }
    else { router.observeInput({ source: origin === 'terminal' ? 'interactive' : 'extension', text: 'input' }); router.consume({ role: 'user', content: 'input' }); }
    service.noteInput(); router.freeze(); service.capture(router.snapshot()!, '/workspace');
    return { router, service, prepare, send, notify, disposed: () => disposed, revoke: () => { valid = false; }, settings };
}
async function tool(f: ReturnType<typeof fixture>, id = 'tool-1', name = 'screenshot', result: any = { content: [image] }, isError = false) {
    f.service.toolStarted(id, name, f.router.snapshot()); await f.service.toolEnded(id, name, result, isError);
}
describe('optional outputs', () => {
    it('defaults both outputs off; rejects invalid tool/owner configuration', () => {
        expect(validateOptionalOutputs(undefined)).toEqual({ imageTools: [] });
        for (const value of [{ imageTools: ['*'] }, { imageTools: ['send_wa_media'] }, { imageTools: [], terminal: { ownerJid: group, accountScope: 'a' } }, { imageTools: [], terminal: { ownerJid: owner } }]) expect(() => validateOptionalOutputs(value)).toThrow();
    });
    it('only sends approved completed image blocks in verified WhatsApp work', async () => {
        const f = fixture(); await tool(f); expect(f.send).toHaveBeenCalledTimes(1); expect(f.send.mock.calls[0][1].recipientJid).toBe(group); expect(f.disposed()).toBe(1);
        for (const origin of ['terminal', 'unknown']) { const other = fixture(origin); await tool(other); expect(other.send).not.toHaveBeenCalled(); }
    });
    it('does not upload text/details paths, URLs, errors, unapproved tools or unstarted results', async () => {
        const f = fixture();
        await tool(f, 'a', 'read', { content: [image] }); await tool(f, 'b', 'screenshot', { content: [image] }, true);
        await tool(f, 'c', 'screenshot', { content: [{ type: 'text', text: '/workspace/private.png' }], details: { path: '/workspace/private.png' } });
        await tool(f, 'd', 'screenshot', { content: [{ ...image, data: 'https://example.invalid/a.png' }] });
        await tool(f, 'e', 'screenshot', { content: [image], isError: true });
        await f.service.toolEnded('missing', 'screenshot', { content: [image] }, false); expect(f.send).not.toHaveBeenCalled();
    });
    it('reserves hash dedup before concurrent prepare and does not retry unknown delivery', async () => {
        const f = fixture(); f.send.mockImplementation(async (_snapshot: any, request: any) => { const result = { success: false, delivery: 'unknown' }; await request.onSettled?.(result); return result as any; });
        await Promise.all([tool(f, 'a'), tool(f, 'b')]); await tool(f, 'c'); expect(f.prepare).toHaveBeenCalledTimes(1); expect(f.send).toHaveBeenCalledTimes(1);
    });
    it('retains an upload until deferred transport settlement and never repeats it', async () => {
        const f = fixture(); f.send.mockImplementation(async () => ({ success: false, delivery: 'unknown' } as any));
        await tool(f); expect(f.disposed()).toBe(0);
        await tool(f, 'duplicate'); expect(f.send).toHaveBeenCalledTimes(1);
        const request = f.send.mock.calls[0][1]; await request.onSettled({ success: true }); await request.onSettled({ success: true });
        expect(f.disposed()).toBe(1);
    });
    it('an explicit text send to the owner suppresses terminal forwarding even when delivery is unknown', async () => {
        const f = fixture('terminal'); const token = f.router.beginSend(f.router.snapshot(), owner, 'explicit-text'); f.router.finishSend(token, { success: false, delivery: 'unknown' });
        f.router.buffer({ role: 'assistant', content: 'already covered' }); await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled();
    });
    it('caps outstanding uploads across inputs until their deferred settlements complete', async () => {
        const f = fixture(); f.send.mockImplementation(async () => ({ success: false, delivery: 'unknown' } as any));
        await tool(f, 'many', 'screenshot', { content: Array.from({ length: 4 }, (_, i) => ({ ...image, data: Buffer.from('image'+i).toString('base64') })) });
        expect(f.send).toHaveBeenCalledTimes(4); f.service.noteInput(); f.service.capture(f.router.snapshot()!, '/workspace');
        await tool(f, 'next'); expect(f.send).toHaveBeenCalledTimes(4); expect(f.prepare).toHaveBeenCalledTimes(4);
        for (const call of f.send.mock.calls) await call[1].onSettled({ success: false });
        expect(f.disposed()).toBe(4);
    });
    it('bounds images and total bytes and ignores a late opt-in for the current input', async () => {
        const f = fixture(); await tool(f, 'many', 'screenshot', { content: Array.from({ length: 10 }, (_, i) => ({ ...image, data: Buffer.from('image'+i).toString('base64') })) });
        expect(f.send.mock.calls.length).toBeLessThanOrEqual(4);
        const off = fixture('whatsapp', { imageTools: [] }); off.settings.imageTools.push('screenshot'); await tool(off); expect(off.send).not.toHaveBeenCalled();
        const huge = fixture(); await tool(huge, 'huge', 'screenshot', { content: [{ ...image, data: 'A'.repeat(36 * 1024 * 1024) }] }); expect(huge.prepare).not.toHaveBeenCalled();
    });
    it('cancels preparation and disposes without sending after admission/session change', async () => {
        const f = fixture(); const dispose = vi.fn(async () => {}); f.prepare.mockImplementation(async () => { f.revoke(); return { content: {} as any, metadata: { type: 'image' } as any, dispose }; });
        await tool(f); expect(f.send).not.toHaveBeenCalled(); expect(dispose).toHaveBeenCalledTimes(1);
        const g = fixture(); g.router.reset(); await tool(g); expect(g.prepare).not.toHaveBeenCalled();
    });
    it('sends only a complete terminal final to the explicitly consented private owner', async () => {
        const f = fixture('terminal'); f.router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'Final answer' }], stopReason: 'stop' });
        await f.service.forwardTerminal(); await f.service.forwardTerminal(); expect(f.send).toHaveBeenCalledTimes(1); expect(f.send.mock.calls[0][1]).toMatchObject({ recipientJid: owner, text: 'Final answer' });
        for (const origin of ['whatsapp', 'unknown']) { const other = fixture(origin); other.router.buffer({ role: 'assistant', content: 'not terminal' }); await other.service.forwardTerminal(); expect(other.send).not.toHaveBeenCalled(); }
    });
    it('does not forward thinking/tool/error output, missing consent or revoked policy', async () => {
        for (const stopReason of ['error', 'aborted']) { const f = fixture('terminal'); f.router.buffer({ role: 'assistant', content: 'no', stopReason }); await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled(); }
        const f = fixture('terminal'); f.router.buffer({ role: 'assistant', content: [{ type: 'text', text: 'working' }, { type: 'toolCall' }] }); await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled();
        const off = fixture('terminal', { imageTools: [] }); off.router.buffer({ role: 'assistant', content: 'private' }); await off.service.forwardTerminal(); expect(off.send).not.toHaveBeenCalled();
        const stale = fixture('terminal'); stale.router.buffer({ role: 'assistant', content: 'private' }); stale.revoke(); await stale.service.forwardTerminal(); expect(stale.send).not.toHaveBeenCalled();
    });
    it('bounds forwarded text in UTF-8 bytes, including non-ASCII answers', async () => {
        const f = fixture('terminal'); f.router.buffer({ role: 'assistant', content: '漢'.repeat(30 * 1024) });
        await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled();
        expect(f.notify).toHaveBeenCalledWith('Terminal answer exceeds 64 KiB; kept local.');
    });
    it('never retargets a captured terminal answer on owner/account change', async () => {
        const f = fixture('terminal', { imageTools: [], terminal: { ownerJid: '15550000002@s.whatsapp.net', accountScope: 'fixture' } });
        f.router.buffer({ role: 'assistant', content: 'private' }); await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled();
        const other = fixture('terminal', { imageTools: [], terminal: { ownerJid: owner, accountScope: 'other' } }); other.router.buffer({ role: 'assistant', content: 'private' }); await other.service.forwardTerminal(); expect(other.send).not.toHaveBeenCalled();
    });
});


describe('autonomous consent validator', () => {
    it.each(['owner', 'group'])('round-trips independent %s consent with required authority fields', kind => {
        const autonomous = { kind, jid: kind === 'owner' ? owner : group, ownerJid: owner, accountScope: 'fixture' };
        const settings = { imageTools: [], autonomous, terminal: { ownerJid: owner, accountScope: 'fixture' } };
        expect(validateOptionalOutputs(settings)).toEqual(settings);
        for (const key of ['ownerJid', 'accountScope']) {
            const invalid: Record<string, unknown> = { ...autonomous }; delete invalid[key];
            expect(() => validateOptionalOutputs({ imageTools: [], autonomous: invalid })).toThrow();
        }
    });
    it('rejects malformed, unsupported or mismatched autonomous consent', () => {
        const consent = { kind: 'owner', jid: owner, ownerJid: owner, accountScope: 'fixture' };
        for (const patch of [{ kind: 'other' }, { jid: group }, { jid: '15550000002@s.whatsapp.net' }, { ownerJid: group },
            { accountScope: '' }, { accountScope: 'x'.repeat(257) }, { extra: true }, { kind: 'group', jid: owner }]) {
            expect(() => validateOptionalOutputs({ imageTools: [], autonomous: { ...consent, ...patch } })).toThrow();
        }
    });
});

function createAutonomousFixture(kind: 'owner' | 'group', role: 'custom' | 'user') {
    const consent = { kind, jid: kind === 'owner' ? owner : group, ownerJid: owner, accountScope: 'fixture' };
    const state = { settings: { imageTools: [], autonomous: consent, terminal: { ownerJid: owner, accountScope: 'fixture' } } as OptionalOutputs,
        revision: 0, current: true, owner, account: 'fixture', allowed: true, terminalCurrent: true };
    const router = new ConversationRouter();
    const send = vi.fn(async (_snapshot: unknown, request: import('../../src/models/whatsapp.types.ts').MessageRequest) => {
        const result = { success: true, attempts: 1 }; await request.onSettled?.(result); return result as import('../../src/models/whatsapp.types.ts').MessageResult;
    });
    const notify = vi.fn(); const prepareImage = vi.fn();
    const service = new OptionalOutputService({ router, allowed: () => state.allowed, send, notify, prepareImage,
        policy: () => { const revision = state.revision; const ownerAtInput = state.owner; const account = state.account;
            return { settings: state.settings, ownerJid: state.owner, accountScope: state.account,
                isCurrent: () => state.current && state.revision === revision && state.owner === ownerAtInput && state.account === account,
                terminalCurrent: () => state.terminalCurrent }; } });
    const input = () => {
        if (role === 'user') router.observeInput({ source: 'extension', text: 'Background result' });
        router.consume({ role, content: 'Background result' }); service.noteInput(); router.freeze(); service.capture(router.snapshot()!, '/workspace');
    };
    router.noteRunStart(role); router.startRun(); input();
    const answer = (text = 'Final background answer', stopReason = 'stop') => router.buffer({ role: 'assistant', content: text, stopReason });
    return { router, service, send, notify, state, answer, input, prepareImage };
}
describe.each(['custom', 'user'] as const)('autonomous %s final projection', role => {
    const autonomousFixture = (kind: 'owner' | 'group' = 'owner') => createAutonomousFixture(kind, role);
    it.each(['owner', 'group'] as const)('sends one text to the %s, never voice, then claims duplicate callbacks', async kind => {
        const f = autonomousFixture(kind); f.answer(); await f.service.forwardAutonomous(); await f.service.forwardAutonomous();
        expect(f.send).toHaveBeenCalledTimes(1);
        expect(f.send.mock.calls[0][1]).toMatchObject({ recipientJid: kind === 'owner' ? owner : group, text: 'Final background answer', options: { maxRetries: 1 } });
        expect(f.send.mock.calls[0][1].content).toBeUndefined(); expect(f.prepareImage).not.toHaveBeenCalled();
        expect(f.router.getControlOrigin()).toBe('unknown');
    });
    it.each(['error', 'aborted', 'tool-only', 'toolUse', 'empty'])('keeps %s output local', async reason => {
        const f = autonomousFixture();
        f.router.buffer({ role: 'assistant', stopReason: reason, content: reason === 'toolUse' || reason === 'tool-only'
            ? [{ type: 'toolCall' }, ...(reason === 'toolUse' ? [{ type: 'text', text: 'working' }] : [])] : reason === 'empty' ? '' : 'failure' });
        await f.service.forwardAutonomous(); expect(f.send).not.toHaveBeenCalled();
    });
    it.each(['accepted', 'inflight', 'unknown'])('does not duplicate an %s explicit send', async outcome => {
        const f = autonomousFixture(); const token = f.router.beginSend(f.router.snapshot(), owner);
        if (outcome !== 'inflight') f.router.finishSend(token, { success: outcome === 'accepted', ...(outcome === 'unknown' ? { delivery: 'unknown' as const } : {}) });
        f.answer(); await f.service.forwardAutonomous(); expect(f.send).not.toHaveBeenCalled();
    });
    it('keeps terminal forwarding separate in both directions', async () => {
        const f = autonomousFixture(); f.answer(); await f.service.forwardTerminal(); expect(f.send).not.toHaveBeenCalled();
        const local = fixture('terminal'); local.router.buffer({ role: 'assistant', content: 'Terminal' });
        await local.service.forwardAutonomous(); expect(local.send).not.toHaveBeenCalled();
        await local.service.forwardTerminal(); expect(local.send).toHaveBeenCalledTimes(1);
        for (const origin of ['whatsapp', 'unknown']) { const other = fixture(origin); await other.service.forwardAutonomous(); expect(other.send).not.toHaveBeenCalled(); }
    });
    it.each(['disconnected', 'off', 'logout', 'session', 'revision', 'owner', 'account', 'group-removed', 'group-paused', 'bound-group', 'abort'])('fences %s without replay', async change => {
        const f = autonomousFixture('group'); f.answer();
        if (['disconnected', 'off', 'logout', 'session'].includes(change)) f.state.current = false;
        else if (change === 'revision') f.state.revision++;
        else if (change === 'owner') f.state.owner = '15550000002@s.whatsapp.net';
        else if (change === 'account') f.state.account = 'different';
        else if (change === 'abort') f.service.reset();
        else f.state.allowed = false;
        await f.service.forwardAutonomous(); expect(f.send).not.toHaveBeenCalled();
    });
    it.each(['owner-group', 'group-owner', 'group-group'])('sends nothing to either destination on %s change, including later custom inputs', async change => {
        const f = autonomousFixture(change.startsWith('owner') ? 'owner' : 'group'); f.answer();
        f.state.revision++; f.state.settings.autonomous = { kind: change === 'group-owner' ? 'owner' : 'group',
            jid: change === 'group-owner' ? owner : '120363000002@g.us', ownerJid: owner, accountScope: 'fixture' };
        await f.service.forwardAutonomous(); f.input(); f.answer(); await f.service.forwardAutonomous(); await f.service.forwardAutonomous();
        expect(f.send).not.toHaveBeenCalled();
    });
    it.each(['off', 'malformed'])('cannot opt in after an initially %s first input, even via a later custom input', async mode => {
        const f = autonomousFixture(); f.router.endRun(false); f.service.reset();
        f.state.settings = mode === 'off' ? { imageTools: [] } : { imageTools: [], autonomous: { kind: 'bogus' } } as unknown as OptionalOutputs;
        f.router.noteRunStart('custom'); f.router.startRun(); f.input();
        f.state.settings = { imageTools: [], autonomous: { kind: 'owner', jid: owner, ownerJid: owner, accountScope: 'fixture' } }; f.state.revision++;
        f.answer(); await f.service.forwardAutonomous(); f.input(); f.answer(); await f.service.forwardAutonomous();
        expect(f.send).not.toHaveBeenCalled();
    });
    it('keeps oversized UTF-8 text entirely local with a notice', async () => {
        const f = autonomousFixture(); f.answer('漢'.repeat(30 * 1024)); await f.service.forwardAutonomous();
        expect(f.send).not.toHaveBeenCalled(); expect(f.notify).toHaveBeenCalledWith('Autonomous answer exceeds 64 KiB; kept local.');
    });
    it.each(['unknown', 'rejected', 'thrown'])('does not retry %s delivery on later callbacks', async outcome => {
        const f = autonomousFixture();
        if (outcome === 'thrown') f.send.mockRejectedValue(new Error('Synthetic failure'));
        else f.send.mockResolvedValue({ success: false, attempts: 1, ...(outcome === 'unknown' ? { delivery: 'unknown' as const } : {}) });
        f.answer(); await f.service.forwardAutonomous(); await f.service.forwardAutonomous();
        expect(f.send).toHaveBeenCalledTimes(1); expect(f.notify).toHaveBeenCalled();
    });
    it('retains the existing four-job capacity through unknown settlements', async () => {
        const f = autonomousFixture(); f.send.mockResolvedValue({ success: false, attempts: 1, delivery: 'unknown' });
        for (let i = 0; i < 5; i++) { f.input(); f.answer(); await f.service.forwardAutonomous(); }
        expect(f.send).toHaveBeenCalledTimes(4);
        expect(f.notify).toHaveBeenCalledWith('Optional output capacity reached; not queued or retried.');
        for (const [, request] of f.send.mock.calls) await request.onSettled?.({ success: false, attempts: 1 });
    });
});
