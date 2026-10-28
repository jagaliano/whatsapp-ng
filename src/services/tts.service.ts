import { mkdir, mkdtemp, lstat, realpath, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createStoragePaths } from './storage-path.js';
import { OutgoingMediaService, type PreparedOutgoingMedia } from './outgoing-media.service.js';
import { EdgeTtsService } from './edge-tts.service.js';
import { RemoteTtsService } from './remote-tts.service.js';
import { EDGE_TTS_ENDPOINT, resolveTtsConfig, TtsError, TTS_MAX_AUDIO_BYTES, TTS_MAX_CHARACTERS, TTS_MAX_PENDING, TTS_SYNTHESIS_TIMEOUT_MS,
    type ResolvedTtsConfig, type TtsConfig } from './tts-config.js';

export interface TtsSynthesisOptions {
    signal?: AbortSignal;
    isCurrent?: () => boolean;
    /** Must come from the caller's trusted destination-consent state, not a model tool parameter. */
    approvedDestinationKey?: string;
}
export interface PreparedSpeech extends PreparedOutgoingMedia {
    speech: { provider: ResolvedTtsConfig['provider']; destination: string };
}
interface ServiceOptions {
    workspaceRoot: string;
    mediaRoot?: string;
    synthesisTimeoutMs?: number;
    ffmpegCommands?: readonly string[];
}
interface SpeechJob {
    text: string;
    config: Readonly<ResolvedTtsConfig>;
    options: TtsSynthesisOptions;
    controller: AbortController;
    signal: AbortSignal;
    started: boolean;
    timedOut: boolean;
    timer?: ReturnType<typeof setTimeout>;
    monitor?: ReturnType<typeof setInterval>;
    abort: () => void;
    resolve: (value: PreparedSpeech) => void;
    reject: (error: Error) => void;
    work?: Promise<PreparedSpeech>;
}

/** Bounded synthesis/preparation only. It never sends messages or enables a reply mode. */
export class TtsService {
    private readonly waiting: SpeechJob[] = [];
    private active?: SpeechJob;
    private closed = false;
    private readonly mediaRoot: string;
    private readonly timeoutMs: number;

    constructor(private readonly options: ServiceOptions) {
        this.mediaRoot = options.mediaRoot ?? createStoragePaths().mediaDir;
        this.timeoutMs = options.synthesisTimeoutMs ?? TTS_SYNTHESIS_TIMEOUT_MS;
        if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > TTS_SYNTHESIS_TIMEOUT_MS) throw new TtsError('Invalid speech deadline');
    }

    prepare(text: string, config: TtsConfig, options: TtsSynthesisOptions = {}): Promise<PreparedSpeech> {
        let selected: Readonly<ResolvedTtsConfig>;
        try {
            if (this.closed) throw new TtsError('Speech service is closed');
            if (typeof text !== 'string' || text.length > TTS_MAX_CHARACTERS * 2 || !text.trim() || [...text].length > TTS_MAX_CHARACTERS) throw new TtsError('Speech text must contain 1–2000 characters');
            selected = resolveTtsConfig(config);
            if (options.approvedDestinationKey !== selected.destinationKey) throw new TtsError('Speech destination requires explicit consent');
            if (options.signal?.aborted || !this.current(options)) throw new TtsError('Speech synthesis cancelled');
            if (this.active && this.waiting.length >= TTS_MAX_PENDING) throw new TtsError('Speech queue is full');
        } catch (error) { return Promise.reject(error); }
        return new Promise<PreparedSpeech>((resolve, reject) => {
            const controller = new AbortController();
            const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
            const job: SpeechJob = { text, config: selected, options: { ...options }, controller, signal,
                started: false, timedOut: false, abort: () => {}, resolve, reject };
            job.abort = () => {
                if (job.started) return; // active work settles only after its client/process has stopped
                const index = this.waiting.indexOf(job);
                if (index >= 0) this.waiting.splice(index, 1);
                this.cleanup(job);
                reject(this.cancelled(job));
            };
            signal.addEventListener('abort', job.abort, { once: true });
            // Queue waiting consumes the synthesis budget; cancelled slots are removed immediately.
            job.timer = setTimeout(() => { job.timedOut = true; controller.abort(); }, this.timeoutMs);
            job.timer.unref();
            if (options.isCurrent) {
                job.monitor = setInterval(() => { if (!this.current(job.options)) controller.abort(); }, 100);
                job.monitor.unref();
            }
            this.waiting.push(job);
            if (signal.aborted) job.abort();
            this.pump();
        });
    }

    async close(): Promise<void> {
        this.closed = true;
        this.active?.controller.abort();
        for (const job of [...this.waiting]) job.controller.abort();
        await this.active?.work?.catch(() => {});
    }

    private pump(): void {
        if (this.active || this.closed) return;
        const job = this.waiting.shift();
        if (!job) return;
        this.active = job;
        job.started = true;
        job.work = this.run(job);
        void job.work.then(job.resolve, job.reject).finally(() => {
            this.cleanup(job);
            this.active = undefined;
            this.pump();
        });
    }

    private async run(job: SpeechJob): Promise<PreparedSpeech> {
        let directory: string | undefined;
        let prepared: PreparedOutgoingMedia | undefined;
        try {
            this.check(job);
            await mkdir(this.mediaRoot, { recursive: true, mode: 0o700 });
            if ((await lstat(this.mediaRoot)).isSymbolicLink()) throw new TtsError('Invalid speech storage directory');
            const root = await realpath(this.mediaRoot);
            directory = await mkdtemp(join(root, 'tts-'));
            const output = join(directory, `speech.${job.config.format}`);
            const partial = output + '.partial';
            this.check(job);
            if (job.config.provider === 'edge') await new EdgeTtsService().write(job.text, job.config, partial, job.signal);
            else await new RemoteTtsService().write(job.text, job.config, partial, job.signal);
            this.check(job);
            clearTimeout(job.timer);
            await rename(partial, output);
            // Existing media preparation probes real codecs and owns the complete
            // Ogg/Opus snapshot; a playable header alone is not validation.
            prepared = await new OutgoingMediaService({ workspaceRoot: this.options.workspaceRoot, mediaRoot: root,
                maxBytes: TTS_MAX_AUDIO_BYTES, ffmpegCommands: this.options.ffmpegCommands }).prepare({ path: output, type: 'audio', voiceNote: true }, job.signal);
            this.check(job);
            await rm(directory, { recursive: true, force: true });
            directory = undefined;
            this.check(job);
            return { ...prepared, speech: { provider: job.config.provider,
                destination: new URL(job.config.endpoint ?? EDGE_TTS_ENDPOINT).host } };
        } catch (error) {
            await prepared?.dispose();
            if (job.signal.aborted) throw this.cancelled(job);
            if (error instanceof TtsError) throw error;
            throw new TtsError('Speech preparation failed');
        } finally {
            if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
        }
    }

    private check(job: SpeechJob): void {
        if (!this.current(job.options)) job.controller.abort();
        if (job.signal.aborted) throw this.cancelled(job);
    }
    private current(options: TtsSynthesisOptions): boolean {
        try { return options.isCurrent ? options.isCurrent() : true; }
        catch { return false; }
    }
    private cancelled(job: SpeechJob): TtsError {
        return new TtsError(job.timedOut ? 'Speech synthesis timed out' : 'Speech synthesis cancelled');
    }
    private cleanup(job: SpeechJob): void {
        clearTimeout(job.timer);
        if (job.monitor) clearInterval(job.monitor);
        job.signal.removeEventListener('abort', job.abort);
    }
}
