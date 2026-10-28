import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportedThinking, WhatsAppCommandRouter, type PhoneControlPorts } from '../../src/services/whatsapp-command.router.ts';
import { speechDefaults } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';

const owner = '15550000001@s.whatsapp.net'; const other = '15550000002@s.whatsapp.net'; const group = '120363000000@g.us';
const model = { provider: 'fixture', id: 'chat/exact', reasoning: true, thinkingLevelMap: { minimal: null, xhigh: 'xhigh' } } as any;
function fixture() {
    let revision = 0; let scope = 'account:1/session:1'; let idle = true; let pending = false; let allowed = true; let n = 0; let stats = false; let statsRevision = 0;
    let reporting = { changedFiles: false, interimText: false, liveActivity: false }; let reportingRevision = 0;
    let settings = speechDefaults(); const sent: string[] = [];
    const ctx = { isIdle: () => idle, hasPendingMessages: () => pending, getContextUsage: () => ({ percent: 25 }), model,
        modelRegistry: { getAvailable: vi.fn().mockResolvedValue([model]) }, compact: vi.fn(), abort: vi.fn(), shutdown: vi.fn(),
        sessionManager: { getSessionId: () => scope }, ui: { notify: vi.fn() }, newSession: vi.fn().mockResolvedValue({ cancelled: true }) };
    const ports = { pi: { getThinkingLevel: () => 'high', setThinkingLevel: vi.fn(), setModel: vi.fn().mockResolvedValue(true), sendUserMessage: vi.fn() },
        session: { getOperatorRevision: () => revision, getStatus: () => 'connected', getFinalAfterAttachments: () => true,
            getReplyStats: () => stats, getReplyStatsRevision: () => statsRevision,
            getReplyReporting: vi.fn(() => ({ ...reporting })), getReplyReportingRevision: () => reportingRevision,
            setReplyReporting: vi.fn(async (next, expected, current) => { if (!current() || expected !== reportingRevision) throw new Error('Expired'); reporting = next; reportingRevision++; }),
            setReplyStats: vi.fn(async (enabled, current) => { if (!current()) throw new Error('Expired'); stats = enabled; statsRevision++; }),
            getSpeechRevision: () => 0, getSpeechSettings: () => structuredClone(settings), setSpeechSettings: vi.fn(async (next, _revision, current) => { if (!current()) throw new Error('Expired'); settings = next; }),
            setFinalAfterAttachments: vi.fn(), getAuthStateDir: () => '/synthetic/profile' },
        context: () => ctx, scope: () => scope, account: () => 'account:1', allowed: () => allowed, canonical: (jid: string) => jid,
        actor: (key: any) => key.fromMe === false ? key.participant ?? key.remoteJid : undefined, owner: (actor: string) => actor === owner,
        send: vi.fn(async (_chat, text, current) => { if (!current()) return { success: false, attempts: 0 }; sent.push(text); return { success: true, messageId: `sent-${++n}`, attempts: 1 }; }),
        stop: vi.fn().mockResolvedValue(undefined), off: vi.fn().mockResolvedValue(undefined), resume: vi.fn().mockResolvedValue(true), notify: vi.fn() };
    const router = new WhatsAppCommandRouter(ports as unknown as PhoneControlPorts);
    const handle = (text: string, actor = owner, chat = actor, quotedId?: string) => router.handle({ key: { remoteJid: chat, id: `incoming-${n}`, fromMe: false, ...(chat === group ? { participant: actor } : {}) },
        message: { conversation: text }, sessionContext: { accountScope: 'account:1', generation: 1 }, senderNumber: actor }, text, quotedId);
    return { router, ports, ctx, sent, handle, busy: () => { idle = false; }, queued: () => { pending = true; }, revoke: () => { revision++; }, replace: () => { scope = 'account:2/session:2'; },
        deny: () => { allowed = false; }, changeStats: () => { statsRevision++; }, changeReporting: () => { reportingRevision++; }, settings: () => settings, enableSpeech: () => { settings.enabled = true; settings.approvedDestinationKey = resolveTtsConfig(settings.config).destinationKey; } };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('exact owner phone controls', () => {
    it('preserves existing phone reply/stat controls when saved optional reporting is malformed', async () => {
        const h = fixture(); h.ports.session.getReplyReporting.mockImplementation(() => { throw new Error('Invalid saved reporting'); });
        await h.handle('/replies'); expect(h.sent.at(-1)).toContain('final stats Off'); await h.handle('3'); expect(h.ports.session.getReplyStats()).toBe(true);
        await h.handle('/replies'); await h.handle('2'); expect(h.ports.session.setFinalAfterAttachments).toHaveBeenCalledWith(false, expect.any(Function));
    });
    it('keeps reporting separately opt-in and warns the verified owner about shared metadata/text', async () => {
        const h = fixture(); await h.handle('/replies'); expect(h.sent.at(-1)).toContain('workspace-relative');
        await h.handle('5'); expect(h.ports.session.getReplyReporting()).toEqual({ changedFiles: true, interimText: false, liveActivity: false }); expect(h.ports.session.getReplyStats()).toBe(false);
    });
    it('rejects stale reporting menus and never lets a foreign actor select a reporting action', async () => {
        const h = fixture(); await h.handle('/replies'); await h.handle('5', other); expect(h.ports.session.setReplyReporting).not.toHaveBeenCalled();
        h.changeReporting(); await h.handle('5'); expect(h.ports.session.getReplyReporting().changedFiles).toBe(false); expect(h.sent.at(-1)).toContain('Phone command failed');
    });
    it.each(['/modelSomething', '/abortive', '/compaction', 'task /model fixture/chat'])('leaves %s ordinary', async text => {
        const h = fixture(); expect(await h.handle(text)).toBe(false); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.ctx.compact).not.toHaveBeenCalled();
    });
    it.each(['/model fixture/chat/exact', '/think high', '/stop', '/abort', '/compact focus', '/new', '/voice text', '/replies', '/off', '/quit'])('denies non-owner %s without effect', async command => {
        const h = fixture(); expect(await h.handle(command, other)).toBe(true); expect(h.sent.join()).toContain('Owner authorization');
        expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.ports.pi.setThinkingLevel).not.toHaveBeenCalled();
        expect(h.ctx.compact).not.toHaveBeenCalled(); expect(h.ports.stop).not.toHaveBeenCalled(); expect(h.ports.off).not.toHaveBeenCalled(); expect(h.ports.pi.sendUserMessage).not.toHaveBeenCalled();
    });
    it('uses the actual group participant, not the allowed group or a spoofed header', async () => {
        const h = fixture(); await h.handle('/model fixture/chat/exact', other, group); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('/model fixture/chat/exact', owner, group); expect(h.ports.pi.setModel).toHaveBeenCalledWith(model);
    });
    it('never acts outside the allowed/bound chat', async () => { const h = fixture(); h.deny(); await h.handle('/stop'); expect(h.ports.stop).not.toHaveBeenCalled(); expect(h.sent).toEqual([]); });
    it.each(['busy', 'queued'])('does not silently interrupt %s Pi for model changes', async state => {
        const h = fixture(); if (state === 'busy') h.busy(); else h.queued();
        await h.handle('/model fixture/chat/exact'); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.ports.stop).not.toHaveBeenCalled(); expect(h.sent.join()).toContain('/stop');
    });
    it('selects only an exact authenticated model with no fallback', async () => {
        const h = fixture(); await h.handle('/model chat/exact'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('/model fixture/chat/exact'); expect(h.ports.pi.setModel).toHaveBeenCalledWith(model);
    });
    it('rechecks authority and busy state after asynchronous model discovery', async () => {
        const h = fixture(); let release!: (models: any[]) => void;
        h.ctx.modelRegistry.getAvailable.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const work = h.handle('/model fixture/chat/exact'); h.revoke(); release([model]); await work; expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it.each(['/think minimal', '/think max', '/think arbitrary'])('rejects unsupported %s rather than clamping', async command => {
        const h = fixture(); await h.handle(command); expect(h.ports.pi.setThinkingLevel).not.toHaveBeenCalled(); expect(h.sent.join()).toContain('Unsupported');
    });
    it('validates thinking capabilities identically to the pinned public SDK helper', () => {
        for (const candidate of [model, { ...model, reasoning: false }, { ...model, thinkingLevelMap: undefined }, { ...model, thinkingLevelMap: { off: null, high: null, max: 'max' } }])
            expect(supportedThinking(candidate)).toEqual(getSupportedThinkingLevels(candidate));
    });
    it('reports observed compaction completion/error, not optimistic success', async () => {
        const h = fixture(); await h.handle('/compact preserve decisions'); expect(h.ctx.compact).toHaveBeenCalledOnce();
        expect(h.sent.join()).not.toContain('session compacted.'); const options = h.ctx.compact.mock.calls[0][0] as any;
        expect(options.customInstructions).toBe('preserve decisions'); options.onComplete({}); await Promise.resolve(); expect(h.sent.join()).toContain('session compacted.');
    });
    it('drops a late compaction callback after session replacement', async () => {
        const h = fixture(); await h.handle('/compact'); h.replace(); const before = h.sent.length;
        (h.ctx.compact.mock.calls[0][0] as any).onError(new Error('synthetic')); await Promise.resolve(); expect(h.sent.length).toBe(before);
    });
    it('offers truthful help/status without paths, keys or shell commands', async () => {
        const h = fixture(); await h.handle('/help', other); await h.handle('/status', other);
        expect(h.sent.join()).toContain('shared Pi session'); expect(h.sent.join()).toContain('25%'); expect(h.sent.join()).not.toContain('/synthetic');
    });
    it('uses owner-only numbered choices and ordinary text cancels the state', async () => {
        const h = fixture(); await h.handle('/model'); expect(h.sent[0]).toContain('1. fixture/chat/exact');
        expect(await h.handle('ordinary task')).toBe(false); await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('/model'); await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledWith(model);
    });
    it('does not let an obsolete send completion remove a replacement menu', async () => {
        const h = fixture(); let complete!: (result: any) => void; let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        h.ports.send.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; entered(); }));
        const old = h.handle('/model'); await started; await h.handle('/voice');
        complete({ success: true, messageId: 'old-menu', attempts: 1 }); await old;
        await h.handle('1'); expect(h.ports.session.setSpeechSettings).toHaveBeenCalledOnce();
    });

    it('revalidates menu model availability rather than selecting a replacement list index', async () => {
        const h = fixture(); await h.handle('/model'); h.ctx.modelRegistry.getAvailable.mockResolvedValue([{ ...model, id: 'different' }]);
        await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it('does not let another group participant cancel the owner menu with commands or numeric votes', async () => {
        const h = fixture(); await h.handle('/think', owner, group);
        await h.handle('/help', other, group); await h.handle('/model invalid', other, group);
        expect(await h.handle('3', other, group, 'sent-1')).toBe(true);
        await h.handle('3', owner, group, 'sent-1'); expect(h.ports.pi.setThinkingLevel).toHaveBeenCalledWith('medium');
    });
    it.each(['/Users/private/models/fixture.gguf', './models/client-a.gguf', '../models/client-a.gguf', '~/.cache/acme/weights.gguf', 'C:\\models\\weights.gguf', String.raw`\\server\share\weights.gguf`, 'file:///opt/models/weights.gguf'])('does not reveal filesystem identifier %s in status, menus or acknowledgements', async id => {
        const h = fixture(); h.ctx.model = { ...model, id };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([h.ctx.model]);
        await h.handle('/status'); await h.handle('/model'); await h.handle('1');
        expect(h.sent.join()).not.toContain(id); expect(h.sent.join()).toContain('private identifier hidden');
    });

    it('does not redact ordinary organization/model identifiers', async () => {
        const h = fixture(); h.ctx.model = { ...model, id: 'organization/model' };
        await h.handle('/status'); expect(h.sent.join()).toContain('organization/model');
    });
    it('requires exact quoted menu selection in groups', async () => {
        const h = fixture(); await h.handle('/think', owner, group); await h.handle('3', other, group, 'sent-1');
        expect(h.ports.pi.setThinkingLevel).not.toHaveBeenCalled(); await h.handle('3', owner, group, 'sent-1'); expect(h.ports.pi.setThinkingLevel).toHaveBeenCalledWith('medium');
    });
    it('does not grant destination consent or group opt-in from the phone', async () => {
        const h = fixture(); await h.handle('/voice voice'); expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled();
        h.enableSpeech(); await h.handle('/voice voice', owner, group); expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled();
        await h.handle('/voice mirror'); expect(h.settings().chats[owner].mode).toBe('mirror');
    });
    it('keeps text-mode selection available without speech consent and preserves pauses', async () => {
        const h = fixture(); h.settings().chats[owner] = { automaticReplies: false }; await h.handle('/voice text');
        expect(h.settings().chats[owner]).toEqual({ automaticReplies: false, mode: 'text' });
    });
    it('changes final stats only for the owner and acknowledges after its own revision commit', async () => {
        const h = fixture(); await h.handle('/replies', other); expect(h.ports.session.setReplyStats).not.toHaveBeenCalled();
        await h.handle('/replies'); await h.handle('3'); expect(h.ports.session.getReplyStats()).toBe(true);
        expect(h.ports.session.setReplyStats).toHaveBeenCalledOnce(); expect(h.sent.at(-1)).toContain('Shared final stats enabled');
        expect(h.ports.session.setFinalAfterAttachments).not.toHaveBeenCalled();
    });
    it('rejects a stale stats menu without restoring an older preference', async () => {
        const h = fixture(); await h.handle('/replies'); h.changeStats(); await h.handle('3');
        expect(h.ports.session.getReplyStats()).toBe(false); expect(h.sent.at(-1)).toContain('Phone command failed');
    });
    it('changes only implemented reply settings, with a captured authorization guard', async () => {
        const h = fixture(); await h.handle('/replies'); expect(h.sent[0]).toContain('activity Off'); await h.handle('2');
        expect(h.ports.session.setFinalAfterAttachments).toHaveBeenCalledWith(false, expect.any(Function));
    });
    it.each(['off', 'quit'])('requires explicit %s confirmation and retains credentials', async command => {
        const h = fixture(); await h.handle('/'+command); expect(h.ports.off).not.toHaveBeenCalled(); expect(h.ctx.shutdown).not.toHaveBeenCalled();
        await h.handle('1'); expect(h.ports.off).not.toHaveBeenCalled(); expect(h.ctx.shutdown).not.toHaveBeenCalled();
        await h.handle('/'+command); h.busy(); await h.handle('2');
        if (command === 'off') expect(h.ports.off).toHaveBeenCalledOnce(); else expect(h.ctx.shutdown).toHaveBeenCalledOnce();
    });
    it('does not resend or add a poll after an unknown numbered-menu delivery', async () => {
        const h = fixture(); const poll = vi.fn(); (h.ports as any).poll = poll;
        h.ports.send.mockResolvedValueOnce({ success: false, delivery: 'unknown', messageId: 'unknown-menu', attempts: 1 } as any);
        await h.handle('/model'); expect(h.ports.send).toHaveBeenCalledOnce(); expect(poll).not.toHaveBeenCalled();
    });
    it('dispatches /new through one-use native command tokens, never directly from an event context', async () => {
        const h = fixture(); await h.handle('/new'); expect(h.ports.pi.sendUserMessage).not.toHaveBeenCalled();
        await h.handle('2'); const [content, options] = h.ports.pi.sendUserMessage.mock.calls[0]; expect(options).toMatchObject({ expandPromptTemplates: true, deliverAs: 'followUp' });
        expect(h.ctx.newSession).not.toHaveBeenCalled(); const args = (content as string).slice('/whatsapp '.length);
        await h.router.gateway(args, h.ctx as any); expect(h.ctx.newSession).toHaveBeenCalledOnce();
        await h.router.gateway(args, h.ctx as any); expect(h.ctx.newSession).toHaveBeenCalledOnce();
    });
    it('refuses forged or expired native session tokens', async () => {
        vi.useFakeTimers(); const h = fixture(); await h.router.gateway('--internal control-new 00000000-0000-0000-0000-000000000000', h.ctx as any);
        await h.handle('/new'); await h.handle('2'); vi.advanceTimersByTime(15_001);
        await h.router.gateway((h.ports.pi.sendUserMessage.mock.calls[0][0] as string).slice('/whatsapp '.length), h.ctx as any);
        expect(h.ctx.newSession).not.toHaveBeenCalled();
    });
});
