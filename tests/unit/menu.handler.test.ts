import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuHandler } from '../../src/ui/menu.handler.ts';
import { resetI18n } from '../../src/i18n.ts';
import { showMessageDetailView } from '../../src/ui/message-detail.view.ts';
import { showMessageReplyView } from '../../src/ui/message-reply.view.ts';

vi.mock('qrcode-terminal', () => ({
    generate: vi.fn()
}));

vi.mock('../../src/ui/message-detail.view.ts', () => ({
    showMessageDetailView: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/ui/message-reply.view.ts', () => ({
    showMessageReplyView: vi.fn().mockResolvedValue(undefined)
}));

type SelectChoice = string | ((title: string, options: string[]) => string);

const createContext = (choices: {
    selects?: SelectChoice[];
    inputs?: string[];
    confirms?: boolean[];
} = {}) => {
    const selects = [...(choices.selects ?? [])];
    const inputs = [...(choices.inputs ?? [])];
    const confirms = [...(choices.confirms ?? [])];

    return {
        ui: {
            select: vi.fn(async (title: string, options: string[]) => {
                const choice = selects.shift();
                if (typeof choice === 'function') {
                    return choice(title, options);
                }
                if (choice && title.startsWith('WhatsApp — ') && !options.includes(choice)) {
                    const category: Record<string, string> = { 'Connect WhatsApp': 'Connection', 'Disconnect WhatsApp': 'Connection',
                        Recents: 'Chats / Owner', 'Allowed Contacts': 'Chats / Owner', Owner: 'Chats / Owner',
                        'Reply delivery': 'Replies', 'Optional outputs': 'Replies', 'Allowed Groups': 'Groups', 'Group replies': 'Groups',
                        'Local history scope': 'Advanced', 'Logoff (Delete Session)': 'Advanced' };
                    if (category[choice]) { selects.unshift(choice); return category[choice]; }
                }
                return choice ?? 'Back';
            }),
            input: vi.fn(async () => inputs.shift() ?? ''),
            confirm: vi.fn(async () => confirms.shift() ?? false),
            notify: vi.fn()
        }
    };
};

const createServices = () => {
    const whatsappService = {
        getEffectiveStatus: vi.fn().mockReturnValue('connected'),
        getQuotedMessage: vi.fn().mockReturnValue({ key: { id: 'MSG1', remoteJid: '5511999998888@s.whatsapp.net', fromMe: false }, message: { conversation: 'retained' } }),
        setQRCodeCallback: vi.fn(),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        sendMenuMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'MSG123' })
    };

    const sessionManager = {
        getStatus: vi.fn().mockReturnValue('connected'),
        getFinalAfterAttachments: vi.fn().mockReturnValue(true),
        getAutoConnect: vi.fn().mockReturnValue(false), getAutoConnectRevision: vi.fn().mockReturnValue(7), setAutoConnect: vi.fn().mockResolvedValue(undefined),
        getReplyStats: vi.fn().mockReturnValue(false), getReplyStatsRevision: vi.fn().mockReturnValue(0), setReplyStats: vi.fn().mockResolvedValue(undefined),
        getReplyReporting: vi.fn().mockReturnValue({ changedFiles: false, interimText: false, liveActivity: false }), getReplyReportingRevision: vi.fn().mockReturnValue(0), setReplyReporting: vi.fn().mockResolvedValue(undefined),
        setFinalAfterAttachments: vi.fn().mockResolvedValue(undefined),
        getGroupReplies: vi.fn().mockReturnValue({ mode: 'mentions-or-replies', context: false }), getGroupRepliesRevision: vi.fn().mockReturnValue(0), setGroupReplies: vi.fn().mockResolvedValue(undefined),
        isRegistered: vi.fn().mockResolvedValue(false),
        getAllowList: vi.fn().mockReturnValue([]),
        addNumber: vi.fn().mockResolvedValue(undefined),
        removeNumber: vi.fn().mockResolvedValue(undefined),
        setAllowedContactAlias: vi.fn().mockResolvedValue(undefined),
        removeAllowedContactAlias: vi.fn().mockResolvedValue(undefined),
        getAllowedGroups: vi.fn().mockReturnValue([]),
        getAllowedGroup: vi.fn().mockReturnValue(undefined),
        addAllowedGroup: vi.fn().mockResolvedValue(undefined),
        removeAllowedGroup: vi.fn().mockResolvedValue(undefined),
        setAllowedGroupAlias: vi.fn().mockResolvedValue(undefined),
        removeAllowedGroupAlias: vi.fn().mockResolvedValue(undefined),
        getAllowedGroupReactionMode: vi.fn().mockReturnValue('active'),
        setAllowedGroupReactionMode: vi.fn().mockResolvedValue(undefined),
        getIgnoredNumbers: vi.fn().mockReturnValue([]),
        removeIgnoredNumber: vi.fn().mockResolvedValue(undefined),
        getAllowedContact: vi.fn().mockReturnValue(undefined),
        isAllowed: vi.fn().mockReturnValue(false),
        isAllowedGroup: vi.fn().mockReturnValue(false),
        isConversationAllowed: vi.fn().mockReturnValue(false)
    };

    const recentsService = {
        getRecentConversations: vi.fn().mockResolvedValue([]),
        getConversationHistory: vi.fn().mockResolvedValue([]),
        recordMessage: vi.fn().mockResolvedValue(undefined)
    };

    return { whatsappService, sessionManager, recentsService };
};

describe('MenuHandler', () => {
    it.each([['Enabled', true], ['Disabled', false]] as const)('saves auto-connect %s without connecting, stopping or changing Off', async (choice, enabled) => {
        const h = createServices(); const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', (title, options) => {
            expect(title).toContain('Auto-connect on startup: Off'); expect(options).toEqual(['Enabled', 'Disabled', 'Back']); return choice;
        }] }); const connect = vi.fn(); const off = vi.fn();
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), connect, off, enabled: () => false }).handleCommand(ctx as any);
        expect(h.sessionManager.setAutoConnect).toHaveBeenCalledExactlyOnceWith(enabled, 7, expect.any(Function));
        expect(h.whatsappService.start).not.toHaveBeenCalled(); expect(h.whatsappService.stop).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled(); expect(off).not.toHaveBeenCalled();
        expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('current connection unchanged'), 'info');
    });
    it('returns from auto-connect Back to Connection with fresh options, then Back to the root', async () => {
        const h = createServices(); h.sessionManager.getAutoConnect.mockReturnValue(true);
        const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', (title) => {
            expect(title).toContain(': On'); h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected'); return 'Back';
        }, (title, options) => { expect(title).toBe('Connection'); expect(options).toContain('Connect WhatsApp'); return 'Back'; }, (title) => {
            expect(title).toBe('WhatsApp — Enabled (transport: disconnected)'); return 'Back';
        }] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledTimes(5); expect(h.sessionManager.setAutoConnect).not.toHaveBeenCalled();
        expect(h.whatsappService.start).not.toHaveBeenCalled(); expect(h.whatsappService.stop).not.toHaveBeenCalled(); expect(ctx.ui.notify).not.toHaveBeenCalled();
    });
    it('keeps the original menu authority across repeated auto-connect Back navigation', async () => {
        const h = createServices(); const captureCurrent = vi.fn(() => () => true);
        const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', 'Back', 'Auto-connect on startup', 'Back', 'Back', 'Back'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), captureCurrent }).handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledTimes(7); expect(captureCurrent).toHaveBeenCalledOnce(); expect(h.sessionManager.setAutoConnect).not.toHaveBeenCalled();
    });
    it('does not reopen Connection when auto-connect Back loses its original authority', async () => {
        const h = createServices(); let current = true; const captureCurrent = vi.fn(() => () => current);
        const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', () => { current = false; return 'Back'; }] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), captureCurrent }).handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledTimes(3); expect(captureCurrent).toHaveBeenCalledOnce();
        expect(ctx.ui.notify).toHaveBeenCalledWith('Settings changed while this menu was open. Reopen /whatsapp.', 'info'); expect(h.sessionManager.setAutoConnect).not.toHaveBeenCalled();
    });
    it('still closes the menu when the auto-connect dialog is cancelled', async () => {
        const h = createServices(); const ctx = createContext();
        ctx.ui.select.mockResolvedValueOnce('Connection').mockResolvedValueOnce('Auto-connect on startup').mockResolvedValueOnce(undefined as any);
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledTimes(3); expect(h.sessionManager.setAutoConnect).not.toHaveBeenCalled(); expect(ctx.ui.notify).not.toHaveBeenCalled();
    });
    it('does not apply an auto-connect choice after menu authority expires', async () => {
        const h = createServices(); let current = true;
        const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', () => { current = false; return 'Enabled'; }] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), captureCurrent: () => () => current }).handleCommand(ctx as any);
        expect(h.sessionManager.setAutoConnect).not.toHaveBeenCalled(); expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Settings changed'), 'info');
    });
    it('passes the original preference revision and live authority through an auto-connect write', async () => {
        const h = createServices(); let current = true; const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', 'Enabled'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), captureCurrent: () => () => current }).handleCommand(ctx as any);
        const guard = h.sessionManager.setAutoConnect.mock.calls[0][2] as () => boolean; expect(guard()).toBe(true); current = false; expect(guard()).toBe(false);
    });
    it('does not acknowledge auto-connect after a failed save', async () => {
        const h = createServices(); h.sessionManager.setAutoConnect.mockRejectedValueOnce(new Error('Synthetic save failed'));
        const ctx = createContext({ selects: ['Connection', 'Auto-connect on startup', 'Enabled'] });
        await expect(new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any)).rejects.toThrow('save failed');
        expect(ctx.ui.notify).not.toHaveBeenCalled(); expect(h.whatsappService.start).not.toHaveBeenCalled();
    });
    it.each([true, false])('requires explicit terminal consent for intermediate metadata/text (%s)', async consent => {
        const h = createServices(); const ctx = createContext({ selects: ['Reply delivery', 'Enable interim assistant text'], confirms: [consent] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(ctx.ui.confirm).toHaveBeenCalledWith('Enable optional reply reporting?', expect.stringContaining('workspace-relative'));
        expect(h.sessionManager.setReplyReporting).toHaveBeenCalledTimes(consent ? 1 : 0);
        if (consent) expect(h.sessionManager.setReplyReporting).toHaveBeenCalledWith({ changedFiles: false, interimText: true, liveActivity: false }, 0, expect.any(Function));
        expect(h.sessionManager.setReplyStats).not.toHaveBeenCalled(); expect(h.whatsappService.start).not.toHaveBeenCalled();
    });
    it('groups the root into six focused settings categories', async () => {
        const h = createServices(); const ctx = createContext({ selects: ['Back'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledWith(expect.any(String), ['Connection', 'Chats / Owner', 'Replies', 'Voice', 'Groups', 'Advanced', 'Back']);
    });
    it.each([true, false])('uses the shared deliberate-Off lifecycle only after confirmation (%s)', async confirmed => {
        const h = createServices(); const ctx = createContext({ selects: ['Connection', 'Turn WhatsApp off'], confirms: [confirmed] });
        const off = vi.fn(async () => {});
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any, { voice: vi.fn(), owner: vi.fn(), off, enabled: () => true }).handleCommand(ctx as any);
        expect(ctx.ui.confirm).toHaveBeenCalledOnce(); expect(off).toHaveBeenCalledTimes(confirmed ? 1 : 0);
        expect(h.whatsappService.logout).not.toHaveBeenCalled(); expect(h.whatsappService.start).not.toHaveBeenCalled();
    });
    it('does not offer Off when already deliberately off', async () => {
        const h = createServices(); h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected');
        const ctx = createContext({ selects: ['Connection', (_title, options) => {
            expect(options).toContain('Connect WhatsApp'); expect(options).not.toContain('Turn WhatsApp off'); return 'Back';
        }, 'Back'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), enabled: () => false }).handleCommand(ctx as any);
        expect(ctx.ui.confirm).not.toHaveBeenCalled(); expect(h.whatsappService.stop).not.toHaveBeenCalled();
    });
    it('refreshes the heading and connection options after Back', async () => {
        const h = createServices(); const ctx = createContext({ selects: ['Connection', (_title, options) => {
            expect(options).not.toContain('Connect WhatsApp'); h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected'); return 'Back';
        }, (title) => { expect(title).toBe('WhatsApp — Enabled (transport: disconnected)'); return 'Connection'; }, (_title, options) => {
            expect(options).toContain('Connect WhatsApp'); return 'Connect WhatsApp';
        }] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(h.whatsappService.start).toHaveBeenCalledOnce();
    });
    it('reads fresh transport state between category and action selection', async () => {
        const h = createServices(); const ctx = createContext({ selects: [() => {
            h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected'); return 'Connection';
        }, (_title, options) => { expect(options).toContain('Connect WhatsApp'); return 'Connect WhatsApp'; }] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(h.whatsappService.start).toHaveBeenCalledOnce();
    });
    it('does not execute a Connect choice invalidated while its action dialog was open', async () => {
        const h = createServices(); h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected');
        const ctx = createContext({ selects: ['Connection', () => {
            h.whatsappService.getEffectiveStatus.mockReturnValue('connected'); return 'Connect WhatsApp';
        }, 'Back'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(h.whatsappService.start).not.toHaveBeenCalled(); expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('changed'), 'info');
    });
    it('discards an Off choice if deliberate Off changed during its action dialog', async () => {
        const h = createServices(); let enabled = true; const off = vi.fn(async () => {});
        const ctx = createContext({ selects: ['Connection', () => { enabled = false; return 'Turn WhatsApp off'; }, 'Back'], confirms: [true] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), enabled: () => enabled, off }).handleCommand(ctx as any);
        expect(off).not.toHaveBeenCalled(); expect(ctx.ui.confirm).not.toHaveBeenCalled();
    });
    it.each(['category', 'action', 'confirmation'])('closes expired %s navigation without throwing or renewing its authority', async stage => {
        const h = createServices(); let current = true; const off = vi.fn(async () => {}); const captureCurrent = vi.fn(() => () => current);
        const ctx = createContext({ selects: [() => { if (stage === 'category') current = false; return 'Connection'; },
            () => { if (stage === 'action') current = false; return 'Turn WhatsApp off'; }], confirms: [true] });
        if (stage === 'confirmation') ctx.ui.confirm.mockImplementationOnce(async () => { current = false; return true; });
        await expect(new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), enabled: () => true, off, captureCurrent }).handleCommand(ctx as any)).resolves.toBeUndefined();
        expect(ctx.ui.notify).toHaveBeenCalledWith('Settings changed while this menu was open. Reopen /whatsapp.', 'info');
        expect(captureCurrent).toHaveBeenCalledOnce(); expect(off).not.toHaveBeenCalled(); expect(h.whatsappService.start).not.toHaveBeenCalled();
        if (stage === 'category') expect(ctx.ui.select).toHaveBeenCalledOnce();
    });
    it('keeps offline history and owner settings available while deliberately off', async () => {
        const h = createServices(); h.whatsappService.getEffectiveStatus.mockReturnValue('disconnected');
        const ctx = createContext({ selects: ['Chats / Owner', 'Owner'] }); const owner = vi.fn(async () => {});
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any, { voice: vi.fn(), owner, enabled: () => false }).handleCommand(ctx as any);
        expect(ctx.ui.select.mock.calls[1][1]).toEqual(expect.arrayContaining(['Recents', 'Allowed Contacts', 'Owner']));
        expect(owner).toHaveBeenCalledOnce(); expect(h.whatsappService.start).not.toHaveBeenCalled();
    });
    it('shows a fixed metadata-log policy without reading or deleting logs', async () => {
        const h = createServices(); const ctx = createContext({ selects: ['Advanced', 'Privacy and logs'] });
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any).handleCommand(ctx as any);
        expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('whatsapp-ng.runtime.log'), 'info'); expect(h.whatsappService.logout).not.toHaveBeenCalled();
    });
    it.each([true, false])('requires explicit group-context confirmation (%s)', async confirmed => {
        const h = createServices(); const ctx = createContext({ selects: ['Group replies', 'Enable preceding text context'], confirms: [confirmed] });
        const changed = vi.fn(); const handler = new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), groupChanged: changed, captureCurrent: () => () => true });
        await handler.handleCommand(ctx as any); expect(ctx.ui.confirm).toHaveBeenCalledOnce();
        if (confirmed) { expect(h.sessionManager.setGroupReplies).toHaveBeenCalledWith({ mode: 'mentions-or-replies', context: true }, 0, expect.any(Function)); expect(changed).toHaveBeenCalledOnce(); }
        else { expect(h.sessionManager.setGroupReplies).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled(); }
    });
    it('sets a group mode without changing unrelated reply preferences', async () => {
        const h = createServices(); const ctx = createContext({ selects: ['Group replies', 'Replies only'] }); let current = true;
        await new MenuHandler(h.whatsappService as any, h.sessionManager as any, h.recentsService as any,
            { voice: vi.fn(), owner: vi.fn(), captureCurrent: () => () => current }).handleCommand(ctx as any);
        expect(h.sessionManager.setGroupReplies).toHaveBeenCalledWith({ mode: 'replies', context: false }, 0, expect.any(Function));
        const guard = h.sessionManager.setGroupReplies.mock.calls[0][2] as () => boolean; current = false; expect(guard()).toBe(false);
        expect(h.sessionManager.setReplyStats).not.toHaveBeenCalled(); expect(h.sessionManager.setFinalAfterAttachments).not.toHaveBeenCalled();
    });
    beforeEach(() => {
        resetI18n();
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    it('starts WhatsApp pairing from the root menu when disconnected', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        whatsappService.getEffectiveStatus.mockReturnValue('logged-out');
        const ctx = createContext({ selects: ['Connect WhatsApp'] });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(whatsappService.setQRCodeCallback).toHaveBeenCalledOnce();
        expect(whatsappService.start).toHaveBeenCalledOnce();
        expect(ctx.ui.notify).toHaveBeenCalledWith('WhatsApp Pairing Started', 'info');
    });

    it('uses effective WhatsApp status instead of persisted session status', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getStatus.mockReturnValue('connected');
        whatsappService.getEffectiveStatus.mockReturnValue('disconnected');
        const ctx = createContext({ selects: ['Back'] });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('WhatsApp — Enabled (transport: disconnected)', [
            'Connection', 'Chats / Owner', 'Replies', 'Voice', 'Groups', 'Advanced', 'Back'
        ]);
    });

    it.each([
        ['Explain after attachments (default)', true],
        ['Caption/tool only (legacy)', false]
    ] as const)('persists the terminal reply preference %s', async (choice, expected) => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        const ctx = createContext({ selects: ['Reply delivery', choice] });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);
        await handler.handleCommand(ctx as any);
        expect(sessionManager.setFinalAfterAttachments).toHaveBeenCalledExactlyOnceWith(expected, expect.any(Function));
        expect(ctx.ui.notify).toHaveBeenCalledWith('Reply delivery preference saved. Applies to new requests.', 'info');
    });

    it.each([['Enable final stats for allowed chats', true], ['Disable final stats', false]] as const)('sets terminal final stats via %s with a captured scope guard', async (choice, enabled) => {
        const { whatsappService, sessionManager, recentsService } = createServices(); const ctx = createContext({ selects: ['Reply delivery', choice] });
        let current = true; const settings = { voice: vi.fn(), owner: vi.fn(), captureCurrent: () => () => current };
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any, settings);
        await handler.handleCommand(ctx as any); expect(sessionManager.setReplyStats).toHaveBeenCalledWith(enabled, expect.any(Function));
        const guard = sessionManager.setReplyStats.mock.calls[0][1] as () => boolean; expect(guard()).toBe(true); current = false; expect(guard()).toBe(false);
        expect(sessionManager.setFinalAfterAttachments).not.toHaveBeenCalled();
    });
    it('does not change the reply preference when its selection is cancelled', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        const ctx = createContext({ selects: ['Reply delivery', 'Back'] });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);
        await handler.handleCommand(ctx as any);
        expect(sessionManager.setFinalAfterAttachments).not.toHaveBeenCalled();
    });

    it.each([['Voice', 'voice'], ['Owner', 'owner']] as const)('opens terminal %s settings without connecting or sending', async (label, method) => {
        const { whatsappService, sessionManager, recentsService } = createServices(); whatsappService.getEffectiveStatus.mockReturnValue('disconnected');
        const ctx = createContext({ selects: [label] }); const settings = { voice: vi.fn().mockResolvedValue(undefined), owner: vi.fn().mockResolvedValue(undefined) };
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any, settings);
        await handler.handleCommand(ctx as any);
        expect(ctx.ui.select).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['Voice', 'Chats / Owner', 'Replies']));
        expect(settings[method]).toHaveBeenCalledExactlyOnceWith(ctx); expect(whatsappService.start).not.toHaveBeenCalled(); expect(whatsappService.sendMenuMessage).not.toHaveBeenCalled();
    });

    it('disconnects WhatsApp from the root menu when connected', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        const ctx = createContext({ selects: ['Connection', 'Turn WhatsApp off'], confirms: [true] });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(whatsappService.stop).toHaveBeenCalledOnce();
        expect(ctx.ui.notify).toHaveBeenCalledWith('WhatsApp is off. Login and history retained; re-enable from Connection.', 'warning');
    });

    it('logs out only after confirmation', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.isRegistered.mockResolvedValue(true);
        const ctx = createContext({
            selects: ['Logoff (Delete Session)'],
            confirms: [true]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.confirm).toHaveBeenCalledWith('Logoff', 'Delete all credentials?');
        expect(whatsappService.logout).toHaveBeenCalledOnce();
        expect(ctx.ui.notify).toHaveBeenCalledWith('Logged off and credentials deleted', 'info');
    });

    it('sorts allowed contacts and adds a valid contact', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getAllowList.mockReturnValue([
            { number: '+2', name: 'Zoey' },
            { number: '+1', name: 'Ana' }
        ]);
        const ctx = createContext({
            selects: ['Allowed Contacts', 'Add Contact', 'Back', 'Back'],
            inputs: ['+5511999998888']
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('Allowed Contacts', [
            'Ana [+1]',
            'Zoey [+2]',
            'Add Contact',
            'Back'
        ]);
        expect(sessionManager.addNumber).toHaveBeenCalledWith('+5511999998888');
        expect(ctx.ui.notify).toHaveBeenCalledWith('Added +5511999998888 to the allow list', 'info');
    });

    it('sends a message to an allowed contact with the Pi suffix and records it', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getAllowList.mockReturnValue([{ number: '+5511999998888', name: 'Ana', sendNumber: '+5511999998888' }]);
        const ctx = createContext({
            selects: ['Allowed Contacts', 'Ana [+5511999998888] (+5511999998888)', 'Send Message', 'Back', 'Back', 'Back'],
            inputs: ['', 'Oi']
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.notify).toHaveBeenCalledWith('Please enter a message before sending.', 'error');
        expect(whatsappService.sendMenuMessage).toHaveBeenCalledWith(
            '5511999998888@s.whatsapp.net',
            'Oi π'
        );
        expect(recentsService.recordMessage).toHaveBeenCalledWith({
            messageId: 'MSG123',
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            text: 'Oi π',
            direction: 'outgoing',
            timestamp: 1234567890
        });
    });

    it('prints allowed contacts to the console and TUI info output on separate lines', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getAllowList.mockReturnValue([
            { number: '+5511999998888', name: 'Ana' },
            { number: '+553291297719', name: 'Dani' }
        ]);
        const ctx = createContext({
            selects: [
                'Allowed Contacts',
                'Ana [+5511999998888]',
                'Print Contact',
                'Back',
                'Dani [+553291297719]',
                'Print Contact',
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('Allowed Contact • Ana [+5511999998888]', [
            'History',
            'Add Number',
            'Print Contact',
            'Remove Alias',
            'Remove Contact',
            'Back'
        ]);
        expect(ctx.ui.notify).toHaveBeenCalledWith('+5511999998888', 'info');
        expect(ctx.ui.notify).toHaveBeenCalledWith('+5511999998888\n+553291297719', 'info');
        expect(logSpy).toHaveBeenCalledWith('[WhatsApp-NG] Allowed contacts\n  • +5511999998888');
        expect(logSpy).toHaveBeenCalledWith('[WhatsApp-NG] Allowed contacts\n  • +5511999998888\n  • +553291297719');
    });

    it('sorts allowed groups and adds a valid group JID', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getAllowedGroups.mockReturnValue([
            { number: '120363222@g.us', name: 'Zeta' },
            { number: '120363111@g.us', name: 'Alpha' }
        ]);
        const ctx = createContext({
            selects: ['Allowed Groups', 'Add Group', 'Back', 'Back'],
            inputs: ['120363999@g.us']
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('Allowed Groups', [
            'Alpha (120363111@g.us)',
            'Zeta (120363222@g.us)',
            'Add Group',
            'Back'
        ]);
        expect(sessionManager.addAllowedGroup).toHaveBeenCalledWith('120363999@g.us');
        expect(ctx.ui.notify).toHaveBeenCalledWith('Added 120363999@g.us to the allowed groups list', 'info');
    });

    it('shows allowed group menu without reaction mode options', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        sessionManager.getAllowedGroups.mockReturnValue([
            { number: '120363222@g.us', name: 'Zeta' },
            { number: '120363111@g.us', name: 'Alpha' }
        ]);
        const ctx = createContext({
            selects: [
                'Allowed Groups',
                'Alpha (120363111@g.us)',
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('Allowed Group • Alpha (120363111@g.us)', [
            'History',
            'Send Message',
            'Print Group JID',
            'Remove Alias',
            'Remove Group',
            'Back'
        ]);
        expect(sessionManager.setAllowedGroupReactionMode).not.toHaveBeenCalled();
    });


    it('opens a message detail view when a recent history item is selected', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue([{ 
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            lastMessagePreview: 'hello',
            lastMessageTime: 1234567890,
            lastMessageDirection: 'incoming',
            messageCount: 1,
            isAllowed: false
        }]);
        recentsService.getConversationHistory.mockResolvedValue([{ 
            messageId: 'MSG1',
            senderNumber: '+5511999998888',
            text: 'full message body',
            direction: 'incoming',
            timestamp: 1234567890
        }]);
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => options[0],
                'History',
                (_title, options) => options[0],
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(showMessageDetailView).toHaveBeenCalledWith(ctx as any, expect.objectContaining({
            title: 'Message • Ana (+5511999998888)',
            messageId: 'MSG1',
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            text: 'full message body',
            direction: 'incoming',
            timestamp: 1234567890
        }));
    });

    it('opens the reply composer from the selected message context', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue([{ 
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            lastMessagePreview: 'hello',
            lastMessageTime: 1234567890,
            lastMessageDirection: 'incoming',
            messageCount: 1,
            isAllowed: false
        }]);
        recentsService.getConversationHistory.mockResolvedValue([{ 
            messageId: 'MSG1',
            senderNumber: '+5511999998888',
            text: 'full message body',
            direction: 'incoming',
            timestamp: 1234567890
        }]);
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => options[0],
                'History',
                (_title, options) => options[0],
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        vi.mocked(showMessageDetailView).mockResolvedValueOnce('reply');

        await handler.handleCommand(ctx as any);

        expect(showMessageReplyView).toHaveBeenCalledWith(ctx as any, expect.objectContaining({
            selectedMessage: expect.objectContaining({
                messageId: 'MSG1',
                senderNumber: '+5511999998888',
                senderName: 'Ana',
                text: 'full message body',
                direction: 'incoming',
                timestamp: 1234567890
            })
        }));
    });

    it('paginates recents list by 10 conversations', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue(Array.from({ length: 11 }, (_value, index) => ({
            senderNumber: `+55119999988${String(index).padStart(2, '0')}`,
            senderName: `Contact ${index + 1}`,
            lastMessagePreview: `preview ${index + 1}`,
            lastMessageTime: 1234567890 + index,
            lastMessageDirection: index % 2 === 0 ? 'incoming' : 'outgoing',
            messageCount: 1,
            isAllowed: false
        })));
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => {
                    expect(options).toHaveLength(12);
                    expect(options.at(-2)).toBe('Next');
                    expect(options.at(-1)).toBe('Back');
                    return 'Next';
                },
                (_title, options) => {
                    expect(options).toHaveLength(3);
                    expect(options[0]).toContain('Contact 1');
                    expect(options).toContain('Previous');
                    expect(options).toContain('Back');
                    return 'Back';
                },
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(recentsService.getRecentConversations).toHaveBeenCalledOnce();
    });

    it('shows History first in the recents action menu', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue([{
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            lastMessagePreview: 'hello',
            lastMessageTime: 1234567890,
            lastMessageDirection: 'incoming',
            messageCount: 1,
            isAllowed: false
        }]);
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => options[0],
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(ctx.ui.select).toHaveBeenCalledWith('Recents • Ana (+5511999998888)', [
            'History',
            'Allow Contact',
            'Back'
        ]);
    });


    it('paginates recent conversation history by 10 messages', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue([{
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            lastMessagePreview: 'hello',
            lastMessageTime: 1234567890,
            lastMessageDirection: 'incoming',
            messageCount: 11,
            isAllowed: false
        }]);
        recentsService.getConversationHistory.mockResolvedValue(Array.from({ length: 11 }, (_value, index) => ({
            messageId: `MSG${index + 1}`,
            senderNumber: '+5511999998888',
            text: `message ${index + 1}`,
            direction: index % 2 === 0 ? 'incoming' : 'outgoing',
            timestamp: new Date(2026, 3, index + 1, 8, 30, 0).getTime()
        })));
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => options[0],
                'History',
                (_title, options) => {
                    expect(options).toHaveLength(12);
                    expect(options.at(-2)).toBe('Next');
                    expect(options.at(-1)).toBe('Back');
                    return 'Next';
                },
                (_title, options) => {
                    expect(options).toHaveLength(3);
                    expect(options).toContain('Previous');
                    expect(options).toContain('Back');
                    return 'Back';
                },
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(recentsService.getConversationHistory).toHaveBeenCalledWith('+5511999998888');
    });

    it('shows recent conversation history options', async () => {
        const { whatsappService, sessionManager, recentsService } = createServices();
        recentsService.getRecentConversations.mockResolvedValue([{
            senderNumber: '+5511999998888',
            senderName: 'Ana',
            lastMessagePreview: 'hello',
            lastMessageTime: 1234567890,
            lastMessageDirection: 'incoming',
            messageCount: 1,
            isAllowed: false
        }]);
        recentsService.getConversationHistory.mockResolvedValue([{
            messageId: 'MSG1',
            senderNumber: '+5511999998888',
            text: 'newer day but earlier time',
            direction: 'incoming',
            timestamp: new Date(2026, 3, 17, 8, 30, 0).getTime()
        }, {
            messageId: 'MSG2',
            senderNumber: '+5511999998888',
            text: 'older day but later time that should be truncated in the history option because it is intentionally verbose',
            direction: 'outgoing',
            timestamp: new Date(2026, 3, 16, 23, 29, 59).getTime()
        }, {
            messageId: 'MSG3',
            senderNumber: '+5511999998888',
            text: 'newest day same time',
            direction: 'incoming',
            timestamp: new Date(2026, 3, 18, 8, 30, 0).getTime()
        }, {
            messageId: 'MSG4',
            senderNumber: '+5511999998888',
            text: 'newest day later time',
            direction: 'outgoing',
            timestamp: new Date(2026, 3, 18, 21, 45, 0).getTime()
        }]);
        const ctx = createContext({
            selects: [
                'Recents',
                (_title, options) => options[0],
                'History',
                'Back',
                'Back',
                'Back',
                'Back'
            ]
        });
        const handler = new MenuHandler(whatsappService as any, sessionManager as any, recentsService as any);

        await handler.handleCommand(ctx as any);

        expect(recentsService.getConversationHistory).toHaveBeenCalledWith('+5511999998888');
        expect(ctx.ui.select).toHaveBeenCalledWith(
            expect.stringContaining('History • Ana (+5511999998888)'),
            [
                expect.stringContaining('Sent'),
                expect.stringContaining('Received'),
                expect.stringContaining('Received'),
                expect.stringContaining('Sent'),
                'Back'
            ]
        );
        const historyOptions = ctx.ui.select.mock.calls.find(([title]) =>
            String(title).startsWith('History •')
        )?.[1];
        expect(historyOptions).toBeDefined();
        expect(historyOptions![0]).toContain('newest day later time');
        expect(historyOptions![1]).toContain('newest day same time');
        expect(historyOptions![2]).toContain('newer day but earlier time');
        expect(historyOptions![3]).toContain('older day but later time');
        expect(historyOptions![3]).toContain('...');
    });
});
