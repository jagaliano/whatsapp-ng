import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetI18n } from '../../src/i18n.ts';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
    downloadContentFromMessage: vi.fn(),
    existsSync: vi.fn(),
    execFile: vi.fn(),
    homedir: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn(),
    chmod: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    createRemote: vi.fn(),
    createLocal: vi.fn()
}));

vi.mock('baileys', () => ({
    downloadContentFromMessage: mocks.downloadContentFromMessage
}));

vi.mock('node:child_process', () => ({
    execFile: mocks.execFile
}));

vi.mock('node:fs', async (importOriginal) => ({
    ...await importOriginal<typeof import('node:fs')>(),
    existsSync: mocks.existsSync
}));

vi.mock('node:os', () => ({
    homedir: mocks.homedir
}));

vi.mock('node:fs/promises', () => ({
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
    mkdtemp: mocks.mkdtemp,
    chmod: mocks.chmod,
    rm: mocks.rm
}));

vi.mock('../../src/services/remote-audio.transcriber.ts', () => ({
    createRemoteAudioTranscriber: mocks.createRemote,
    REMOTE_STT_MAX_BYTES: 25 * 1024 * 1024
}));

vi.mock('../../src/services/whisper-cpp-audio.transcriber.ts', () => ({
    tryCreateWhisperCppAudioTranscriber: mocks.createLocal
}));

const createStream = (...chunks: Buffer[]) => (async function* () {
    for (const chunk of chunks) {
        yield chunk;
    }
})();

const logger = {
    log: vi.fn(),
    error: vi.fn()
};

const whisperTranscriber = {
    transcribe: vi.fn()
};

let AudioService: typeof import('../../src/services/audio.service.ts').AudioService;

const setupService = () => new AudioService(logger as any, whisperTranscriber as any);

describe('AudioService', () => {
    beforeEach(async () => {
        resetI18n();
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        logger.log.mockClear();
        logger.error.mockClear();
        vi.spyOn(Date, 'now').mockReturnValue(1234567890);
        mocks.homedir.mockReturnValue('/home/test');
        mocks.downloadContentFromMessage.mockResolvedValue(createStream(Buffer.from('media')));
        mocks.existsSync.mockReturnValue(true);
        mocks.execFile.mockImplementation((...args: unknown[]) => {
            const callback = args.at(-1) as (error?: Error | null) => void;
            callback(null);
            return undefined;
        });
        whisperTranscriber.transcribe.mockResolvedValue('transcribed text');
        mocks.mkdtemp.mockImplementation(async (prefix: string) => `${prefix}fixture`);
        mocks.createRemote.mockReset().mockReturnValue(null);
        mocks.createLocal.mockReset().mockReturnValue(whisperTranscriber);
        ({ AudioService } = await import('../../src/services/audio.service.ts'));
    });

    it('defers media-directory creation until transcription, after startup migration', async () => {
        const service = setupService();
        expect(mocks.mkdir).not.toHaveBeenCalled();
        await service.transcribe({ id: 'fixture' } as any);
        expect(mocks.mkdir).toHaveBeenCalledWith(join('/home/test', '.pi', 'agent', 'extensions', 'whatsapp-ng', 'whatsapp-medias'), { recursive: true, mode: 0o700 });
    });

    it('returns trimmed transcription text for a successful audio transcription', async () => {
        mocks.downloadContentFromMessage.mockResolvedValue(
            createStream(Buffer.from('part-1'), Buffer.from('part-2'))
        );
        whisperTranscriber.transcribe.mockResolvedValue('  áudio transcrito  \n');

        const service = setupService();
        const audioMessage = { id: 'audio-1' };

        await expect(service.transcribe(audioMessage as any)).resolves.toBe('áudio transcrito');

        const mediaDir = join('/home/test', '.pi', 'agent', 'extensions', 'whatsapp-ng', 'whatsapp-medias');
        const scratchDir = join(mediaDir, 'audio-fixture');
        const inputPath = join(scratchDir, 'input.ogg');
        const wavPath = join(scratchDir, 'audio.wav');

        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith(audioMessage, 'audio');
        expect(mocks.writeFile).toHaveBeenCalledWith(inputPath, Buffer.concat([Buffer.from('part-1'), Buffer.from('part-2')]), { mode: 0o600, flag: 'wx' });
        expect(mocks.execFile).toHaveBeenCalledWith('ffmpeg', ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath], { windowsHide: true, timeout: 60_000, signal: undefined }, expect.any(Function));
        expect(mocks.chmod).toHaveBeenCalledWith(wavPath, 0o600);
        expect(mocks.rm).toHaveBeenCalledWith(scratchDir, { recursive: true, force: true });
        expect(whisperTranscriber.transcribe).toHaveBeenCalledWith(wavPath);
        expect(logger.log).toHaveBeenCalledWith('[WhatsApp-NG] Audio download: 0 ms');
        expect(logger.log).toHaveBeenCalledWith('[WhatsApp-NG] Audio write file: 0 ms');
        expect(logger.log).toHaveBeenCalledWith('[WhatsApp-NG] Audio convert: 0 ms');
        expect(logger.log).toHaveBeenCalledWith('[WhatsApp-NG] Audio whisper: 0 ms');
        expect(logger.log).toHaveBeenCalledWith('[WhatsApp-NG] Audio total: 0 ms');
    });

    it.each(['https', 'http'])('selects remote settings lazily and announces the %s scheme without local fallback', async scheme => {
        const config = { sttEndpoint: `${scheme}://speech.example.test/v1`, sttModel: 'fixture', sttEnv: 'STT_KEY' };
        const remote = { hostname: 'speech.example.test', origin: `${scheme}://speech.example.test`, transcribe: vi.fn().mockResolvedValue('remote text') };
        const getConfig = vi.fn(() => config);
        const service = new AudioService(logger, undefined, getConfig);
        expect(getConfig).not.toHaveBeenCalled();
        expect(mocks.createLocal).not.toHaveBeenCalled();
        mocks.createRemote.mockReturnValue(remote);
        await expect(service.transcribe({})).resolves.toBe('remote text');
        expect(mocks.createRemote).toHaveBeenCalledWith(config);
        expect(mocks.createLocal).not.toHaveBeenCalled();
        expect(whisperTranscriber.transcribe).not.toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`audio will be uploaded to ${scheme}://speech.example.test`));
        expect(mocks.execFile.mock.calls[0][1]).toContain('-fs');
        remote.transcribe.mockRejectedValue(new Error('Remote STT HTTP 401'));
        mocks.downloadContentFromMessage.mockResolvedValue(createStream(Buffer.from('next')));
        await expect(service.transcribe({})).resolves.toContain('Remote STT HTTP 401');
        expect(mocks.createLocal).not.toHaveBeenCalled();
        expect(mocks.rm).toHaveBeenCalledTimes(2);
    });

    it('fails closed on invalid remote settings before local initialization or media download', async () => {
        mocks.createRemote.mockImplementation(() => { throw new Error('Remote STT configuration invalid'); });
        await expect(new AudioService(logger).transcribe({})).resolves.toContain('Remote STT configuration invalid');
        expect(mocks.createLocal).not.toHaveBeenCalled();
        expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
    });

    it('rejects oversized downloads and cleans up without conversion', async () => {
        mocks.downloadContentFromMessage.mockResolvedValue(createStream(Buffer.alloc(25 * 1024 * 1024 + 1)));
        await expect(setupService().transcribe({})).resolves.toContain('25 MiB limit');
        expect(mocks.execFile).not.toHaveBeenCalled();
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.rm).toHaveBeenCalled();
    });

    it('checks account/session ownership again before the remote upload', async () => {
        let current = true;
        const remote = { hostname: 'speech.example.test', origin: 'https://speech.example.test', transcribe: vi.fn() };
        mocks.createRemote.mockReturnValue(remote);
        mocks.execFile.mockImplementation((...args: unknown[]) => {
            current = false;
            (args.at(-1) as (error: null) => void)(null);
        });
        await expect(new AudioService(logger).transcribe({}, { isCurrent: () => current })).resolves.toContain('session changed');
        expect(remote.transcribe).not.toHaveBeenCalled();
        expect(mocks.rm).toHaveBeenCalled();
    });

    it('does not download audio after an explicit cancellation', async () => {
        const controller = new AbortController();
        controller.abort();
        await setupService().transcribe({}, { signal: controller.signal });
        expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
    });

    it('uses separate temporary directories even when timestamps collide', async () => {
        let id = 0;
        mocks.mkdtemp.mockImplementation(async (prefix: string) => `${prefix}${++id}`);
        mocks.downloadContentFromMessage.mockImplementation(async () => createStream(Buffer.from('audio')));
        await Promise.all([setupService().transcribe({}), setupService().transcribe({})]);
        expect(mocks.writeFile.mock.calls[0][0]).not.toBe(mocks.writeFile.mock.calls[1][0]);
        expect(mocks.rm).toHaveBeenCalledTimes(2);
    });

    it('returns fallback when transcription output is empty', async () => {
        whisperTranscriber.transcribe.mockResolvedValue('');

        const service = setupService();

        await expect(service.transcribe({ id: 'audio-2' } as any)).resolves.toBe('[Empty transcription]');
    });

    it('reports backend-neutral setup guidance when no transcriber is available', async () => {
        const service = new AudioService(logger as any, null);
        await expect(service.transcribe({ id: 'unavailable' })).resolves.toBe(
            '[Transcription error: Whisper.cpp unavailable: install whisper-cli on PATH or set WHISPER_CLI_PATH]'
        );
    });

    it('never dumps speech from a failed transcriber error into diagnostics', async () => {
        whisperTranscriber.transcribe.mockRejectedValueOnce(new Error('PRIVATE-C4-SPEECH-STDOUT'));
        await setupService().transcribe({ id: 'synthetic-audio' });
        expect(console.error).toHaveBeenCalledExactlyOnceWith('[AudioService] Transcription error:');
        expect(JSON.stringify(logger.log.mock.calls)).not.toContain('PRIVATE-C4-SPEECH-STDOUT');
    });
    it('returns formatted error when audio download fails', async () => {
        mocks.downloadContentFromMessage.mockRejectedValue(new Error('download failed'));

        const service = setupService();

        await expect(service.transcribe({ id: 'audio-4' } as any)).resolves.toBe(
            '[Transcription error: download failed]'
        );

        expect(console.error).toHaveBeenCalledExactlyOnceWith('[AudioService] Transcription error:');
    });
});
