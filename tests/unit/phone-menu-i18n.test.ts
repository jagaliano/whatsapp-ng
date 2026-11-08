import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext, ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { CommandMenuService } from '../../src/services/command-menu.service.js';
import { WhatsAppCommandRouter, type PhoneControlPorts } from '../../src/services/whatsapp-command.router.js';
import { resolveTtsConfig } from '../../src/services/tts-config.js';
import { speechDefaults } from '../../src/services/speech-settings.js';
import { initI18n, resetI18n, t } from '../../src/i18n.js';

const owner = '15550000001@s.whatsapp.net';
const other = '15550000002@s.whatsapp.net';
const group = '120363000000@g.us';
const model = { provider: 'fixture', id: 'chat/exact', reasoning: true, thinkingLevelMap: { minimal: null, xhigh: 'xhigh' } } as NonNullable<ExtensionContext['model']>;

function fixture() {
    let settings = speechDefaults(); let stats = false; let explain = true; let idle = true;
    let reporting = { changedFiles: false, interimText: false, liveActivity: false };
    const sent: string[] = [];
    const ctx = { model: model as typeof model | undefined, isIdle: () => idle, hasPendingMessages: () => false,
        getContextUsage: () => ({ percent: 25 }) as { percent: number } | undefined,
        modelRegistry: { getAvailable: vi.fn(async () => [model]) }, compact: vi.fn((_options: { onComplete: () => void; onError: () => void }) => {}), shutdown: vi.fn(),
        sessionManager: { getSessionId: () => 'fixture-session' } };
    const ports = { pi: { getThinkingLevel: () => 'high', setThinkingLevel: vi.fn(), setModel: vi.fn(async () => true), sendUserMessage: vi.fn((_text: string, _options: unknown) => {}) },
        session: { getOperatorRevision: () => 0, getStatus: () => 'connected', getFinalAfterAttachments: () => explain,
            getReplyStats: () => stats, getReplyStatsRevision: () => 0, getReplyReporting: vi.fn(() => reporting), getReplyReportingRevision: () => 0,
            getSpeechSettings: () => settings, getSpeechRevision: () => 0, getAuthStateDir: () => '/synthetic',
            setSpeechSettings: vi.fn(async (next: typeof settings) => { settings = next; }),
            setFinalAfterAttachments: vi.fn(async (next: boolean) => { explain = next; }),
            setReplyStats: vi.fn(async (next: boolean) => { stats = next; }),
            setReplyReporting: vi.fn(async (next: typeof reporting) => { reporting = next; }) },
        context: () => ctx, scope: () => 'fixture-scope', account: () => 'fixture-account', allowed: () => true,
        canonical: (jid: string) => jid, actor: (key: { participant?: string; remoteJid: string }) => key.participant ?? key.remoteJid,
        owner: (actor: string) => actor === owner, send: vi.fn(async (_chat: string, text: string) => {
            sent.push(text); return { success: true, attempts: 1, messageId: `sent-${sent.length}` }; }),
        poll: vi.fn(async (_chat: string, _content: { values: string[] }) => ({ success: true, attempts: 1, messageId: 'fixture-poll' })),
        stop: vi.fn(), off: vi.fn(), resume: vi.fn(async () => true), notify: vi.fn() };
    const router = new WhatsAppCommandRouter(ports as unknown as PhoneControlPorts);
    const handle = (text: string, actor = owner, chat = actor, quotedId?: string) => router.handle({ key: { remoteJid: chat, id: 'fixture-in', fromMe: false, ...(chat === group ? { participant: actor } : {}) },
        message: { conversation: text }, sessionContext: { accountScope: 'fixture-account', generation: 1 }, senderNumber: actor }, text, quotedId);
    return { ports, ctx, router, sent, handle, settings: () => settings, busy: () => { idle = false; } };
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); resetI18n(); });

// Fixed baseline action identities, not inferred from translated labels or the implementation.
const actions = [
    ['/think', ['off', 'low', 'medium', 'high', 'xhigh']],
    ['/voice', ['text', 'voice', 'both', 'mirror']],
    ['/replies', ['explain', 'caption', 'stats:on', 'stats:off', 'report:changedFiles:on', 'report:interimText:on', 'report:liveActivity:on']],
    ['/new', ['cancel', 'confirm']], ['/off', ['cancel', 'confirm']], ['/quit', ['cancel', 'confirm']],
    ['/model', ['fixture/chat/exact']]
] as const;

describe('grouped help', () => {
    it('lists exact command tokens once, grouped and readable by a non-owner', async () => {
        const h = fixture(); await h.handle('/help', other);
        const text = h.sent[0];
        expect(text.match(/(?<![\w/])\/(?:help|status|stop|abort|model|think|compact|new|voice|replies|off|quit)\b/g)?.sort()).toEqual(
            ['/help', '/status', '/stop', '/abort', '/model', '/think', '/compact', '/new', '/voice', '/replies', '/off', '/quit'].sort());
        const headings = ['Information', 'Shared Pi session', 'This chat', 'WhatsApp and process'].map(value => text.indexOf(value));
        expect(headings.every(index => index >= 0)).toBe(true); expect(headings).toEqual([...headings].sort((a, b) => a - b));
        for (const value of ['[provider/model or search]', '[level]', '[focus]', '[text|voice|both|mirror]', 'owner-only', 'five minutes', 'Current chat mode']) expect(text).toContain(value);
        expect(text).not.toContain('/synthetic'); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled();
        h.router.reset();
    });
});

describe('split status', () => {
    it('keeps every field in the correct section', async () => {
        const h = fixture(); await h.handle('/status', other);
        const [shared, chat] = h.sent[0].split('\nThis chat\n');
        expect(shared).toContain('Shared Pi and WhatsApp');
        for (const value of ['WhatsApp: connected', 'Pi: idle', 'Model: fixture/chat/exact', 'Thinking:', 'Context: 25%', 'Replies:', 'Final stats: Off']) expect(shared).toContain(value);
        expect(chat).toContain('Automatic replies: Enabled'); expect(chat).toContain('Voice: Text only');
        expect(shared).not.toContain('Automatic replies:'); expect(chat).not.toContain('Final stats:'); h.router.reset();
    });
    it('retains unknown context, unavailable model and paused replies', async () => {
        const h = fixture(); h.ctx.model = undefined; h.ctx.getContextUsage = () => undefined;
        h.settings().chats[owner] = { automaticReplies: false }; await h.handle('/status');
        expect(h.sent[0]).toContain('Model: unavailable'); expect(h.sent[0]).toContain('Context: unknown');
        expect(h.sent[0]).toContain('Automatic replies: Paused'); h.router.reset();
    });
});

describe('friendly menus', () => {
    it.each(['/think', '/voice', '/replies', '/model'])('%s marks current values without changing actions', async command => {
        const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture(); await h.handle(command);
        const [, title, options, body] = create.mock.calls[0];
        const current = options.filter(option => option.label.endsWith('(current)'));
        expect(current).toHaveLength(command === '/replies' ? 2 : 1);
        if (command === '/voice') expect(options.map(option => option.label)).toEqual(['Text only (current)', 'Voice', 'Voice + text', 'Mirror audio input']);
        if (command === '/think' || command === '/model') { expect(body).toBe('This affects the shared Pi session, not a private chat session.'); expect(title).not.toContain('This affects'); }
        const labels = options.map((option, i) => `${i + 1}. ${option.label}`);
        expect(h.ports.poll.mock.calls[0][1].values).toEqual(labels); expect(new Set(labels).size).toBe(labels.length); h.router.reset();
    });
    it.each(['/new', '/off', '/quit'])('%s keeps Cancel then Confirm with explanation in body', async command => {
        const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture(); await h.handle(command);
        const [, title, options, body] = create.mock.calls[0];
        expect(options.map(option => option.label)).toEqual(['Cancel', 'Confirm']); expect(title.length).toBeLessThanOrEqual(120); expect(body).toBeTruthy();
        await h.handle('1'); expect(h.sent.at(-1)).toBe('Cancelled.'); expect(h.ports.off).not.toHaveBeenCalled(); expect(h.ctx.shutdown).not.toHaveBeenCalled(); h.router.reset();
    });
});

describe('complete replies disclosure', () => {
    it.each([false, true])('is unabridged even with invalid preferences (%s)', async invalid => {
        const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        if (invalid) h.ports.session.getReplyReporting.mockImplementation(() => { throw new Error('synthetic invalid'); });
        await h.handle('/replies');
        const [, title, , body] = create.mock.calls[0];
        expect(title.length).toBeLessThanOrEqual(120);
        expect(body).toContain('Enabling shares workspace-relative paths/intermediate assistant text or tool names with allowed chats; never thinking/tool bodies.');
        if (invalid) expect(body).toContain('Saved optional settings are invalid; selecting a reporting option replaces them.');
        expect(body!.length).toBeLessThanOrEqual(1000); expect(h.sent[0]).toContain(body!);
        expect(h.ports.poll.mock.calls[0][1]).toMatchObject({ name: title }); h.router.reset();
    });
});

const locales = ['en', 'pt-BR', 'es', 'fr'] as const;
function localize(locale: string) { vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); }
const oldEnglish = ['Reply with a number within', 'Ordinary text cancels', 'This affects the shared Pi session', 'Owner authorization required',
    'The shared Pi session is busy', 'Phone command failed', 'Use terminal', 'Speech is disabled', 'No current model',
    'No authenticated models', 'Unsupported thinking level', 'Configured model (private identifier hidden)', 'Shared replies', 'Caption/tool only', 'Explain after attachments'];
function noEnglish(text: string, locale: string) { if (locale !== 'en') for (const phrase of oldEnglish) expect(text).not.toContain(phrase); }

describe.each(locales)('phone presentation (%s)', locale => {
    it('has explicit dictionary coverage with identical placeholders', () => {
        const source = readFileSync(new URL('../../src/i18n.ts', import.meta.url), 'utf8');
        const en = source.slice(source.indexOf('const fallback = {'), source.indexOf('} as const;'));
        const entries = (block: string) => Object.fromEntries([...block.matchAll(/"(phone\.[^"]+)": ("(?:[^"\\]|\\.)*")/g)].map(m => [m[1], JSON.parse(m[2]) as string]));
        const expected = entries(en);
        expect(Object.keys(expected).length).toBeGreaterThan(90);
        if (locale === 'en') return;
        const anchor = locale === 'pt-BR' ? '    "pt-BR": {' : `    ${locale}: {`;
        const start = source.indexOf(anchor); const end = source.indexOf('\n    },', start);
        const actual = entries(source.slice(start, end < 0 ? undefined : end));
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        for (const [key, value] of Object.entries(expected)) expect(actual[key].match(/\{\w+\}/g)?.sort() ?? []).toEqual(value.match(/\{\w+\}/g)?.sort() ?? []);
    });
    it('renders grouped help and split status with identifiers untouched', async () => {
        localize(locale); const h = fixture(); await h.handle('/help', other); await h.handle('/status', other);
        for (const heading of ['phone.help.info', 'phone.help.shared', 'phone.help.chat', 'phone.help.process'] as const) expect(h.sent[0]).toContain(t(heading));
        expect(h.sent[0]).toContain('/voice [text|voice|both|mirror]'); expect(h.sent[0]).toContain('/model [provider/model or search]');
        const [shared, chat] = h.sent[1].split('\n' + t('phone.status.chat') + '\n');
        expect(shared).toContain(t('phone.status.shared')); expect(shared).toContain('fixture/chat/exact'); expect(shared).toContain('25%');
        expect(chat).toContain(t('phone.status.voice', { value: t('phone.mode.text') }));
        noEnglish(h.sent.join('\n'), locale); h.router.reset();
    });
    it.each(actions)('%s keeps actions, complete bodies, markers and frozen poll labels', async (command, values) => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture(); await h.handle(command);
        const [, title, options, body] = create.mock.calls[0];
        expect(title.length).toBeLessThanOrEqual(120); expect(body?.length ?? 0).toBeLessThanOrEqual(1000);
        expect(options.map(option => option.value)).toEqual(values.map(value => ({ command: command.slice(1), value,
            ...(value.startsWith('stats:') || value.startsWith('report:') ? { revision: 0 } : {}) })));
        for (const option of options) expect(option.label.length).toBeLessThanOrEqual(120);
        const labels = options.map((option, i) => `${i + 1}. ${option.label}`);
        expect(new Set(labels).size).toBe(labels.length); expect(h.ports.poll.mock.calls[0][1].values).toEqual(labels);
        expect(h.sent[0]).toContain(t('phone.menu.instruction')); expect(h.sent[0]).not.toContain(t('phone.menu.instructionGroup'));
        if (['/think', '/model', '/new'].includes(command)) { expect(body).toContain(t('phone.shared')); expect(title).not.toContain(t('phone.shared')); }
        const marked = options.filter(option => option.label.endsWith(t('phone.current'))).length;
        expect(marked).toBe(command === '/replies' ? 2 : ['/voice', '/think', '/model'].includes(command) ? 1 : 0);
        noEnglish(h.sent[0], locale);
        // A locale change cannot change the labels/actions of an already-created menu.
        localize(locale === 'fr' ? 'en' : 'fr'); await h.handle('1');
        if (command === '/voice') expect(h.ports.session.setSpeechSettings).toHaveBeenCalled();
        if (command === '/think') expect(h.ports.pi.setThinkingLevel).toHaveBeenCalledWith('off');
        if (command === '/model') expect(h.ports.pi.setModel).toHaveBeenCalledWith(model); h.router.reset();
    });
    it.each(['text', 'voice', 'both', 'mirror'] as const)('marks and applies the actual chat mode %s', async mode => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        h.settings().enabled = true; h.settings().approvedDestinationKey = resolveTtsConfig(h.settings().config).destinationKey;
        h.settings().chats[owner] = { mode }; await h.handle('/voice');
        expect(create.mock.calls[0][2].filter(option => option.label.endsWith(t('phone.current'))).map(option => option.value)).toEqual([{ command: 'voice', value: mode }]);
        await h.handle(String(['text', 'voice', 'both', 'mirror'].indexOf(mode) + 1));
        expect(h.settings().chats[owner].mode).toBe(mode); expect(h.sent.at(-1)).toBe(t('phone.voice.saved', { mode: t(`phone.mode.${mode}`) })); h.router.reset();
    });
    it('still opens the voice menu when saved speech settings are unreadable', async () => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        h.ports.session.getSpeechSettings = () => { throw new Error('synthetic invalid speech'); };
        await h.handle('/voice');
        expect(create).toHaveBeenCalledOnce(); expect(create.mock.calls[0][2].map(option => option.value)).toEqual(
            ['text', 'voice', 'both', 'mirror'].map(value => ({ command: 'voice', value })));
        expect(h.sent[0]).toContain(t('phone.menu.instruction')); expect(h.sent[0]).not.toContain(t('phone.current'));
        await h.handle('1'); expect(h.sent.at(-1)).toBe(t('phone.failed')); expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled(); h.router.reset();
    });
    it('keeps reporting toggles independent and shows their states', async () => {
        localize(locale); const h = fixture();
        for (const [i, key] of ['changedFiles', 'interimText', 'liveActivity'].entries()) {
            await h.handle('/replies'); await h.handle(String(i + 5));
            expect(h.ports.session.getReplyReporting()[key as 'changedFiles' | 'interimText' | 'liveActivity']).toBe(true);
            await h.handle('/replies');
            expect(h.sent.at(-1)).toContain(t(`phone.replies.${(['files', 'interim', 'activity'] as const)[i]}.off`));
            await h.handle(String(i + 5));
            expect(h.ports.session.getReplyReporting()[key as 'changedFiles' | 'interimText' | 'liveActivity']).toBe(false);
        }
        await h.handle('/replies'); await h.handle('3'); await h.handle('/replies');
        expect(h.sent.at(-1)).toContain(t('phone.replies.statsOn') + ' ' + t('phone.current'));
        await h.handle('4'); expect(h.ports.session.getReplyStats()).toBe(false);
        expect(h.sent.at(-1)).toBe(t('phone.stats.saved', { state: t('phone.stats.disabled') })); h.router.reset();
    });
    it('reserves current-marker space inside the existing long-model display cap', async () => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        const candidate = { ...model, id: 'x'.repeat(180) }; h.ctx.model = candidate; h.ctx.modelRegistry.getAvailable.mockResolvedValue([candidate]);
        await h.handle('/model fixture/'); const option = create.mock.calls[0][2][0];
        expect(option.label.length).toBe(120); expect(option.label.endsWith(t('phone.current'))).toBe(true);
        expect(option.value).toEqual({ command: 'model', value: 'fixture/' + candidate.id });
        await h.handle('1'); expect(h.ports.pi.setModel).toHaveBeenCalledExactlyOnceWith(candidate); h.router.reset();
    });
    it('keeps paging, search, exact identifiers and current model on its own page', async () => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        const models = Array.from({ length: 23 }, (_, i) => ({ ...model, id: 'chat/' + String(i).padStart(2, '0') }));
        h.ctx.model = models[10]; h.ctx.modelRegistry.getAvailable.mockResolvedValue(models);
        await h.handle('/model chat/'); expect(create.mock.calls.at(-1)![2]).toHaveLength(11);
        expect(h.sent.at(-1)).toContain(t('phone.model.next')); expect(h.sent.at(-1)).not.toContain(t('phone.current'));
        await h.handle('11'); expect(create.mock.calls.at(-1)![2]).toHaveLength(12);
        expect(h.sent.at(-1)).toContain('fixture/chat/10 ' + t('phone.current'));
        await h.handle('12'); expect(h.sent.at(-1)).not.toContain(t('phone.current'));
        expect(h.sent.at(-1)).toContain(t('phone.model.previous')); await h.handle('4'); await h.handle('1');
        expect(h.ports.pi.setModel).toHaveBeenCalledWith(models[10]); h.router.reset();
    });
    it('covers localized informational, usage, failure and completion replies', async () => {
        localize(locale); const h = fixture();
        for (const command of ['/replies argument', '/stop argument', '/new argument']) {
            await h.handle(command); expect(h.sent.at(-1)).toContain(t('phone.usage', { command: '' }).trim());
        }
        await h.handle('/think not-a-level'); expect(h.sent.at(-1)).toBe(t('phone.think.unsupported'));
        await h.handle('/stop'); expect(h.sent.at(-1)).toBe(t('phone.stopped'));
        await h.handle('/help ' + 'x'.repeat(2048)); expect(h.sent.at(-1)).toBe(t('phone.tooLong'));
        h.ctx.model = undefined; await h.handle('/think'); expect(h.sent.at(-1)).toBe(t('phone.model.noCurrent'));
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([]); await h.handle('/model'); expect(h.sent.at(-1)).toBe(t('phone.model.noAvailable'));
        h.ctx.modelRegistry.getAvailable.mockResolvedValue([model]); await h.handle('/model no-matches'); expect(h.sent.at(-1)).toBe(t('phone.model.noMatches'));
        h.ports.pi.setModel.mockResolvedValueOnce(false); await h.handle('/model fixture/chat/exact'); expect(h.sent.at(-1)).toBe(t('phone.model.noAuth'));
        h.ports.session.setReplyStats.mockRejectedValueOnce(new Error('synthetic failure')); await h.handle('/replies'); await h.handle('3');
        expect(h.sent.at(-1)).toBe(t('phone.failed')); await h.handle('/off'); await h.handle('2'); expect(h.sent.at(-1)).toBe(t('phone.off.done'));
        await h.handle('/quit'); await h.handle('2'); expect(h.sent.at(-1)).toBe(t('phone.quit.done'));
        noEnglish(h.sent.join('\n'), locale); h.router.reset();
    });
    it('renders compaction callbacks, private-model placeholder, group refusal and fresh-session completion', async () => {
        localize(locale); const h = fixture(); await h.handle('/compact');
        expect(h.sent.at(-1)).toBe(t('phone.compact.requested')); h.ctx.compact.mock.calls[0][0].onComplete(); await Promise.resolve();
        expect(h.sent.at(-1)).toBe(t('phone.compact.done')); await h.handle('/compact'); h.ctx.compact.mock.calls[1][0].onError(); await Promise.resolve();
        expect(h.sent.at(-1)).toBe(t('phone.compact.failed'));
        h.ctx.model = { ...model, id: '/synthetic/models/fixture.gguf' }; await h.handle('/status');
        expect(h.sent.at(-1)).toContain(t('phone.model.private')); expect(h.sent.at(-1)).not.toContain('/synthetic');
        h.settings().enabled = true; h.settings().approvedDestinationKey = resolveTtsConfig(h.settings().config).destinationKey;
        await h.handle('/voice voice', owner, group); expect(h.sent.at(-1)).toContain(t('phone.voice.groupMissing'));
        expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled();
        const resumes: string[] = [];
        const ctx = { ...h.ctx, ui: { notify: vi.fn() }, newSession: async ({ withSession }: { withSession: (replacement: unknown) => Promise<void> }) => {
            h.ctx.sessionManager.getSessionId = () => 'fixture-successor';
            await withSession({ sessionManager: h.ctx.sessionManager, sendUserMessage: async (text: string) => { resumes.push(text); } }); return { cancelled: false };
        } } as unknown as ExtensionCommandContext;
        await h.handle('/new'); await h.handle('2');
        await h.router.gateway(h.ports.pi.sendUserMessage.mock.calls[0][0].slice('/whatsapp '.length), ctx);
        await h.router.gateway(resumes[0].slice('/whatsapp '.length), ctx);
        expect(h.sent.at(-1)).toBe(t('phone.new.ready')); noEnglish(h.sent.join('\n'), locale); h.router.reset();
    });
    it('keeps the entire invalid-preferences disclosure within the body limit', async () => {
        localize(locale); const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        h.ports.session.getReplyReporting.mockImplementation(() => { throw new Error('synthetic invalid'); }); await h.handle('/replies');
        const body = create.mock.calls[0][3]!;
        expect(body).toBe(t('phone.replies.disclosure', { stats: t('phone.status.off'), files: t('phone.status.off'), interim: t('phone.status.off'), activity: t('phone.status.off') }) + ' ' + t('phone.replies.invalid'));
        expect(h.sent[0]).toContain(body); expect(body.length).toBeLessThanOrEqual(1000); noEnglish(body, locale); h.router.reset();
    });
    it('retains group quoting, ordinary-text cancellation and expiry', async () => {
        localize(locale); vi.useFakeTimers(); const h = fixture(); await h.handle('/think', owner, group);
        expect(h.sent[0]).toContain(t('phone.menu.instructionGroup'));
        await h.handle('1', owner, group); expect(h.ports.pi.setThinkingLevel).not.toHaveBeenCalled();
        await h.handle('/think', owner, group); await h.handle('1', other, group, 'sent-2');
        await h.handle('1', owner, group, 'sent-2'); expect(h.ports.pi.setThinkingLevel).toHaveBeenCalledExactlyOnceWith('off');
        await h.handle('/model'); await h.handle('ordinary task'); await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled();
        await h.handle('/model'); vi.advanceTimersByTime(300001); await h.handle('1'); expect(h.ports.pi.setModel).not.toHaveBeenCalled(); h.router.reset();
    });
    it('localizes denied, busy, usage, speech refusal and failure without granting authority', async () => {
        localize(locale); const h = fixture(); await h.handle('/voice mirror', other);
        expect(h.sent.at(-1)).toBe(t('phone.denied', { chatsOwner: t('menu.category.chatsOwner'), owner: t('voice.owner') }));
        await h.handle('/voice mirror'); expect(h.sent.at(-1)).toBe(t('phone.voice.setup', { missing: t('phone.voice.disabled') + '; ' + t('phone.voice.unapproved'), voice: t('voice.menu'), setup: t('voice.setupChat') }));
        expect(h.ports.session.setSpeechSettings).not.toHaveBeenCalled(); await h.handle('/voice invalid'); expect(h.sent.at(-1)).toBe(t('phone.usage', { command: '/voice text|voice|both|mirror' }));
        h.busy(); await h.handle('/think high'); expect(h.sent.at(-1)).toBe(t('phone.busy')); expect(h.ports.pi.setThinkingLevel).not.toHaveBeenCalled();
        await h.handle('/off'); await h.handle('1'); expect(h.sent.at(-1)).toBe(t('phone.cancelled'));
        noEnglish(h.sent.join('\n'), locale); h.router.reset();
    });
});

it('uses the existing English fallback for unsupported locales', async () => {
    localize('zz'); const h = fixture(); await h.handle('/help'); expect(h.sent[0]).toContain('Information'); expect(h.sent[0]).toContain('Current chat mode: Text only.'); h.router.reset();
});

describe('phone action parity', () => {
    it.each(actions)('%s preserves frozen action order', async (command, values) => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', 'en'); initI18n(undefined);
        const create = vi.spyOn(CommandMenuService.prototype, 'create'); const h = fixture();
        await h.handle(command);
        expect(create.mock.calls[0][2].map(option => option.value)).toEqual(values.map(value => ({ command: command.slice(1), value,
            ...(value.startsWith('stats:') || value.startsWith('report:') ? { revision: 0 } : {}) })));
        h.router.reset();
    });
});
