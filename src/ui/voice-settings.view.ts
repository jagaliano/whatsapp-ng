import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { validatePhoneNumber, type MessageResult } from '../models/whatsapp.types.js';
import type { SessionManager } from '../services/session.manager.js';
import { describeSpeechDestination, setChatReplyPreferences, chatReplyPolicy, speechDefaults, settingsJid, type SpeechSettings } from '../services/speech-settings.js';
import { resolveTtsConfig, updateTtsConfig, EDGE_TTS_ENDPOINT, type TtsConfig, type TtsUpdates } from '../services/tts-config.js';
import type { ReplyOutputMode } from '../services/final-output.service.js';
import { t } from '../i18n.js';

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
    return t('voice.consentMessage', { destination: destination.service, endpoint: resolveTtsConfig(config).endpoint ?? EDGE_TTS_ENDPOINT });
}

/** Only invoked by the explicit extension command, never from a model tool. */
export async function showVoiceSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: VoiceSettingsActions): Promise<void> {
    const back = t('menu.root.back');
    const apply = async (settings: SpeechSettings, revision: number) => {
        await session.setSpeechSettings(settings, revision, actions.current);
        ctx.ui.notify(t('voice.saved'), 'info');
    };
    const approveForMode = async (settings: SpeechSettings): Promise<boolean> => {
        const key = resolveTtsConfig(settings.config).destinationKey;
        if (settings.approvedDestinationKey !== key) {
            if (!await ctx.ui.confirm(t('voice.consentTitle'), consentMessage(settings.config))) return false;
            settings.approvedDestinationKey = key;
        }
        settings.enabled = true;
        return true;
    };
    const chooseMode = async (): Promise<ReplyOutputMode | undefined> => {
        const modes = ['text', 'voice', 'both', 'mirror'] as const;
        const selected = await ctx.ui.select(t('voice.defaultMode'), [...modes.map(modeLabel), back]);
        return modes.find(mode => modeLabel(mode) === selected);
    };
    const updateBackend = async () => {
        const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
        const edge = t('voice.edge'); const remote = t('voice.remote');
        const selected = await ctx.ui.select(t('voice.backend'), [edge, remote, back]);
        if (selected !== edge && selected !== remote) return;
        let config: TtsConfig;
        if (selected === edge) config = updateTtsConfig(settings.config, {});
        else {
            const updates: TtsUpdates = {};
            for (const [field, label] of [['ttsEndpoint', 'voice.endpoint'], ['ttsModel', 'voice.model'], ['ttsEnv', 'voice.env'], ['ttsVoice', 'voice.providerVoice']] as const) {
                const value = await ctx.ui.input(t(label), settings.config[field] ?? '');
                if (value === undefined) return;
                if (value.trim()) updates[field] = value.trim();
            }
            if (!Object.keys(updates).length && resolveTtsConfig(settings.config).provider !== 'edge') return;
            config = updateTtsConfig(settings.config, updates);
            if (resolveTtsConfig(config).provider === 'edge') throw new Error('Incomplete remote configuration');
        }
        await apply({ ...settings, config }, revision); // destination changes revoke the previous approval
    };
    const editVoice = async (edge: boolean) => {
        const settings = session.getSpeechSettings(); const revision = session.getSpeechRevision();
        const value = await ctx.ui.input(edge ? t('voice.edgeVoice') : t('voice.providerVoice'), edge ? settings.config.edgeVoice ?? 'en-US-AndrewMultilingualNeural' : settings.config.ttsVoice ?? '');
        if (value === undefined || !value.trim()) return;
        let updates: TtsUpdates = { ttsVoice: value.trim() };
        if (edge) {
            const locale = await ctx.ui.input(t('voice.locale'), value.trim().split('-').slice(0, 2).join('-'));
            if (locale === undefined) return;
            updates = { edgeVoice: value.trim(), edgeLocale: locale.trim() || value.trim().split('-').slice(0, 2).join('-') };
        }
        await apply({ ...settings, config: updateTtsConfig(settings.config, updates) }, revision);
    };
    const selectChat = async (): Promise<VoiceChat | undefined> => {
        const chats = actions.chats();
        if (!chats.length) { ctx.ui.notify(t('voice.noChats'), 'warning'); return; }
        const selected = await ctx.ui.select(t('voice.chats'), [...chats.map(chat => chat.label), back]);
        return chats.find(chat => chat.label === selected);
    };
    const editChat = async () => {
        const chat = await selectChat(); if (!chat) return;
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
                const selectedLabel = await ctx.ui.select(t('voice.chatMode'), [inherit, ...modes.map(modeLabel), back]);
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
                if (await ctx.ui.confirm(t('voice.introduce'), t('voice.reviewSend', { chat: chat.label, recipient: chat.recipientJid, text }))) outcome(ctx, await actions.disclose(chat, text, revision));
            } else return;
        }
    };
    while (actions.current()) {
        let settings: SpeechSettings;
        try { settings = session.getSpeechSettings(); }
        catch {
            const reset = t('voice.reset');
            if (await ctx.ui.select(t('voice.invalidSaved'), [reset, back]) === reset && await ctx.ui.confirm(reset, t('voice.resetMessage'))) {
                await apply(speechDefaults(), session.getSpeechRevision()); continue;
            }
            return;
        }
        const revision = session.getSpeechRevision();
        const labels = [t('voice.backend'), t('voice.providerVoice'), t('voice.edgeVoice'), t('voice.speed'), t('voice.format'), t('voice.defaultMode'), t('voice.approve'), t('voice.chats'), t('voice.preview'), t('voice.disable'), back];
        const destination = describeSpeechDestination(settings.config);
        const selected = await ctx.ui.select(t('voice.title', { destination: `${destination.service} (${destination.host})`, mode: modeLabel(settings.mode), enabled: settings.enabled ? t('voice.on') : t('voice.off'), approved: settings.approvedDestinationKey ? t('voice.yes') : t('voice.no') }), labels);
        try {
            if (selected === t('voice.backend')) await updateBackend();
            else if (selected === t('voice.providerVoice')) await editVoice(resolveTtsConfig(settings.config).provider === 'edge');
            else if (selected === t('voice.edgeVoice')) await editVoice(true);
            else if (selected === t('voice.speed')) {
                const resolved = resolveTtsConfig(settings.config);
                const value = await ctx.ui.input(t('voice.speedPrompt'), String(resolved.speed));
                if (value !== undefined && value.trim()) await apply({ ...settings, config: updateTtsConfig(settings.config, resolved.provider === 'edge' ? { edgeSpeed: Number(value) } : { ttsSpeed: Number(value) }) }, revision);
            } else if (selected === t('voice.format')) {
                if (resolveTtsConfig(settings.config).provider === 'edge') { ctx.ui.notify(t('voice.edgeFormat'), 'info'); continue; }
                const format = await ctx.ui.select(t('voice.format'), ['mp3', 'wav', 'opus', back]);
                if (format === 'mp3' || format === 'wav' || format === 'opus') await apply({ ...settings, config: updateTtsConfig(settings.config, { ttsFormat: format }) }, revision);
            } else if (selected === t('voice.defaultMode')) {
                const mode = await chooseMode();
                if (mode && (mode === 'text' || await approveForMode(settings))) await apply({ ...settings, mode }, revision);
            } else if (selected === t('voice.approve')) {
                if (await ctx.ui.confirm(t('voice.consentTitle'), consentMessage(settings.config))) await apply({ ...settings, approvedDestinationKey: destination.destinationKey }, revision);
            } else if (selected === t('voice.chats')) await editChat();
            else if (selected === t('voice.preview')) {
                const chat = await selectChat();
                if (chat && await ctx.ui.confirm(t('voice.preview'), `${destination.service}\n${resolveTtsConfig(settings.config).endpoint ?? EDGE_TTS_ENDPOINT}\n${resolveTtsConfig(settings.config).model ?? resolveTtsConfig(settings.config).voice}\n\n${t('voice.previewMessage', { chat: chat.label, recipient: chat.recipientJid, text: VOICE_PREVIEW_PHRASE })}`)) {
                    outcome(ctx, await actions.preview(chat, settings.config, destination.destinationKey, revision, ctx.cwd));
                }
            } else if (selected === t('voice.disable')) {
                await apply({ ...settings, enabled: false, mode: 'text', approvedDestinationKey: undefined }, revision);
            } else return;
        } catch { ctx.ui.notify(t('voice.failed'), 'error'); }
    }
}

export async function showOwnerSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: Pick<VoiceSettingsActions, 'current' | 'chats'>): Promise<void> {
    const enter = t('voice.enterOwner'); const clear = t('voice.clearOwner'); const back = t('menu.root.back');
    const people = actions.chats().filter(chat => !chat.jid.endsWith('@g.us'));
    const selected = await ctx.ui.select(t('voice.ownerTitle', { owner: session.getOperatorJid() || t('voice.unset') }), [...people.map(chat => chat.label), enter, clear, back]);
    if (!selected || selected === back) return;
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
    } catch { ctx.ui.notify(t('voice.failed'), 'error'); }
}
