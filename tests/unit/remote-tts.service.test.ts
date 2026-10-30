import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteTtsService } from '../../src/services/remote-tts.service.ts';
import { resolveTtsConfig, TTS_MAX_AUDIO_BYTES } from '../../src/services/tts-config.ts';

const fixture = { ttsEndpoint: 'https://api.fish.audio/v1/tts', ttsModel: 's2.1-pro-free', ttsEnv: 'WHATSAPP_NG_TEST_TTS_KEY', ttsVoice: 'fixture-existing-reference' };
const audio = Buffer.from('ID3-fixture-audio');
describe('native HTTP speech adapters', () => {
    let root: string;
    let output: string;
    const fetchMock = vi.fn();
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'wa-tts-http-')); output = join(root, 'speech.partial');
        vi.stubEnv(fixture.ttsEnv, 'fixture-key-not-for-config');
        fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
    const write = (config = fixture, signal = new AbortController().signal) => new RemoteTtsService().write('Fixed public phrase', resolveTtsConfig(config), output, signal);
    const response = () => new Response(audio, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(audio.length) } });

    it.each([
        ['fish', fixture],
        ['openai', { ...fixture, ttsEndpoint: 'https://api.openai.com/v1/audio/speech', ttsModel: 'gpt-4o-mini-tts', ttsVoice: 'alloy' }],
        ['openrouter', { ...fixture, ttsEndpoint: 'https://openrouter.ai/api/v1/audio/speech', ttsModel: 'fixture/speech-model', ttsVoice: 'fixture-voice' }]
    ] as const)('maps %s exactly, privately streaming raw audio with redirects disabled', async (provider, config) => {
        fetchMock.mockResolvedValueOnce(response());
        await write(config);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(config.ttsEndpoint);
        expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer fixture-key-not-for-config', 'Content-Type': 'application/json' } });
        const body = JSON.parse(options.body);
        if (provider === 'fish') {
            expect(options.headers.model).toBe('s2.1-pro-free');
            expect(body).toEqual({ text: 'Fixed public phrase', format: 'mp3', reference_id: config.ttsVoice, prosody: { speed: 1 } });
            expect(body.model).toBeUndefined();
        } else {
            expect(options.headers.model).toBeUndefined();
            expect(body).toEqual({ model: config.ttsModel, input: 'Fixed public phrase', voice: config.ttsVoice, response_format: 'mp3', speed: 1 });
        }
        expect(await readFile(output)).toEqual(audio);
        expect((await stat(output)).mode & 0o777).toBe(0o600);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it('omits the voice field entirely only after explicit server-default selection', async () => {
        fetchMock.mockResolvedValueOnce(response());
        const config = resolveTtsConfig({ ttsEndpoint: 'http://127.0.0.1:8098/v1/audio/speech', ttsProtocol: 'openai-compatible',
            ttsModel: 'chatterbox', ttsEnv: fixture.ttsEnv, ttsUseServerVoice: true, ttsFormat: 'wav' });
        await new RemoteTtsService().write('Fixed public phrase', config, output, new AbortController().signal);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ model: 'chatterbox', input: 'Fixed public phrase', response_format: 'wav', speed: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(1); expect(await readFile(output)).toEqual(audio);
    });
    it.each([401, 429, 500])('reports only HTTP status %s, never response diagnostics, and never retries', async status => {
        fetchMock.mockResolvedValueOnce(new Response('fixture-sensitive-provider-diagnostic', { status }));
        await expect(write()).rejects.toThrow(`Speech provider HTTP ${status}`);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(await readdir(root)).toEqual([]);
    });
    it('does not contact a service with a missing environment credential', async () => {
        vi.stubEnv(fixture.ttsEnv, undefined);
        await expect(write()).rejects.toThrow('API key unavailable');
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('redacts fetch/redirect errors rather than printing their underlying messages', async () => {
        fetchMock.mockRejectedValueOnce(new Error('fixture-sensitive-fetch-diagnostic'));
        await expect(write()).rejects.toThrow(/^Speech provider request failed$/);
    });
    it.each(['application/json', 'text/html'])('rejects non-audio content %s before creating a file', async type => {
        fetchMock.mockResolvedValueOnce(new Response('fixture-error', { headers: { 'content-type': type } }));
        await expect(write()).rejects.toThrow('non-audio');
        expect(await readdir(root)).toEqual([]);
    });
    it('rejects advertised oversize audio before reading it', async () => {
        fetchMock.mockResolvedValueOnce(new Response(audio, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(TTS_MAX_AUDIO_BYTES + 1) } }));
        await expect(write()).rejects.toThrow('8 MiB');
        expect(await readdir(root)).toEqual([]);
    });
    it('caps chunked audio before writing an oversize chunk and cancels its reader', async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({ start(controller) {
            controller.enqueue(new Uint8Array(5 * 1024 * 1024));
            controller.enqueue(new Uint8Array(4 * 1024 * 1024));
        }, cancel() { cancelled = true; } });
        fetchMock.mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'audio/mpeg' } }));
        await expect(write()).rejects.toThrow('8 MiB');
        expect(cancelled).toBe(true);
        expect((await stat(output)).size).toBeLessThanOrEqual(TTS_MAX_AUDIO_BYTES);
    });
    it.each(['empty', 'incomplete'])('rejects %s audio', async mode => {
        fetchMock.mockResolvedValueOnce(new Response(mode === 'empty' ? Buffer.alloc(0) : audio, {
            headers: { 'content-type': 'audio/mpeg', ...(mode === 'incomplete' ? { 'content-length': '999' } : {}) }
        }));
        await expect(write()).rejects.toThrow(mode);
    });
    it('aborts the actual outstanding request without exposing the external abort reason', async () => {
        const controller = new AbortController();
        let started!: () => void;
        const begin = new Promise<void>(resolve => { started = resolve; });
        fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('fixture-sensitive-abort-reason')), { once: true }); started();
        }));
        const pending = write(fixture, controller.signal);
        await begin; controller.abort('fixture-sensitive-reason');
        await expect(pending).rejects.toThrow(/^Speech synthesis cancelled$/);
        expect(await readdir(root)).toEqual([]);
    });
    it('cancels a stalled response stream and waits for its private file to close', async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(audio); }, cancel() { cancelled = true; } });
        fetchMock.mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'audio/mpeg' } }));
        const controller = new AbortController();
        const pending = write(fixture, controller.signal);
        await vi.waitFor(async () => expect((await stat(output)).size).toBe(audio.length));
        controller.abort();
        await expect(pending).rejects.toThrow('cancelled');
        expect(cancelled).toBe(true);
    });
});
