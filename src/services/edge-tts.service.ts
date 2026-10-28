import { Worker } from 'node:worker_threads';
import { TtsError, TTS_MAX_AUDIO_BYTES, type ResolvedTtsConfig } from './tts-config.js';

/** The unofficial Edge transport is isolated from credentials and owned to termination. */
export class EdgeTtsService {
    async write(text: string, config: Readonly<ResolvedTtsConfig>, output: string, signal: AbortSignal): Promise<void> {
        if (signal.aborted) throw new TtsError('Speech synthesis cancelled');
        let worker: Worker;
        try {
            worker = new Worker(new URL('./edge-tts.worker.mjs', import.meta.url), {
                env: {}, execArgv: [], stdout: true, stderr: true,
                workerData: { text, output, voice: config.voice, locale: config.locale, speed: config.speed, maxBytes: TTS_MAX_AUDIO_BYTES }
            });
        } catch { throw new TtsError('Edge speech client unavailable'); }
        worker.stdout?.resume();
        worker.stderr?.resume();
        await new Promise<void>((resolve, reject) => {
            let settling = false;
            const finish = async (success: boolean) => {
                if (settling) return;
                settling = true;
                signal.removeEventListener('abort', abort);
                try { await worker.terminate(); } catch { success = false; }
                if (success && !signal.aborted) resolve();
                else reject(new TtsError(signal.aborted ? 'Speech synthesis cancelled' : 'Edge speech synthesis failed'));
            };
            const abort = () => { void finish(false); };
            worker.once('message', message => { void finish(message?.ok === true); });
            worker.once('error', () => { void finish(false); });
            worker.once('exit', () => { void finish(false); });
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        });
    }
}
