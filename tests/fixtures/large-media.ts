import { createCipheriv, createHash, randomBytes, type Hash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { getMediaKeys } from 'baileys';

/** Deterministic synthetic bytes, generated chunk by chunk; never materializes the whole file. */
export function syntheticChunk(seed: number, offset: number, length: number): Buffer {
    const chunk = Buffer.allocUnsafe(length);
    let state = (seed ^ Math.floor(offset / 4096)) >>> 0 || 1;
    for (let index = 0; index < length; index++) {
        if ((offset + index) % 4096 === 0) state = (seed ^ ((offset + index) / 4096)) >>> 0 || 1;
        state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0;
        chunk[index] = state & 0xff;
    }
    return chunk;
}

export async function* syntheticPlaintext(seed: number, size: number, chunkSize = 64 * 1024): AsyncGenerator<Buffer> {
    for (let offset = 0; offset < size; offset += chunkSize) yield syntheticChunk(seed, offset, Math.min(chunkSize, size - offset));
}

export async function hashStream(chunks: AsyncIterable<Buffer>): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of chunks) hash.update(chunk);
    return hash.digest('hex');
}

export async function hashFile(path: string, chunkSize = 1024 * 1024): Promise<{ hash: string; size: number }> {
    const file = await open(path, 'r');
    const hash: Hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(chunkSize);
    let size = 0;
    try {
        while (true) {
            const { bytesRead } = await file.read(buffer, 0, buffer.length, size);
            if (!bytesRead) break;
            hash.update(buffer.subarray(0, bytesRead));
            size += bytesRead;
        }
    } finally { await file.close(); }
    return { hash: hash.digest('hex'), size };
}

/** Writes a synthetic file incrementally. */
export async function writeSyntheticFile(path: string, seed: number, size: number): Promise<void> {
    const file = await open(path, 'wx', 0o600);
    try {
        let offset = 0;
        for await (const chunk of syntheticPlaintext(seed, size, 1024 * 1024)) {
            await file.write(chunk, 0, chunk.length, offset);
            offset += chunk.length;
        }
    } finally { await file.close(); }
}

/** Baileys-compatible ciphertext stream: AES-256-CBC(PKCS7) followed by a 10-byte trailer. */
export async function* encryptedMediaStream(plaintext: AsyncIterable<Buffer>, mediaKey: Buffer, type: 'image' | 'video' | 'document'): AsyncGenerator<Buffer> {
    const { cipherKey, iv } = await getMediaKeys(mediaKey, type);
    const cipher = createCipheriv('aes-256-cbc', cipherKey, iv);
    for await (const chunk of plaintext) {
        const out = cipher.update(chunk);
        if (out.length) yield out;
    }
    yield cipher.final();
    yield Buffer.alloc(10);
}

export interface FetchStats { pulled: number; enqueuedUnread: () => number; cancelled: boolean; calls: number }

export interface MockFetchOptions {
    /** Async source of network bytes. */
    source: () => AsyncIterable<Buffer>;
    /** Re-chunk network bytes to this size. */
    networkChunk?: number;
    delayMs?: number;
}

/** A pull-based Response body that reports how many network bytes were consumed. */
export function mockMediaFetch(options: MockFetchOptions): { fetch: typeof fetch; stats: FetchStats } {
    const stats: FetchStats = { pulled: 0, enqueuedUnread: () => 0, cancelled: false, calls: 0 };
    const fetchMock = (async () => {
        stats.calls++;
        const iterator = options.source()[Symbol.asyncIterator]();
        let pending: Buffer = Buffer.alloc(0);
        const size = options.networkChunk ?? 16 * 1024;
        const body = new ReadableStream<Uint8Array>({
            async pull(controller) {
                while (pending.length < size) {
                    const next = await iterator.next();
                    if (next.done) break;
                    pending = pending.length ? Buffer.concat([pending, next.value]) : next.value;
                }
                if (!pending.length) { controller.close(); return; }
                if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
                const out = pending.subarray(0, size);
                pending = pending.subarray(out.length);
                stats.pulled += out.length;
                controller.enqueue(new Uint8Array(out));
            },
            cancel() { stats.cancelled = true; }
        }, { highWaterMark: 1 });
        return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    return { fetch: fetchMock, stats };
}

export function synthMediaMessage(declared: number | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { mediaKey: randomBytes(32), directPath: '/synthetic/path', url: 'https://mmg.whatsapp.net/synthetic',
        ...(declared === undefined ? {} : { fileLength: declared }), ...extra };
}
