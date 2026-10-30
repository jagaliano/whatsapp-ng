import type { ReplyOutputMode, FinalOutputPolicy } from './final-output.service.js';
import { resolveTtsConfig, updateTtsConfig, TtsError, EDGE_TTS_ENDPOINT, type TtsConfig } from './tts-config.js';

export const TTS_CONFIG_FIELDS = ['ttsEndpoint', 'ttsModel', 'ttsEnv', 'ttsVoice', 'ttsUseServerVoice', 'ttsFormat', 'ttsProtocol', 'ttsSpeed', 'edgeVoice', 'edgeLocale', 'edgeSpeed'] as const;
export interface ChatReplyPreferences { mode?: ReplyOutputMode; automaticReplies?: boolean; groupSpeech?: boolean }
export interface SpeechSettings {
    config: TtsConfig;
    enabled: boolean;
    mode: ReplyOutputMode;
    approvedDestinationKey?: string;
    chats: Record<string, ChatReplyPreferences>;
}
export const speechDefaults = (): SpeechSettings => ({ config: {}, enabled: false, mode: 'text', chats: {} });
export function outputMode(value: unknown): value is ReplyOutputMode { return ['text', 'voice', 'both', 'mirror'].includes(value as string); }
export function settingsJid(value: string): string {
    if (typeof value !== 'string' || value.length > 128) throw new TtsError('Invalid settings conversation');
    let jid = value.trim();
    if (/^\+?\d+$/.test(jid)) jid = `${jid.replace(/^\+/, '')}@s.whatsapp.net`;
    if (!/^\d{1,30}(?::\d+)?@(s\.whatsapp\.net|lid|g\.us)$/.test(jid)) throw new TtsError('Invalid settings conversation');
    return jid.replace(/:\d+@/, '@');
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function validateSpeechSettings(value: SpeechSettings): SpeechSettings {
    if (!object(value) || !object(value.config) || !object(value.chats) || !outputMode(value.mode) || typeof value.enabled !== 'boolean') throw new TtsError('Invalid saved voice settings; repair them in terminal /whatsapp > Voice');
    if (Object.keys(value).some(key => !['config', 'enabled', 'mode', 'approvedDestinationKey', 'chats'].includes(key))) throw new TtsError('Invalid speech settings field');
    const config = updateTtsConfig({}, value.config);
    // Inactive Edge preferences must also be valid before a later remote reset.
    resolveTtsConfig({ edgeVoice: config.edgeVoice, edgeLocale: config.edgeLocale, edgeSpeed: config.edgeSpeed });
    const destination = resolveTtsConfig(config).destinationKey;
    const chats: Record<string, ChatReplyPreferences> = {};
    if (Object.keys(value.chats).length > 500) throw new TtsError('Too many chat preferences');
    for (const [key, entry] of Object.entries(value.chats)) {
        if (!object(entry) || Object.keys(entry).some(field => !['mode', 'automaticReplies', 'groupSpeech'].includes(field))) throw new TtsError('Invalid chat preferences');
        const jid = settingsJid(key);
        if (jid !== key || (entry.mode !== undefined && !outputMode(entry.mode))
            || (entry.automaticReplies !== undefined && typeof entry.automaticReplies !== 'boolean')
            || (entry.groupSpeech !== undefined && (typeof entry.groupSpeech !== 'boolean' || !jid.endsWith('@g.us')))) throw new TtsError('Invalid chat preferences');
        chats[jid] = { ...entry } as ChatReplyPreferences;
    }
    if (value.approvedDestinationKey !== undefined && (typeof value.approvedDestinationKey !== 'string' || value.approvedDestinationKey.length > 4096)) throw new TtsError('Invalid speech consent');
    return { config, enabled: value.enabled, mode: value.mode, chats,
        ...(value.approvedDestinationKey === destination ? { approvedDestinationKey: destination } : {}) };
}
export function storedSpeechFields(settings: SpeechSettings): Record<string, unknown> {
    const checked = validateSpeechSettings(settings);
    const { config, ...voicePreferences } = checked;
    return { ...config, voicePreferences };
}
export function loadSpeechSettings(config: Record<string, unknown>): SpeechSettings {
    const tts = Object.fromEntries(TTS_CONFIG_FIELDS.filter(key => config[key] !== undefined).map(key => [key, config[key]]));
    const prefs = config.voicePreferences === undefined ? {} : config.voicePreferences;
    if (!object(prefs) || Object.keys(prefs).some(key => !['enabled', 'mode', 'approvedDestinationKey', 'chats'].includes(key))) throw new TtsError('Invalid saved voice settings');
    return validateSpeechSettings({ ...speechDefaults(), ...prefs, config: tts } as SpeechSettings);
}
export function matchingChatPreferences(settings: SpeechSettings, jid: string, canonical: (jid: string) => string | undefined): Array<[string, ChatReplyPreferences]> {
    const target = canonical(settingsJid(jid));
    if (!target) throw new TtsError('Conversation identity is unavailable');
    return Object.entries(settings.chats).filter(([key]) => canonical(key) === target);
}
export function chatReplyPolicy(settings: SpeechSettings, jid: string, canonical: (jid: string) => string | undefined): { automaticReplies: boolean; mode: ReplyOutputMode; groupOptIn: boolean } {
    const matches = matchingChatPreferences(settings, jid, canonical);
    const modes = new Set(matches.map(([, profile]) => profile.mode).filter(mode => mode !== undefined));
    const groupOptIn = jid.endsWith('@g.us') && matches.length === 1 && matches[0][1].groupSpeech === true;
    return { automaticReplies: !matches.some(([, profile]) => profile.automaticReplies === false),
        mode: !settings.enabled || settings.approvedDestinationKey !== resolveTtsConfig(settings.config).destinationKey
            || (jid.endsWith('@g.us') && !groupOptIn) || modes.size > 1 ? 'text' : modes.values().next().value ?? settings.mode,
        groupOptIn };
}
export function setChatReplyPreferences(settings: SpeechSettings, jid: string, patch: ChatReplyPreferences, canonical: (jid: string) => string | undefined): SpeechSettings {
    const next = structuredClone(settings);
    const matches = matchingChatPreferences(next, jid, canonical);
    const key = canonical(settingsJid(jid));
    if (!key) throw new TtsError('Conversation identity is unavailable');
    const modes = new Set(matches.map(([, profile]) => profile.mode).filter(mode => mode !== undefined));
    // Consolidation must preserve the effective policy, not silently restore
    // defaults when PN/LID entries become aliases. Only an explicit patch can
    // lift an existing pause or resolve conflicting modes to spoken output.
    const previous: ChatReplyPreferences = matches.length <= 1 ? matches[0]?.[1] ?? {} : {
        automaticReplies: !matches.some(([, profile]) => profile.automaticReplies === false),
        mode: modes.size > 1 ? 'text' : modes.values().next().value,
        ...(key.endsWith('@g.us') ? { groupSpeech: false } : {})
    };
    for (const [alias] of matches) delete next.chats[alias];
    next.chats[key] = { ...previous, ...patch };
    return validateSpeechSettings(next);
}
export function finalSpeechPolicy(settings: SpeechSettings, jid: string, canonical: (jid: string) => string | undefined, isCurrent: () => boolean): FinalOutputPolicy {
    const chat = chatReplyPolicy(settings, jid, canonical);
    return { mode: chat.mode, tts: settings.config, approvedDestinationKey: settings.approvedDestinationKey,
        groupOptIn: chat.groupOptIn, isCurrent: () => chat.automaticReplies && isCurrent() };
}
export function describeSpeechDestination(config: TtsConfig): { host: string; service: string; destinationKey: string } {
    const resolved = resolveTtsConfig(config);
    const host = new URL(resolved.endpoint ?? EDGE_TTS_ENDPOINT).host;
    return { host, destinationKey: resolved.destinationKey,
        service: resolved.provider === 'edge' ? 'Microsoft / Edge (unofficial, online)' : host === 'api.fish.audio' ? 'Fish Audio'
            : host === 'api.openai.com' ? 'OpenAI' : host === 'openrouter.ai' ? 'OpenRouter' : `${resolved.provider} (${host})` };
}
