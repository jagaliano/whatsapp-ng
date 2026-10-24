import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioService } from '../../src/services/audio.service.ts';
import { SessionManager } from '../../src/services/session.manager.ts';
import { getDefaultStorageRoot, createStoragePaths } from '../../src/services/storage-path.ts';
import { getFfmpegCommands } from '../../src/services/ffmpeg-path.ts';

const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('baileys', () => ({
    downloadContentFromMessage: mocks.download,
    useMultiFileAuthState: vi.fn(),
    BufferJSON: { replacer: (_key: string, value: unknown) => value, reviver: (_key: string, value: unknown) => value }
}));

const ffmpeg = getFfmpegCommands().find(command => spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0);

describe.skipIf(!ffmpeg)('remote STT with real FFmpeg and an intercepted upload', () => {
    let root: string;
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'whatsapp-ng-remote-pipeline-'));
        vi.stubEnv('HOME', root);
        vi.stubEnv('USERPROFILE', root);
        vi.stubEnv('FFMPEG_PATH', ffmpeg!);
        vi.stubEnv('WHATSAPP_NG_PIPELINE_STT_KEY', 'pipeline-fixture-not-a-real-key');
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        await rm(root, { recursive: true, force: true });
    });

    it('loads settings, converts a fixture to private WAV, uploads once and cleans only its scratch files', async () => {
        const source = join(root, 'fixture.ogg');
        const generated = spawnSync(ffmpeg!, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.15', '-c:a', 'libopus', source]);
        expect(generated.status, generated.stderr.toString()).toBe(0);
        const ogg = await readFile(source);
        mocks.download.mockResolvedValue((async function* () { yield ogg; })());
        const settings = new SessionManager(getDefaultStorageRoot());
        await settings.ensureInitialized();
        await settings.setSttConfig({
            sttEndpoint: 'https://speech.example.test/openai/v1', sttModel: 'fixture-model', sttEnv: 'WHATSAPP_NG_PIPELINE_STT_KEY'
        });
        const paths = createStoragePaths();
        const log = vi.fn();
        const fetch = vi.fn(async (url, request) => {
            expect(url.toString()).toBe('https://speech.example.test/openai/v1/audio/transcriptions');
            expect(request.headers.Authorization).toBe('Bearer pipeline-fixture-not-a-real-key');
            const file = request.body.get('file') as File;
            const wave = Buffer.from(await file.arrayBuffer());
            expect(wave.subarray(0, 4).toString()).toBe('RIFF');
            expect(wave.subarray(8, 12).toString()).toBe('WAVE');
            expect(file.type).toBe('audio/wav');
            const scratch = (await readdir(paths.mediaDir))[0];
            const directory = join(paths.mediaDir, scratch);
            if (process.platform !== 'win32') {
                expect((await stat(directory)).mode & 0o777).toBe(0o700);
                for (const name of ['input.ogg', 'audio.wav']) expect((await stat(join(directory, name))).mode & 0o777).toBe(0o600);
            }
            return Response.json({ text: 'public synthetic audio fixture' });
        });
        vi.stubGlobal('fetch', fetch);
        const service = new AudioService({ log, error: vi.fn() }, undefined, () => settings.getSttConfig());
        await expect(service.transcribe({})).resolves.toBe('public synthetic audio fixture');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(await readdir(paths.mediaDir)).toEqual([]);
        await expect(access(join(getDefaultStorageRoot(), 'whisper'))).rejects.toThrow();
        expect(JSON.stringify(log.mock.calls)).not.toContain('pipeline-fixture-not-a-real-key');
        expect(await readFile(join(getDefaultStorageRoot(), 'config.json'), 'utf8')).not.toContain('pipeline-fixture-not-a-real-key');
        expect(await readFile(source)).toEqual(ogg);
    });
});
