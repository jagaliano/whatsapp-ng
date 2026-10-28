import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TtsService, type PreparedSpeech } from '../../src/services/tts.service.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { getFfmpegCommands } from '../../src/services/ffmpeg-path.ts';

const run = promisify(execFile);
const ffmpeg = getFfmpegCommands().find(command => spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0);
const config = { ttsEndpoint: 'https://api.openai.com/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'WHATSAPP_NG_TEST_TTS_KEY', ttsVoice: 'alloy', ttsFormat: 'wav' as const };
describe.skipIf(!ffmpeg)('speech uses the existing real FFmpeg/Opus preparation', () => {
    let root: string;
    let wave: Buffer;
    const services: TtsService[] = [];
    const artifacts: PreparedSpeech[] = [];
    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'wa-speech-codec-'));
        const path = join(root, 'fixture.wav');
        await run(ffmpeg!, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.15', '-c:a', 'pcm_s16le', path]);
        wave = await readFile(path);
    });
    afterEach(async () => {
        await Promise.all(services.splice(0).map(service => service.close()));
        await Promise.all(artifacts.splice(0).map(artifact => artifact.dispose()));
        vi.unstubAllGlobals(); vi.unstubAllEnvs();
    });
    afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });
    const prepare = async (bytes: Buffer) => {
        vi.stubEnv(config.ttsEnv, 'fixture-key-not-for-config');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'audio/wav' } })));
        const service = new TtsService({ workspaceRoot: root, mediaRoot: join(root, 'media'), ffmpegCommands: [ffmpeg!] });
        services.push(service);
        const result = await service.prepare('Fixed public phrase', config, { approvedDestinationKey: resolveTtsConfig(config).destinationKey });
        artifacts.push(result); return result;
    };
    it('produces a private valid Ogg/Opus PTT snapshot and cleans raw intermediates', async () => {
        const result = await prepare(wave);
        expect(result.content).toMatchObject({ ptt: true, mimetype: 'audio/ogg; codecs=opus' });
        expect(result.metadata).toMatchObject({ type: 'audio', voiceNote: true, converted: true });
        const path = (result.content as { audio: { url: string } }).audio.url;
        expect((await readFile(path)).subarray(0, 4).toString()).toBe('OggS');
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        expect(await readdir(join(root, 'media'))).toEqual([]);
        await result.dispose(); await expect(access(path)).rejects.toThrow();
    });
    it.each(['not audio', 'RIFF0000WAVEincomplete', 'ID3incomplete'])('rejects malformed/truncated audio (%s), not just an audio MIME or header', async data => {
        await expect(prepare(Buffer.from(data))).rejects.toThrow('Speech preparation failed');
        expect(await readdir(join(root, 'media'))).toEqual([]);
    });
});
