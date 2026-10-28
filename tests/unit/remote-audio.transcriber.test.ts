import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, open, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRemoteAudioTranscriber, REMOTE_STT_MAX_BYTES } from '../../src/services/remote-audio.transcriber.ts';

const config = {
    sttEndpoint: 'https://speech.example.test/openai/v1/',
    sttModel: 'fixture-speech-model',
    sttEnv: 'WHATSAPP_NG_TEST_STT_KEY'
};

describe('OpenAI-compatible remote audio transcription', () => {
    let root: string;
    let audio: string;
    const fetchMock = vi.fn();

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'whatsapp-ng-stt-'));
        audio = join(root, 'audio.wav');
        await writeFile(audio, Buffer.from('RIFF-fixture-WAVE'), { mode: 0o600 });
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '');
        vi.stubEnv(config.sttEnv, 'fixture-key-not-a-real-credential');
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockReset().mockResolvedValue(Response.json({ text: '  transcribed speech  ' }));
    });

    afterEach(async () => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        await rm(root, { recursive: true, force: true });
    });

    it('leaves local STT selected only when all settings are absent or empty', () => {
        expect(createRemoteAudioTranscriber({})).toBeNull();
        expect(createRemoteAudioTranscriber({ sttEndpoint: '', sttModel: '', sttEnv: '' })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        { sttEndpoint: config.sttEndpoint },
        { ...config, sttEnv: '' },
        { ...config, sttModel: 123 },
        { ...config, sttEnv: 'not an env variable' },
        { ...config, sttEndpoint: 'http://speech.example.test/v1' },
        { ...config, sttEndpoint: 'https://user:password@speech.example.test/v1' },
        { ...config, sttEndpoint: 'https://speech.example.test/v1?key=not-a-real-key' },
        { ...config, sttEndpoint: 'https://speech.example.test/v1#fragment' }
    ])('fails closed on malformed/partial remote settings %#', invalid => {
        expect(() => createRemoteAudioTranscriber(invalid as any)).toThrow(/Remote STT configuration/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        ['https://api.groq.com/openai/v1/', 'whisper-large-v3-turbo'],
        ['https://api.openai.com/v1', 'whisper-1'],
        ['https://api.mistral.ai/v1', 'fixture-voxtral-model'],
        ['https://custom.example.test/api/v1', 'another-model']
    ])('uses the configured endpoint/model without provider-specific credentials: %s', async (base, model) => {
        const transcriber = createRemoteAudioTranscriber({ ...config, sttEndpoint: base, sttModel: model })!;
        await expect(transcriber.transcribe(audio)).resolves.toBe('transcribed speech');
        const [url, request] = fetchMock.mock.calls[0];
        expect(url.toString()).toBe(`${base.replace(/\/$/, '')}/audio/transcriptions`);
        expect(request.method).toBe('POST');
        expect(request.redirect).toBe('error');
        expect(request.headers).toEqual({ Authorization: 'Bearer fixture-key-not-a-real-credential' });
        expect(request.body).toBeInstanceOf(FormData);
        expect(request.body.get('model')).toBe(model);
        expect(request.body.get('response_format')).toBe('json');
        const file = request.body.get('file') as File;
        expect(file.name).toBe('audio.wav');
        expect(file.type).toBe('audio/wav');
        expect(Buffer.from(await file.arrayBuffer())).toEqual(Buffer.from('RIFF-fixture-WAVE'));
    });

    it.each(['http://127.0.0.1:8096/v1', 'http://127.0.0.2/v1', 'http://[::1]:8096/v1', 'http://localhost:8096/v1'])('accepts loopback HTTP without changing multipart/auth/redirect rules: %s', async sttEndpoint => {
        const transcriber = createRemoteAudioTranscriber({ ...config, sttEndpoint })!; await transcriber.transcribe(audio);
        expect(fetchMock.mock.calls[0][0].toString()).toBe(sttEndpoint + '/audio/transcriptions');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer fixture-key-not-a-real-credential' } });
        expect(transcriber.hostname).toBe(new URL(sttEndpoint).host);
    });
    it('allows LAN HTTP only with the exact opt-in and still rejects credentials/query/fragment', () => {
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); expect(createRemoteAudioTranscriber({ ...config, sttEndpoint: 'http://192.168.1.20/v1' })).not.toBeNull();
        for (const sttEndpoint of ['http://user:pass@127.0.0.1/v1', 'http://127.0.0.1/v1?q=x', 'http://127.0.0.1/v1#x', 'ftp://127.0.0.1/v1']) expect(() => createRemoteAudioTranscriber({ ...config, sttEndpoint })).toThrow(/Remote STT configuration/);
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', 'true'); expect(() => createRemoteAudioTranscriber({ ...config, sttEndpoint: 'http://192.168.1.20/v1' })).toThrow();
    });
    it.each([undefined, 'auto', 'es', 'pt-BR'])('sends only an explicit remote language, treating auto as protocol omission (%s)', async sttLanguage => {
        await createRemoteAudioTranscriber({ ...config, sttLanguage } as any)!.transcribe(audio);
        expect(fetchMock.mock.calls[0][1].body.get('language')).toBe(!sttLanguage || sttLanguage === 'auto' ? null : sttLanguage);
    });
    it.each(['english', 'en_US', 'es\r\nheader', 42])('rejects invalid language before local-mode early exit: %s', sttLanguage => {
        expect(() => createRemoteAudioTranscriber({ sttLanguage } as any)).toThrow(/Remote STT configuration/);
        expect(() => createRemoteAudioTranscriber({ ...config, sttLanguage } as any)).toThrow(/Remote STT configuration/);
    });
    it('resolves only sttEnv, at request time, without falling back to other keys', async () => {
        const transcriber = createRemoteAudioTranscriber(config)!;
        vi.stubEnv(config.sttEnv, '');
        vi.stubEnv('OPENAI_API_KEY', 'unrelated-fixture-key');
        vi.stubEnv('GROQ_API_KEY', 'another-unrelated-fixture-key');
        await expect(transcriber.transcribe(audio)).rejects.toThrow('Remote STT API key unavailable; check sttEnv');
        expect(fetchMock).not.toHaveBeenCalled();
        vi.stubEnv(config.sttEnv, 'rotated-fixture-key');
        await transcriber.transcribe(audio);
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer rotated-fixture-key');
    });

    it('rejects oversized files and symlinks before sending', async () => {
        const handle = await open(audio, 'r+');
        await handle.truncate(REMOTE_STT_MAX_BYTES + 1);
        await handle.close();
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/audio.*limit/);
        const link = join(root, 'link.wav');
        await symlink(audio, link);
        await expect(createRemoteAudioTranscriber(config)!.transcribe(link)).rejects.toThrow(/Remote STT/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('redacts HTTP error bodies and does not retry', async () => {
        fetchMock.mockResolvedValue(new Response('fixture-key-not-a-real-credential provider details', { status: 401 }));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/^Remote STT HTTP 401$/);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('redacts transport errors and rejects redirect responses', async () => {
        fetchMock.mockRejectedValueOnce(new Error('fixture-key-not-a-real-credential https://private.example.test'));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/^Remote STT request failed$/);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://other.example.test' } }));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/^Remote STT HTTP 302$/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each(['not json', '{"text":123}', 'null'])('rejects invalid response shapes without echoing them: %s', async body => {
        fetchMock.mockResolvedValue(new Response(body));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/^Remote STT invalid response$/);
    });

    it('bounds response bytes and cancels the remaining body', async () => {
        const cancel = vi.fn();
        fetchMock.mockResolvedValue(new Response(new ReadableStream({
            start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel
        })));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/response.*limit/);
        expect(cancel).toHaveBeenCalled();
    });

    it('preserves an empty transcription for the existing empty-text fallback', async () => {
        fetchMock.mockResolvedValue(Response.json({ text: '  ' }));
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).resolves.toBe('');
    });

    it('does not upload when the session became stale during preparation', async () => {
        await expect(createRemoteAudioTranscriber(config)!.transcribe(audio, { isCurrent: () => false })).rejects.toThrow(/cancelled/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('aborts an in-flight request on cancellation', async () => {
        const controller = new AbortController();
        fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }));
        const pending = createRemoteAudioTranscriber(config)!.transcribe(audio, { signal: controller.signal });
        const checked = expect(pending).rejects.toThrow(/cancelled/);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        controller.abort();
        await checked;
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    });

    it('aborts when a session/account generation changes during the request', async () => {
        let current = true;
        fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }));
        const pending = createRemoteAudioTranscriber(config)!.transcribe(audio, { isCurrent: () => current });
        const checked = expect(pending).rejects.toThrow(/cancelled/);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        current = false;
        await checked;
    });

    it('uses a bounded request timeout and redacts its error', async () => {
        const deadline = new AbortController();
        const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
        fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }));
        const checked = expect(createRemoteAudioTranscriber(config)!.transcribe(audio)).rejects.toThrow(/timed out/);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(timeout).toHaveBeenCalledWith(60_000);
        deadline.abort(new DOMException('fixture deadline', 'TimeoutError'));
        await checked;
    });
});
