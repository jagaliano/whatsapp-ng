import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { AudioTranscriber, AudioTranscriptionOptions, SttConfig } from './audio-transcriber.js';
import { allowsPlainHttp } from './endpoint-policy.js';

export const REMOTE_STT_MAX_BYTES = 25 * 1024 * 1024;
const RESPONSE_MAX_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;

// Only controlled messages may cross into logs or the agent's conversation.
class RemoteSttError extends Error {}

export function createRemoteAudioTranscriber(config: SttConfig): RemoteAudioTranscriber | null {
    const { sttEndpoint, sttModel, sttEnv, sttLanguage } = config;
    const invalid = () => new RemoteSttError('Remote STT configuration requires HTTPS, or HTTP on loopback / with WHATSAPP_NG_ALLOW_PLAIN_HTTP=1, a model, sttEnv name and optional language code or auto');
    if (sttLanguage !== undefined && sttLanguage !== '' && (typeof sttLanguage !== 'string'
        || (sttLanguage !== 'auto' && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(sttLanguage)))) throw invalid();
    if ([sttEndpoint, sttModel, sttEnv].every(value => value === undefined || value === '')) return null;
    if (typeof sttEndpoint !== 'string' || typeof sttModel !== 'string' || typeof sttEnv !== 'string'
        || !sttModel.trim() || sttModel.length > 256 || /[\r\n\0]/.test(sttModel)
        || sttEndpoint.length > 2048 || sttEnv.length > 128 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(sttEnv)) throw invalid();
    let endpoint: URL;
    try { endpoint = new URL(sttEndpoint); } catch { throw invalid(); }
    if (!allowsPlainHttp(endpoint) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw invalid();
    endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/audio/transcriptions`;
    return new RemoteAudioTranscriber(endpoint, sttModel.trim(), sttEnv, sttLanguage === 'auto' ? undefined : sttLanguage);
}

class RemoteAudioTranscriber implements AudioTranscriber {
    readonly hostname: string;
    readonly origin: string;

    constructor(private readonly endpoint: URL, private readonly model: string, private readonly env: string, private readonly language?: string) {
        this.hostname = endpoint.host;
        this.origin = endpoint.origin;
    }

    async transcribe(inputPath: string, options: AudioTranscriptionOptions = {}): Promise<string> {
        const controller = new AbortController();
        const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const signal = AbortSignal.any([controller.signal, deadline, ...(options.signal ? [options.signal] : [])]);
        const cancelStale = () => {
            try { if (options.isCurrent && !options.isCurrent()) controller.abort(); }
            catch { controller.abort(); }
        };
        const checkCurrent = () => { cancelStale(); signal.throwIfAborted(); };
        const monitor = options.isCurrent ? setInterval(cancelStale, 100) : undefined;
        monitor?.unref();
        try {
            checkCurrent();
            const key = process.env[this.env]?.trim();
            if (!key || /[\r\n]/.test(key)) throw new RemoteSttError('Remote STT API key unavailable; check sttEnv');
            const bytes = await this.readAudio(inputPath);
            checkCurrent();
            const body = new FormData();
            body.set('file', new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), 'audio.wav');
            body.set('model', this.model);
            body.set('response_format', 'json');
            if (this.language) body.set('language', this.language);
            const response = await fetch(this.endpoint, {
                method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${key}` }, body, signal
            });
            checkCurrent();
            if (!response.ok) {
                void response.body?.cancel().catch(() => {});
                throw new RemoteSttError(`Remote STT HTTP ${response.status}`);
            }
            const text = await this.readResponse(response, checkCurrent);
            checkCurrent();
            let result: unknown;
            try { result = JSON.parse(text); } catch { throw new RemoteSttError('Remote STT invalid response'); }
            if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string') {
                throw new RemoteSttError('Remote STT invalid response');
            }
            return result.text.trim();
        } catch (error) {
            if (deadline.aborted) throw new RemoteSttError('Remote STT timed out');
            if (signal.aborted) throw new RemoteSttError('Remote STT cancelled');
            if (error instanceof RemoteSttError) throw error;
            // Fetch, filesystem and parser exceptions can contain URLs, headers or provider bodies.
            throw new RemoteSttError('Remote STT request failed');
        } finally {
            if (monitor) clearInterval(monitor);
            controller.abort();
        }
    }

    private async readAudio(inputPath: string): Promise<Buffer> {
        const handle = await open(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
            const stat = await handle.stat();
            if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > REMOTE_STT_MAX_BYTES) {
                throw new RemoteSttError('Remote STT audio exceeds the 25 MiB limit or is not a nonempty regular file');
            }
            // Bound allocation/read even if a file grows after stat; never follow a substituted leaf symlink/FIFO.
            const bytes = Buffer.alloc(stat.size + 1);
            let offset = 0;
            while (offset < bytes.length) {
                const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
                if (!bytesRead) break;
                offset += bytesRead;
            }
            const after = await handle.stat();
            if (offset !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) {
                throw new RemoteSttError('Remote STT audio changed during preparation');
            }
            return bytes.subarray(0, offset);
        } finally { await handle.close(); }
    }

    private async readResponse(response: Response, checkCurrent: () => void): Promise<string> {
        const length = Number(response.headers.get('content-length'));
        if (length > RESPONSE_MAX_BYTES) {
            void response.body?.cancel().catch(() => {});
            throw new RemoteSttError('Remote STT response exceeds the 1 MiB limit');
        }
        if (!response.body) throw new RemoteSttError('Remote STT invalid response');
        const reader = response.body.getReader();
        const chunks: Buffer[] = [];
        let size = 0;
        try {
            while (true) {
                checkCurrent();
                const { value, done } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > RESPONSE_MAX_BYTES) throw new RemoteSttError('Remote STT response exceeds the 1 MiB limit');
                chunks.push(Buffer.from(value));
            }
            return Buffer.concat(chunks, size).toString('utf8');
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
    }
}
