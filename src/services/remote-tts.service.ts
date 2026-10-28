import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { ResolvedTtsConfig } from './tts-config.js';
import { TtsError, TTS_MAX_AUDIO_BYTES } from './tts-config.js';

/** Native HTTP only. Destination consent and request/session lifetime are owned by TtsService. */
export class RemoteTtsService {
    async write(text: string, config: Readonly<ResolvedTtsConfig>, output: string, signal: AbortSignal): Promise<void> {
        let response: Response | undefined;
        try {
            this.check(signal);
            const key = config.env ? process.env[config.env]?.trim() : undefined;
            if (!key || /[\r\n\0]/.test(key)) throw new TtsError('Speech API key unavailable; check the configured environment variable');
            const fish = config.provider === 'fish';
            const body = fish
                ? { text, format: config.format, reference_id: config.voice, prosody: { speed: config.speed } }
                : { model: config.model, input: text, voice: config.voice, response_format: config.format, speed: config.speed };
            const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
            if (fish) headers.model = config.model!;
            response = await fetch(config.endpoint!, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal });
            this.check(signal);
            if (!response.ok) throw new TtsError(`Speech provider HTTP ${response.status}`);
            const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
            if (!type || (!type.startsWith('audio/') && type !== 'application/octet-stream')) throw new TtsError('Speech provider returned non-audio content');
            const length = Number(response.headers.get('content-length'));
            if (!Number.isFinite(length) || length < 0 || length > TTS_MAX_AUDIO_BYTES) throw new TtsError('Speech audio exceeds the 8 MiB limit or has an invalid length');
            if (!response.body) throw new TtsError('Speech provider returned no audio');
            const reader = response.body.getReader();
            const abort = () => { void reader.cancel().catch(() => {}); };
            signal.addEventListener('abort', abort, { once: true });
            let size = 0;
            const check = () => this.check(signal);
            try {
                await pipeline(async function* () {
                    while (true) {
                        check();
                        const { value, done } = await reader.read();
                        check();
                        if (done) break;
                        size += value.byteLength;
                        if (size > TTS_MAX_AUDIO_BYTES) throw new TtsError('Speech audio exceeds the 8 MiB limit');
                        yield value;
                    }
                    if (!size) throw new TtsError('Speech provider returned empty audio');
                    if (length && size !== length) throw new TtsError('Speech provider returned incomplete audio');
                }(), createWriteStream(output, { flags: 'wx', mode: 0o600 }), { signal });
            } finally {
                signal.removeEventListener('abort', abort);
                void reader.cancel().catch(() => {});
                reader.releaseLock();
            }
        } catch (error) {
            void response?.body?.cancel().catch(() => {});
            if (signal.aborted) throw new TtsError('Speech synthesis cancelled');
            if (error instanceof TtsError) throw error;
            // Provider bodies, fetch errors and filesystem errors can contain sensitive data.
            throw new TtsError('Speech provider request failed');
        }
    }

    private check(signal: AbortSignal): void {
        if (signal.aborted) throw new TtsError('Speech synthesis cancelled');
    }
}
