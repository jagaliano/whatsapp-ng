import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTtsConfig, updateTtsConfig, type TtsConfig } from '../../src/services/tts-config.ts';

const fish: TtsConfig = { ttsEndpoint: 'https://api.fish.audio/v1/tts', ttsModel: 's2.1-pro-free', ttsEnv: 'TEST_TTS_KEY', ttsVoice: 'fixture-existing-voice' };
beforeEach(() => vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', ''));
afterEach(() => vi.unstubAllEnvs());
describe('speech backend configuration (no I/O)', () => {
    it.each(['127.0.0.1', '127.0.0.2', '[::1]', 'localhost'])('accepts loopback HTTP and gives it separate destination consent (%s)', host => {
        const endpoint = `http://${host}:8098/v1/audio/speech`;
        const config = { ...fish, ttsEndpoint: endpoint, ttsProtocol: 'openai-compatible' as const };
        expect(resolveTtsConfig(config).endpoint).toBe(endpoint);
        expect(resolveTtsConfig(config).destinationKey).not.toBe(resolveTtsConfig({ ...config, ttsEndpoint: endpoint.replace('http:', 'https:') }).destinationKey);
    });
    it('requires exact opt-in for non-loopback HTTP without relaxing other URL guards', () => {
        const config = { ...fish, ttsEndpoint: 'http://192.168.1.20/speech' };
        expect(() => resolveTtsConfig(config)).toThrow(); vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); expect(resolveTtsConfig(config).endpoint).toBe(config.ttsEndpoint);
        for (const ttsEndpoint of ['http://user:pass@127.0.0.1/speech', 'http://127.0.0.1/speech?q=x', 'http://127.0.0.1/speech#x', 'ftp://127.0.0.1/speech']) expect(() => resolveTtsConfig({ ...config, ttsEndpoint })).toThrow();
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', 'true'); expect(() => resolveTtsConfig(config)).toThrow();
    });
    it('selects Andrew multilingual and en-US for empty/blank connection fields', () => {
        for (const config of [{}, { ttsEndpoint: ' ', ttsModel: '', ttsEnv: '  ' }]) {
            expect(resolveTtsConfig(config)).toMatchObject({ provider: 'edge', voice: 'en-US-AndrewMultilingualNeural', locale: 'en-US', speed: 1, format: 'mp3' });
        }
    });
    it('never reuses a Fish voice as an Edge voice and infers a custom voice locale', () => {
        expect(resolveTtsConfig({ ttsVoice: 'fixture-fish-reference' }).voice).toBe('en-US-AndrewMultilingualNeural');
        expect(resolveTtsConfig({ edgeVoice: 'es-MX-JorgeNeural' }).locale).toBe('es-MX');
    });
    it.each(['ttsEndpoint', 'ttsModel', 'ttsEnv'] as const)('rejects incomplete configuration missing %s', key => {
        const incomplete = { ...fish }; delete incomplete[key];
        expect(() => resolveTtsConfig(incomplete)).toThrow();
    });
    it.each(['http://api.example.test/speech', 'https://user:password@example.test/speech', 'https://example.test/speech?key=fixture', 'https://example.test/speech#fragment', 'not a URL'])('rejects unsafe URL %s', ttsEndpoint => {
        expect(() => resolveTtsConfig({ ...fish, ttsEndpoint })).toThrow();
    });
    it.each(['s2.1pro-free', 'unknown-model', 's2.1-pro-free\r\nother:value'])('rejects Fish default/fallback model hazards: %s', ttsModel => {
        expect(() => resolveTtsConfig({ ...fish, ttsModel })).toThrow();
    });
    it('requires a voice and an environment-variable name, not an API-key value', () => {
        expect(() => resolveTtsConfig({ ...fish, ttsVoice: '' })).toThrow('existing voice');
        expect(() => resolveTtsConfig({ ...fish, ttsEnv: 'not-an-env-name' })).toThrow();
        expect(() => resolveTtsConfig({ ...fish, ttsEndpoint: 'https://api.openai.com/v1/audio/speech', ttsModel: 'gpt-4o-mini-tts', ttsVoice: '' })).toThrow('provider voice');
    });
    it('uses an explicit protocol for custom Fish proxies without appending URL paths', () => {
        const endpoint = 'https://proxy.example.test/custom-speech';
        expect(resolveTtsConfig({ ...fish, ttsEndpoint: endpoint }).provider).toBe('openai-compatible');
        expect(resolveTtsConfig({ ...fish, ttsEndpoint: endpoint, ttsProtocol: 'fish' })).toMatchObject({ provider: 'fish', endpoint });
    });
    it('merges omitted fields, trims supplied values and leaves the original untouched', () => {
        const updated = updateTtsConfig(fish, { ttsModel: ' s2.1-pro ' });
        expect(updated).toEqual({ ...fish, ttsModel: 's2.1-pro' });
        expect(fish.ttsModel).toBe('s2.1-pro-free');
    });
    it('rejects a partial removal without changing the previous configuration', () => {
        const original = { ...fish };
        expect(() => updateTtsConfig(original, { ttsEnv: null })).toThrow();
        expect(original).toEqual(fish);
        expect(() => updateTtsConfig(original, { ttsVoice: '' })).toThrow();
    });
    it('clears all remote overrides with {} or three explicit removals, preserving Edge preferences', () => {
        const edge = { edgeVoice: 'en-US-AndrewMultilingualNeural', edgeLocale: 'en-US', edgeSpeed: 1.2 };
        const current = { ...fish, ...edge, ttsProtocol: 'fish' as const, ttsFormat: 'wav' as const, ttsSpeed: 0.8 };
        expect(updateTtsConfig(current, {})).toEqual(edge);
        expect(updateTtsConfig(current, { ttsEndpoint: ' ', ttsModel: null, ttsEnv: '' })).toEqual(edge);
    });
    it('requires a newly selected provider voice rather than inheriting a Fish reference', () => {
        expect(() => updateTtsConfig(fish, { ttsEndpoint: 'https://api.openai.com/v1/audio/speech', ttsModel: 'gpt-4o-mini-tts' })).toThrow('provider voice');
        expect(updateTtsConfig(fish, { ttsEndpoint: 'https://api.openai.com/v1/audio/speech', ttsModel: 'gpt-4o-mini-tts', ttsVoice: 'alloy' }).ttsVoice).toBe('alloy');
    });
    it('keeps the voice when an explicit protocol matches the auto-detected provider', () => {
        const updated = updateTtsConfig(fish, { ttsProtocol: 'fish' });
        expect(updated).toEqual({ ...fish, ttsProtocol: 'fish' });
        expect(resolveTtsConfig(updated).destinationKey).toBe(resolveTtsConfig(fish).destinationKey);
        expect(updateTtsConfig(updated, { ttsProtocol: null }).ttsVoice).toBe(fish.ttsVoice);
    });
    it('still drops the voice when the effective provider or endpoint changes', () => {
        const custom = { ...fish, ttsEndpoint: 'https://proxy.example.test/tts', ttsProtocol: 'fish' as const };
        expect(() => updateTtsConfig(custom, { ttsProtocol: 'openai-compatible' })).toThrow('provider voice');
        expect(() => updateTtsConfig(fish, { ttsEndpoint: 'https://proxy.example.test/tts', ttsProtocol: 'fish' })).toThrow('voice reference');
    });
    it('binds destination consent to normalized endpoint, protocol and credential-variable name', () => {
        const selected = resolveTtsConfig(fish);
        expect(resolveTtsConfig({ ...fish, ttsModel: 's2.1-pro' }).destinationKey).toBe(selected.destinationKey);
        expect(resolveTtsConfig({ ...fish, ttsEnv: 'OTHER_TEST_KEY' }).destinationKey).not.toBe(selected.destinationKey);
        expect(resolveTtsConfig({ ...fish, ttsEndpoint: 'https://proxy.example.test/tts', ttsProtocol: 'fish' }).destinationKey).not.toBe(selected.destinationKey);
        expect(Object.isFrozen(selected)).toBe(true);
    });
    it.each([0, 2.1, Number.NaN, Number.POSITIVE_INFINITY, '1'])('rejects invalid speed %s', value => {
        expect(() => resolveTtsConfig({ ...fish, ttsSpeed: value as number })).toThrow();
        expect(() => resolveTtsConfig({ edgeSpeed: value as number })).toThrow();
    });
    it('rejects SSML-bearing voices, raw PCM, unknown protocols and key-value configuration fields', () => {
        expect(() => resolveTtsConfig({ edgeVoice: 'en-US-AndrewNeural"><break/>' })).toThrow();
        expect(() => resolveTtsConfig({ ...fish, ttsFormat: 'pcm' as any })).toThrow();
        expect(() => resolveTtsConfig({ ...fish, ttsProtocol: 'auto' as any })).toThrow();
        expect(() => updateTtsConfig(fish, { apiKey: 'fixture-only-not-a-real-key' } as any)).toThrow('Unknown');
    });
});
