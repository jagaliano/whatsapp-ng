import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { InboundMediaTransfer, type InboundRequest } from '../../src/services/inbound-media-transfer.ts';
import { TransferSlots } from '../../src/services/transfer-slots.ts';
import { MIB } from '../../src/services/media-limits.ts';
import { hashFile, hashStream, syntheticPlaintext } from '../fixtures/large-media.ts';

/** A size-only stream that reuses one zero buffer, so 512 MiB cases retain no content. */
function zeroStream(size: number, chunk = 4 * MIB): Readable {
    const block = Buffer.alloc(chunk);
    let sent = 0;
    return new Readable({ highWaterMark: 1, objectMode: false, read() {
        if (sent >= size) { this.push(null); return; }
        const n = Math.min(chunk, size - sent); sent += n; this.push(n === chunk ? block : block.subarray(0, n));
    } });
}
function chunksStream(chunks: Buffer[]): Readable { return Readable.from(chunks, { objectMode: false }); }

describe('InboundMediaTransfer', () => {
    let dir: string;
    let slots: TransferSlots;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-inbound-')); slots = new TransferSlots(1); });
    afterEach(async () => { vi.useRealTimers(); await rm(dir, { recursive: true, force: true }); });

    const request = (overrides: Partial<InboundRequest> = {}): InboundRequest => ({
        message: {}, type: 'document', limitBytes: 25 * MIB, directory: dir, fileName: 'final.bin', isCurrent: () => true, ...overrides
    });
    const files = async () => (await readdir(dir)).sort();

    it.each([1, 25])('accepts exactly %i MiB and refuses one byte more', async mib => {
        const ok = await new InboundMediaTransfer({ slots, download: async () => zeroStream(mib * MIB) }).run(request({ limitBytes: mib * MIB, message: { fileLength: mib * MIB } }));
        expect(ok).toMatchObject({ status: 'stored', bytes: mib * MIB });
        expect((await stat(join(dir, 'final.bin'))).size).toBe(mib * MIB);
        await rm(join(dir, 'final.bin'));
        const over = await new InboundMediaTransfer({ slots, download: async () => zeroStream(mib * MIB + 1) }).run(request({ limitBytes: mib * MIB }));
        expect(over).toMatchObject({ status: 'oversize' });
        expect(await files()).toEqual([]);
    });

    it('accepts exactly 512 MiB with absent declaration and refuses one byte more', async () => {
        const ok = await new InboundMediaTransfer({ slots, download: async () => zeroStream(512 * MIB) }).run(request({ limitBytes: 512 * MIB }));
        expect(ok).toMatchObject({ status: 'stored', bytes: 512 * MIB });
        await rm(join(dir, 'final.bin'));
        const over = await new InboundMediaTransfer({ slots, download: async () => zeroStream(512 * MIB + 1) }).run(request({ limitBytes: 512 * MIB }));
        expect(over.status).toBe('oversize');
        expect(await files()).toEqual([]);
    }, 120_000);

    it('refuses a known oversized declaration before downloading', async () => {
        const download = vi.fn();
        const outcome = await new InboundMediaTransfer({ slots, download }).run(request({ message: { fileLength: 25 * MIB + 1 } }));
        expect(outcome).toMatchObject({ status: 'oversize', declared: 25 * MIB + 1 });
        expect(download).not.toHaveBeenCalled();
    });

    it('stops at the first byte past an understated declaration, even mid-chunk', async () => {
        const outcome = await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(8), Buffer.alloc(8)]) })
            .run(request({ message: { fileLength: 10 } }));
        expect(outcome).toEqual({ status: 'interrupted', reason: 'sizeMismatch' });
        expect(await files()).toEqual([]);
    });

    it('reports a short (overstated) transfer as truncated, not received', async () => {
        const outcome = await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(5)]) })
            .run(request({ message: { fileLength: 10 } }));
        expect(outcome).toEqual({ status: 'interrupted', reason: 'truncated' });
        expect(await files()).toEqual([]);
    });

    it('refuses a chunk crossing the limit before writing it', async () => {
        const outcome = await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(MIB - 1), Buffer.alloc(2)]) })
            .run(request({ limitBytes: MIB }));
        expect(outcome.status).toBe('oversize');
        expect(await files()).toEqual([]);
    });

    it('stores byte-identical content with private permissions and the given name', async () => {
        const source = () => Readable.from(syntheticPlaintext(7, 3 * MIB + 17));
        const outcome = await new InboundMediaTransfer({ slots, download: async () => source() }).run(request());
        expect(outcome).toMatchObject({ status: 'stored', bytes: 3 * MIB + 17, path: join(dir, 'final.bin') });
        expect((await hashFile(join(dir, 'final.bin'))).hash).toBe(await hashStream(syntheticPlaintext(7, 3 * MIB + 17)));
        expect((await stat(join(dir, 'final.bin'))).mode & 0o777).toBe(0o600);
        expect((await stat(dir)).mode & 0o777).toBe(0o700);
    });

    it('treats unknown size as large: takes the slot and the 10-minute deadline', async () => {
        const held = slots.tryAcquire('inbound')!;
        const busy = await new InboundMediaTransfer({ slots, download: vi.fn() }).run(request());
        expect(busy).toEqual({ status: 'busy' });
        const small = await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(4)]) }).run(request({ message: { fileLength: 4 } }));
        expect(small.status).toBe('stored');
        held();
        const timers: number[] = [];
        const spy = vi.spyOn(globalThis, 'setTimeout');
        await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(4)]) }).run(request({ fileName: 'b' }));
        await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(4)]) }).run(request({ fileName: 'c', message: { fileLength: 4 } }));
        for (const call of spy.mock.calls) if (typeof call[1] === 'number' && call[1] >= 60_000) timers.push(call[1]);
        expect(timers).toEqual([600_000, 60_000]);
        spy.mockRestore();
        expect(slots.held('inbound')).toBe(0);
    });

    it('interrupts on deadline and removes the partial file', async () => {
        vi.useFakeTimers();
        const stream = new Readable({ read() {} });
        const run = new InboundMediaTransfer({ slots, download: async () => stream }).run(request({ message: { fileLength: 100 } }));
        await vi.advanceTimersByTimeAsync(10);
        stream.push(Buffer.alloc(10));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(await run).toEqual({ status: 'interrupted', reason: 'deadline' });
        expect(stream.destroyed).toBe(true);
        expect(await files()).toEqual([]);
    });

    it('completes a slow but progressing large transfer within its deadline', async () => {
        vi.useFakeTimers();
        const stream = new Readable({ read() {} });
        const run = new InboundMediaTransfer({ slots, download: async () => stream }).run(request());
        for (let i = 0; i < 9; i++) { await vi.advanceTimersByTimeAsync(60_000); stream.push(Buffer.alloc(1024)); }
        stream.push(null);
        await vi.advanceTimersByTimeAsync(1);
        expect(await run).toMatchObject({ status: 'stored', bytes: 9 * 1024 });
    });

    it.each(['signal', 'authority'] as const)('interrupts on %s loss mid-stream and before publication', async mode => {
        const controller = new AbortController();
        let current = true;
        const stream = new Readable({ read() {} });
        const run = new InboundMediaTransfer({ slots, download: async () => stream }).run(request({ signal: controller.signal, isCurrent: () => current }));
        stream.push(Buffer.alloc(10));
        await new Promise(resolve => setTimeout(resolve, 5));
        if (mode === 'signal') controller.abort(); else current = false;
        stream.push(Buffer.alloc(10));
        expect(await run).toEqual({ status: 'interrupted', reason: 'cancelled' });
        expect(await files()).toEqual([]);
        let calls = 0;
        const beforePublish = await new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(3)]) })
            .run(request({ isCurrent: () => ++calls < 2 }));
        expect(beforePublish).toEqual({ status: 'interrupted', reason: 'cancelled' });
        expect(await files()).toEqual([]);
    });

    it('reports disk failures and leaves no partial file', async () => {
        const fs = InboundMediaTransfer.defaultFileSystem();
        const transfer = new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(10)]), fs: { ...fs,
            write: async () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }); } } });
        expect(await transfer.run(request())).toEqual({ status: 'interrupted', reason: 'disk' });
        expect(await files()).toEqual([]);
    });

    it('reports a download failure as failed', async () => {
        const outcome = await new InboundMediaTransfer({ slots, download: async () => { throw new Error('network'); } }).run(request());
        expect(outcome).toEqual({ status: 'interrupted', reason: 'failed' });
    });

    it('reports cleanup failure with the leftover path and never as received', async () => {
        const fs = InboundMediaTransfer.defaultFileSystem();
        const unlink = vi.fn(async () => { throw new Error('EPERM'); });
        const transfer = new InboundMediaTransfer({ slots, download: async () => chunksStream([Buffer.alloc(8), Buffer.alloc(8)]), fs: { ...fs, unlink } });
        const outcome = await transfer.run(request({ message: { fileLength: 10 } }));
        expect(outcome).toEqual({ status: 'cleanupFailed', reason: 'sizeMismatch', leftover: join(dir, '.final.bin.partial') });
        expect(unlink).toHaveBeenCalledOnce();
        expect(slots.held('inbound')).toBe(0);
    });

    it('never exposes an incomplete file under the final name', async () => {
        const stream = new Readable({ read() {} });
        const run = new InboundMediaTransfer({ slots, download: async () => stream }).run(request());
        stream.push(Buffer.alloc(10));
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(await files()).toEqual(['.final.bin.partial']);
        stream.push(null);
        await run;
        expect(await files()).toEqual(['final.bin']);
    });
});

describe('InboundMediaTransfer stalled authority loss (review fix)', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-inbound-stall-')); });
    afterEach(async () => { vi.useRealTimers(); await rm(dir, { recursive: true, force: true }); });
    it.each(['opened', 'opening'] as const)('stops a stalled (%s) download and releases the slot when authority ends, without another chunk', async phase => {
        vi.useFakeTimers();
        const slots = new TransferSlots(1);
        let current = true; let polls = 0;
        const stream = new Readable({ read() {} });
        const download = phase === 'opened' ? async () => stream : () => new Promise<Readable>(() => {});
        const run = new InboundMediaTransfer({ slots, download }).run({ message: {}, type: 'document', limitBytes: 25 * MIB, directory: dir, fileName: 'x', isCurrent: () => { polls++; return current; } });
        if (phase === 'opened') {
            await vi.advanceTimersByTimeAsync(5); stream.push(Buffer.alloc(10));
            await vi.waitFor(() => expect(polls).toBeGreaterThan(0)); // the chunk was consumed while current
        }
        await vi.advanceTimersByTimeAsync(50);
        expect(slots.held('inbound')).toBe(1);
        current = false; // no further chunk arrives
        await vi.advanceTimersByTimeAsync(2_000);
        expect(await run).toEqual({ status: 'interrupted', reason: 'cancelled' });
        expect(slots.held('inbound')).toBe(0);
        if (phase === 'opened') expect(stream.destroyed).toBe(true);
        expect(await readdir(dir)).toEqual([]);
    });
});
