import { downloadContentFromMessage } from 'baileys';
import { mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { PROCESSING_CEILING_BYTES } from './media-limits.js';
import { TransferSlots, sharedTransferSlots } from './transfer-slots.js';

export type InboundMediaType = 'image' | 'video' | 'document';
export type InterruptReason = 'deadline' | 'cancelled' | 'truncated' | 'sizeMismatch' | 'failed' | 'disk';
export type InboundOutcome =
    | { status: 'stored'; path: string; bytes: number; declared?: number }
    | { status: 'oversize'; limitBytes: number; declared?: number }
    | { status: 'busy' }
    | { status: 'interrupted'; reason: InterruptReason }
    | { status: 'cleanupFailed'; reason: InterruptReason | 'oversize'; leftover: string };

export interface InboundRequest {
    /** Transport media message; only size and download keys are read here. */
    message: Record<string, unknown>;
    type: InboundMediaType;
    /** Captured at admission; later setting changes do not affect this transfer. */
    limitBytes: number;
    directory: string;
    fileName: string;
    isCurrent: () => boolean;
    signal?: AbortSignal;
}

export interface InboundFileSystem {
    mkdir(path: string): Promise<void>;
    openExclusive(path: string): Promise<FileHandle>;
    write(handle: FileHandle, chunk: Buffer, position: number): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    unlink(path: string): Promise<void>;
}

type Download = (message: Record<string, unknown>, type: InboundMediaType) => Promise<AsyncIterable<Buffer> & Partial<Pick<Readable, 'destroy'>>> | (AsyncIterable<Buffer> & Partial<Pick<Readable, 'destroy'>>);

const LARGE_DEADLINE_MS = 600_000;
const SMALL_DEADLINE_MS = 60_000;
const AUTHORITY_POLL_MS = 1_000;

class TransferStop extends Error {
    constructor(readonly outcome: 'oversize' | InterruptReason) { super(outcome); }
}

type TransferStream = AsyncIterable<Buffer> & Partial<Pick<Readable, 'destroy'>>;

/** Mutable state of one transfer: the stop reason wins over later stream errors. */
class TransferRun {
    readonly partial: string;
    readonly finalPath: string;
    stream?: TransferStream;
    handle?: FileHandle;
    created = false;
    stop?: TransferStop;
    private wake?: () => void;

    constructor(readonly request: InboundRequest) {
        this.partial = join(request.directory, `.${request.fileName}.partial`);
        this.finalPath = join(request.directory, request.fileName);
    }

    halt(reason: InterruptReason): void {
        this.stop ??= new TransferStop(reason);
        this.stream?.destroy?.();
        this.wake?.();
    }

    throwIfStopped(): void { if (this.stop) throw this.stop; }

    /** Opening the transport stream can itself stall; a stop rejects the wait and destroys a late stream. */
    async openWithin(open: () => Promise<TransferStream> | TransferStream): Promise<TransferStream> {
        const stalled = new Promise<never>((_resolve, reject) => { this.wake = () => reject(this.stop); });
        stalled.catch(() => {});
        if (this.stop) this.wake?.();
        const opened = Promise.resolve().then(open);
        opened.then(late => { if (this.stop) late.destroy?.(); }, () => {});
        return Promise.race([opened.catch(() => { throw new TransferStop('failed'); }), stalled]);
    }
}

/** Streams one inbound non-audio file to a private partial name and publishes it only when complete and current. */
export class InboundMediaTransfer {
    private readonly slots: TransferSlots;
    private readonly download: Download;
    private readonly fs: InboundFileSystem;

    constructor(dependencies: { slots?: TransferSlots; download?: Download; fs?: InboundFileSystem } = {}) {
        this.slots = dependencies.slots ?? sharedTransferSlots;
        this.download = dependencies.download ?? ((message, type) => downloadContentFromMessage(message as Parameters<typeof downloadContentFromMessage>[0], type));
        this.fs = dependencies.fs ?? InboundMediaTransfer.defaultFileSystem();
    }

    static defaultFileSystem(): InboundFileSystem {
        return {
            mkdir: async path => { await mkdir(path, { recursive: true, mode: 0o700 }); },
            openExclusive: path => open(path, 'wx', 0o600),
            write: async (handle, chunk, position) => {
                let written = 0;
                while (written < chunk.length) {
                    const { bytesWritten } = await handle.write(chunk, written, chunk.length - written, position + written);
                    if (!bytesWritten) throw Object.assign(new Error('Short write'), { code: 'EIO' });
                    written += bytesWritten;
                }
            },
            rename: (from, to) => rename(from, to),
            unlink: path => unlink(path)
        };
    }

    /** Declared size only when it is a usable positive integer; otherwise unknown. */
    static declaredSize(message: Record<string, unknown>): number | undefined {
        const raw = message.fileLength as unknown;
        const value = raw && typeof raw === 'object' && typeof (raw as { toNumber?: unknown }).toNumber === 'function'
            ? (raw as { toNumber(): number }).toNumber() : Number(raw);
        return Number.isSafeInteger(value) && value > 0 ? value : undefined;
    }

    public async run(request: InboundRequest): Promise<InboundOutcome> {
        const declared = InboundMediaTransfer.declaredSize(request.message);
        if (declared !== undefined && declared > request.limitBytes) return { status: 'oversize', limitBytes: request.limitBytes, declared };
        const large = declared === undefined || declared > PROCESSING_CEILING_BYTES;
        const release = large ? this.slots.tryAcquire('inbound') : () => {};
        if (!release) return { status: 'busy' };
        try {
            return await this.transfer(request, declared, large ? LARGE_DEADLINE_MS : SMALL_DEADLINE_MS);
        } finally { release(); }
    }

    private async transfer(request: InboundRequest, declared: number | undefined, deadlineMs: number): Promise<InboundOutcome> {
        const run = new TransferRun(request);
        const timer = setTimeout(() => run.halt('deadline'), deadlineMs);
        // Authority can end while no chunk arrives (stalled stream): poll it so local work stops and capacity is released.
        const watchdog = setInterval(() => { if (!request.isCurrent()) run.halt('cancelled'); }, AUTHORITY_POLL_MS);
        const onAbort = () => run.halt('cancelled');
        request.signal?.addEventListener('abort', onAbort, { once: true });
        if (request.signal?.aborted) onAbort();
        try {
            run.stream = await run.openWithin(() => this.download(request.message, request.type));
            run.throwIfStopped();
            await this.fs.mkdir(request.directory);
            run.handle = await this.fs.openExclusive(run.partial).catch(error => { throw this.fileError(error); });
            run.created = true;
            const received = await this.copy(run, declared);
            await this.publish(run);
            return { status: 'stored', path: run.finalPath, bytes: received, ...(declared === undefined ? {} : { declared }) };
        } catch (error) {
            return this.refuse(run, error instanceof TransferStop ? error.outcome : 'failed', declared);
        } finally {
            clearTimeout(timer);
            clearInterval(watchdog);
            request.signal?.removeEventListener('abort', onAbort);
            run.stream?.destroy?.();
            await run.handle?.close().catch(() => {});
        }
    }

    /** One outstanding write at a time; size, declaration and authority are checked before each write. */
    private async copy(run: TransferRun, declared: number | undefined): Promise<number> {
        const { request } = run;
        let received = 0;
        try {
            for await (const chunk of run.stream!) {
                run.throwIfStopped();
                if (!request.isCurrent()) throw new TransferStop('cancelled');
                const next = received + chunk.length;
                if (declared !== undefined && next > declared) throw new TransferStop('sizeMismatch');
                if (next > request.limitBytes) throw new TransferStop('oversize');
                await this.fs.write(run.handle!, chunk, received).catch(error => { throw this.fileError(error); });
                received = next;
            }
        } catch (error) {
            throw run.stop ?? (error instanceof TransferStop ? error : new TransferStop('failed'));
        }
        run.throwIfStopped();
        if (declared !== undefined && received < declared) throw new TransferStop('truncated');
        return received;
    }

    /** Publication is the final authority check: only a complete, current file gets its final name. */
    private async publish(run: TransferRun): Promise<void> {
        await run.handle!.close().catch(error => { throw this.fileError(error); });
        run.handle = undefined;
        if (!run.request.isCurrent() || run.request.signal?.aborted) throw new TransferStop('cancelled');
        await this.fs.rename(run.partial, run.finalPath).catch(error => { throw this.fileError(error); });
        run.created = false;
    }

    /** Removes the owned partial once; a failed removal is reported, never retried or compensated. */
    private async refuse(run: TransferRun, reason: InterruptReason | 'oversize', declared: number | undefined): Promise<InboundOutcome> {
        const outcome: InboundOutcome = reason === 'oversize'
            ? { status: 'oversize', limitBytes: run.request.limitBytes, ...(declared === undefined ? {} : { declared }) }
            : { status: 'interrupted', reason };
        if (!run.created) return outcome;
        await run.handle?.close().catch(() => {});
        run.handle = undefined;
        try { await this.fs.unlink(run.partial); }
        catch { return { status: 'cleanupFailed', reason, leftover: run.partial }; }
        return outcome;
    }

    private fileError(error: unknown): TransferStop {
        // Any local file-system failure while saving is reported as a disk refusal.
        return error instanceof TransferStop ? error : new TransferStop('disk');
    }
}
