import { expect, vi } from 'vitest';
import fs, { createReadStream, type ReadStream, type WriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createDecipheriv, createHash } from 'node:crypto';
import { downloadContentFromMessage, encryptedStream, getMediaKeys } from 'baileys';
import { InboundMediaTransfer } from '../../src/services/inbound-media-transfer.ts';
import { OutgoingMediaService } from '../../src/services/outgoing-media.service.ts';
import { TransferSlots } from '../../src/services/transfer-slots.ts';
import { MIB } from '../../src/services/media-limits.ts';
import { encryptedMediaStream, mockMediaFetch, synthMediaMessage, syntheticPlaintext, writeSyntheticFile } from './large-media.ts';

export const SC002_BUDGET = 16 * MIB;

/**
 * SC-002 accounting (research R3). Sums, at every write start and completion:
 *  - class B covered: Readable.fromWeb queue, Baileys decrypt Transform readable+writable queues,
 *    one web-stream queue chunk (highWaterMark 1) and the mock's pull buffer (≤ 2 network chunks),
 *    the decrypt carry (< 16 bytes);
 *  - class A: the app's outstanding write buffer (the live decrypt-output copy being written).
 * Not covered (reported gap): undici's internal body buffering, absent with the mocked fetch.
 * `pulled − written` is asserted separately as a backpressure check only.
 */
export async function measureInbound(size: number, limitBytes: number, dir: string) {
    const mediaKey = Buffer.alloc(32, 9);
    const networkChunk = 64 * 1024;
    const { fetch, stats } = mockMediaFetch({ source: () => encryptedMediaStream(syntheticPlaintext(11, size), mediaKey, 'document'), networkChunk });
    vi.stubGlobal('fetch', fetch);
    const webStreams: Readable[] = [];
    const fromWeb = Readable.fromWeb.bind(Readable);
    vi.spyOn(Readable, 'fromWeb').mockImplementation(((body: Parameters<typeof Readable.fromWeb>[0], options?: Parameters<typeof Readable.fromWeb>[1]) => {
        const stream = fromWeb(body, options); webStreams.push(stream); return stream;
    }) as typeof Readable.fromWeb);
    const concat = vi.spyOn(Buffer, 'concat');
    let output: Readable | undefined;
    // Estimated, not observed: web-stream queue (highWaterMark 1 chunk), mock pull buffer (≤ 2 chunks), decrypt carry (< 16 B).
    const inboundEstimate = networkChunk + 2 * networkChunk + 16;
    let measuredPeak = 0;
    let written = 0; let outstanding = 0; let peak = 0; let peakBackpressure = 0; let largestChunk = 0;
    const sample = () => {
        const web = webStreams[0];
        const decrypt = output as unknown as { readableLength: number; writableLength: number } | undefined;
        const measured = (web?.readableLength ?? 0) + (decrypt?.readableLength ?? 0) + (decrypt?.writableLength ?? 0) + outstanding;
        measuredPeak = Math.max(measuredPeak, measured);
        const total = measured + inboundEstimate;
        peak = Math.max(peak, total);
        peakBackpressure = Math.max(peakBackpressure, stats.pulled - written);
        expect(total).toBeLessThanOrEqual(SC002_BUDGET);
    };
    const fs = InboundMediaTransfer.defaultFileSystem();
    const transfer = new InboundMediaTransfer({
        slots: new TransferSlots(1),
        download: async (message, type) => { output = await downloadContentFromMessage(message as never, type) as Readable; return output; },
        fs: { ...fs, write: async (handle, chunk, position) => {
            largestChunk = Math.max(largestChunk, chunk.length);
            outstanding += chunk.length; sample();
            await fs.write(handle, chunk, position);
            outstanding -= chunk.length; written += chunk.length; sample();
        } }
    });
    const outcome = await transfer.run({ message: synthMediaMessage(undefined, { mediaKey }), type: 'document', limitBytes,
        directory: dir, fileName: 'out.bin', isCurrent: () => true });
    const bigConcat = concat.mock.calls.some(([list]) => (list as Buffer[]).reduce((n, b) => n + b.length, 0) >= MIB);
    return { outcome, peak, measuredPeak, inboundEstimate, peakBackpressure, largestChunk, bigConcat, output, web: webStreams[0], stats };
}



/**
 * SC-002 outbound accounting (research R3), Tier 2: app snapshot copy, then real Baileys
 * `encryptedStream`, then an injected slow upload consumer reading the encrypted file.
 *  - snapshot stage: Buffer allocations made by the app during prepare (one 64 KiB copy buffer);
 *  - encrypt stage: source ReadStream queue + encrypted WriteStream queue + live cipher output copy;
 *  - upload stage: encrypted ReadStream queue + consumer-held chunk.
 * Not covered (reported gap): `https.request`/socket writable buffering in Baileys' Node upload.
 */
/**
 * Estimated, not observed: the plaintext chunk held by Baileys' loop (≤ 64 KiB ReadStream highWaterMark)
 * plus its in-flight cipher output (≤ 64 KiB + 16). Upload stage uses a mock consumer; https.request is uncovered.
 */
const ENCRYPT_ESTIMATE_BYTES = 2 * 64 * 1024 + 16;
export async function measureOutbound(size: number, dir: string) {
    const source = join(dir, 'drawing.bin');
    await writeSyntheticFile(source, 23, size);

    const allocations: number[] = [];
    const alloc = Buffer.alloc.bind(Buffer);
    const allocSpy = vi.spyOn(Buffer, 'alloc').mockImplementation(((n: number, ...rest: unknown[]) => { allocations.push(n); return (alloc as (...a: unknown[]) => Buffer)(n, ...rest); }) as typeof Buffer.alloc);
    const prepared = await new OutgoingMediaService({ workspaceRoot: dir, maxBytes: 512 * MIB }).prepare({ path: source, type: 'document' });
    allocSpy.mockRestore();
    const snapshotStage = allocations.reduce((sum, n) => sum + n, 0);

    // Passive observation only: no 'data' listener or extra iterator, so Baileys consumes the stream as in production.
    const writeStreams: WriteStream[] = [];
    let encryptPeakMeasured = 0; let samples = 0;
    const input: ReadStream = createReadStream((prepared.content as { document: { url: string } }).document.url);
    const sampleEncrypt = () => {
        samples++;
        const measured = input.readableLength + writeStreams.reduce((sum, stream) => sum + stream.writableLength, 0);
        encryptPeakMeasured = Math.max(encryptPeakMeasured, measured);
        expect(measured + ENCRYPT_ESTIMATE_BYTES).toBeLessThanOrEqual(SC002_BUDGET);
    };
    const originalCreateWriteStream = fs.createWriteStream;
    fs.createWriteStream = ((...args: Parameters<typeof fs.createWriteStream>) => {
        const stream = originalCreateWriteStream(...args); writeStreams.push(stream);
        const write = stream.write.bind(stream) as (...a: unknown[]) => boolean;
        (stream as unknown as { write: (...a: unknown[]) => boolean }).write = (...a: unknown[]) => { const ok = write(...a); sampleEncrypt(); return ok; };
        stream.on('drain', sampleEncrypt);
        return stream;
    }) as typeof fs.createWriteStream;
    syncBuiltinESMExports();
    let encrypted;
    try {
        encrypted = await encryptedStream({ stream: input }, 'document');
    } finally {
        fs.createWriteStream = originalCreateWriteStream;
        syncBuiltinESMExports();
    }
    expect(input.bytesRead).toBe(size);
    expect(writeStreams.length, 'Baileys encrypted WriteStream must be instrumented').toBeGreaterThanOrEqual(1);
    expect(samples).toBeGreaterThan(size / (64 * 1024) / 2);

    // Upload stage: slow consumer of the encrypted file; also decrypts to prove byte identity.
    const { cipherKey, iv } = await getMediaKeys(encrypted.mediaKey, 'document');
    const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv);
    const hash = createHash('sha256');
    const upload = createReadStream(encrypted.encFilePath);
    const encryptedSize = size + 16 - (size % 16) + 10;
    let consumed = 0; let uploadPeakMeasured = 0;
    for await (const chunk of upload) {
        sampleUpload(chunk.length);
        await new Promise(resolve => setImmediate(resolve));
        const end = Math.min(chunk.length, encryptedSize - 10 - consumed);
        if (end > 0) hash.update(decipher.update(chunk.subarray(0, end)));
        consumed += chunk.length;
    }
    hash.update(decipher.final());
    function sampleUpload(held: number) { const total = upload.readableLength + held; uploadPeakMeasured = Math.max(uploadPeakMeasured, total); expect(total).toBeLessThanOrEqual(SC002_BUDGET); }
    await unlink(encrypted.encFilePath);
    await prepared.dispose();
    return { snapshotStage, encryptPeakMeasured, encryptEstimate: ENCRYPT_ESTIMATE_BYTES, uploadPeakMeasured, samples,
        largestAlloc: Math.max(0, ...allocations), hash: hash.digest('hex') };
}
