import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { createRemoteAudioTranscriber } from '../../src/services/remote-audio.transcriber.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { RemoteTtsService } from '../../src/services/remote-tts.service.ts';

it('uses real loopback HTTP with the existing STT/TTS wire contracts and synthetic credentials only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wa-speech-http-')); const requests: Array<{ url: string; body: string; auth?: string }> = [];
    const audio = Buffer.from('RIFF-SYNTHETIC-NOT-A-RECORDING');
    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
        requests.push({ url: request.url!, body: Buffer.concat(chunks).toString(), auth: request.headers.authorization });
        if (request.url === '/v1/audio/transcriptions') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ text: 'synthetic transcript' })); }
        else { response.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length }); response.end(audio); }
    });
    try {
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', ''); vi.stubEnv('LOCAL_SPEECH_FIXTURE_KEY', 'synthetic-local-only');
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected fixture TCP address');
        const base = `http://127.0.0.1:${address.port}/v1`; const input = join(root, 'input.wav'); await writeFile(input, audio);
        await expect(createRemoteAudioTranscriber({ sttEndpoint: base, sttModel: 'fixture', sttEnv: 'LOCAL_SPEECH_FIXTURE_KEY', sttLanguage: 'es' })!.transcribe(input)).resolves.toBe('synthetic transcript');
        const output = join(root, 'output.wav'); await new RemoteTtsService().write('public fixture', resolveTtsConfig({ ttsEndpoint: `${base}/audio/speech`, ttsModel: 'fixture', ttsEnv: 'LOCAL_SPEECH_FIXTURE_KEY', ttsVoice: 'fixture', ttsFormat: 'wav' }), output, AbortSignal.timeout(5000));
        expect(requests.map(request => request.url)).toEqual(['/v1/audio/transcriptions', '/v1/audio/speech']); expect(requests.every(request => request.auth === 'Bearer synthetic-local-only')).toBe(true);
        expect(requests[0].body).toContain('name="language"\r\n\r\nes');
        expect(JSON.parse(requests[1].body)).toEqual({ model: 'fixture', input: 'public fixture', voice: 'fixture', response_format: 'wav', speed: 1 });
        expect(await readFile(output)).toEqual(audio);
    } finally {
        server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true });
    }
});
