import { allowsPlainHttp } from './endpoint-policy.js';

export const EDGE_TTS_ENDPOINT = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
export const TTS_MAX_CHARACTERS = 2_000;
export const TTS_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const TTS_SYNTHESIS_TIMEOUT_MS = 60_000;
export const TTS_MAX_PENDING = 5;

export class TtsError extends Error {}
export type TtsFormat = 'mp3' | 'wav' | 'opus';
export interface TtsConfig {
    ttsEndpoint?: string;
    ttsModel?: string;
    /** Environment-variable name only. Never an API key. */
    ttsEnv?: string;
    ttsVoice?: string;
    ttsFormat?: TtsFormat;
    ttsProtocol?: 'fish' | 'openai-compatible';
    ttsSpeed?: number;
    edgeVoice?: string;
    edgeLocale?: string;
    edgeSpeed?: number;
}
export type TtsUpdates = { [K in keyof TtsConfig]?: TtsConfig[K] | null };
export interface ResolvedTtsConfig {
    readonly provider: 'edge' | 'fish' | 'openai-compatible';
    readonly endpoint?: string;
    readonly model?: string;
    readonly env?: string;
    readonly voice: string;
    readonly locale?: string;
    readonly speed: number;
    readonly format: TtsFormat;
    /** Non-secret identity of the precise destination/protocol and credential-variable name. */
    readonly destinationKey: string;
}
const remoteFields = ['ttsEndpoint', 'ttsModel', 'ttsEnv', 'ttsVoice', 'ttsFormat', 'ttsProtocol', 'ttsSpeed'] as const;
const fields = new Set<string>([...remoteFields, 'edgeVoice', 'edgeLocale', 'edgeSpeed']);
const fishModels = new Set(['s1', 's2-pro', 's2.1-pro', 's2.1-pro-free', 'drama-3']);

function text(value: unknown, max: number): string | undefined {
    if (value == null || value === '') return undefined;
    if (typeof value !== 'string' || value.length > max || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new TtsError('Invalid speech configuration');
    return value.trim() || undefined;
}
function speed(value: unknown): number {
    if (value == null) return 1;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.5 || value > 2) throw new TtsError('Speech speed must be between 0.5 and 2');
    return value;
}

function remoteProvider(endpoint: URL, protocol: string | undefined): 'fish' | 'openai-compatible' {
    if (protocol === 'fish' || protocol === 'openai-compatible') return protocol;
    return (endpoint.hostname === 'api.fish.audio' && endpoint.pathname.replace(/\/+$/, '') === '/v1/tts' ? 'fish' : 'openai-compatible');
}
/** Effective provider/endpoint a voice ID belongs to; undefined when not a parseable remote destination. */
function voiceScope(config: Record<string, unknown>): string | undefined {
    try {
        const endpoint = new URL(text(config.ttsEndpoint, 2048) ?? '');
        return JSON.stringify([remoteProvider(endpoint, text(config.ttsProtocol, 32)), endpoint.href]);
    } catch { return undefined; }
}

/** Validation only: does not read credentials, initialize a client or upload text. */
export function resolveTtsConfig(config: TtsConfig): Readonly<ResolvedTtsConfig> {
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TtsError('Invalid speech configuration');
    const endpointText = text(config.ttsEndpoint, 2048);
    const model = text(config.ttsModel, 256);
    const env = text(config.ttsEnv, 128);
    if (!endpointText && !model && !env) {
        const voice = text(config.edgeVoice, 128) ?? 'en-US-AndrewMultilingualNeural';
        const locale = text(config.edgeLocale, 32) ?? voice.split('-').slice(0, 2).join('-');
        if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice) || !/^[a-z]{2,3}-[A-Z]{2}$/.test(locale)) throw new TtsError('Invalid Edge voice or locale');
        return Object.freeze({ provider: 'edge', voice, locale, speed: speed(config.edgeSpeed), format: 'mp3',
            destinationKey: JSON.stringify(['edge', EDGE_TTS_ENDPOINT, '']) });
    }
    if (!endpointText || !model || !env || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(env)) throw new TtsError('Remote speech requires an endpoint, model and environment-variable name');
    let endpoint: URL;
    try { endpoint = new URL(endpointText); } catch { throw new TtsError('Invalid speech endpoint'); }
    if (!allowsPlainHttp(endpoint) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new TtsError('Speech endpoint requires HTTPS, or HTTP on loopback / with WHATSAPP_NG_ALLOW_PLAIN_HTTP=1; no credentials, query or fragment');
    const protocol = text(config.ttsProtocol, 32);
    if (protocol !== undefined && protocol !== 'fish' && protocol !== 'openai-compatible') throw new TtsError('Invalid speech protocol');
    const provider = remoteProvider(endpoint, protocol);
    if (provider === 'fish' && !fishModels.has(model)) throw new TtsError('Unsupported Fish model; no provider-default model is permitted');
    const voice = text(config.ttsVoice, 256);
    if (!voice) throw new TtsError(provider === 'fish' ? 'Fish requires an existing voice reference ID' : 'Remote speech requires a provider voice');
    const format = text(config.ttsFormat, 16) ?? 'mp3';
    if (format !== 'mp3' && format !== 'wav' && format !== 'opus') throw new TtsError('Unsupported speech format');
    return Object.freeze({ provider, endpoint: endpoint.href, model, env, voice, format, speed: speed(config.ttsSpeed),
        destinationKey: JSON.stringify([provider, endpoint.href, env]) });
}

/** Pure atomic merge. Empty updates select Edge; callers decide persistence and consent. */
export function updateTtsConfig(current: TtsConfig, updates: TtsUpdates): TtsConfig {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new TtsError('Invalid speech update');
    if (Object.keys(updates).some(key => !fields.has(key))) throw new TtsError('Unknown speech configuration field');
    const next: Record<string, unknown> = { ...current };
    const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (!entries.length) {
        for (const key of remoteFields) delete next[key];
    } else {
        for (const [key, value] of entries) {
            if (value === null || (typeof value === 'string' && !value.trim())) delete next[key];
            else next[key] = typeof value === 'string' ? value.trim() : value;
        }
        if (!next.ttsEndpoint && !next.ttsModel && !next.ttsEnv) {
            for (const key of remoteFields) delete next[key];
        } else if (updates.ttsVoice === undefined && (voiceScope(next) === undefined || voiceScope(next) !== voiceScope(current as Record<string, unknown>))) {
            // A voice ID only survives when the effective provider and endpoint are unchanged
            // (e.g. making the auto-detected Fish protocol explicit), never across providers.
            delete next.ttsVoice;
        }
    }
    resolveTtsConfig(next as TtsConfig);
    return next as TtsConfig;
}
