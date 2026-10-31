import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MessageRequest } from '../../src/models/whatsapp.types.ts';
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
        getAllowList: vi.fn().mockReturnValue(['5511999998888', '15550000002', '15550000003', '15550000099'].map(number => ({ number: `${number}@s.whatsapp.net` }))),
        getAllowedGroups: vi.fn().mockReturnValue([{ number: '120363000000001@g.us' }]),
        setGroupJidForAuth: vi.fn(),
        getFinalAfterAttachments: vi.fn().mockReturnValue(true),
        getAutoConnect: vi.fn().mockReturnValue(false),
        getReplyStats: vi.fn().mockReturnValue(false), getReplyStatsRevision: vi.fn().mockReturnValue(0),
        getReplyReporting: vi.fn().mockReturnValue({ changedFiles: false, interimText: false, liveActivity: false }), getReplyReportingRevision: vi.fn().mockReturnValue(0),
        getGroupReplies: vi.fn().mockReturnValue({ mode: 'all', context: false }), getGroupRepliesRevision: vi.fn().mockReturnValue(0),
        getSpeechSettings: vi.fn().mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: {} }),
        getSpeechRevision: vi.fn().mockReturnValue(0), getReplyAdmissionKey: vi.fn().mockReturnValue('fixture-admission-0'),
        getOperatorRevision: vi.fn().mockReturnValue(0), getOperatorJid: vi.fn().mockReturnValue('5511999998888@s.whatsapp.net'),
        setSpeechSettings: vi.fn().mockResolvedValue(undefined), setSpeechConfigCallback: vi.fn(), getSttConfig: vi.fn().mockReturnValue({})
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
        outputPolicy: { mode: 'text' } as any,
        settingsMenus: undefined as any,
        speechPrepare: vi.fn(), speechClose: vi.fn().mockResolvedValue(undefined), speechConstruct: vi.fn(),
        sessionManager: createSessionManager(),
        whatsappService: createWhatsAppService(),
        recentsService: createRecentsService(),
        menuHandler: createMenuHandler(),
        incomingMediaService: createIncomingMediaService(),
        extractIncomingText: vi.fn().mockReturnValue({ kind: 'text', text: 'hello from whatsapp' }),
        reset() {
            this.outputPolicy = { mode: 'text' }; this.settingsMenus = undefined;
            this.speechPrepare = vi.fn(); this.speechClose = vi.fn().mockResolvedValue(undefined); this.speechConstruct = vi.fn();
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

vi.mock('../../src/services/final-output.service.ts', async importOriginal => {
    const actual = await importOriginal<typeof import('../../src/services/final-output.service.ts')>();
    return { ...actual, FinalOutputCoordinator: class extends actual.FinalOutputCoordinator {
        constructor(options: ConstructorParameters<typeof actual.FinalOutputCoordinator>[0]) { super({ ...options, policy: snapshot => mocks.outputPolicy ?? options.policy?.(snapshot) ?? { mode: 'text' } }); }
    } };
});
vi.mock('../../src/services/tts.service.ts', () => ({ TtsService: class {
    constructor() { mocks.speechConstruct(); }
    prepare(...args: unknown[]) { return mocks.speechPrepare(...args); }
    close() { return mocks.speechClose(); }
} }));

vi.mock('../../src/services/audio.service.ts', () => ({
    AudioService: vi.fn(function () { return {}; })
}));

vi.mock('../../src/ui/menu.handler.ts', () => ({
    MenuHandler: vi.fn(function (...args: any[]) { mocks.settingsMenus = args[3]; return mocks.menuHandler; })
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
    getActiveTools: ReturnType<typeof vi.fn<() => string[]>>;
    setActiveTools: ReturnType<typeof vi.fn<(names: string[]) => void>>;
}

const createMockPi = (): MockPi => {
    const flags = new Map<string, unknown>();
    const handlers = new Map<string, PiHandler>();
    const commands = new Map<string, any>();
    const tools = new Map<string, any>();
    let active = ['read', 'send_wa_message', 'send_wa_media', 'send_reaction', 'list_wa_conversations', 'request_wa_history'];

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
        getActiveTools: vi.fn(() => [...active]),
        setActiveTools: vi.fn((names: string[]) => { active = [...names]; })
    };
};

const createMockContext = () => ({
    cwd: '/fixture/workspace',
    signal: undefined as AbortSignal | undefined,
    isIdle: vi.fn().mockReturnValue(true),
    ui: {
        select: vi.fn().mockResolvedValue('Back'), confirm: vi.fn().mockResolvedValue(false), input: vi.fn(),
        setStatus: vi.fn(),
        notify: vi.fn()
    },
    sessionManager: {
        getEntries: vi.fn().mockReturnValue([])
    },
    compact: vi.fn(),
    abort: vi.fn()
});

const loadExtension = async () => {
    vi.resetModules();
    const module = await import('../../whatsapp-ng.ts');
    return module.default;
};

const makeAssistantEvent = (text: string) => ({
    message: {
        role: 'assistant',
        content: [{ type: 'text', text }]
    }
});

const incoming = (id = 'incoming', jid = '5511999998888@s.whatsapp.net') => ({
    key: { id, remoteJid: jid, fromMe: false },
    pushName: 'Ana',
    senderNumber: '+' + jid.split('@')[0],
    sessionContext: { accountScope: 'fixture-account', generation: 1 },
    message: { conversation: 'hello' }
});

const submit = async (pi: MockPi, ctx: ReturnType<typeof createMockContext>, id = 'incoming', jid?: string) => {
    const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
    await callback(incoming(id, jid));
    const content = pi.sendUserMessage.mock.calls.at(-1)![0] as string;
    await pi.handlers.get('input')!({ source: 'extension', text: content }, ctx);
    await pi.handlers.get('message_start')!({ message: { role: 'user', content: [{ type: 'text', text: content }] } }, ctx);
};

const setup = async () => {
    const registerExtension = await loadExtension();
    const pi = createMockPi();
    const ctx = createMockContext();
    registerExtension(pi as any);
    await pi.handlers.get('session_start')!({}, ctx);
    return { pi, ctx };
};

const beginOwned = async (pi: MockPi, ctx: ReturnType<typeof createMockContext>) => {
    await pi.handlers.get('agent_start')!({}, ctx);
    await submit(pi, ctx);
    await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
};

const finalTurn = async (pi: MockPi, ctx: ReturnType<typeof createMockContext>, text: string) => {
    const event = makeAssistantEvent(text);
    await pi.handlers.get('message_end')!(event, ctx);
    await pi.handlers.get('turn_end')!({ ...event, toolResults: [] }, ctx);
};

describe('whatsapp-ng owned turn delivery', () => {
    beforeEach(() => {
        resetI18n();
        vi.stubEnv('WHATSAPP_NG_LOCALE', '');
        mocks.reset();
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.each(['phone', 'lid', 'group'])('preserves the transport JID namespace in %s prompt labels', async kind => {
        const { pi } = await setup(); const phone = '5511999998888@s.whatsapp.net'; const lid = '90000001@lid'; const group = '120363000000001@g.us';
        mocks.whatsappService.canonicalConversation.mockImplementation(jid => jid === lid ? phone : jid);
        const item = incoming('typed-identity', kind === 'phone' ? phone : kind === 'lid' ? lid : group);
        if (kind === 'group') (item.key as any).participant = lid;
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0](item);
        expect(pi.sendUserMessage).toHaveBeenCalledOnce(); const content = pi.sendUserMessage.mock.calls[0][0];
        expect(content).toContain(`(${kind === 'phone' ? phone : lid})`);
        expect(content).not.toContain('(90000001):'); expect(content).not.toContain('90000001@s.whatsapp.net');
        if (kind === 'group') expect(content).toContain(`in group ${group}:`);
    });
    it.each(['text', 'system'])('never logs the body of an incoming %s request', async kind => {
        const { pi } = await setup(); const { WhatsAppNgLogger } = await import('../../src/services/whatsapp-ng.logger.ts');
        const logs = vi.spyOn(WhatsAppNgLogger.prototype, 'log');
        mocks.extractIncomingText.mockReturnValue({ kind, text: 'PRIVATE-C4-QUESTION' } as any);
        mocks.incomingMediaService.process.mockResolvedValue({ text: 'PRIVATE-C4-TRANSCRIPTION' });
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0](incoming());
        expect(JSON.stringify(logs.mock.calls)).not.toMatch(/PRIVATE-C4-QUESTION|PRIVATE-C4-TRANSCRIPTION/);
        expect(pi.sendUserMessage).toHaveBeenCalledTimes(kind === 'text' ? 1 : 0);
    });
    it('requires native group addressing before media preparation, not textual mentions', async () => {
        const { pi } = await setup(); const group = '120363000001@g.us'; const own = '15550000009@s.whatsapp.net';
        mocks.sessionManager.getAllowedGroups.mockReturnValue([{ number: group }]);
        mocks.sessionManager.getGroupReplies.mockReturnValue({ mode: 'mentions-or-replies', context: false });
        (mocks.whatsappService as any).isOwnJid = (jid: string) => jid === own;
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const item = { ...incoming(), key: { id: 'group-text', remoteJid: group, fromMe: false, participant: '5511999998888@s.whatsapp.net' }, message: { conversation: '@15550000009 hello' } };
        await callback(item); expect(pi.sendUserMessage).not.toHaveBeenCalled(); expect(mocks.incomingMediaService.process).not.toHaveBeenCalled();
        expect(mocks.whatsappService.markRead).not.toHaveBeenCalled();
        await callback({ ...item, key: { ...item.key, id: 'group-mention' }, message: { extendedTextMessage: { text: 'hello', contextInfo: { mentionedJid: [own] } } } });
        expect(pi.sendUserMessage).toHaveBeenCalledOnce(); expect(mocks.whatsappService.markRead).toHaveBeenCalledOnce();
    });
    it('uses optional preceding group text once and clears it across pause/re-enable', async () => {
        const { pi } = await setup(); const group = '120363000001@g.us'; const own = '15550000009@s.whatsapp.net';
        mocks.sessionManager.getAllowedGroups.mockReturnValue([{ number: group }]); mocks.sessionManager.getGroupReplies.mockReturnValue({ mode: 'mentions-or-replies', context: true });
        (mocks.whatsappService as any).isOwnJid = (jid: string) => jid === own;
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const item = { ...incoming(), key: { id: 'preceding', remoteJid: group, fromMe: false, participant: '5511999998888@s.whatsapp.net' } };
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: 'preceding plain text' }); await callback(item);
        expect(mocks.incomingMediaService.process).not.toHaveBeenCalled();
        const mention = { ...item, key: { ...item.key, id: 'trigger' }, message: { extendedTextMessage: { text: 'hello', contextInfo: { mentionedJid: [own] } } } };
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: 'current request' }); await callback(mention);
        expect(pi.sendUserMessage.mock.calls[0][0]).toContain('preceding plain text');
        await callback({ ...mention, key: { ...mention.key, id: 'next-trigger' } }); expect(pi.sendUserMessage.mock.calls[1][0]).not.toContain('preceding plain text');
        mocks.extractIncomingText.mockReturnValue({ kind: 'text', text: 'old pause context' }); await callback({ ...item, key: { ...item.key, id: 'before-pause' } });
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: { [group]: { automaticReplies: false } } });
        mocks.sessionManager.getReplyAdmissionKey.mockReturnValue('paused'); await callback({ ...item, key: { ...item.key, id: 'paused' } });
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: {} }); mocks.sessionManager.getReplyAdmissionKey.mockReturnValue('resumed');
        await callback({ ...mention, key: { ...mention.key, id: 'after-pause' } }); expect(pi.sendUserMessage.mock.calls.at(-1)![0]).not.toContain('old pause context');
    });
    it.each(['text', 'audio'])('routes a retained group quote image through existing %s processing', async kind => {
        const { pi } = await setup(); const group = '120363000000001@g.us'; const image = { url: 'https://fixture.invalid', mediaKey: Buffer.alloc(32) };
        (mocks.whatsappService as any).getIncomingQuotedImage = vi.fn().mockReturnValue(image);
        if (kind === 'audio') mocks.extractIncomingText.mockReturnValue({ kind: 'audio', text: '', audioMessage: {} } as any);
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        await callback({ ...incoming(), key: { id: 'quote-image', remoteJid: group, fromMe: false, participant: '5511999998888@s.whatsapp.net' } });
        expect(mocks.incomingMediaService.process.mock.calls.at(-1)![0]).toMatchObject({ kind: 'image', imageMessage: image }); expect(pi.sendUserMessage).toHaveBeenCalledOnce();
    });
    it.each(['text', 'audio'])('preserves the %s question through a failed retained group image download', async kind => {
        const { pi } = await setup();
        const { IncomingMediaService } = await vi.importActual<typeof import('../../src/services/incoming-media.service.ts')>('../../src/services/incoming-media.service.ts');
        const question = 'Please explain the chart';
        const media = new IncomingMediaService({ transcribe: vi.fn(async () => question) } as any, { log: vi.fn(), error: vi.fn() } as any);
        vi.spyOn(media as any, 'downloadMessage').mockRejectedValue(new Error('Synthetic unavailable image'));
        mocks.incomingMediaService.process.mockImplementation(media.process.bind(media));
        (mocks.whatsappService as any).getIncomingQuotedImage = vi.fn().mockReturnValue({ mimetype: 'image/png' });
        mocks.extractIncomingText.mockReturnValue(kind === 'audio' ? { kind: 'audio', text: '', audioMessage: {} } as any : { kind: 'text', text: question });
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        await callback({ ...incoming(), key: { id: 'unavailable-quote', remoteJid: '120363000000001@g.us', fromMe: false, participant: '5511999998888@s.whatsapp.net' } });
        expect(pi.sendUserMessage).toHaveBeenCalledOnce(); expect(pi.sendUserMessage.mock.calls[0][0]).toContain(question);
    });
    it('does not mark paused incoming work read', async () => {
        const { pi } = await setup(); mocks.sessionManager.getSpeechSettings.mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: { '5511999998888@s.whatsapp.net': { automaticReplies: false } } });
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0](incoming());
        expect(pi.sendUserMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.markRead).not.toHaveBeenCalled();
    });
    it('admits manual self-chat, never ordinary own-direction messages to another chat', async () => {
        const { pi } = await setup(); let self = false; (mocks.whatsappService as any).isOwnJid = () => self;
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const item = { ...incoming(), key: { ...incoming().key, fromMe: true } };
        await callback(item); expect(pi.sendUserMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.markRead).not.toHaveBeenCalled();
        self = true; await callback({ ...item, key: { ...item.key, id: 'manual-self' } }); expect(pi.sendUserMessage).toHaveBeenCalledOnce();
    });
    it('keeps existing final stats when optional reporting settings are malformed', async () => {
        const { pi, ctx } = await setup(); mocks.sessionManager.getReplyStats.mockReturnValue(true);
        mocks.sessionManager.getReplyReporting.mockImplementation(() => { throw new Error('Invalid saved reporting'); });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Final answer');
        await expect.poll(() => mocks.whatsappService.sendContent.mock.calls.filter(([request]) => request.text.startsWith('Reply stats:')).length).toBe(1);
    });
    it('sends opt-in final stats after the answer without observing tool arguments or results', async () => {
        const { pi, ctx } = await setup(); mocks.sessionManager.getReplyStats.mockReturnValue(true);
        await beginOwned(pi, ctx);
        await pi.handlers.get('tool_execution_start')?.({ toolCallId: 'observed', toolName: 'read', args: { path: 'private-input' } }, ctx);
        await pi.handlers.get('tool_execution_end')?.({ toolCallId: 'observed', toolName: 'read', isError: false, result: { content: 'private-result' } }, ctx);
        await finalTurn(pi, ctx, 'Final answer');
        await expect.poll(() => mocks.whatsappService.sendContent.mock.calls.filter(([request]) => request.text.startsWith('Reply stats:')).length).toBe(1);
        const request = mocks.whatsappService.sendContent.mock.calls.find(([request]) => request.text.startsWith('Reply stats:'))![0];
        expect(request.text).toContain('tools 1 succeeded, 0 failed'); expect(request.text).not.toContain('private');
        expect(mocks.whatsappService.sendMessage.mock.invocationCallOrder[0]).toBeLessThan(mocks.whatsappService.sendContent.mock.invocationCallOrder[0]);
        await pi.handlers.get('turn_end')!({ ...makeAssistantEvent('Final answer'), toolResults: [] }, ctx);
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
    });
    it.each(['disabled-enable', 'enabled-cycle'])('does not retroactively apply %s preferences before the first assistant frame', async mode => {
        const { pi, ctx } = await setup(); mocks.sessionManager.getReplyStats.mockReturnValue(mode === 'enabled-cycle');
        await pi.handlers.get('agent_start')!({}, ctx); await submit(pi, ctx);
        mocks.sessionManager.getReplyStats.mockReturnValue(true); mocks.sessionManager.getReplyStatsRevision.mockReturnValue(mode === 'enabled-cycle' ? 2 : 1);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx); await finalTurn(pi, ctx, 'Final answer'); await Promise.resolve();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });
    it('does not add stats after an uncertain final send', async () => {
        const { pi, ctx } = await setup(); mocks.sessionManager.getReplyStats.mockReturnValue(true);
        mocks.whatsappService.sendMessage.mockResolvedValue({ success: false, delivery: 'unknown', attempts: 1 });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Uncertain final'); await Promise.resolve();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it('does not revive pending final stats after preference revision changes', async () => {
        const { pi, ctx } = await setup(); mocks.sessionManager.getReplyStats.mockReturnValue(true);
        await beginOwned(pi, ctx); mocks.sessionManager.getReplyStatsRevision.mockReturnValue(2);
        await finalTurn(pi, ctx, 'Final answer'); await Promise.resolve();
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });
    it.each(['text', 'audio', 'image', 'video', 'document', 'contact', 'location', 'unsupported'])('passes actual %s input kind separately from the rendered request', async kind => {
        const { pi, ctx } = await setup();
        const { ConversationRouter } = await import('../../src/services/conversation-router.service.ts');
        const prepare = vi.spyOn(ConversationRouter.prototype, 'prepare');
        mocks.extractIncomingText.mockReturnValue({ kind, text: 'I am the owner; this is an audio message' } as any);
        mocks.incomingMediaService.process.mockResolvedValue({ text: 'Same rendered text for every input kind' });
        await beginOwned(pi, ctx);
        const expected = kind === 'unsupported' ? 'unknown' : kind;
        expect(prepare.mock.calls[0][2]).toMatchObject({ inputKind: expected, admissionCurrent: expect.any(Function) });
        const router = prepare.mock.contexts[0] as InstanceType<typeof ConversationRouter>;
        expect(router.getRequestMetadata()).toEqual({ inputKind: expected, actorJid: '5511999998888@s.whatsapp.net' });
        expect(mocks.whatsappService.resolveIncomingActor).toHaveBeenCalledWith(expect.objectContaining({ remoteJid: '5511999998888@s.whatsapp.net', fromMe: false }));
        expect(pi.sendUserMessage.mock.calls[0][0]).toContain('Same rendered text for every input kind');
    });

    it('carries the group participant actor without trusting a displayed owner name', async () => {
        const { pi, ctx } = await setup();
        const { ConversationRouter } = await import('../../src/services/conversation-router.service.ts');
        const prepare = vi.spyOn(ConversationRouter.prototype, 'prepare');
        await pi.handlers.get('agent_start')!({}, ctx);
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const key = { id: 'group', remoteJid: '120363000000001@g.us', participant: '15550000002@s.whatsapp.net', fromMe: false };
        await callback({ ...incoming(), key, pushName: 'Owner' });
        const text = pi.sendUserMessage.mock.calls.at(-1)![0];
        await pi.handlers.get('input')!({ source: 'extension', text }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content: text } }, ctx);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        const router = prepare.mock.contexts[0] as InstanceType<typeof ConversationRouter>;
        expect(router.getRequestMetadata()).toEqual({ inputKind: 'text', actorJid: key.participant });
        expect(router.snapshot()?.target).toBe(key.remoteJid);
    });

    const selectSpeech = (mode: 'voice' | 'both' | 'mirror') => {
        const config = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
        mocks.outputPolicy = { mode, tts: config, approvedDestinationKey: resolveTtsConfig(config).destinationKey, isCurrent: () => true };
        const artifact = { content: { audio: { url: '/fixture/private/speech.ogg' }, ptt: true, mimetype: 'audio/ogg; codecs=opus' },
            metadata: { type: 'audio', fileName: 'speech.ogg', mimetype: 'audio/ogg; codecs=opus', size: 42 },
            speech: { provider: 'openai-compatible', destination: 'speech.example.test' }, dispose: vi.fn().mockResolvedValue(undefined) };
        mocks.speechPrepare.mockResolvedValue(artifact); return artifact;
    };

    it.each(['voice', 'both', 'mirror'] as const)('refuses explicit owning-chat text in %s before effects and retains one automatic spoken final', async mode => {
        const { pi, ctx } = await setup(); selectSpeech(mode);
        if (mode === 'mirror') mocks.extractIncomingText.mockReturnValue({ kind: 'audio', text: 'Fixture audio' });
        await beginOwned(pi, ctx);
        const result = await pi.tools.get('send_wa_message').execute('wrong-path', { message: 'Wrong explicit answer' });
        expect(result.isError).toBe(true);
        expect(JSON.parse(result.content[0].text)).toMatchObject({ success: false, attempts: 0, error: expect.stringContaining('normal final answer') });
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
        expect(mocks.speechPrepare).not.toHaveBeenCalled(); expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled();
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Normal final answer'); await pi.handlers.get('turn_end')!({}, ctx);
        expect(mocks.speechPrepare).toHaveBeenCalledOnce(); expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(mode === 'both' ? 1 : 0);
    });
    it.each(['jid', 'recipient_jid'] as const)('does not permit a verified PN/LID %s alias or quote to bypass spoken protection', async field => {
        const { pi, ctx } = await setup(); selectSpeech('voice');
        const owner = '5511999998888@s.whatsapp.net'; const alias = '90000000001@lid';
        mocks.whatsappService.canonicalConversation.mockImplementation(jid => jid === alias ? owner : jid);
        await beginOwned(pi, ctx);
        const result = await pi.tools.get('send_wa_message').execute('alias-quote', { [field]: alias, message: 'Quoted text', quote: { messageId: 'fixture-quote' } });
        expect(result.isError).toBe(true); expect(JSON.parse(result.content[0].text).error).toContain('normal final answer');
        expect(mocks.whatsappService.getQuotedMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });
    it('rechecks the resolved outbound destination so a gateway cannot bypass spoken protection', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); await beginOwned(pi, ctx);
        mocks.whatsappService.resolveOutboundRecipientJid.mockReturnValue('5511999998888@s.whatsapp.net');
        const result = await pi.tools.get('send_wa_message').execute('gateway', { jid: '15550000003@s.whatsapp.net', message: 'Gateway text' });
        expect(result.isError).toBe(true); expect(JSON.parse(result.content[0].text).attempts).toBe(0);
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled();
    });
    it.each(['alias', 'transport', 'admission'])('fences a newly verified owning-chat %s during actual sender preflight', async change => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); await beginOwned(pi, ctx);
        const owner = '5511999998888@s.whatsapp.net'; const other = '15550000003@s.whatsapp.net';
        const { MessageSender } = await import('../../src/services/message.sender.ts');
        let entered!: () => void; let resume!: () => void;
        const paused = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { resume = resolve; });
        const sendMessage = vi.fn().mockResolvedValue({ key: { id: 'fixture-wire' }, message: { conversation: 'Wrong text' } });
        const socket = { sendMessage }; const context = mocks.whatsappService.getSessionContext();
        const service = { ...mocks.whatsappService, getSocket: () => socket, prepareArchive: async () => {},
            registerOutgoing: vi.fn(), cacheSentMessage: vi.fn(), recordSendOutcome: vi.fn(),
            flushArchive: async () => { entered(); await gate; } };
        const sender = new MessageSender(service as unknown as ConstructorParameters<typeof MessageSender>[0]);
        mocks.whatsappService.sendMessage.mockImplementationOnce(async (...args: unknown[]) => sender.send({
            recipientJid: change === 'transport' ? owner : other, text: String(args[1]), sessionContext: context,
            ...(args[3] as Pick<MessageRequest, 'signal' | 'isCurrent' | 'quote' | 'onSettled'> | undefined), options: { maxRetries: 1 }
        }));
        const pending = pi.tools.get('send_wa_message').execute('late-alias', { jid: other, message: 'Wrong text' });
        await paused;
        if (change === 'alias') mocks.whatsappService.canonicalConversation.mockImplementation(jid => jid === other ? owner : jid);
        if (change === 'admission') mocks.sessionManager.getReplyAdmissionKey.mockReturnValue('revoked-admission');
        resume();
        const result = await pending; expect(result.isError).toBe(true); expect(sendMessage).not.toHaveBeenCalled();
        const outcome = JSON.parse(result.content[0].text);
        expect(outcome).toMatchObject({ success: false, attempts: 1, error: 'The WhatsApp account or session changed before transmission. Send a fresh request if still needed.' });
        expect(outcome.delivery).toBeUndefined(); expect(service.registerOutgoing).toHaveBeenCalledOnce();
        expect(service.recordSendOutcome).toHaveBeenCalledWith(change === 'transport' ? owner : other, expect.any(String), expect.objectContaining({ success: false, attempts: 1 }));
        expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled(); await finalTurn(pi, ctx, 'Normal final');
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledTimes(change === 'admission' ? 0 : 1);
    });
    it('keeps other-chat sends available without covering the owning spoken final', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); await beginOwned(pi, ctx);
        const result = await pi.tools.get('send_wa_message').execute('other', { jid: '15550000003@s.whatsapp.net', message: 'Other chat' });
        expect(result.isError).toBe(false); await finalTurn(pi, ctx, 'Normal final answer');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce(); expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
    });
    it('keeps non-audio Mirror and terminal/idle explicit text available', async () => {
        const { pi, ctx } = await setup(); selectSpeech('mirror'); await beginOwned(pi, ctx);
        expect((await pi.tools.get('send_wa_message').execute('text-mirror', { message: 'Explicit text' })).isError).toBe(false);
        await pi.handlers.get('agent_end')!({ messages: [] }, ctx); selectSpeech('voice');
        expect((await pi.tools.get('send_wa_message').execute('idle', { message: 'Manual idle text' })).isError).toBe(false);
        await pi.handlers.get('agent_start')!({}, ctx);
        await pi.handlers.get('input')!({ source: 'interactive', text: 'Local task' }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content: 'Local task' } }, ctx);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        expect((await pi.tools.get('send_wa_message').execute('local', { jid: '5511999998888@s.whatsapp.net', message: 'Manual local text' })).isError).toBe(false);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(3); expect(mocks.speechPrepare).not.toHaveBeenCalled();
    });
    it.each([false, true])('keeps explicit text when real speech preferences are disabled or unapproved (enabled=%s)', async enabled => {
        const { pi, ctx } = await setup(); mocks.outputPolicy = undefined;
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config: {}, enabled, mode: 'voice', chats: {} });
        await beginOwned(pi, ctx);
        expect((await pi.tools.get('send_wa_message').execute('no-consent', { message: 'Text only' })).isError).toBe(false);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce(); expect(mocks.speechPrepare).not.toHaveBeenCalled();
    });
    it('does not let a revoked captured spoken policy open an explicit-text escape', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); let current = true;
        mocks.outputPolicy.isCurrent = () => current; await beginOwned(pi, ctx); current = false;
        const result = await pi.tools.get('send_wa_message').execute('revoked', { message: 'No alternate delivery' });
        expect(result.isError).toBe(true); await finalTurn(pi, ctx, 'Cancelled final');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it('wires an approved final voice through the actual coordinator into sendContent', async () => {
        const { pi, ctx } = await setup(); const artifact = selectSpeech('voice');
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Final answer');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
        expect(mocks.whatsappService.sendContent.mock.calls[0][0]).toMatchObject({ recipientJid: '5511999998888@s.whatsapp.net', content: { ptt: true }, options: { maxRetries: 1, brand: false } });
        expect(artifact.dispose).toHaveBeenCalledOnce();
        expect(mocks.recentsService.recordMessage).toHaveBeenCalledWith(expect.objectContaining({ text: '[Voice reply]' }));
        await pi.handlers.get('turn_end')!({}, ctx); expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
    });
    it('wires both mode and keeps accepted text when speech preparation fails', async () => {
        const { pi, ctx } = await setup(); selectSpeech('both'); mocks.speechPrepare.mockRejectedValueOnce(new Error('fixture private diagnostic'));
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Full readable answer');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
        expect(ctx.ui.notify).toHaveBeenCalledWith('Voice unavailable; the reply is text-only.', 'warning');
    });
    it.each(['text', 'audio'])('mirror finalization uses actual %s metadata', async kind => {
        const { pi, ctx } = await setup(); selectSpeech('mirror'); mocks.extractIncomingText.mockReturnValue({ kind, text: 'Fixture' } as any);
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Final answer');
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledTimes(kind === 'audio' ? 1 : 0);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(kind === 'audio' ? 0 : 1);
    });
    it('reports uncertain voice delivery without deleting a file still owned by transport or sending text', async () => {
        const { pi, ctx } = await setup(); const artifact = selectSpeech('voice'); let request!: MessageRequest;
        mocks.whatsappService.sendContent.mockImplementationOnce(async value => { request = value; return { success: false, delivery: 'unknown', attempts: 1 } as any; });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Final answer');
        expect(ctx.ui.notify).toHaveBeenCalledWith('WhatsApp reply delivery is uncertain. Do not resend automatically.', 'warning');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(artifact.dispose).not.toHaveBeenCalled();
        await request.onSettled?.({ success: true, messageId: 'LATE', attempts: 1 }); expect(artifact.dispose).toHaveBeenCalledOnce();
    });
    it('still stops WhatsApp when managed speech retirement fails during shutdown', async () => {
        const { pi, ctx } = await setup(); const { ManagedSpeechService } = await import('../../src/services/managed-speech.service.ts');
        const disconnect = vi.spyOn(ManagedSpeechService.prototype, 'disconnect').mockRejectedValueOnce(new Error('Synthetic retirement failure'));
        try { await expect(pi.handlers.get('session_shutdown')!({}, ctx)).rejects.toThrow('Synthetic retirement failure'); expect(mocks.whatsappService.stop).toHaveBeenCalledOnce(); }
        finally { disconnect.mockRestore(); }
    });
    it('does not reopen managed startup when a pending session_start resumes after shutdown', async () => {
        const { pi, ctx } = await setup(); const { ManagedSpeechService } = await import('../../src/services/managed-speech.service.ts');
        const begun = Promise.withResolvers<void>(); const resume = Promise.withResolvers<void>();
        mocks.sessionManager.ensureInitialized.mockImplementationOnce(async () => { begun.resolve(); await resume.promise; });
        const update = vi.spyOn(ManagedSpeechService.prototype, 'update'); const pending = pi.handlers.get('session_start')!({}, ctx);
        try {
            await begun.promise; await pi.handlers.get('session_shutdown')!({}, ctx); resume.resolve(); await pending;
            mocks.sessionManager.setSpeechConfigCallback.mock.calls[0][0](); expect(update.mock.calls.at(-1)?.[0].connected).toBe(false);
        } finally { resume.resolve(); await pending; update.mockRestore(); }
    });
    it('does not admit a new managed server from a settings commit in a closing runtime', async () => {
        const { pi, ctx } = await setup(); const { ManagedSpeechService } = await import('../../src/services/managed-speech.service.ts'); const gate = Promise.withResolvers<void>();
        const disconnect = vi.spyOn(ManagedSpeechService.prototype, 'disconnect').mockReturnValueOnce(gate.promise);
        const update = vi.spyOn(ManagedSpeechService.prototype, 'update'); const pending = pi.handlers.get('session_shutdown')!({}, ctx);
        try {
            mocks.sessionManager.setSpeechConfigCallback.mock.calls[0][0](); expect(update.mock.calls.at(-1)?.[0].connected).toBe(false);
        } finally { gate.resolve(); await pending; disconnect.mockRestore(); update.mockRestore(); }
    });
    it.each(['session_before_switch', 'session_shutdown'])('cancels speech and suppresses stale fallback on %s', async eventName => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); let began!: () => void;
        const started = new Promise<void>(resolve => { began = resolve; });
        mocks.speechPrepare.mockImplementationOnce((_text, _config, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true }); began();
        }));
        await beginOwned(pi, ctx); const pending = finalTurn(pi, ctx, 'Final answer'); await started;
        await pi.handlers.get(eventName)!({}, ctx); await pending;
        expect(mocks.speechClose).toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it('terminal Off cancels speech, retains local tools and refuses stale output after re-enable', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); let begin!: () => void;
        const started = new Promise<void>(resolve => { begin = resolve; });
        mocks.speechPrepare.mockImplementationOnce((_text, _config, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true }); begin();
        }));
        try {
            await beginOwned(pi, ctx); const pending = finalTurn(pi, ctx, 'Private speech'); await started;
            await mocks.settingsMenus.off(ctx); await pending;
            expect(ctx.abort).toHaveBeenCalledOnce(); expect(mocks.whatsappService.stop).toHaveBeenCalledOnce(); expect(mocks.speechClose).toHaveBeenCalledOnce();
            expect(pi.getActiveTools()).toEqual(['read', 'list_wa_conversations', 'request_wa_history']);
            const status = vi.fn(async () => ({ success: true, requests: [] })); Object.assign(mocks.whatsappService, { getHistoryStatus: status });
            expect((await pi.tools.get('request_wa_history').execute('status', { mode: 'status' })).isError).toBe(false);
            await expect(pi.tools.get('request_wa_history').execute('request', { mode: 'request', jid: '5511999998888@s.whatsapp.net' })).rejects.toThrow('WhatsApp is off');
            await expect(pi.tools.get('send_wa_message').execute('send', { message: 'No send' })).rejects.toThrow('WhatsApp is off');
            pi.getFlag.mockImplementation(name => name === 'whatsapp-ng-online'); mocks.sessionManager.isRegistered.mockResolvedValue(true);
            await pi.handlers.get('session_start')!({}, ctx); expect(mocks.whatsappService.start).not.toHaveBeenCalled();
            mocks.settingsMenus.connect(); await finalTurn(pi, ctx, 'Late previous answer');
            expect(pi.getActiveTools()).toEqual(expect.arrayContaining(['read', 'send_wa_message', 'send_reaction']));
            expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
        } finally { mocks.settingsMenus.connect(); }
    });
    it('repeated Off preserves new terminal work and leaves the retired routing scope unchanged', async () => {
        const { ctx } = await setup(); const terminal = createMockContext();
        try {
            await mocks.settingsMenus.off(ctx); const afterOff = mocks.settingsMenus.captureCurrent();
            await mocks.settingsMenus.off(terminal);
            expect(ctx.abort).toHaveBeenCalledOnce(); expect(terminal.abort).not.toHaveBeenCalled();
            expect(mocks.whatsappService.stop).toHaveBeenCalledOnce(); expect(afterOff()).toBe(true);
            mocks.settingsMenus.connect(); await mocks.settingsMenus.off(terminal);
            expect(terminal.abort).toHaveBeenCalledOnce(); expect(mocks.whatsappService.stop).toHaveBeenCalledTimes(2);
        } finally { mocks.settingsMenus.connect(); }
    });
    it('still performs the first deliberate Off when transport is temporarily disconnected', async () => {
        const { ctx } = await setup(); mocks.whatsappService.getStatus.mockReturnValue('disconnected');
        try { await mocks.settingsMenus.off(ctx); expect(ctx.abort).toHaveBeenCalledOnce(); expect(mocks.whatsappService.stop).toHaveBeenCalledOnce(); }
        finally { mocks.settingsMenus.connect(); }
    });
    it('does not repeat abort or transport shutdown while the first Off is awaiting settlement', async () => {
        const { ctx } = await setup(); const terminal = createMockContext(); let release!: () => void;
        mocks.whatsappService.stop.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
        const first = mocks.settingsMenus.off(ctx);
        try {
            const repeated = mocks.settingsMenus.off(terminal); release(); await Promise.all([first, repeated]);
            expect(ctx.abort).toHaveBeenCalledOnce(); expect(terminal.abort).not.toHaveBeenCalled(); expect(mocks.whatsappService.stop).toHaveBeenCalledOnce();
        } finally { release(); await first; mocks.settingsMenus.connect(); }
    });
    it.each([false, true])('cancels startup retry before explicit Connect (Off first: %s)', async off => {
        const { pi, ctx } = await setup(); vi.useFakeTimers();
        try {
            pi.getFlag.mockImplementation(name => name === 'whatsapp-ng-online'); mocks.sessionManager.isRegistered.mockResolvedValue(true);
            mocks.whatsappService.start.mockRejectedValueOnce(new Error('Synthetic startup failure'));
            await pi.handlers.get('session_start')!({}, ctx);
            if (off) await mocks.settingsMenus.off(ctx);
            mocks.settingsMenus.connect(); await mocks.whatsappService.start();
            await vi.advanceTimersByTimeAsync(3500); expect(mocks.whatsappService.start).toHaveBeenCalledTimes(2);
        } finally { mocks.settingsMenus.connect(); vi.useRealTimers(); }
    });
    it('wires Pi Escape/RPC abort into synthesis while turn_end is still awaiting it', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); const parent = new AbortController(); ctx.signal = parent.signal;
        let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
        mocks.speechPrepare.mockImplementationOnce((_text, _config, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true }); began();
        }));
        await beginOwned(pi, ctx); const pending = finalTurn(pi, ctx, 'Answer'); await started; parent.abort();
        expect(mocks.speechPrepare.mock.calls[0][2].signal.aborted).toBe(true); await pending;
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it('does not construct any speech backend for existing text-only configurations', async () => {
        const { pi, ctx } = await setup(); await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Text reply');
        expect(mocks.speechConstruct).not.toHaveBeenCalled(); expect(mocks.speechPrepare).not.toHaveBeenCalled();
    });

    it('does not discard a captured text-only answer when voice settings are edited', async () => {
        const { pi, ctx } = await setup(); mocks.outputPolicy = undefined;
        await beginOwned(pi, ctx); mocks.sessionManager.getSpeechRevision.mockReturnValue(1);
        await finalTurn(pi, ctx, 'The complete text answer');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce(); expect(mocks.speechPrepare).not.toHaveBeenCalled();
    });
    it('uses persisted consent/preferences through the real A5 policy provider', async () => {
        const { pi, ctx } = await setup(); const artifact = selectSpeech('voice'); const config = { ...mocks.outputPolicy.tts };
        mocks.outputPolicy = undefined;
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config, enabled: true, mode: 'voice', chats: {}, approvedDestinationKey: resolveTtsConfig(config).destinationKey });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Actual policy answer');
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(artifact.dispose).toHaveBeenCalledOnce();
    });
    it('new remote settings without approval remain text-only through the actual policy', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); const config = { ...mocks.outputPolicy.tts }; mocks.outputPolicy = undefined;
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config, enabled: true, mode: 'voice', chats: {} });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Readable answer');
        expect(mocks.speechPrepare).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });
    it('rechecks the saved settings revision after synthesis without forwarding stale audio or fallback', async () => {
        const { pi, ctx } = await setup(); const artifact = selectSpeech('voice'); const config = { ...mocks.outputPolicy.tts }; mocks.outputPolicy = undefined;
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config, enabled: true, mode: 'voice', chats: {}, approvedDestinationKey: resolveTtsConfig(config).destinationKey });
        mocks.speechPrepare.mockImplementationOnce(async () => { mocks.sessionManager.getSpeechRevision.mockReturnValue(1); return artifact; });
        await beginOwned(pi, ctx); await finalTurn(pi, ctx, 'Old settings answer');
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(artifact.dispose).toHaveBeenCalledOnce();
    });
    it('does not download/transcribe or submit a newly paused chat message', async () => {
        const { pi } = await setup(); mocks.outputPolicy = undefined;
        mocks.sessionManager.getSpeechSettings.mockReturnValue({ config: {}, enabled: false, mode: 'text', chats: { '5511999998888@s.whatsapp.net': { automaticReplies: false } } });
        mocks.extractIncomingText.mockReturnValue({ kind: 'audio', text: '', audioMessage: {} } as any);
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0](incoming());
        expect(mocks.incomingMediaService.process).not.toHaveBeenCalled(); expect(pi.sendUserMessage).not.toHaveBeenCalled();
        expect(mocks.whatsappService.markIncomingProcessing).toHaveBeenCalledWith(expect.anything(), 'consumed');
    });
    it('cannot auto-reply to an already queued pre-pause request after re-enable', async () => {
        const { pi, ctx } = await setup(); mocks.outputPolicy = undefined;
        await pi.handlers.get('agent_start')!({}, ctx);
        await mocks.whatsappService.setMessageCallback.mock.calls[0][0](incoming());
        const content = pi.sendUserMessage.mock.calls[0][0] as string;
        mocks.sessionManager.getReplyAdmissionKey.mockReturnValue('after-pause-and-enable');
        await pi.handlers.get('input')!({ source: 'extension', text: content }, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content } }, ctx);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Must not replay');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    const previewMenu = (ctx: ReturnType<typeof createMockContext>) => {
        ctx.ui.select.mockResolvedValueOnce('Fixed-phrase preview (review & send)')
            .mockImplementationOnce(async (_title, options) => options.find((option: string) => option.includes('5511999998888@s.whatsapp.net')));
        ctx.ui.confirm.mockResolvedValueOnce(true);
    };
    it('sends a confirmed fixed phrase to the selected allowed chat, not lastRemoteJid, without enabling speech', async () => {
        const { ctx } = await setup(); const artifact = selectSpeech('voice'); mocks.whatsappService.getLastRemoteJid.mockReturnValue('15550000099@s.whatsapp.net');
        previewMenu(ctx); await mocks.settingsMenus.voice(ctx);
        expect(mocks.speechPrepare.mock.calls[0][0]).toBe('This is an automated voice preview. Esta es una prueba de voz automatizada.');
        expect(mocks.speechPrepare.mock.calls[0][1]).toEqual({});
        expect(mocks.whatsappService.sendContent.mock.calls[0][0]).toMatchObject({ recipientJid: '5511999998888@s.whatsapp.net', content: { ptt: true }, options: { brand: false, maxRetries: 1 }, isCurrent: expect.any(Function) });
        expect(mocks.sessionManager.setSpeechSettings).not.toHaveBeenCalled(); expect(artifact.dispose).toHaveBeenCalledOnce();
    });
    it('rejects a preview during an active native run even if the UI reports idle', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); await beginOwned(pi, ctx); previewMenu(ctx);
        await mocks.settingsMenus.voice(ctx); expect(mocks.speechPrepare).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled();
    });
    it('sends only the reviewed AI introduction through the normal selected-chat sender', async () => {
        const { ctx } = await setup();
        ctx.ui.select.mockResolvedValueOnce('Chats: modes, automatic replies and introduction')
            .mockImplementationOnce(async (_title, options) => options.find((option: string) => option.includes('5511999998888@s.whatsapp.net')))
            .mockResolvedValueOnce('Introduce the AI assistant (review & send)'); ctx.ui.confirm.mockResolvedValueOnce(true);
        await mocks.settingsMenus.voice(ctx);
        expect(mocks.whatsappService.sendContent.mock.calls[0][0]).toMatchObject({ recipientJid: '5511999998888@s.whatsapp.net', text: 'This chat is connected to an AI assistant, not the human account owner. Replies may be automated.', options: { brand: false, maxRetries: 1 }, isCurrent: expect.any(Function) });
        expect(mocks.speechPrepare).not.toHaveBeenCalled(); expect(mocks.sessionManager.setSpeechSettings).not.toHaveBeenCalled();
    });
    it('never sends a prepared preview if its settings revision changes during synthesis', async () => {
        const { ctx } = await setup(); const artifact = selectSpeech('voice'); previewMenu(ctx);
        mocks.speechPrepare.mockImplementationOnce(async () => { mocks.sessionManager.getSpeechRevision.mockReturnValue(1); return artifact; });
        await mocks.settingsMenus.voice(ctx); expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(artifact.dispose).toHaveBeenCalledOnce();
    });
    it('retains an uncertain preview until actual settlement and does not invent a text fallback', async () => {
        const { ctx } = await setup(); const artifact = selectSpeech('voice'); previewMenu(ctx); let request!: MessageRequest;
        mocks.whatsappService.sendContent.mockImplementationOnce(async value => { request = value; return { success: false, delivery: 'unknown', attempts: 1 } as any; });
        await mocks.settingsMenus.voice(ctx); expect(artifact.dispose).not.toHaveBeenCalled(); expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        await request.onSettled?.({ success: true, attempts: 1, messageId: 'late-preview' }); expect(artifact.dispose).toHaveBeenCalledOnce();
        expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
    });
    it('cancels a terminal preview on session replacement while turn-independent synthesis is pending', async () => {
        const { pi, ctx } = await setup(); selectSpeech('voice'); previewMenu(ctx); let begin!: () => void;
        const started = new Promise<void>(resolve => { begin = resolve; });
        mocks.speechPrepare.mockImplementationOnce((_text, _config, options) => new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true }); begin(); }));
        const pending = mocks.settingsMenus.voice(ctx); await started; await pi.handlers.get('session_before_switch')!({}, ctx); await pending;
        expect(mocks.whatsappService.sendContent).not.toHaveBeenCalled(); expect(mocks.speechClose).toHaveBeenCalled();
    });

    it('buffers message_end and sends only at the completed owned turn', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        const event = makeAssistantEvent('Hello back!');
        await pi.handlers.get('message_end')!(event, ctx);
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        await pi.handlers.get('turn_end')!({ ...event, toolResults: [] }, ctx);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Hello back!', true, expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(mocks.recentsService.recordMessage).toHaveBeenCalledWith(expect.objectContaining({
            messageId: 'MSG123', senderNumber: '+5511999998888', text: 'Hello back!', direction: 'outgoing'
        }));
        expect(ctx.ui.notify).toHaveBeenCalledWith('Sent reply to WhatsApp contact', 'info');
    });

    it.each((['voice', 'both', 'mirror'] as const).flatMap(mode => [
        { mode, explain: false, outcome: 'accepted', allowed: true },
        { mode, explain: false, outcome: 'unknown', allowed: true },
        { mode, explain: false, outcome: 'failed', allowed: false },
        { mode, explain: true, outcome: 'accepted', allowed: false },
        { mode, explain: true, outcome: 'unknown', allowed: false }
    ]))('preserves explicit explanation after $outcome attachment in $mode (final explanation=$explain)', async ({ mode, explain, outcome, allowed }) => {
        const root = await mkdtemp(join(tmpdir(), 'wa-spoken-legacy-'));
        try {
            const file = join(root, 'fixture.md'); await writeFile(file, 'Synthetic attachment.');
            const { pi, ctx } = await setup(); selectSpeech(mode); mocks.sessionManager.getFinalAfterAttachments.mockReturnValue(explain);
            if (mode === 'mirror') mocks.extractIncomingText.mockReturnValue({ kind: 'audio', text: 'Fixture audio' });
            await beginOwned(pi, ctx);
            if (outcome !== 'accepted') mocks.whatsappService.sendContent.mockImplementationOnce(async request => {
                const result = { success: false, attempts: outcome === 'unknown' ? 1 : 0, ...(outcome === 'unknown' ? { delivery: 'unknown' as const } : {}) };
                await request.onSettled?.(result); return result as Awaited<ReturnType<typeof mocks.whatsappService.sendContent>>;
            });
            await pi.tools.get('send_wa_media').execute('attachment', { path: file, type: 'document' }, new AbortController().signal, undefined, { ...ctx, cwd: root });
            await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
            const result = await pi.tools.get('send_wa_message').execute('explanation', { message: 'Explicit explanation' });
            expect(result.isError).toBe(!allowed);
            expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(allowed ? 1 : 0);
            await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx); await finalTurn(pi, ctx, 'Normal explanation');
            if (allowed) {
                expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce(); expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
                expect(mocks.speechPrepare).not.toHaveBeenCalled();
            } else expect(mocks.speechPrepare).toHaveBeenCalledOnce();
        } finally { await rm(root, { recursive: true, force: true }); }
    });
    it('preserves legacy explicit explanation while the attachment is still in flight', async () => {
        const root = await mkdtemp(join(tmpdir(), 'wa-spoken-pending-'));
        try {
            const file = join(root, 'fixture.md'); await writeFile(file, 'Synthetic pending attachment.');
            const { pi, ctx } = await setup(); selectSpeech('voice'); mocks.sessionManager.getFinalAfterAttachments.mockReturnValue(false);
            await beginOwned(pi, ctx); let started!: () => void; let finish!: () => void;
            const entered = new Promise<void>(resolve => { started = resolve; }); const gate = new Promise<void>(resolve => { finish = resolve; });
            mocks.whatsappService.sendContent.mockImplementationOnce(async request => {
                started(); await gate; const result = { success: true, messageId: 'ATTACHMENT', attempts: 1 }; await request.onSettled?.(result); return result;
            });
            const pending = pi.tools.get('send_wa_media').execute('attachment', { path: file, type: 'document' }, new AbortController().signal, undefined, { ...ctx, cwd: root });
            await entered;
            try {
                const result = await pi.tools.get('send_wa_message').execute('explanation', { message: 'Explicit explanation' });
                expect(result.isError).toBe(false);
            } finally { finish(); await pending; }
            await finalTurn(pi, ctx, 'Redundant final'); expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
            expect(mocks.speechPrepare).not.toHaveBeenCalled();
        } finally { await rm(root, { recursive: true, force: true }); }
    });
    it.each([true, false])('applies final-after-attachment preference %s without replaying the final', async explain => {
        const root = await mkdtemp(join(tmpdir(), 'wa-a1-media-'));
        try {
            const file = join(root, 'fixture.md');
            await writeFile(file, 'Generated A1 fixture.');
            const { pi, ctx } = await setup();
            mocks.sessionManager.getFinalAfterAttachments.mockReturnValue(explain);
            await beginOwned(pi, ctx);
            const result = await pi.tools.get('send_wa_media').execute('attachment', { path: file, type: 'document' }, new AbortController().signal, undefined, { ...ctx, cwd: root });
            expect(result.isError).toBe(false);
            await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
            await finalTurn(pi, ctx, 'Here is what the file contains.');
            await pi.handlers.get('turn_end')!({}, ctx);
            expect(mocks.whatsappService.sendContent).toHaveBeenCalledOnce();
            if (explain) expect(mocks.whatsappService.sendMessage).toHaveBeenCalledExactlyOnceWith('5511999998888@s.whatsapp.net', 'Here is what the file contains.', true, expect.objectContaining({ signal: expect.any(AbortSignal) }));
            else expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('claims a final response before asynchronous transmission settles', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        let finish!: (result: { success: boolean; messageId: string; attempts: number }) => void;
        mocks.whatsappService.sendMessage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await pi.handlers.get('message_end')!(makeAssistantEvent('One final'), ctx);
        const pending = pi.handlers.get('turn_end')!({}, ctx);
        await pi.handlers.get('turn_end')!({}, ctx);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
        finish({ success: true, messageId: 'FINAL', attempts: 1 });
        await pending;
        await pi.handlers.get('turn_end')!({}, ctx);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });

    it('does not retry an unknown automatic final delivery on a repeated callback', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        mocks.whatsappService.sendMessage.mockResolvedValueOnce({ success: false, delivery: 'unknown', attempts: 1 } as any);
        await finalTurn(pi, ctx, 'Uncertain final');
        await pi.handlers.get('turn_end')!({}, ctx);
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
        expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled();
    });

    it('supplies policy-aware prompt guidance without making it routing authority', async () => {
        const { pi, ctx } = await setup();
        const event = { systemPromptOptions: { sections: { existing: 'Preserve me' } } };
        await pi.handlers.get('before_agent_start')!(event, ctx);
        const sections = event.systemPromptOptions.sections as Record<string, string>;
        expect(sections.existing).toBe('Preserve me');
        expect(sections.whatsapp_reply_delivery).toContain('Speaking directly'.toLowerCase());
        expect(sections.whatsapp_reply_delivery).toContain('does not replace the final explanation');
        mocks.sessionManager.getFinalAfterAttachments.mockReturnValue(false);
        await pi.handlers.get('before_agent_start')!(event, ctx);
        expect(sections.whatsapp_reply_delivery).toContain('Legacy caption/tool-only mode');
        mocks.whatsappService.getStatus.mockReturnValue('disconnected');
        await pi.handlers.get('before_agent_start')!(event, ctx);
        expect(sections.whatsapp_reply_delivery).toBeUndefined();
        expect(sections.existing).toBe('Preserve me');
    });

    it('never mirrors terminal-only turns to an old WhatsApp destination', async () => {
        const { pi, ctx } = await setup();
        await pi.handlers.get('agent_start')!({}, ctx);
        await pi.handlers.get('message_start')!({ message: { role: 'user', content: [{ type: 'text', text: 'terminal' }] } }, ctx);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Local answer');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('skips delivery while disconnected', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        mocks.sessionManager.getStatus.mockReturnValue('disconnected');
        await finalTurn(pi, ctx, 'Hello');
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('records failure instead of success if an owned send fails or throws', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        mocks.whatsappService.sendMessage.mockResolvedValueOnce({ success: false, error: 'timeout', attempts: 1 });
        await finalTurn(pi, ctx, 'Failed');
        expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled();
        expect(ctx.ui.notify).toHaveBeenCalledWith('Failed to send WhatsApp reply', 'error');
        mocks.whatsappService.sendMessage.mockRejectedValueOnce(new Error('network'));
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Throws');
        expect(mocks.recentsService.recordMessage).not.toHaveBeenCalled();
    });

    it('does not mirror text-plus-tool commentary before or after the tool sends', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        const event = { message: { role: 'assistant', stopReason: 'toolUse', content: [
            { type: 'text', text: 'Sending now' }, { type: 'toolCall', id: 'call', name: 'send_wa_message', arguments: {} }
        ] } };
        await pi.handlers.get('message_end')!(event, ctx);
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
        await pi.tools.get('send_wa_message').execute('call', { message: 'Tool message' });
        await pi.handlers.get('turn_end')!({ ...event, toolResults: [] }, ctx);
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Redundant confirmation');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });

    it('a tool send to another chat does not suppress the rightful owned final reply', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        await pi.tools.get('send_wa_message').execute('call', { jid: '15550000003@s.whatsapp.net', message: 'Other chat' });
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Answer to A');
        expect(mocks.whatsappService.sendMessage).toHaveBeenNthCalledWith(2, '5511999998888@s.whatsapp.net', 'Answer to A', true, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('B arriving during A cannot redirect a default tool or reset A suppression', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        await callback(incoming('B', '15550000002@s.whatsapp.net'));
        mocks.whatsappService.getLastRemoteJid.mockReturnValue('15550000002@s.whatsapp.net');
        await pi.tools.get('send_wa_message').execute('call', { message: 'Still A' });
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledWith('5511999998888@s.whatsapp.net', 'Still A', true);
        await finalTurn(pi, ctx, 'Duplicate');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledOnce();
    });

    it('combined A/B consumption sends only one fixed notice to each verified chat, not model content', async () => {
        const { pi, ctx } = await setup();
        await pi.handlers.get('agent_start')!({}, ctx);
        await submit(pi, ctx, 'A');
        await submit(pi, ctx, 'B', '15550000002@s.whatsapp.net');
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Combined');
        const result = await pi.tools.get('send_wa_message').execute('call', { message: 'No guess' });
        expect(result.isError).toBe(true);
        expect(mocks.whatsappService.sendMessage.mock.calls.map(call => call[0])).toEqual(['5511999998888@s.whatsapp.net', '15550000002@s.whatsapp.net']);
        expect(mocks.whatsappService.sendMessage.mock.calls.every(call => call[1] === "I couldn't safely assign the reply to one conversation. Please resend your request in a fresh message.")).toBe(true);
        await finalTurn(pi, ctx, 'Still combined');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('preserves original consumed transports for retry notices despite outbound overrides', async () => {
        const { pi, ctx } = await setup();
        const delivered: string[] = [];
        mocks.whatsappService.resolveOutboundRecipientJid.mockReturnValue('15550000099@s.whatsapp.net');
        mocks.whatsappService.sendMessage.mockImplementation(async (jid: string, _text: string, preserveTransport = false) => {
            delivered.push(preserveTransport ? jid : mocks.whatsappService.resolveOutboundRecipientJid(jid));
            return { success: true, messageId: 'NOTICE', attempts: 1 };
        });
        await pi.handlers.get('agent_start')!({}, ctx);
        await submit(pi, ctx, 'A');
        await submit(pi, ctx, 'B', '15550000002@s.whatsapp.net');
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'Never forward this ambiguous answer');
        expect(delivered).toEqual(['5511999998888@s.whatsapp.net', '15550000002@s.whatsapp.net']);
        expect(mocks.whatsappService.resolveOutboundRecipientJid).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendMessage.mock.calls.every(call => call[2] === true)).toBe(true);
    });

    it('does not inject slow media preparation after a session reset', async () => {
        const { pi, ctx } = await setup();
        let finish!: (value: { text: string }) => void;
        let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
        mocks.incomingMediaService.process.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; entered(); }));
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const processing = callback(incoming('slow'));
        await started;
        await pi.handlers.get('session_before_switch')!({}, ctx);
        finish({ text: 'Late media' });
        await processing;
        expect(pi.sendUserMessage).not.toHaveBeenCalled();
    });

    it.each(['Late media', '/abort', '/compact'])('does not inject or execute %s after its account changes during preparation', async text => {
        const { pi, ctx } = await setup();
        let finish!: (value: { text: string }) => void;
        let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        mocks.incomingMediaService.process.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; entered(); }));
        mocks.whatsappService.isSessionContextCurrent.mockImplementation(context => context?.accountScope === mocks.whatsappService.getAccountScope());
        const callback = mocks.whatsappService.setMessageCallback.mock.calls[0][0];
        const processing = callback(incoming('old-account'));
        await started;
        mocks.whatsappService.getAccountScope.mockReturnValue('new-account');
        finish({ text });
        await processing;
        expect(pi.sendUserMessage).not.toHaveBeenCalled();
        expect(ctx.abort).not.toHaveBeenCalled();
        expect(ctx.compact).not.toHaveBeenCalled();
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('does not revive an owned turn after returning to the same account in a newer generation', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        mocks.whatsappService.getSessionContext.mockReturnValue({ accountScope: 'fixture-account', generation: 3 });
        await finalTurn(pi, ctx, 'Old generation');
        const result = await pi.tools.get('send_wa_message').execute('stale-call', { jid: '15550000003@s.whatsapp.net', message: 'Stale explicit send' });
        expect(result.isError).toBe(true);
        expect(mocks.whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('reset clears ownership and a new request gets independent suppression', async () => {
        const { pi, ctx } = await setup();
        await beginOwned(pi, ctx);
        await pi.tools.get('send_wa_message').execute('first', { message: 'First' });
        await pi.handlers.get('agent_end')!({ messages: [makeAssistantEvent('done').message] }, ctx);
        await pi.handlers.get('agent_start')!({}, ctx);
        await submit(pi, ctx, 'new-request');
        await pi.handlers.get('message_start')!(makeAssistantEvent(''), ctx);
        await finalTurn(pi, ctx, 'New reply');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(2);
        await pi.handlers.get('session_before_switch')!({}, ctx);
        await finalTurn(pi, ctx, 'Stale');
        expect(mocks.whatsappService.sendMessage).toHaveBeenCalledTimes(2);
    });
});
