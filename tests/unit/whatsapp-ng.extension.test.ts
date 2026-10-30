import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MessageRequest } from '../../src/models/whatsapp.types.ts';
import { speechDefaults, validateSpeechSettings } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';

const mocks = vi.hoisted(() => {
    const createSessionManager = () => ({
        ensureInitialized: vi.fn().mockResolvedValue(undefined),
        getAuthStateDir: vi.fn().mockReturnValue('/synthetic-profile'),
        isRegistered: vi.fn().mockResolvedValue(false),
        setStatus: vi.fn().mockResolvedValue(undefined),
        addNumber: vi.fn().mockResolvedValue(undefined),
        addAllowedGroup: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockReturnValue('connected'),
        getAllowList: vi.fn().mockReturnValue([{ number: '+5511999998888', name: 'Ana' }]),
        getAllowedGroups: vi.fn().mockReturnValue([]),
        setGroupJidForAuth: vi.fn(),
        getFinalAfterAttachments: vi.fn().mockReturnValue(true),
        getAutoConnect: vi.fn().mockReturnValue(false),
        getGroupReplies: vi.fn().mockReturnValue({ mode: 'all', context: false }), getGroupRepliesRevision: vi.fn().mockReturnValue(0),
        getSpeechSettings: vi.fn().mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: {} }),
        getSpeechRevision: vi.fn().mockReturnValue(0), getReplyAdmissionKey: vi.fn().mockReturnValue('fixture-admission-0'),
        getOperatorRevision: vi.fn().mockReturnValue(0), getOperatorJid: vi.fn().mockReturnValue('5511999998888@s.whatsapp.net'),
        setSpeechSettings: vi.fn().mockResolvedValue(undefined), setSpeechConfigCallback: vi.fn(),
        getSttConfig: vi.fn().mockReturnValue({ sttEndpoint: 'https://speech.invalid/v1', sttModel: 'original', sttEnv: 'FIXTURE_STT_KEY' }),
        setSttConfig: vi.fn().mockResolvedValue(undefined)
    });

    const createWhatsAppService = () => ({
        setVerboseMode: vi.fn(),
        setStatusCallback: vi.fn(),
        setIncomingMessageRecorder: vi.fn(),
        setMessageCallback: vi.fn(),
        setGroupBinding: vi.fn(),
        setRecentsService: vi.fn(),
        getBoundGroupJid: vi.fn().mockReturnValue(null),
        getEffectiveStatus: vi.fn().mockReturnValue('connected'),
        getStatus: vi.fn().mockReturnValue('connected'),
        isVerbose: vi.fn().mockReturnValue(false),
        isRegistered: vi.fn(),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG123', attempts: 1 }),
        sendContent: vi.fn(async (request: MessageRequest) => {
            const result = { success: true, messageId: 'MEDIA123', attempts: 1 };
            await request.onSettled?.(result);
            return result;
        }),
        resolveOutboundRecipientJid: vi.fn((recipient: string) => recipient),
        canonicalConversation: vi.fn((jid: string) => jid),
        resolveIncomingActor: vi.fn((key: { fromMe?: boolean | null; remoteJid?: string | null; participant?: string | null }) => key.fromMe === false
            ? (key.remoteJid?.endsWith('@g.us') ? key.participant : key.remoteJid) : undefined),
        getQuotedMessage: vi.fn(),
        getAccountScope: vi.fn().mockReturnValue('fixture-account'),
        getSessionContext: vi.fn().mockReturnValue({ accountScope: 'fixture-account', generation: 1 }),
        isSessionContextCurrent: vi.fn().mockReturnValue(true),
        markIncomingProcessing: vi.fn(),
        getLastRemoteJid: vi.fn().mockReturnValue('5511999998888@s.whatsapp.net'),
        markRead: vi.fn(),
        sendPresence: vi.fn().mockResolvedValue(undefined)
    });

    const createRecentsService = () => ({
        ensureInitialized: vi.fn().mockResolvedValue(undefined),
        recordMessage: vi.fn().mockResolvedValue(undefined)
    });

    const createMenuHandler = () => ({
        handleCommand: vi.fn().mockResolvedValue(undefined)
    });

    const createIncomingMediaService = () => ({
        process: vi.fn().mockResolvedValue({ text: 'hello from whatsapp' })
    });

    return {
        sessionManager: createSessionManager(),
        whatsappService: createWhatsAppService(),
        recentsService: createRecentsService(),
        menuHandler: createMenuHandler(),
        incomingMediaService: createIncomingMediaService(),
        extractIncomingText: vi.fn().mockReturnValue({ kind: 'text', text: 'hello from whatsapp' }),
        reset() {
            this.sessionManager = createSessionManager();
            this.whatsappService = createWhatsAppService();
            this.recentsService = createRecentsService();
            this.menuHandler = createMenuHandler();
            this.incomingMediaService = createIncomingMediaService();
            this.extractIncomingText = vi.fn().mockReturnValue({ kind: 'text', text: 'hello from whatsapp' });
        }
    };
});

vi.mock('../../src/services/session.manager.ts', () => ({
    SessionManager: Object.assign(vi.fn(function () { return mocks.sessionManager; }), {
        isGroupJid: (jid: string) => jid.endsWith('@g.us')
    })
}));

vi.mock('../../src/services/whatsapp.service.ts', () => ({
    WhatsAppService: vi.fn(function () { return mocks.whatsappService; })
}));

vi.mock('../../src/services/recents.service.ts', () => ({
    RecentsService: vi.fn(function () { return mocks.recentsService; })
}));

vi.mock('../../src/services/audio.service.ts', () => ({
    AudioService: vi.fn(function () { return {}; })
}));

vi.mock('../../src/ui/menu.handler.ts', () => ({
    MenuHandler: vi.fn(function () { return mocks.menuHandler; })
}));

vi.mock('../../src/services/incoming-message.resolver.ts', async importOriginal => ({
    ...await importOriginal<typeof import('../../src/services/incoming-message.resolver.ts')>(),
    extractIncomingText: (...args: unknown[]) => mocks.extractIncomingText(...args)
}));

vi.mock('../../src/services/incoming-media.service.ts', () => ({
    IncomingMediaService: vi.fn(function () { return mocks.incomingMediaService; })
}));

type PiHandler = (event: any, ctx: any) => Promise<void>;

interface MockPi {
    flags: Map<string, unknown>;
    handlers: Map<string, PiHandler>;
    commands: Map<string, any>;
    tools: Map<string, any>;
    registerFlag: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    registerCommand: ReturnType<typeof vi.fn>;
    registerTool: ReturnType<typeof vi.fn>;
    getFlag: ReturnType<typeof vi.fn>;
    appendEntry: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    sendUserMessage: ReturnType<typeof vi.fn>;
    getActiveTools: ReturnType<typeof vi.fn>;
    setActiveTools: ReturnType<typeof vi.fn>;
}

const createMockPi = (): MockPi => {
    const flags = new Map<string, unknown>();
    const handlers = new Map<string, PiHandler>();
    const commands = new Map<string, any>();
    const tools = new Map<string, any>();

    return {
        flags,
        handlers,
        commands,
        tools,
        registerFlag: vi.fn((name: string, config: unknown) => flags.set(name, config)),
        on: vi.fn((name: string, handler: PiHandler) => handlers.set(name, handler)),
        registerCommand: vi.fn((name: string, command: unknown) => commands.set(name, command)),
        registerTool: vi.fn((tool: { name: string }) => tools.set(tool.name, tool)),
        getFlag: vi.fn().mockReturnValue(false),
        appendEntry: vi.fn(),
        exec: vi.fn().mockResolvedValue({ code: 0 }),
        sendUserMessage: vi.fn(),
        getActiveTools: vi.fn().mockReturnValue([]),
        setActiveTools: vi.fn()
    };
};

const createMockContext = () => ({
    mode: 'tui' as 'tui' | 'rpc' | 'json' | 'print',
    cwd: '/fixture/workspace',
    ui: {
        setStatus: vi.fn(),
        notify: vi.fn()
    },
    sessionManager: {
        getEntries: vi.fn().mockReturnValue([])
    },
    isIdle: vi.fn().mockReturnValue(true),
    hasPendingMessages: vi.fn().mockReturnValue(false),
    compact: vi.fn(),
    abort: vi.fn()
});

const loadExtension = async () => {
    vi.resetModules();
    const module = await import('../../whatsapp-ng.ts');
    return module.default;
};

describe('whatsapp-ng extension', () => {
    beforeEach(() => {
        delete (globalThis as any).__whatsappNgRetiredInputs;
        delete (globalThis as any).__whatsappNgPhoneOffProfiles;
        resetI18n();
        vi.stubEnv('WHATSAPP_NG_LOCALE', '');
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '');
        mocks.reset();
        vi.stubGlobal('__whatsappNgMigrationStarts', new Map());
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.each(['/compact', '/abort'])('B control denies a non-owner %s before media or Pi work', async command => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); register(pi as any);
        await pi.handlers.get('session_start')!({}, ctx);
        const actor = '5511000000000@s.whatsapp.net';
        mocks.sessionManager.getAllowList.mockReturnValue([{ number: actor }]);
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: command });
        mocks.incomingMediaService.process.mockResolvedValue({ text: command });
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0]({ key: { remoteJid: actor, id: 'unauthorized-control', fromMe: false }, message: { conversation: command }, sessionContext: { accountScope: 'fixture-account', generation: 1 } });
        expect(ctx.compact).not.toHaveBeenCalled(); expect(ctx.abort).not.toHaveBeenCalled();
        expect(mocks.incomingMediaService.process).not.toHaveBeenCalled(); expect(pi.sendUserMessage).not.toHaveBeenCalled();
    });

    it('B control does not interpret /compactSomething as /compact', async () => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); register(pi as any);
        await pi.handlers.get('session_start')!({}, ctx);
        const actor = '5511999998888@s.whatsapp.net'; mocks.sessionManager.getAllowList.mockReturnValue([{ number: actor }]);
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: '/compactSomething' });
        mocks.incomingMediaService.process.mockResolvedValue({ text: '/compactSomething' });
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0]({ key: { remoteJid: actor, id: 'exact-token', fromMe: false }, message: { conversation: '/compactSomething' }, sessionContext: { accountScope: 'fixture-account', generation: 1 } });
        expect(ctx.compact).not.toHaveBeenCalled(); expect(pi.sendUserMessage).toHaveBeenCalledOnce();
    });

    it('registers flags, command, tool, and lifecycle handlers', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();

        registerExtension(pi as any);

        expect(pi.flags.has('verbose')).toBe(true);
        expect(pi.flags.has('whatsapp-ng-online')).toBe(true);
        expect(pi.flags.has('whatsapp-group')).toBe(true);
        expect(pi.commands.has('whatsapp')).toBe(true);
        expect(pi.tools.has('send_wa_message')).toBe(true);
        expect(pi.tools.has('send_wa_media')).toBe(true);
        expect(pi.tools.has('configure_wa_tts')).toBe(true);
        expect(pi.handlers.has('session_start')).toBe(true);
        expect(pi.handlers.has('agent_start')).toBe(true);
        expect(pi.handlers.has('message_end')).toBe(true);
        expect(pi.handlers.has('session_shutdown')).toBe(true);
    });

    const speechFixture = async (source = 'interactive', actor = '5511999998888@s.whatsapp.net', group = false) => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); register(pi as any);
        await pi.handlers.get('session_start')!({}, ctx);
        let settings = speechDefaults(); let revision = 0;
        mocks.sessionManager.getSpeechSettings.mockImplementation(() => structuredClone(settings));
        mocks.sessionManager.getSpeechRevision.mockImplementation(() => revision);
        mocks.sessionManager.setSpeechSettings.mockImplementation(async (next, expected, current) => {
            if (expected !== revision || !current()) throw new Error('fixture stale request'); settings = validateSpeechSettings(next); revision++;
        });
        await pi.handlers.get('agent_start')!({}, ctx);
        let content = 'Configure speech';
        if (source === 'whatsapp') {
            const target = group ? '120363012345@g.us' : actor;
            mocks.sessionManager.getAllowList.mockReturnValue([{ number: actor }]);
            mocks.sessionManager.getAllowedGroups.mockReturnValue(group ? [{ number: target }] : []);
            await mocks.whatsappService.setMessageCallback.mock.calls[0][0]({ key: { remoteJid: target, id: 'settings-request', fromMe: false, ...(group ? { participant: actor } : {}) }, message: { conversation: 'Configure speech' }, sessionContext: { accountScope: 'fixture-account', generation: 1 } });
            content = pi.sendUserMessage.mock.calls[0][0] as string;
            await pi.handlers.get('input')!({ source: 'extension', text: content }, ctx);
        } else await pi.handlers.get('input')!({ source, text: content }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content } }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'assistant', content: [] } }, ctx);
        return { pi, ctx, settings: () => settings, set: (value: typeof settings) => { settings = value; }, tool: pi.tools.get('configure_wa_tts') };
    };
    const speechConfig = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
    it.each(['interactive', 'rpc'])('allows verified local %s backend configuration without opting into speech', async source => {
        const h = await speechFixture(source); mocks.sessionManager.getOperatorJid.mockReturnValue('');
        vi.stubEnv('FIXTURE_TTS_KEY', 'synthetic-secret-not-for-config-or-result');
        const result = await h.tool.execute('configure', speechConfig, new AbortController().signal);
        expect(result.isError).toBe(false); expect(h.settings()).toMatchObject({ config: speechConfig, enabled: false, mode: 'text' });
        expect(h.settings().approvedDestinationKey).toBeUndefined(); expect(JSON.stringify(result)).not.toContain('synthetic-secret-not-for-config-or-result');
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it('registers and saves explicit server-default voice without consent, synthesis or a named voice', async () => {
        const h = await speechFixture();
        expect(h.tool.parameters.properties.ttsUseServerVoice).toBeDefined();
        const config = { ttsEndpoint: 'http://127.0.0.1:8098/v1/audio/speech', ttsProtocol: 'openai-compatible',
            ttsModel: 'chatterbox', ttsEnv: 'FIXTURE_TTS_KEY', ttsUseServerVoice: true };
        const result = await h.tool.execute('server-default', config);
        expect(result.isError).toBe(false); expect(h.settings()).toMatchObject({ config, enabled: false, mode: 'text' });
        expect(h.settings().config.ttsVoice).toBeUndefined(); expect(h.settings().approvedDestinationKey).toBeUndefined();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });
    it.each([false, true])('allows only the verified owner in direct/group context (group=%s)', async group => {
        const h = await speechFixture('whatsapp', '5511999998888@s.whatsapp.net', group);
        expect((await h.tool.execute('owner', speechConfig)).isError).toBe(false);
    });
    it('denies a non-owner despite a valid allowed conversation', async () => {
        const h = await speechFixture('whatsapp', '15550000002@s.whatsapp.net');
        expect((await h.tool.execute('other', speechConfig)).isError).toBe(true); expect(mocks.sessionManager.setSpeechSettings).not.toHaveBeenCalled();
    });
    it('denies a missing phone owner instead of treating the request as terminal', async () => {
        const h = await speechFixture('whatsapp'); mocks.sessionManager.getOperatorJid.mockReturnValue('');
        const result = await h.tool.execute('missing-owner', speechConfig); expect(result.isError).toBe(true); expect(result.content[0].text).toContain('Choose the phone owner');
    });
    it('denies idle/unknown provenance and does not grant consent from unsupported model arguments', async () => {
        const h = await speechFixture('extension'); expect((await h.tool.execute('unknown', speechConfig)).isError).toBe(true);
        const local = await speechFixture(); const result = await local.tool.execute('consent-injection', { ...speechConfig, approvedDestinationKey: resolveTtsConfig(speechConfig).destinationKey, enabled: true });
        expect(result.isError).toBe(true); expect(local.settings()).toEqual(speechDefaults());
    });
    it('preserves partial updates, rejects incomplete clears, and resets only remote fields with {}', async () => {
        const h = await speechFixture();
        h.set({ ...speechDefaults(), config: { ...speechConfig, edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX' }, mode: 'voice', enabled: true,
            approvedDestinationKey: resolveTtsConfig(speechConfig).destinationKey, chats: { '5511999998888@s.whatsapp.net': { mode: 'mirror' } } });
        expect((await h.tool.execute('partial', { ttsModel: 'updated' })).isError).toBe(false); expect(h.settings().config.ttsEndpoint).toBe(speechConfig.ttsEndpoint);
        const before = h.settings(); expect((await h.tool.execute('bad-clear', { ttsEnv: null })).isError).toBe(true); expect(h.settings()).toEqual(before);
        expect((await h.tool.execute('edge', {})).isError).toBe(false);
        expect(h.settings().config).toEqual({ edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX' }); expect(h.settings().mode).toBe('voice');
        expect(h.settings().chats).toEqual(before.chats); expect(h.settings().approvedDestinationKey).toBeUndefined();
    });
    it('rejects a delayed mutation if the operator revision changes before applying it', async () => {
        const h = await speechFixture('whatsapp');
        mocks.sessionManager.setSpeechSettings.mockImplementationOnce(async (_next, _revision, current) => { mocks.sessionManager.getOperatorRevision.mockReturnValue(1); if (!current()) throw new Error('fixture stale owner'); });
        expect((await h.tool.execute('stale', speechConfig)).isError).toBe(true); expect(h.settings()).toEqual(speechDefaults());
    });

    it('sends explicit document metadata without putting attachment bytes in the tool result', async () => {
        const root = await mkdtemp(join(tmpdir(), 'wa-tool-file-'));
        try {
            const path = join(root, 'test.md');
            await writeFile(path, 'FIXTURE-BYTES-NOT-FOR-TRANSCRIPT');
            const registerExtension = await loadExtension();
            const pi = createMockPi();
            registerExtension(pi as any);
            const result = await pi.tools.get('send_wa_media').execute('media-call', { path, type: 'document', jid: '15550000001@s.whatsapp.net' }, new AbortController().signal, undefined, { ...createMockContext(), cwd: root });
            expect(result.isError).toBe(false);
            expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true, media: { fileName: 'test.md', mimetype: 'text/markdown' } });
            expect(result.content[0].text).not.toContain('FIXTURE-BYTES-NOT-FOR-TRANSCRIPT');
            expect(mocks.whatsappService.sendContent).toHaveBeenCalledWith(expect.objectContaining({ recipientJid: '15550000001@s.whatsapp.net', sendOptions: { mediaUploadTimeoutMs: 60_000 } }));
            expect(mocks.recentsService.recordMessage).toHaveBeenCalledOnce();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('adds the selected native quote to a text tool send and records its relationship', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        registerExtension(pi as any);
        const jid = '15550000001@s.whatsapp.net';
        mocks.whatsappService.getQuotedMessage.mockReturnValue({ key: { remoteJid: jid, id: 'original', fromMe: false }, message: { conversation: 'Retained' } });
        mocks.whatsappService.sendMessage.mockImplementationOnce(async (_jid, _text, _preserve, options) => {
            const result = { success: true, messageId: 'quoted-send', attempts: 1 };
            await options.onSettled(result);
            return result;
        });
        const quote = { messageId: 'original', conversationJid: jid, fromMe: false };
        const result = await pi.tools.get('send_wa_message').execute('quote', { jid, message: 'Reply', quote });
        expect(result.isError).toBe(false);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledWith(jid, 'Reply', true, expect.objectContaining({ quote }));
        expect(mocks.recentsService.recordMessage).toHaveBeenCalledWith(expect.objectContaining({ quotedMessageId: 'original' }));
    });

    it.each(['send_wa_message', 'send_wa_media'])('does not silently drop an unavailable quote in %s', async tool => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        registerExtension(pi as any);
        const result = await pi.tools.get(tool).execute('missing-quote', { jid: '15550000001@s.whatsapp.net', message: 'No fallback', path: 'irrelevant.pdf', type: 'document', quote: { messageId: 'missing' } });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Native quote unavailable');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });

    const sttFixture = async (source = 'interactive', actor = '5511999998888@s.whatsapp.net', group = false) => {
        const h = await speechFixture(source, actor, group);
        return { ...h, tool: h.pi.tools.get('configure_wa_stt') };
    };
    const sttConfig = { sttEndpoint: 'https://speech.example.test/v1', sttModel: 'fixture-stt', sttEnv: 'FIXTURE_STT_KEY' };

    it.each(['interactive', 'rpc', 'whatsapp'])('allows STT changes from a verified %s request without reading or sending credentials', async source => {
        const h = await sttFixture(source);
        if (source !== 'whatsapp') mocks.sessionManager.getOperatorJid.mockReturnValue('');
        vi.stubEnv('FIXTURE_STT_KEY', 'synthetic-value-never-return-this');
        const result = await h.tool.execute('authorized-stt', sttConfig, new AbortController().signal);
        expect(result.isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenCalledWith(sttConfig, expect.any(Function));
        expect(JSON.stringify(result)).not.toContain('synthetic-value-never-return-this');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it.each([false, true])('denies STT changes and clears from an allowed non-owner (group=%s)', async group => {
        const h = await sttFixture('whatsapp', '15550000002@s.whatsapp.net', group);
        mocks.sessionManager.getSttConfig.mockClear();
        for (const params of [sttConfig, {}]) expect((await h.tool.execute('denied-stt', params)).isError).toBe(true);
        expect(mocks.sessionManager.getSttConfig).not.toHaveBeenCalled();
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it('accepts the actual owner as the group participant for STT configuration', async () => {
        const h = await sttFixture('whatsapp', '5511999998888@s.whatsapp.net', true);
        expect((await h.tool.execute('group-owner-stt', sttConfig)).isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenCalledWith(sttConfig, expect.any(Function));
    });
    it('denies STT configuration when the phone owner is missing', async () => {
        const h = await sttFixture('whatsapp'); mocks.sessionManager.getOperatorJid.mockReturnValue('');
        const result = await h.tool.execute('no-stt-owner', sttConfig);
        expect(result.isError).toBe(true); expect(result.content[0].text).toContain('Choose the phone owner');
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it('denies idle or unknown STT provenance instead of assuming a local request', async () => {
        const pi = createMockPi(); (await loadExtension())(pi as any);
        expect((await pi.tools.get('configure_wa_stt').execute('idle-stt', {})).isError).toBe(true);
        const h = await sttFixture('extension'); expect((await h.tool.execute('unknown-stt', sttConfig)).isError).toBe(true);
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it.each(['abort', 'owner', 'account', 'session', 'ended', 'disallowed'] as const)('fences delayed STT configuration after %s revocation', async change => {
        const h = await sttFixture('whatsapp'); const abort = new AbortController(); let captured: (() => boolean) | undefined;
        mocks.sessionManager.setSttConfig.mockImplementationOnce(async (_config, current) => {
            captured = current;
            if (change === 'abort') abort.abort();
            else if (change === 'owner') mocks.sessionManager.getOperatorRevision.mockReturnValue(1);
            else if (change === 'account') mocks.whatsappService.getSessionContext.mockReturnValue({ accountScope: 'replacement-account', generation: 2 });
            else if (change === 'session') await h.pi.handlers.get('session_before_switch')!({}, h.ctx);
            else if (change === 'ended') await h.pi.handlers.get('agent_end')!({ messages: [] }, h.ctx);
            else mocks.sessionManager.getAllowList.mockReturnValue([]);
            if (!current?.()) throw new Error('Settings request expired');
        });
        expect((await h.tool.execute('revoked-stt', sttConfig, abort.signal)).isError).toBe(true);
        expect(captured).toBeTypeOf('function'); expect(captured!()).toBe(false);
    });
    it('rechecks STT authority after initialization before reading or persisting settings', async () => {
        const h = await sttFixture(); mocks.sessionManager.getSttConfig.mockClear();
        mocks.sessionManager.ensureInitialized.mockImplementationOnce(async () => { await h.pi.handlers.get('session_before_switch')!({}, h.ctx); });
        expect((await h.tool.execute('stale-stt-init', sttConfig)).isError).toBe(true);
        expect(mocks.sessionManager.getSttConfig).not.toHaveBeenCalled(); expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it('denies already cancelled STT changes before touching settings', async () => {
        const h = await sttFixture(); const abort = new AbortController(); abort.abort();
        expect((await h.tool.execute('aborted-stt', sttConfig, abort.signal)).isError).toBe(true);
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });

    it('preserves omitted STT fields on a partial tool update and returns the effective config', async () => {
        const { pi } = await sttFixture();
        const result = await pi.tools.get('configure_wa_stt').execute('partial', { sttModel: 'updated' });
        const expected = { sttEndpoint: 'https://speech.invalid/v1', sttModel: 'updated', sttEnv: 'FIXTURE_STT_KEY' };
        expect(result.isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenCalledWith(expected, expect.any(Function));
        expect(JSON.parse(result.content[0].text)).toEqual({ success: true, ...expected });
    });

    it.each([{ sttEndpoint: 'http://speech.invalid' }, { sttEnv: '' }, { sttModel: 'x'.repeat(257) }])('rejects invalid STT updates without changing settings: %s', async params => {
        const { pi } = await sttFixture();
        const result = await pi.tools.get('configure_wa_stt').execute('invalid', params);
        expect(result.isError).toBe(true);
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });

    it('adds remote language without changing connection settings and explicitly clears it with null or empty', async () => {
        const { tool } = await sttFixture();
        expect((await tool.execute('language', { sttLanguage: 'es' })).isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenLastCalledWith(expect.objectContaining({ sttLanguage: 'es', sttEnv: 'FIXTURE_STT_KEY' }), expect.any(Function));
        mocks.sessionManager.getSttConfig.mockReturnValue({ sttEndpoint: 'https://speech.invalid/v1', sttModel: 'fixture', sttEnv: 'FIXTURE_STT_KEY', sttLanguage: 'es' } as any);
        for (const sttLanguage of [null, '']) { expect((await tool.execute('clear-language', { sttLanguage })).isError).toBe(false); expect(mocks.sessionManager.setSttConfig.mock.calls.at(-1)![0]).not.toHaveProperty('sttLanguage'); }
        expect((await tool.execute('local', {})).isError).toBe(false); expect(mocks.sessionManager.setSttConfig).toHaveBeenLastCalledWith({}, expect.any(Function));
    });
    it('rejects invalid language-only local updates before persistence', async () => {
        mocks.sessionManager.getSttConfig.mockReturnValue({} as any); const { pi } = await sttFixture();
        expect((await pi.tools.get('configure_wa_stt').execute('bad-language', { sttLanguage: 'not_a_language' })).isError).toBe(true); expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });
    it('honors explicit HTTP opt-in without changing the default-negative test environment', async () => {
        const { tool } = await sttFixture(); const params = { sttEndpoint: 'http://speech.invalid/v1' };
        expect((await tool.execute('http-denied', params)).isError).toBe(true); expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); expect((await tool.execute('http-approved', params)).isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenCalledWith(expect.objectContaining(params), expect.any(Function));
    });
    it('rejects incomplete first-time STT setup without persisting it', async () => {
        mocks.sessionManager.getSttConfig.mockReturnValue({} as any);
        const { pi } = await sttFixture();
        expect((await pi.tools.get('configure_wa_stt').execute('incomplete', { sttModel: 'fixture' })).isError).toBe(true);
        expect(mocks.sessionManager.setSttConfig).not.toHaveBeenCalled();
    });

    it.each([{}, { sttEndpoint: '', sttModel: '', sttEnv: '' }])('can explicitly select local STT with %s', async params => {
        const { pi } = await sttFixture();
        expect((await pi.tools.get('configure_wa_stt').execute('clear', params)).isError).toBe(false);
        expect(mocks.sessionManager.setSttConfig).toHaveBeenCalledWith(params, expect.any(Function));
    });

    it('does not call the removed pi.events i18n API', async () => {
        const registerExtension = await loadExtension();
        const pi = {
            ...createMockPi(),
            events: {
                emit: vi.fn(),
                on: vi.fn()
            }
        };

        registerExtension(pi as any);

        expect(pi.events.emit).not.toHaveBeenCalled();
        expect(pi.events.on).not.toHaveBeenCalled();
    });

    it('initializes session services and restores saved WhatsApp state on session start', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        ctx.sessionManager.getEntries.mockReturnValue([
            {
                type: 'custom',
                customType: 'whatsapp-ng-state',
                data: {
                    status: 'connected',
                    allowList: [{ number: '+5511999998888', name: 'Ana' }]
                }
            }
        ]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);

        expect(mocks.whatsappService.setVerboseMode).toHaveBeenCalledWith(false);
        expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Disconnected');
        expect(mocks.sessionManager.ensureInitialized).toHaveBeenCalledOnce();
        expect(mocks.recentsService.ensureInitialized).toHaveBeenCalledOnce();
        expect(mocks.sessionManager.setStatus).toHaveBeenCalledWith('disconnected');
        expect(mocks.sessionManager.addNumber).toHaveBeenCalledWith('+5511999998888', 'Ana');
        expect(mocks.whatsappService.setIncomingMessageRecorder).toHaveBeenCalledOnce();
        expect(pi.exec).not.toHaveBeenCalled();
    });

    it('does not import legacy session entries into the independent namespace', async () => {
        const registerExtension = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
        ctx.sessionManager.getEntries.mockReturnValue([{ type: 'custom', customType: 'whatsapp-state', data: { status: 'connected', allowList: [{ number: '+15550000009' }] } }]);
        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);
        expect(mocks.sessionManager.addNumber).not.toHaveBeenCalled();
        expect(mocks.sessionManager.setStatus).not.toHaveBeenCalled();
    });

    it('does not replay a successful migration on new sessions or extension recreation', async () => {
        const register = await loadExtension(); const pi = createMockPi();
        pi.getFlag.mockImplementation(name => name === 'whatsapp-ng-migrate-from' ? '/synthetic-source' : false);
        const { StateMigrationService: first } = await import('../../src/services/state-migration.service.ts');
        const queue = vi.spyOn(first, 'queue').mockResolvedValueOnce(undefined).mockRejectedValue(new Error('source no longer exists'));
        const run = vi.spyOn(first, 'runPending').mockResolvedValue(true);
        try {
            register(pi as any);
            await pi.handlers.get('session_start')!({ reason: 'startup' }, createMockContext());
            await pi.handlers.get('session_start')!({ reason: 'new' }, createMockContext());
            expect(queue).toHaveBeenCalledOnce(); expect(run).toHaveBeenCalledOnce();
        } finally { queue.mockRestore(); run.mockRestore(); }
        const registerAgain = await loadExtension(); const next = createMockPi();
        next.getFlag.mockImplementation(name => name === 'whatsapp-ng-migrate-from' ? '/synthetic-source' : false);
        const { StateMigrationService: fresh } = await import('../../src/services/state-migration.service.ts');
        const queueAgain = vi.spyOn(fresh, 'queue').mockRejectedValue(new Error('must not queue after recreation'));
        const runAgain = vi.spyOn(fresh, 'runPending').mockRejectedValue(new Error('must not migrate after recreation'));
        try {
            registerAgain(next as any);
            await next.handlers.get('session_start')!({ reason: 'resume' }, createMockContext());
            expect(queueAgain).not.toHaveBeenCalled(); expect(runAgain).not.toHaveBeenCalled();
        } finally { queueAgain.mockRestore(); runAgain.mockRestore(); }
    });

    it('blocks all tools and the command when startup migration fails', async () => {
        const registerExtension = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
        const { StateMigrationService } = await import('../../src/services/state-migration.service.ts');
        const run = vi.spyOn(StateMigrationService, 'runPending').mockRejectedValue(new Error('fixture migration blocked'));
        try {
            registerExtension(pi as any);
            await expect(pi.handlers.get('session_start')!({ reason: 'manual' }, ctx)).rejects.toThrow('fixture migration blocked');
            expect(mocks.sessionManager.ensureInitialized).not.toHaveBeenCalled();
            expect(mocks.whatsappService.start).not.toHaveBeenCalled();
            for (const tool of pi.tools.values()) await expect(tool.execute('blocked', {})).rejects.toThrow('fixture migration blocked');
            await expect(pi.commands.get('whatsapp').handler('', ctx)).rejects.toThrow('fixture migration blocked');
        } finally { run.mockRestore(); }
    });

    it('preserves saved connected status when auto-connect is enabled and credentials exist', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        pi.getFlag.mockReturnValue(true);
        mocks.sessionManager.isRegistered.mockResolvedValue(true);
        ctx.sessionManager.getEntries.mockReturnValue([
            {
                type: 'custom',
                customType: 'whatsapp-ng-state',
                data: {
                    status: 'connected',
                    allowList: []
                }
            }
        ]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);

        expect(mocks.sessionManager.setStatus).toHaveBeenCalledWith('connected');
        expect(mocks.whatsappService.start).toHaveBeenCalledOnce();
    });

    it.each([[false, false, false], [true, false, true], [false, true, true], [true, true, true]])('combines saved startup preference %s with online flag %s', async (saved, flag, expected) => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
        pi.getFlag.mockImplementation(name => name === 'whatsapp-ng-online' && flag); mocks.sessionManager.getAutoConnect.mockReturnValue(saved);
        mocks.sessionManager.isRegistered.mockResolvedValue(true); register(pi as any); await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);
        expect(mocks.whatsappService.start).toHaveBeenCalledTimes(expected ? 1 : 0);
        if (expected) expect(mocks.whatsappService.start).toHaveBeenCalledWith({ allowPairingOnAuthFailure: false });
    });
    it.each(['json', 'print'] as const)('does not implicitly auto-connect a %s process but honors its explicit flag', async mode => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); ctx.mode = mode;
        mocks.sessionManager.getAutoConnect.mockReturnValue(true); mocks.sessionManager.isRegistered.mockResolvedValue(true); register(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx); expect(mocks.whatsappService.start).not.toHaveBeenCalled();
        pi.getFlag.mockImplementation(name => name === 'whatsapp-ng-online');
        await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx); expect(mocks.whatsappService.start).toHaveBeenCalledExactlyOnceWith({ allowPairingOnAuthFailure: false });
    });
    it('treats an occupied profile as one informational skip on saved-preference startup', async () => {
        vi.useFakeTimers();
        try {
            const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
            mocks.sessionManager.getAutoConnect.mockReturnValue(true); mocks.sessionManager.isRegistered.mockResolvedValue(true);
            mocks.whatsappService.start.mockRejectedValue(Object.assign(new Error('Synthetic occupied profile'), { code: 'WHATSAPP_NG_PROFILE_IN_USE' })); register(pi as any);
            await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx); await vi.advanceTimersByTimeAsync(15_000);
            expect(mocks.whatsappService.start).toHaveBeenCalledOnce(); expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('already in use'), 'info');
            expect(ctx.ui.notify.mock.calls.filter(([message]) => String(message).includes('Retrying'))).toHaveLength(0);
            expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Disconnected');
        } finally { vi.clearAllTimers(); vi.useRealTimers(); }
    });
    it('loads the saved auto-connect preference before deciding whether to connect', async () => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
        mocks.sessionManager.ensureInitialized.mockImplementationOnce(async () => { mocks.sessionManager.getAutoConnect.mockReturnValue(true); });
        mocks.sessionManager.isRegistered.mockResolvedValue(true); register(pi as any); await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);
        expect(mocks.whatsappService.start).toHaveBeenCalledExactlyOnceWith({ allowPairingOnAuthFailure: false });
    });
    it('never starts pairing when saved auto-connect is enabled without credentials', async () => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext();
        mocks.sessionManager.getAutoConnect.mockReturnValue(true); register(pi as any); await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);
        expect(mocks.whatsappService.start).not.toHaveBeenCalled(); expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('no saved WhatsApp credentials'), 'warning');
    });
    it('does not restore an auto-connect preference from an old Pi session entry', async () => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); mocks.sessionManager.isRegistered.mockResolvedValue(true);
        ctx.sessionManager.getEntries.mockReturnValue([{ type: 'custom', customType: 'whatsapp-ng-state', data: { status: 'connected', autoConnect: true } }]);
        register(pi as any); await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);
        expect(mocks.whatsappService.start).not.toHaveBeenCalled(); expect(mocks.sessionManager.setStatus).toHaveBeenCalledWith('disconnected');
    });
    it('keeps saved connected status when the preference requests startup without an online flag', async () => {
        const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); mocks.sessionManager.isRegistered.mockResolvedValue(true);
        mocks.sessionManager.getAutoConnect.mockReturnValue(true); ctx.sessionManager.getEntries.mockReturnValue([{ type: 'custom', customType: 'whatsapp-ng-state', data: { status: 'connected' } }]);
        register(pi as any); await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);
        expect(mocks.sessionManager.setStatus).toHaveBeenCalledWith('connected'); expect(mocks.whatsappService.start).toHaveBeenCalledOnce();
    });
    it('keeps deliberate Off above saved auto-connect through session reload and extension recreation', async () => {
        (globalThis as any).__whatsappNgPhoneOffProfiles = new Set(['/synthetic-profile']);
        mocks.sessionManager.getAutoConnect.mockReturnValue(true); mocks.sessionManager.isRegistered.mockResolvedValue(true);
        for (const reason of ['startup', 'new', 'reload']) {
            const register = await loadExtension(); const pi = createMockPi(); const ctx = createMockContext(); register(pi as any);
            await pi.handlers.get('session_start')!({ reason }, ctx);
            expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Off');
        }
        expect(mocks.whatsappService.start).not.toHaveBeenCalled();
    });

    it('auto-connects when flag is enabled and auth is registered', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        pi.getFlag.mockReturnValue(true);
        mocks.sessionManager.isRegistered.mockResolvedValue(true);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);

        expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Auto-connecting...');
        expect(mocks.whatsappService.start).toHaveBeenCalledOnce();
    });

    it('shows connected footer as not ready when there are no chats', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        mocks.sessionManager.getAllowList.mockReturnValue([]);
        mocks.sessionManager.getAllowedGroups.mockReturnValue([]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);
        const statusCallback = mocks.whatsappService.setStatusCallback.mock.calls[0][0];

        statusCallback('| WhatsApp: Connected');

        expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Connected - No chats');
    });

    it('shows allowed chat count in connected footer', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        mocks.sessionManager.getAllowList.mockReturnValue([{ number: '+5511999998888' }]);
        mocks.sessionManager.getAllowedGroups.mockReturnValue([{ number: '120363012345@g.us' }]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);
        const statusCallback = mocks.whatsappService.setStatusCallback.mock.calls[0][0];

        statusCallback('| WhatsApp: Connected');

        expect(ctx.ui.setStatus).toHaveBeenCalledWith('whatsapp', '| WhatsApp: Connected to 2 chats');
    });

    it('does not preserve connected state when auto-connect is enabled without saved credentials', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        pi.getFlag.mockReturnValue(true);
        mocks.sessionManager.isRegistered.mockResolvedValue(false);
        ctx.sessionManager.getEntries.mockReturnValue([
            {
                type: 'custom',
                customType: 'whatsapp-ng-state',
                data: {
                    status: 'connected',
                    allowList: []
                }
            }
        ]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'startup' }, ctx);

        expect(mocks.sessionManager.setStatus).toHaveBeenCalledWith('disconnected');
        expect(mocks.whatsappService.start).not.toHaveBeenCalled();
        expect(ctx.ui.notify).toHaveBeenCalledWith(
            'WhatsApp: Auto-connect requested, but no saved WhatsApp credentials were found. Use Connect WhatsApp once to scan the QR code.',
            'warning'
        );
    });

    it('wires incoming WhatsApp messages into Pi follow-up user messages', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();

        registerExtension(pi as any);
        const messageCallback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];

        await messageCallback({
            key: {
                id: 'WA1',
                remoteJid: '5511999998888@s.whatsapp.net',
                fromMe: false
            },
            pushName: 'Ana',
            message: { conversation: 'hello' }
        });

        expect(mocks.extractIncomingText).toHaveBeenCalledWith({ conversation: 'hello' }, mocks.recentsService);
        expect(mocks.incomingMediaService.process).toHaveBeenCalledWith(
            { kind: 'text', text: 'hello from whatsapp' },
            'Ana'
        );
        expect(mocks.whatsappService.markRead).toHaveBeenCalledWith({ remoteJid: '5511999998888@s.whatsapp.net', id: 'WA1', fromMe: false });
        expect(mocks.whatsappService.sendPresence).not.toHaveBeenCalled();
        expect(pi.sendUserMessage).toHaveBeenCalledWith(
            expect.stringContaining('Message from Ana (5511999998888@s.whatsapp.net): hello from whatsapp'),
            { deliverAs: 'followUp' }
        );
        const submitted = pi.sendUserMessage.mock.calls[0][0] as string;
        expect(submitted).toMatch(/^\[WhatsApp request [\da-f-]+\]/);
        const ctx = createMockContext();
        await pi.handlers.get('input')!({ source: 'extension', text: submitted }, ctx);
        await pi.handlers.get('agent_start')!({}, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content: [{ type: 'text', text: submitted }] } }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'assistant', content: [] } }, ctx);
        expect(mocks.whatsappService.sendPresence).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'composing');
    });

    it('provides audio with a live session fence and does not inject stale transcription', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        registerExtension(pi as any);
        mocks.extractIncomingText.mockReturnValue({ kind: 'audio', text: '[Audio Message]', audioMessage: {} } as any);
        let captured: { isCurrent: () => boolean } | undefined;
        let finish!: () => void;
        mocks.incomingMediaService.process.mockImplementationOnce((_resolved: any, _name: string, options: any) => {
            captured = options;
            return new Promise(resolve => { finish = () => resolve({ text: 'late transcription' }); });
        });
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        mocks.sessionManager.getAllowList.mockReturnValue([{ number: '15550000001@s.whatsapp.net' }]);
        const pending = callback({ key: { id: 'AUDIO', remoteJid: '15550000001@s.whatsapp.net', fromMe: false }, message: {}, pushName: 'Fixture' });
        expect(captured?.isCurrent()).toBe(true);
        await pi.handlers.get('session_before_switch')!({}, ctx);
        expect(captured?.isCurrent()).toBe(false);
        finish();
        await pending;
        expect(pi.sendUserMessage).not.toHaveBeenCalled();
    });

    it('executes /compact commands received from WhatsApp', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: '/compact' });
        mocks.sessionManager.getAllowList.mockReturnValue([{ number: '5511999998888@s.whatsapp.net' }]);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);
        const messageCallback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];

        await messageCallback({
            key: {
                id: 'WA1',
                remoteJid: '5511999998888@s.whatsapp.net',
                fromMe: false
            },
            pushName: 'Ana',
            message: { conversation: '/compact' }
        });

        expect(ctx.compact).toHaveBeenCalledOnce();
        expect(pi.sendUserMessage).not.toHaveBeenCalled();
        expect(mocks.incomingMediaService.process).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledWith(expect.objectContaining({
            recipientJid: '5511999998888@s.whatsapp.net', text: 'Shared Pi compaction requested.',
            isCurrent: expect.any(Function), options: { brand: false, maxRetries: 1 }
        }));
    });

    it('send_wa_message tool reports disconnected status without sending', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        mocks.whatsappService.getStatus.mockReturnValue('disconnected');

        registerExtension(pi as any);
        const result = await pi.tools.get('send_wa_message').execute(
            'tool-call-id',
            { jid: '5511999998888@s.whatsapp.net', message: 'hello' }
        );

        expect(result.isError).toBe(true);
        expect(JSON.parse(result.content[0].text)).toEqual({
            success: false,
            error: 'WhatsApp not connected',
            attempts: 0
        });
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('send_wa_message prefers the active remoteJid over a reconstructed contact JID', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        mocks.whatsappService.getLastRemoteJid.mockReturnValue('5511999998888@lid');
        mocks.whatsappService.canonicalConversation.mockImplementation(jid => jid.replace(/@lid$/, '@s.whatsapp.net'));

        registerExtension(pi as any);
        const result = await pi.tools.get('send_wa_message').execute(
            'tool-call-id',
            { jid: '5511999998888@s.whatsapp.net', message: 'hello' }
        );

        expect(result.isError).toBe(false);
        expect(mocks.whatsappService.resolveOutboundRecipientJid).toHaveBeenCalledWith('5511999998888@lid');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@lid', 'hello');
    });

    it('sets group binding on session_start when whatsapp-group flag is set', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        pi.getFlag.mockImplementation((name: string) => {
            if (name === 'whatsapp-group') return '120363012345@g.us';
            return false;
        });

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);

        expect(mocks.whatsappService.setGroupBinding).toHaveBeenCalledWith('120363012345@g.us');
        expect(mocks.sessionManager.setGroupJidForAuth).toHaveBeenCalledWith('120363012345@g.us');
    });

    it('does not set group binding when whatsapp-group flag is empty', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();
        const ctx = createMockContext();
        pi.getFlag.mockReturnValue(false);

        registerExtension(pi as any);
        await pi.handlers.get('session_start')!({ reason: 'manual' }, ctx);

        expect(mocks.whatsappService.setGroupBinding).not.toHaveBeenCalled();
    });

    it('formats group messages with participant info in the prompt', async () => {
        const registerExtension = await loadExtension();
        const pi = createMockPi();

        registerExtension(pi as any);
        const messageCallback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];

        mocks.sessionManager.getAllowedGroups.mockReturnValue([{ number: '120363012345@g.us' }]);
        await messageCallback({
            key: {
                id: 'WA-GRP-1',
                remoteJid: '120363012345@g.us',
                participant: '5511999998888@s.whatsapp.net',
                fromMe: false
            },
            pushName: 'Ana',
            message: { conversation: 'hello group' }
        });

        expect(pi.sendUserMessage).toHaveBeenCalledWith(
            expect.stringContaining('Message from Ana (5511999998888@s.whatsapp.net) in group 120363012345@g.us: hello from whatsapp'),
            { deliverAs: 'followUp' }
        );
    });
});
