import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { validatePhoneNumber, type MessageResult } from '../models/whatsapp.types.js';
import type { SessionManager } from '../services/session.manager.js';
import { describeSpeechDestination, setChatReplyPreferences, chatReplyPolicy, speechDefaults, settingsJid, type SpeechSettings } from '../services/speech-settings.js';
import { resolveTtsConfig, updateTtsConfig, EDGE_TTS_ENDPOINT, type TtsConfig, type TtsUpdates } from '../services/tts-config.js';
import type { ReplyOutputMode } from '../services/final-output.service.js';
import { t } from '../i18n.js';
import { expireSettingsRequest, isSettingsClosed, type SettingsNavigation } from './whatsapp-settings.view.js';

export const VOICE_PREVIEW_PHRASE = 'This is an automated voice preview. Esta es una prueba de voz automatizada.';
export interface VoiceChat { jid: string; recipientJid: string; label: string }
export interface VoiceSettingsActions {
    current(): boolean;
    canonical(jid: string): string | undefined;
    chats(): VoiceChat[];
    preview(chat: VoiceChat, config: TtsConfig, approvedDestinationKey: string, revision: number, workspace: string): Promise<MessageResult>;
    disclose(chat: VoiceChat, text: string, revision: number): Promise<MessageResult>;
}
const modeKeys: Record<ReplyOutputMode, string> = { text: 'voice.modeText', voice: 'voice.modeVoice', both: 'voice.modeBoth', mirror: 'voice.modeMirror' };
const modeLabel = (mode: ReplyOutputMode) => t(modeKeys[mode] as Parameters<typeof t>[0]);

function outcome(ctx: ExtensionCommandContext, result: MessageResult): void {
    ctx.ui.notify(result.delivery === 'unknown' ? t('speech.deliveryUnknown') : result.success ? t('voice.sent') : t('voice.failed'),
        result.delivery === 'unknown' ? 'warning' : result.success ? 'info' : 'error');
}
function consentMessage(config: TtsConfig): string {
    const destination = describeSpeechDestination(config);
    return t('voice.consentMessage', { destination: destination.service, endpoint: resolveTtsConfig(config).endpoint ?? EDGE_TTS_ENDPOINT }) + '\n\n' + t('voice.sharedEnablement');
}

/** Only invoked by the explicit extension command, never from a model tool. */
export async function showVoiceSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: VoiceSettingsActions): Promise<SettingsNavigation> {
    const advancedBack = t('menu.back.voiceAdvanced');
    const apply = async (settings: SpeechSettings, revision: number) => {
        let previousDestination: string | undefined;
        try { previousDestination = resolveTtsConfig(session.getSpeechSettings().config).destinationKey; } catch { /* Explicit repair may replace invalid settings. */ }
        try { await session.setSpeechSettings(settings, revision, actions.current); }
        catch (error) {
            if (!actions.current()) expireSettingsRequest();
            if (revision !== session.getSpeechRevision()) { ctx.ui.notify(t('voice.changed'), 'warning'); return false; }
            throw error;
        }
        ctx.ui.notify(t('voice.saved'), 'info');
        if (previousDestination && previousDestination !== resolveTtsConfig(settings.config).destinationKey) ctx.ui.notify(t('voice.destinationChanged'), 'info');
        return true;
    };
    const approveForMode = async (settings: SpeechSettings): Promise<boolean> => {
        const key = resolveTtsConfig(settings.config).destinationKey;
        if (!settings.enabled || settings.approvedDestinationKey !== key) {
            const overrides = Object.values(settings.chats).filter(chat => chat.mode && chat.mode !== 'text').length;
            const groups = Object.entries(settings.chats).filter(([jid, chat]) => jid.endsWith('@g.us') && chat.groupSpeech).length;
            const impact = t('voice.sharedSummary', { mode: modeLabel(settings.mode), overrides, groups });
            if (!await ctx.ui.confirm(t('voice.consentTitle'), `${consentMessage(settings.config)}\n${impact}`)) return false;
            settings.approvedDestinationKey = key;
        }
        settings.enabled = true;
        return true;
    };
    const chooseMode = async (): Promise<ReplyOutputMode | undefined> => {
        const modes = ['text', 'voice', 'both', 'mirror'] as const;
        const selected = await ctx.ui.select(t('voice.defaultMode'), [...modes.map(modeLabel), advancedBack]);
        return modes.find(mode => modeLabel(mode) === selected);
    };
    const remoteVoice = async (config: TtsConfig, protocol: 'fish' | 'openai-compatible', back: string): Promise<TtsUpdates | 'back' | undefined> => {
        const named = t('voice.namedVoice'); const server = t('voice.serverVoice');
        const choice = await ctx.ui.select(t('voice.providerVoice'), [named, ...(protocol === 'openai-compatible' ? [server] : []), back]);
        if (choice === server && protocol === 'openai-compatible') return { ttsProtocol: protocol, ttsUseServerVoice: true, ttsVoice: null };
        if (choice === back) return 'back';
        if (choice !== named) return;
        const value = await ctx.ui.input(t('voice.providerVoice'), config.ttsVoice ?? '');
        if (value === undefined) return;
        if (!value.trim()) throw new Error('A named voice is required');
        return { ttsProtocol: protocol, ttsUseServerVoice: false, ttsVoice: value.trim() };
    };
    const updateBackend = async () => {
        const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
        const edge = t('voice.edge'); const remote = t('voice.remote');
        for (;;) {
            const selected = await ctx.ui.select(t('voice.backend'), [edge, remote, advancedBack]);
            if (selected === edge) { await apply({ ...settings, config: updateTtsConfig(settings.config, {}) }, revision); return; }
            if (selected !== remote) return;
            const openai = 'OpenAI-compatible'; const fish = 'Fish';
            for (;;) {
                const selectedProtocol = await ctx.ui.select(t('voice.protocol'), [openai, fish, t('menu.back.voiceBackend')]);
                if (selectedProtocol === t('menu.back.voiceBackend')) break;
                if (selectedProtocol !== openai && selectedProtocol !== fish) return;
                const protocol = selectedProtocol === openai ? 'openai-compatible' : 'fish';
                const updates: TtsUpdates = { ttsProtocol: protocol };
                for (const [field, label] of [['ttsEndpoint', 'voice.endpoint'], ['ttsModel', 'voice.model'], ['ttsEnv', 'voice.env']] as const) {
                    const value = await ctx.ui.input(t(label), settings.config[field] ?? '');
                    if (value === undefined) return;
                    if (value.trim()) updates[field] = value.trim();
                }
                const voice = await remoteVoice(settings.config, protocol, t('menu.back.voiceProtocol'));
                if (voice === 'back') continue;
                if (!voice) return;
                const config = updateTtsConfig(settings.config, { ...updates, ...voice });
                if (resolveTtsConfig(config).provider === 'edge') throw new Error('Incomplete remote configuration');
                await apply({ ...settings, config }, revision); // destination changes revoke approval
                return;
            }
        }
    };
    const editVoice = async (edge: boolean) => {
        const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
        if (!edge) {
            const resolved = resolveTtsConfig(settings.config);
            if (resolved.provider === 'edge') return;
            const updates = await remoteVoice(settings.config, resolved.provider, advancedBack);
            if (updates && updates !== 'back') await apply({ ...settings, config: updateTtsConfig(settings.config, updates) }, revision);
            return;
        }
        const value = await ctx.ui.input(t('voice.edgeVoice'), settings.config.edgeVoice ?? 'en-US-AndrewMultilingualNeural');
        if (value === undefined || !value.trim()) return;
        const locale = await ctx.ui.input(t('voice.locale'), value.trim().split('-').slice(0, 2).join('-'));
        if (locale === undefined) return;
        const updates: TtsUpdates = { edgeVoice: value.trim(), edgeLocale: locale.trim() || value.trim().split('-').slice(0, 2).join('-') };
        await apply({ ...settings, config: updateTtsConfig(settings.config, updates) }, revision);
    };
    const selectChat = async (back: string): Promise<VoiceChat | undefined> => {
        const chats = actions.chats();
        if (!chats.length) { ctx.ui.notify(t('voice.noChats'), 'warning'); return; }
        const selected = await ctx.ui.select(t('voice.chooseChat'), [...chats.map(chat => chat.label), back]);
        return chats.find(chat => chat.label === selected);
    };
    const setupChat = async () => {
        const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
        for (;;) {
            const chat = await selectChat(t('menu.back.voice')); if (!chat) return;
            const back = t('menu.back.chatList');
            const modes = ['text', 'voice', 'both', 'mirror'] as const;
            const selected = await ctx.ui.select(`${t('voice.chatMode')} — ${chat.label}`, [...modes.map(modeLabel), back]);
            if (selected === back) continue;
            const mode = modes.find(mode => modeLabel(mode) === selected); if (!mode) return;
            if (mode !== 'text') {
                if (chat.jid.endsWith('@g.us') && !await ctx.ui.confirm(t('voice.groupTitle'), t('voice.groupMessage', { chat: chat.label }))) return;
                if (!await approveForMode(settings)) return;
            }
            if (!await apply(setChatReplyPreferences(settings, chat.jid, { mode,
                ...(chat.jid.endsWith('@g.us') ? { groupSpeech: mode !== 'text' } : {}) }, actions.canonical), revision)) return;
            const effective = chatReplyPolicy(session.getSpeechSettings(), chat.jid, actions.canonical);
            ctx.ui.notify(`${chat.label}: ${modeLabel(effective.mode)} — ${effective.automaticReplies ? t('voice.repliesOn') : t('voice.repliesOff')}`, 'info');
            return;
        }
    };
    const editChat = async () => {
        const chat = await selectChat(t('menu.back.voice')); if (!chat) return;
        const back = t('menu.back.voice');
        while (actions.current()) {
            const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
            const policy = chatReplyPolicy(settings, chat.jid, actions.canonical);
            const toggle = policy.automaticReplies ? t('voice.pauseReplies') : t('voice.enableReplies');
            const mode = t('voice.chatMode'); const introduce = t('voice.introduce');
            const selected = await ctx.ui.select(`${chat.label} — ${policy.automaticReplies ? t('voice.repliesOn') : t('voice.repliesOff')} / ${modeLabel(policy.mode)}`, [toggle, mode, introduce, back]);
            if (selected === toggle) {
                await apply(setChatReplyPreferences(settings, chat.jid, { automaticReplies: !policy.automaticReplies }, actions.canonical), revision);
            } else if (selected === mode) {
                const inherit = t('voice.inherit');
                const modes = ['text', 'voice', 'both', 'mirror'] as const;
                const selectedLabel = await ctx.ui.select(t('voice.chatMode'), [inherit, ...modes.map(modeLabel), t('menu.back.chatSettings')]);
                if (selectedLabel === inherit) { await apply(setChatReplyPreferences(settings, chat.jid, { mode: undefined }, actions.canonical), revision); continue; }
                const selectedMode = modes.find(mode => modeLabel(mode) === selectedLabel); if (!selectedMode) continue;
                if (selectedMode !== 'text') {
                    if (chat.jid.endsWith('@g.us') && !await ctx.ui.confirm(t('voice.groupTitle'), t('voice.groupMessage', { chat: chat.label }))) continue;
                    if (!await approveForMode(settings)) continue;
                }
                await apply(setChatReplyPreferences(settings, chat.jid, { mode: selectedMode,
                    ...(chat.jid.endsWith('@g.us') ? { groupSpeech: selectedMode !== 'text' } : {}) }, actions.canonical), revision);
            } else if (selected === introduce) {
                const text = t('voice.disclosureText');
                if (await ctx.ui.confirm(t('voice.introduceConfirmTitle'), t('voice.reviewSend', { chat: chat.label, recipient: chat.recipientJid, text }))) outcome(ctx, await actions.disclose(chat, text, revision));
            } else return;
        }
    };
    let advanced = false;
    while (actions.current()) {
        let settings: SpeechSettings;
        try { settings = session.getSpeechSettings(); }
        catch {
            const reset = t('voice.reset'); const back = t('menu.back.main');
            const selected = await ctx.ui.select(t('voice.invalidSaved'), [reset, back]);
            if (selected === back) return 'back';
            if (selected === reset && await ctx.ui.confirm(reset, t('voice.resetMessage'))) {
                await apply(speechDefaults(), session.getSpeechRevision()); continue;
            }
            return;
        }
        const revision = session.getSpeechRevision();
        const resolved = resolveTtsConfig(settings.config);
        const back = advanced ? t('menu.back.voice') : t('menu.back.main');
        const labels = advanced
            ? [t('voice.backend'), t(resolved.provider === 'edge' ? 'voice.edgeVoice' : 'voice.providerVoice'), t('voice.speed'), ...(resolved.provider === 'edge' ? [] : [t('voice.format')]), t('voice.defaultMode'), t('voice.preview'), back]
            : [t('voice.setupChat'), t('voice.chats'), t('voice.advanced'), t('voice.disable'), back];
        const destination = describeSpeechDestination(settings.config);
        const selected = await ctx.ui.select(advanced ? t('voice.advanced') : t('voice.title', { destination: `${resolved.provider === 'edge' ? t('voice.edge') : destination.service} (${destination.host})`, mode: modeLabel(settings.mode), enabled: settings.enabled ? t('voice.on') : t('voice.off'), approved: settings.approvedDestinationKey ? t('voice.yes') : t('voice.no') }), labels);
        try {
            if (selected === back) { if (advanced) { advanced = false; continue; } return 'back'; }
            if (selected === t('voice.setupChat')) await setupChat();
            else if (selected === t('voice.advanced')) advanced = true;
            else if (selected === t('voice.backend')) await updateBackend();
            else if (selected === t('voice.providerVoice')) await editVoice(resolveTtsConfig(settings.config).provider === 'edge');
            else if (selected === t('voice.edgeVoice')) await editVoice(true);
            else if (selected === t('voice.speed')) {
                const resolved = resolveTtsConfig(settings.config);
                const value = await ctx.ui.input(t('voice.speedPrompt'), String(resolved.speed));
                if (value !== undefined && value.trim()) await apply({ ...settings, config: updateTtsConfig(settings.config, resolved.provider === 'edge' ? { edgeSpeed: Number(value) } : { ttsSpeed: Number(value) }) }, revision);
            } else if (selected === t('voice.format')) {
                if (resolveTtsConfig(settings.config).provider === 'edge') { ctx.ui.notify(t('voice.edgeFormat'), 'info'); continue; }
                const format = await ctx.ui.select(t('voice.format'), ['mp3', 'wav', 'opus', advancedBack]);
                if (format === 'mp3' || format === 'wav' || format === 'opus') await apply({ ...settings, config: updateTtsConfig(settings.config, { ttsFormat: format }) }, revision);
            } else if (selected === t('voice.defaultMode')) {
                const mode = await chooseMode();
                if (mode && (mode === 'text' || await approveForMode(settings))) await apply({ ...settings, mode }, revision);
            } else if (selected === t('voice.chats')) await editChat();
            else if (selected === t('voice.preview')) {
                const chat = await selectChat(advancedBack);
                if (chat && await ctx.ui.confirm(t('voice.previewConfirmTitle'), `${destination.service}\n${resolveTtsConfig(settings.config).endpoint ?? EDGE_TTS_ENDPOINT}\n${resolveTtsConfig(settings.config).model ?? resolveTtsConfig(settings.config).voice}\n\n${t('voice.previewMessage', { chat: chat.label, recipient: chat.recipientJid, text: VOICE_PREVIEW_PHRASE })}`)) {
                    outcome(ctx, await actions.preview(chat, settings.config, destination.destinationKey, revision, ctx.cwd));
                }
            } else if (selected === t('voice.disable')) {
                if (await apply({ ...settings, enabled: false, mode: 'text', approvedDestinationKey: undefined }, revision)) ctx.ui.notify(t('voice.disabledNotice'), 'info');
            } else return;
        } catch (error) { if (isSettingsClosed(error)) throw error; ctx.ui.notify(t('voice.failed'), 'error'); }
    }
}

export async function showOwnerSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: Pick<VoiceSettingsActions, 'current' | 'chats'>): Promise<SettingsNavigation> {
    const enter = t('voice.enterOwner'); const clear = t('voice.clearOwner'); const back = t('menu.back.chatsOwner');
    const people = actions.chats().filter(chat => !chat.jid.endsWith('@g.us'));
    const selected = await ctx.ui.select(t('voice.ownerTitle', { owner: session.getOperatorJid() || t('voice.unset') }), [...people.map(chat => chat.label), enter, clear, back]);
    if (selected === back) return 'back';
    if (!selected) return;
    let jid = selected === enter ? await ctx.ui.input(t('voice.ownerPrompt')) : selected === clear ? '' : people.find(chat => chat.label === selected)?.jid;
    if (jid === undefined) return;
    try {
        if (selected === enter && jid && !jid.trim().includes('@') && !validatePhoneNumber(jid.trim())) {
            ctx.ui.notify(t('voice.ownerAmbiguous'), 'error');
            return;
        }
        jid = jid ? settingsJid(jid) : '';
        if (jid.endsWith('@g.us')) throw new Error('Owner must be a person');
        if (await ctx.ui.confirm(t('voice.owner'), t('voice.ownerConfirm', { owner: jid || t('voice.unset') }))) {
            await session.setOperatorJid(jid, actions.current);
            ctx.ui.notify(t('voice.saved'), 'info');
        }
    } catch (error) { if (isSettingsClosed(error)) throw error; ctx.ui.notify(t('voice.failed'), 'error'); }
}
