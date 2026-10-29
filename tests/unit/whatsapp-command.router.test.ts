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
    it('preserves exact authenticated selection ahead of fuzzy matches', async () => {
        const h = fixture(); h.ctx.modelRegistry.getAvailable.mockResolvedValue([model, { ...model, id: 'chat/exact-extra' }]);
        await h.handle('/model fixture/chat/exact'); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(model);
        expect(h.sent.at(-1)).toContain('Shared model selected: fixture/chat/exact.');
    });
    it.each(['acme', 'cld', 'ACME / CLD', 'cld acme'])('finds fuzzy provider/model matches for %s without silently selecting', async query => {
        const h = fixture(); const candidate = { ...model, provider: 'acme', id: 'claude-chat' };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([model, candidate]);
        await h.handle('/model ' + query);
        expect(h.sent.at(-1)).toContain('1. acme/claude-chat'); expect(h.sent.at(-1)).not.toContain('fixture/chat/exact');
        expect(h.ports.pi.setModel).not.toHaveBeenCalled(); await h.handle('1');
        expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(candidate);
    });
    it.each(['DeepSeek', 'Deepseek', 'deepseek'])('shows %s models across every authenticated provider', async query => {
        const h = fixture(); const choices = [
            { ...model, provider: 'deepseek', id: 'deepseek-chat' },
            { ...model, provider: 'opencode-go', id: 'deepseek-v4.1-flash' },
            { ...model, provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash' }
        ];
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([model, ...choices]); await h.handle('/model ' + query);
        for (const candidate of choices) expect(h.sent.at(-1)).toContain(`${candidate.provider}/${candidate.id}`);
        expect(h.sent.at(-1)).not.toContain('fixture/chat/exact'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        const option = h.sent.at(-1)!.split('\n').find(line => line.includes('openrouter/deepseek/'))!;
        await h.handle(option.split('.')[0]); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(choices[2]);
    });
    it('requires confirmation even for a single model-only match', async () => {
        const h = fixture(); await h.handle('/model chat/exact'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        expect(h.sent.at(-1)).toContain('1. fixture/chat/exact'); await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledWith(model);
    });
    it('ranks a tight model match before a sparse subsequence', async () => {
        const h = fixture(); const tight = { ...model, id: 'cld' }; const sparse = { ...model, id: 'claude' };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([sparse, tight]); await h.handle('/model cld');
        expect(h.sent.at(-1)).toContain('1. fixture/cld\n2. fixture/claude'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it('does not select a fallback or echo raw queries when no models match', async () => {
        const h = fixture(); await h.handle('/model missing-secret-search');
        expect(h.sent.at(-1)).toContain('No authenticated models match'); expect(h.sent.join()).not.toContain('missing-secret-search');
        await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it('retains the fuzzy filter through next/previous pages and selects the exact displayed model', async () => {
        const h = fixture(); const choices = Array.from({ length: 23 }, (_, index) => ({ ...model, provider: 'search-provider', id: `chat-${String(index + 1).padStart(2, '0')}` }));
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([{ ...model, provider: 'unrelated', id: 'chat-00' }, ...choices]);
        await h.handle('/model search-provider/chat'); expect(h.sent.at(-1)).toContain('1. search-provider/chat-01');
        await h.handle('11'); expect(h.sent.at(-1)).toContain('1. search-provider/chat-11');
        await h.handle('12'); expect(h.sent.at(-1)).toContain('1. search-provider/chat-21');
        await h.handle('4'); expect(h.sent.at(-1)).toContain('1. search-provider/chat-11');
        expect(h.sent.join()).not.toContain('unrelated/chat-00'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(choices[10]);
    });
    it('clamps a filtered page after authenticated model availability shrinks', async () => {
        const h = fixture(); const choices = Array.from({ length: 11 }, (_, index) => ({ ...model, provider: 'search-provider', id: `chat-${index}` }));
        h.ctx.modelRegistry.getAvailable.mockResolvedValue(choices); await h.handle('/model search-provider');
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([choices[0]]); await h.handle('11');
        expect(h.sent.at(-1)).toContain('1. search-provider/chat-0'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it('never treats raw search text as an internal pagination action', async () => {
        const h = fixture(); await h.handle('/model page:1');
        expect(h.sent.at(-1)).toContain('No authenticated models match'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it.each(['hidden-marker', 'hidden', 'open', 'gpt', 'config', 'model'])('does not search private identifiers or their redaction placeholder for %s', async query => {
        const h = fixture(); const privateModel = { ...model, id: '/Users/private/models/hidden-marker.gguf' };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([privateModel]); await h.handle('/model ' + query);
        expect(h.sent.at(-1)).toContain('No authenticated models match'); expect(h.sent.join()).not.toContain(privateModel.id);
        await h.handle('/model'); expect(h.sent.at(-1)).toContain('Configured model (private identifier hidden)');
    });
    it('keeps genuine provider matches without adding identical private placeholders', async () => {
        const h = fixture(); const publicModel = { ...model, provider: 'openrouter', id: 'chat' };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([publicModel, { ...model, id: '/Users/private/model.gguf' }]);
        await h.handle('/model open'); expect(h.sent.at(-1)).toContain('1. openrouter/chat');
        expect(h.sent.at(-1)).not.toContain('Configured model'); await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(publicModel);
    });
    it('searches the full public identifier even beyond the displayed label length', async () => {
        const h = fixture(); const candidate = { ...model, id: 'long-'.repeat(30) + 'distinct-suffix' };
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([candidate]); await h.handle('/model distinct-suffix');
        expect(h.sent.at(-1)).toContain('1. fixture/long-'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(candidate);
    });
    it('rechecks owner authority before publishing fuzzy discovery results', async () => {
        const h = fixture(); let release!: (models: any[]) => void;
        h.ctx.modelRegistry.getAvailable.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const work = h.handle('/model chat'); h.revoke(); release([model]); await work;
        expect(h.sent).toEqual([]); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
    });
    it('does not resolve an expired fuzzy choice to a newly available model', async () => {
        const h = fixture(); await h.handle('/model chat'); h.ctx.modelRegistry.getAvailable.mockResolvedValue([{ ...model, id: 'chat/replacement' }]);
        await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.sent.at(-1)).toContain('Exact authenticated model unavailable');
    });
    it('retains busy-session and group quote guards for fuzzy selections', async () => {
        const h = fixture(); await h.handle('/model chat', owner, group); await h.handle('1', owner, group);
        expect(h.ports.pi.setModel).not.toHaveBeenCalled(); await h.handle('/model chat', owner, group); h.busy();
        await h.handle('1', owner, group, 'sent-2'); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.sent.at(-1)).toContain('/stop');
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
