import { downloadContentFromMessage } from 'baileys';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, mkdtemp, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getFfmpegCommands } from './ffmpeg-path.js';
import { createStoragePaths } from './storage-path.js';
import { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import { tryCreateWhisperCppAudioTranscriber, type AudioTranscriber } from './whisper-cpp-audio.transcriber.js';
import { t } from '../i18n.js';
import { createRemoteAudioTranscriber, REMOTE_STT_MAX_BYTES } from './remote-audio.transcriber.js';
import type { AudioTranscriptionOptions, SttConfig } from './audio-transcriber.js';

const execFileAsync = promisify(execFile);

type AudioLogger = Pick<WhatsAppNgLogger, 'log' | 'error'>;
type AudioPhase = 'download' | 'write' | 'convert' | 'whisper' | 'remote' | 'total';

export class AudioService {
    private readonly mediaDir = createStoragePaths().mediaDir;
    private readonly logger: AudioLogger;
    private whisperCppTranscriber: AudioTranscriber | null | undefined;
    private readonly ffmpegCommands = getFfmpegCommands();

    constructor(
        logger: AudioLogger = new WhatsAppNgLogger(false),
        whisperCppTranscriber?: AudioTranscriber | null,
        private readonly getSttConfig: () => SttConfig = () => ({})
    ) {
        this.logger = logger;
        // Select only after settings load. Remote mode never initializes local Whisper.
        this.whisperCppTranscriber = whisperCppTranscriber;
    }

    async transcribe(audioMessage: any, options?: AudioTranscriptionOptions): Promise<string> {
        const totalStart = Date.now();
        let scratchDir: string | undefined;
        const checkCurrent = () => {
            options?.signal?.throwIfAborted();
            if (options?.isCurrent && !options.isCurrent()) throw new Error('Audio transcription session changed');
        };
        try {
            checkCurrent();
            const remote = createRemoteAudioTranscriber(this.getSttConfig());
            if (!remote && this.whisperCppTranscriber === undefined) {
                this.whisperCppTranscriber = tryCreateWhisperCppAudioTranscriber(this.logger);
            }
            const transcriber = remote ?? this.whisperCppTranscriber;
            if (!transcriber) throw new Error('Whisper.cpp unavailable: install whisper-cli on PATH or set WHISPER_CLI_PATH');
            if (remote) this.logger.log(t('audio.remoteNotice', { host: remote.hostname }));
            await mkdir(this.mediaDir, { recursive: true, mode: 0o700 });
            scratchDir = await mkdtemp(join(this.mediaDir, 'audio-'));
            const inputPath = join(scratchDir, 'input.ogg');
            const wavPath = join(scratchDir, 'audio.wav');

            const buffer = await this.measurePhase('download', async () => {
                const stream = await downloadContentFromMessage(audioMessage, 'audio');
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of stream) {
                    checkCurrent();
                    size += chunk.length;
                    if (size > REMOTE_STT_MAX_BYTES) throw new Error('Audio download exceeds the 25 MiB limit');
                    chunks.push(chunk);
                }
                return Buffer.concat(chunks, size);
            });
            checkCurrent();
            await this.measurePhase('write', async () => {
                await writeFile(inputPath, buffer, { mode: 0o600, flag: 'wx' });
            });
            checkCurrent();
            await this.measurePhase('convert', async () => {
                await this.convertToWav(inputPath, wavPath, options, Boolean(remote));
                await chmod(wavPath, 0o600);
            });
            checkCurrent();
            return await this.measurePhase(remote ? 'remote' : 'whisper', async () => {
                const transcription = options ? await transcriber.transcribe(wavPath, options) : await transcriber.transcribe(wavPath);
                checkCurrent();
                const text = String(transcription ?? '').trim();
                return text || t('audio.emptyTranscription');
            });
        } catch (error) {
            console.error(t('audio.transcriptionError'), error);
            return t('audio.transcriptionErrorResult', { error: error instanceof Error ? error.message : String(error) });
        } finally {
            if (scratchDir) {
                try { await rm(scratchDir, { recursive: true, force: true }); }
                catch { this.logger.error('[WhatsApp-NG] Audio temporary-file cleanup failed'); }
            }
            this.logger.log(t('audio.phaseTiming', { phase: t('audio.phase.total'), duration: Date.now() - totalStart }));
        }
    }

    private async measurePhase<T>(phase: Exclude<AudioPhase, 'total'>, action: () => Promise<T>): Promise<T> {
        const start = Date.now();

        try {
            return await action();
        } finally {
            this.logger.log(t('audio.phaseTiming', { phase: this.getPhaseLabel(phase), duration: Date.now() - start }));
        }
    }

    private getPhaseLabel(phase: Exclude<AudioPhase, 'total'>): string {
        switch (phase) {
            case 'download':
                return t('audio.phase.download');
            case 'write':
                return t('audio.phase.write');
            case 'convert':
                return t('audio.phase.convert');
            case 'whisper':
                return t('audio.phase.whisper');
            case 'remote':
                return t('audio.phase.remote');
        }
    }

    private async convertToWav(inputPath: string, outputPath: string, options?: AudioTranscriptionOptions, remote = false): Promise<void> {
        const args = ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
            ...(remote ? ['-fs', String(REMOTE_STT_MAX_BYTES + 1)] : []), outputPath];
        let lastError: unknown;

        for (const command of this.ffmpegCommands) {
            try {
                await execFileAsync(command, args, { windowsHide: true, timeout: 60_000, signal: options?.signal });
                return;
            } catch (error) {
                lastError = error;
                if (!this.isMissingFfmpegCommand(error)) {
                    throw error;
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error('ffmpeg unavailable');
    }

    private isMissingFfmpegCommand(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const anyError = error as Error & { code?: number | string; stderr?: string };
        const message = `${anyError.message}\n${anyError.stderr ?? ''}`;

        return anyError.code === 'ENOENT'
            || anyError.code === 127
            || anyError.code === 9009
            || /not found|not recognized/i.test(message);
    }
}
