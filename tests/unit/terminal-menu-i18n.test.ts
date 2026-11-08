import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { initI18n, resetI18n, t } from '../../src/i18n.js';
import { chooseWhatsAppSetting } from '../../src/ui/whatsapp-settings.view.js';
import { MenuHandler } from '../../src/ui/menu.handler.js';
import { showVoiceSettings, showOwnerSettings } from '../../src/ui/voice-settings.view.js';
import { showOptionalOutputSettings } from '../../src/ui/optional-output-settings.view.js';
import { METADATA_LOG_POLICY } from '../../src/services/whatsapp-ng.logger.js';
import { speechDefaults } from '../../src/services/speech-settings.js';
import type { SessionManager } from '../../src/services/session.manager.js';
import type { WhatsAppService } from '../../src/services/whatsapp.service.js';
import type { RecentsService } from '../../src/services/recents.service.js';

type Key = Parameters<typeof t>[0];
const state = { status: 'disconnected', enabled: true, registered: true, archive: true, optional: true, owner: true };
const chat = { jid: '15550000001@s.whatsapp.net', recipientJid: '15550000001@s.whatsapp.net', label: 'Fixture' };
const message = { senderNumber: '+15550000001', messageId: 'M', text: 'Fixture message', direction: 'incoming', timestamp: 1000 };

/** A path consumes actual rendered options, then checks the exit and its next destination. */
function panel(path: Array<Key | '$first'>, exit: Key, destination?: Key) {
    let step = 0;
    const select = vi.fn(async (_title: string, options: string[]) => {
        expect(new Set(options).size).toBe(options.length);
        if (step < path.length) {
            const key = path[step++]; const choice = key === '$first' ? options[0] : t(key); expect(options).toContain(choice); return choice;
        }
        if (step++ === path.length) { expect(options.at(-1)).toBe(t(exit)); return t(exit); }
        if (destination) expect(_title.split('\n')[0]).toContain(t(destination).split('{')[0].trim());
        return undefined;
    });
    const ctx = { cwd: '/fixture', ui: { select, input: vi.fn(async () => undefined), editor: vi.fn(async () => undefined),
        notify: vi.fn(), confirm: vi.fn(async () => false) } } as unknown as ExtensionCommandContext;
    return { ctx, select, done: () => expect(select).toHaveBeenCalledTimes(path.length + (destination ? 2 : 1)) };
}

function services() {
    const session = {
        isRegistered: async () => true, getAllowList: () => [{ number: '+15550000001', name: 'Fixture', sendNumber: '+15550000001' }],
        getAllowedGroups: () => [{ number: '120363000001@g.us', name: 'Fixture group' }], getAllowedContact: () => undefined, getAllowedGroup: () => undefined,
        setContactSendNumber: vi.fn(), removeContactSendNumber: vi.fn(), removeNumber: vi.fn(),
        getAutoConnect: () => true, getAutoConnectRevision: () => 0,
        getFinalAfterAttachments: () => true, getReplyStats: () => false, getReplyStatsRevision: () => 0,
        getReplyReporting: () => ({ changedFiles: false, interimText: false, liveActivity: false }), getReplyReportingRevision: () => 0,
        getGroupReplies: () => ({ mode: 'mentions-or-replies', context: false }), getGroupRepliesRevision: () => 0,
        getSpeechSettings: () => speechDefaults(), getSpeechRevision: () => 0, getOperatorJid: () => '', getOperatorRevision: () => 0,
        getOptionalOutputs: () => ({ imageTools: [] }), getOptionalOutputsRevision: () => 0,
        setAutoConnect: vi.fn(), setReplyStats: vi.fn(), setFinalAfterAttachments: vi.fn(),
        setSpeechSettings: vi.fn(), setOptionalOutputs: vi.fn(), setGroupReplies: vi.fn(), setReplyReporting: vi.fn()
    };
    const recent = {
        getArchiveState: () => ({ enabled: true }), getHistoryScopes: async () => [], selectHistoryScope: vi.fn(),
        getRecentConversations: async () => [{ senderNumber: '+15550000001', lastMessagePreview: 'Fixture', lastMessageTime: 1000 }], getConversationHistory: async () => [message], getHistoryPage: async () => ({ messages: [message] })
    };
    const whatsapp = { getEffectiveStatus: () => 'disconnected', getQuotedMessage: () => undefined };
    const actions = { current: () => true, canonical: (jid: string) => jid, chats: () => [chat], preview: vi.fn(), disclose: vi.fn() };
    return { session, recent, whatsapp, actions };
}

afterEach(() => { resetI18n(); vi.unstubAllEnvs(); });

describe.each(['en', 'pt-BR', 'es', 'fr'])('terminal menu exits (%s)', locale => {
    it.each([
        ['menu.category.connection'], ['menu.category.chatsOwner'], ['menu.category.replies'], ['menu.category.groups'], ['menu.category.advanced']
    ] as Key[][])('category %s returns to root', async category => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const h = panel([category], 'menu.back.main', 'menu.root.title');
        // Root title has interpolated status, so assert the destination prefix separately.
        h.select.mockImplementationOnce(async (_title, options) => { expect(options.at(-1)).toBe(t('menu.close')); return t(category); });
        h.select.mockImplementationOnce(async (_title, options) => { expect(options.at(-1)).toBe(t('menu.back.main')); return t('menu.back.main'); });
        h.select.mockImplementationOnce(async title => { expect(title).toMatch(/^WhatsApp — /); return t('menu.close'); });
        await chooseWhatsAppSetting(h.ctx, () => state, () => true); expect(h.select).toHaveBeenCalledTimes(3);
    });

    it.each([
        [['menu.category.connection', 'menu.connection.autoConnect'], 'menu.back.connection', 'menu.category.connection'],
        [['menu.category.replies', 'menu.replyDelivery.title'], 'menu.back.replies', 'menu.category.replies'],
        [['menu.category.groups', 'menu.groups.replies'], 'menu.back.groups', 'menu.category.groups'],
        [['menu.category.chatsOwner', 'menu.root.allowedNumbers'], 'menu.back.chatsOwner', 'menu.category.chatsOwner'],
        [['menu.category.groups', 'menu.root.allowedGroups'], 'menu.back.groups', 'menu.category.groups'],
        [['menu.category.advanced', 'archive.menu.scope'], 'menu.back.advanced', 'menu.category.advanced'],
        [['menu.category.chatsOwner', 'menu.root.allowedNumbers', '$first'], 'menu.back.allowedContacts', 'menu.allowed.title'],
        [['menu.category.groups', 'menu.root.allowedGroups', '$first'], 'menu.back.allowedGroups', 'menu.allowedGroups.title'],
        [['menu.category.chatsOwner', 'menu.root.recents'], 'menu.back.chatsOwner', 'menu.category.chatsOwner'],
        [['menu.category.advanced', 'archive.menu.scope', 'archive.menu.current'], 'menu.back.advanced', 'menu.category.advanced'],
        [['menu.category.chatsOwner', 'menu.root.recents', '$first'], 'menu.back.recents', 'menu.recents.title'],
        [['menu.category.chatsOwner', 'menu.root.recents', '$first', 'menu.recents.contact.history'], 'menu.back.conversation', 'menu.recents.contact.title'],
        [['menu.category.chatsOwner', 'menu.root.allowedNumbers', '$first', 'menu.allowed.contact.history'], 'menu.back.contact', 'menu.allowed.contact.title'],
        [['menu.category.groups', 'menu.root.allowedGroups', '$first', 'menu.allowedGroups.group.history'], 'menu.back.group', 'menu.allowedGroups.group.title']
     ] as [Array<Key | '$first'>, Key, Key][])('handler path %j', async (path, exit, dest) => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services(); const h = panel(path, exit, dest);
        await new MenuHandler(s.whatsapp as unknown as WhatsAppService, s.session as unknown as SessionManager, s.recent as unknown as RecentsService).handleCommand(h.ctx);
        h.done();
    });

    it.each([
        [[], 'menu.back.main'],
        [['voice.advanced'], 'menu.back.voice'],
        [['voice.setupChat'], 'menu.back.voice'],
        [['voice.chats'], 'menu.back.voice'],
        [['voice.setupChat', 'Fixture'], 'menu.back.chatList'],
        [['voice.chats', 'Fixture'], 'menu.back.voice'],
        [['voice.chats', 'Fixture', 'voice.chatMode'], 'menu.back.chatSettings'],
        [['voice.advanced', 'voice.backend'], 'menu.back.voiceAdvanced'],
        [['voice.advanced', 'voice.defaultMode'], 'menu.back.voiceAdvanced'],
        [['voice.advanced', 'voice.preview'], 'menu.back.voiceAdvanced'],
        [['voice.advanced', 'voice.format'], 'menu.back.voiceAdvanced'],
        [['voice.advanced', 'voice.providerVoice'], 'menu.back.voiceAdvanced'],
        [['voice.advanced', 'voice.backend', 'voice.remote'], 'menu.back.voiceBackend'],
        [['voice.advanced', 'voice.backend', 'voice.remote', 'OpenAI-compatible'], 'menu.back.voiceProtocol']
    ] as [string[], Key][])('Voice path %j', async (path, exit) => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services();
        if (path.includes('voice.format') || path.includes('voice.providerVoice')) s.session.getSpeechSettings = () => ({ ...speechDefaults(), config: {
            ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture', ttsEnv: 'FIXTURE_KEY', ttsVoice: 'fixture', ttsProtocol: 'openai-compatible' as const } });
        let step = 0; const select = vi.fn(async (_title: string, options: string[]) => {
            if (step < path.length) { const key = path[step++]; const choice = ['Fixture', 'OpenAI-compatible'].includes(key) ? key : t(key as Key); expect(options).toContain(choice); return choice; }
            if (step++ === path.length) { expect(options.at(-1)).toBe(t(exit)); return t(exit); }
            const destinations: Partial<Record<Key, string>> = {
                'menu.back.voice': t('voice.title').split('{')[0].trim(), 'menu.back.chatList': t('voice.chooseChat'),
                'menu.back.chatSettings': chat.label, 'menu.back.voiceAdvanced': t('voice.advanced'),
                'menu.back.voiceBackend': t('voice.backend'), 'menu.back.voiceProtocol': t('voice.protocol')
            };
            if (step === path.length + 2) expect(_title).toContain(destinations[exit]);
            return undefined;
        });
        const ctx = { cwd: '/fixture', ui: { select, input: vi.fn(async () => ''), notify: vi.fn() } } as unknown as ExtensionCommandContext;
        await showVoiceSettings(ctx, s.session as unknown as SessionManager, s.actions);
        expect(select.mock.calls.length).toBeGreaterThanOrEqual(path.length + 1);
        expect(select.mock.calls[path.length][1].at(-1)).toBe(t(exit));
        expect(ctx.ui.notify).not.toHaveBeenCalledWith(t('voice.failed'), 'error');
        expect(s.session.setSpeechSettings).not.toHaveBeenCalled();
    });

    it('keeps invalid Voice, group policy and reporting unchanged on Back', async () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const s = services();
        s.session.getSpeechSettings = () => { throw new Error('invalid'); };
        const voice = panel([], 'menu.back.main');
        expect(await showVoiceSettings(voice.ctx, s.session as unknown as SessionManager, s.actions)).toBe('back');
        expect(voice.select.mock.calls[0][0]).toBe(t('voice.invalidSaved'));
        expect(s.session.setSpeechSettings).not.toHaveBeenCalled();
        s.session.getGroupReplies = () => { throw new Error('invalid'); };
        s.session.getReplyReporting = () => { throw new Error('invalid'); };
        for (const [category, entry, exit, dest] of [
            ['menu.category.groups', 'menu.groups.replies', 'menu.back.groups', 'menu.category.groups'],
            ['menu.category.replies', 'menu.replyDelivery.title', 'menu.back.replies', 'menu.category.replies']
        ] as [Key, Key, Key, Key][]) {
            const h = panel([category, entry], exit, dest);
            await new MenuHandler(s.whatsapp as unknown as WhatsAppService, s.session as unknown as SessionManager, s.recent as unknown as RecentsService).handleCommand(h.ctx);
            h.done();
            if (category === 'menu.category.groups') expect(h.select.mock.calls[2][0]).toContain(t('menu.groups.invalid'));
            else expect(h.ctx.ui.notify).toHaveBeenCalledWith(t('menu.reporting.invalid'), 'warning');
        }
        expect(s.session.setGroupReplies).not.toHaveBeenCalled(); expect(s.session.setReplyReporting).not.toHaveBeenCalled();
    });

    it.each([
        ['menu.category.connection', 'menu.connection.autoConnect', 'menu.autoConnect.disabled', 'setAutoConnect', false],
        ['menu.category.groups', 'menu.groups.replies', 'menu.groups.mode.replies', 'setGroupReplies', { mode: 'replies', context: false }],
        ['menu.category.replies', 'menu.replyDelivery.title', 'menu.replyDelivery.statsOn', 'setReplyStats', true],
        ['menu.category.groups', 'menu.groups.replies', 'menu.groups.contextOn', 'setGroupReplies', { mode: 'mentions-or-replies', context: true }],
        ['menu.category.replies', 'menu.replyDelivery.title', 'menu.reporting.files.enable', 'setReplyReporting', { changedFiles: true, interimText: false, liveActivity: false }]
    ] as [Key, Key, Key, 'setAutoConnect' | 'setGroupReplies' | 'setReplyStats' | 'setReplyReporting', unknown][])('localized action %s / %s / %s', async (category, entry, choice, method, expected) => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services();
        const queue = [category, entry, choice];
        const select = vi.fn(async (_title: string, options: string[]) => { const key = queue.shift(); if (!key) return undefined; expect(options).toContain(t(key)); return t(key); });
        const ctx = { ui: { select, notify: vi.fn(), confirm: vi.fn(async () => true) } } as unknown as ExtensionCommandContext;
        await new MenuHandler(s.whatsapp as unknown as WhatsAppService, s.session as unknown as SessionManager, s.recent as unknown as RecentsService).handleCommand(ctx);
        expect(s.session[method].mock.calls[0][0]).toEqual(expected);
        expect(select.mock.calls[2][0]).toContain(t(method === 'setAutoConnect' ? 'menu.on' : 'menu.off'));
    });

    it.each(['menu.allowed.contact.addNumber', 'menu.allowed.contact.removeSendNumber', 'menu.allowed.contact.removeNumber'] as const)('keeps sending-number edits separate from removal (%s)', async action => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services();
        if (action === 'menu.allowed.contact.addNumber') s.session.getAllowList = () => [{ number: '+15550000001', name: 'Fixture', sendNumber: undefined as unknown as string }];
        const queue: Array<Key | '$first'> = ['menu.category.chatsOwner', 'menu.root.allowedNumbers', '$first', action];
        const select = vi.fn(async (_title: string, options: string[]) => { const key = queue.shift(); if (!key) return undefined; const choice = key === '$first' ? options[0] : t(key); expect(options).toContain(choice); return choice; });
        const ctx = { ui: { select, input: vi.fn(async () => '+15550000002'), confirm: vi.fn(async () => true), notify: vi.fn() } } as unknown as ExtensionCommandContext;
        await new MenuHandler(s.whatsapp as unknown as WhatsAppService, s.session as unknown as SessionManager, s.recent as unknown as RecentsService).handleCommand(ctx);
        const removed = action === 'menu.allowed.contact.removeNumber';
        expect(s.session.removeNumber).toHaveBeenCalledTimes(removed ? 1 : 0);
        expect(s.session.setContactSendNumber).toHaveBeenCalledTimes(action === 'menu.allowed.contact.addNumber' ? 1 : 0);
        expect(s.session.removeContactSendNumber).toHaveBeenCalledTimes(action === 'menu.allowed.contact.removeSendNumber' ? 1 : 0);
        expect(ctx.ui.confirm).toHaveBeenCalledTimes(removed ? 1 : 0);
        if (action === 'menu.allowed.contact.addNumber') expect(ctx.ui.input).toHaveBeenCalledWith(expect.stringContaining(t('menu.allowed.contact.enterNumber').split('{')[0]));
    });

    it('shows the identical privacy notice', async () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services();
        const queue: Key[] = ['menu.category.advanced', 'menu.advanced.privacy'];
        const select = vi.fn(async (_title: string, options: string[]) => { const key = queue.shift(); if (!key) return undefined; expect(options).toContain(t(key)); return t(key); });
        const ctx = { ui: { select, notify: vi.fn() } } as unknown as ExtensionCommandContext;
        await new MenuHandler(s.whatsapp as unknown as WhatsAppService, s.session as unknown as SessionManager, s.recent as unknown as RecentsService).handleCommand(ctx);
        expect(ctx.ui.notify).toHaveBeenCalledWith(METADATA_LOG_POLICY, 'info');
    });

    it('keeps category action labels globally distinct', async () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const actions: string[] = [];
        for (const category of ['Connection', 'Chats / Owner', 'Replies', 'Groups', 'Advanced'] as const) {
            const select = vi.fn(async (_title: string, options: string[]) => { actions.push(...options.slice(0, -1)); return undefined; });
            await chooseWhatsAppSetting({ ui: { select } } as unknown as ExtensionCommandContext, () => state, () => true, category);
        }
        actions.push(t('voice.menu'), t('menu.close'));
        expect(new Set(actions).size).toBe(actions.length);
    });

    it('Owner and Optional outputs exits and invalid optional settings do not save', async () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined); const s = services();
        const owner = panel([], 'menu.back.chatsOwner');
        expect(await showOwnerSettings(owner.ctx, s.session as unknown as SessionManager, s.actions)).toBe('back'); owner.done();
        const images = panel(['menu.optional.chooseImages'], 'menu.back.optionalOutputs', 'menu.optional.title');
        expect(await showOptionalOutputSettings(images.ctx, s.session as unknown as SessionManager, { current: () => true, tools: () => ['screenshot'], owner: () => undefined })).toBeUndefined(); images.done();
        const optional = panel([], 'menu.back.replies');
        s.session.getOptionalOutputs = () => { throw new Error('invalid'); };
        expect(await showOptionalOutputSettings(optional.ctx, s.session as unknown as SessionManager, { current: () => true, tools: () => [], owner: () => undefined })).toBe('back');
        expect(optional.ctx.ui.notify).toHaveBeenCalled(); expect(s.session.setOptionalOutputs).not.toHaveBeenCalled(); optional.done();
    });
});

describe('terminal translation dictionaries', () => {
    const source = readFileSync(new URL('../../src/i18n.ts', import.meta.url), 'utf8');
    const boundaries = [source.indexOf('const fallback = {'), source.indexOf('    "pt-BR": {'), source.indexOf('    es: {'), source.indexOf('    fr: {'), source.indexOf('\n};', source.indexOf('    fr: {'))];
    const dictionaries = boundaries.slice(0, -1).map((start, i) => Object.fromEntries(
        [...source.slice(start, boundaries[i + 1]).matchAll(/"([^"]+)":\s*("(?:[^"\\]|\\.)*")/g)].map(m => [m[1], JSON.parse(m[2]) as string])));
    const fallback = dictionaries[0];
    const keys = Object.keys(fallback).filter(key => /^(menu\.|archive\.menu\.|voice\.|message\.detail\.|message\.reply\.)/.test(key));
    const identical = new Set(['menu.whatsapp.title', 'menu.recents.grouped.contacts', 'menu.recents.history.messageTitle', 'voice.no', 'message.reply.original', 'message.detail.direction']);
    it.each([1, 2, 3])('has explicit translations and identical placeholders in locale %s', locale => {
        const words = dictionaries[locale];
        for (const key of keys) {
            expect(words, key).toHaveProperty(key);
            expect([...words[key].matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort(), key)
                .toEqual([...fallback[key].matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort());
            if (!identical.has(key)) expect(words[key], key).not.toBe(fallback[key]);
        }
    });
});
