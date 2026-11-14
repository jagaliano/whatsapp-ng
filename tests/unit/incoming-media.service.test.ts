import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IncomingMediaService, type InboundMediaContext } from '../../src/services/incoming-media.service.ts';
import { InboundMediaTransfer } from '../../src/services/inbound-media-transfer.ts';
import { TransferSlots } from '../../src/services/transfer-slots.ts';
import { MIB } from '../../src/services/media-limits.ts';
import type { AudioService } from '../../src/services/audio.service.ts';

const mocks = vi.hoisted(() => ({
    downloadContentFromMessage: vi.fn(),
    pdfParse: vi.fn(),
    pdfClose: vi.fn(),
    pdfConstructor: vi.fn()
}));

vi.mock('baileys', () => ({
    downloadContentFromMessage: mocks.downloadContentFromMessage
}));

vi.mock('@llamaindex/liteparse', () => ({
    LiteParse: vi.fn(function () {
        mocks.pdfConstructor();
        return { parse: mocks.pdfParse, close: mocks.pdfClose };
    })
}));

const streamFrom = async function* (chunks: Buffer[]) {
    for (const chunk of chunks) {
        yield chunk;
    }
};
const zeros = async function* (size: number, chunk = 4 * MIB) {
    const block = Buffer.alloc(chunk);
    for (let sent = 0; sent < size; sent += chunk) yield size - sent >= chunk ? block : block.subarray(0, size - sent);
};
let root: string;
let mediaDir: string;
let documentDir: string;
const make = (logger?: unknown) => new IncomingMediaService(audioService as any, logger as any, new InboundMediaTransfer({ slots: new TransferSlots(1) }), mediaDir);
const context = (overrides: Partial<InboundMediaContext> = {}): InboundMediaContext => ({ limits: { inboundBytes: 25 * MIB, outboundBytes: 25 * MIB }, isCurrent: () => true, ...overrides });

const audioService = { transcribe: vi.fn() };

describe('IncomingMediaService', () => {

    afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'wa-incoming-'));
        mediaDir = join(root, 'whatsapp-medias');
        documentDir = join(root, '.pi-data', 'whatsapp', 'documents');
        vi.spyOn(process, 'cwd').mockReturnValue(root);
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        audioService.transcribe.mockResolvedValue('audio text');
        mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.from('media')]));
        mocks.pdfParse.mockResolvedValue({ text: 'PDF body text' });
        mocks.pdfConstructor.mockReset();
        vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    it.each(['audio', 'image', 'video', 'document'])('keeps incoming %s names, captions and speech out of log messages', async kind => {
        const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const service = make(logger);
        audioService.transcribe.mockResolvedValue('PRIVATE-C4-SPEECH');
        const data = { fileName: 'PRIVATE-C4-FILENAME.pdf', mimetype: 'application/pdf', caption: 'PRIVATE-C4-CAPTION' };
        await service.process({ kind, text: 'PRIVATE-C4-CAPTION', [`${kind}Message`]: data } as any, 'PRIVATE-C4-NAME');
        expect(JSON.stringify(logger.log.mock.calls)).not.toContain('PRIVATE-C4-');
    });
    it('passes through non-media resolved content', async () => {
        const service = make();

        await expect(service.process({ kind: 'text', text: 'hello' }, 'Ana')).resolves.toEqual({
            text: 'hello'
        });
    });

    it('transcribes audio messages', async () => {
        const service = make();
        const audioMessage = { seconds: 2 };

        await expect(service.process({ kind: 'audio', text: '[Audio Message]', audioMessage }, 'Ana')).resolves.toEqual({
            text: '[Transcribed Audio]: audio text'
        });

        expect(audioService.transcribe).toHaveBeenCalledWith(audioMessage);
        expect(console.log).not.toHaveBeenCalled();
    });

    it('forwards cancellation and session ownership to audio transcription', async () => {
        const options = { signal: new AbortController().signal, isCurrent: () => true };
        const audioMessage = { seconds: 2 };
        await make().process({ kind: 'audio', text: '[Audio Message]', audioMessage }, 'Ana', options);
        expect(audioService.transcribe).toHaveBeenCalledWith(audioMessage, options);
    });

    it('downloads images and normalizes image/jpg MIME type', async () => {
        const result = await make().process({ kind: 'image', text: 'caption', imageMessage: { mimetype: 'image/jpg; charset=utf-8' } }, 'Ana');
        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith({ mimetype: 'image/jpg; charset=utf-8' }, 'image');
        expect(result).toEqual({ text: 'caption', imageBuffer: Buffer.from('media'), imageMimeType: 'image/jpeg' });
    });

    it('downloads videos to the WhatsApp media directory', async () => {
        const result = await make().process({ kind: 'video', text: '[Video]', videoMessage: { mimetype: 'video/mp4' } }, 'Ana');
        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith({ mimetype: 'video/mp4' }, 'video');
        const [file] = await readdir(mediaDir);
        expect(file).toMatch(/^video_1234567890_[a-f0-9-]+\.mp4$/);
        expect(await readFile(join(mediaDir, file))).toEqual(Buffer.from('media'));
        expect((await stat(mediaDir)).mode & 0o777).toBe(0o700);
        expect((await stat(join(mediaDir, file))).mode & 0o777).toBe(0o600);
        expect(result.text).toBe(`[Video]\n[Video saved: ${join(mediaDir, file)}]`);
    });

    it.each(['image', 'video', 'document'] as const)('bounds streamed %s downloads, closes the stream and saves nothing', async kind => {
        let closed = false;
        mocks.downloadContentFromMessage.mockResolvedValue((async function* () {
            try { yield Buffer.alloc(25 * 1024 * 1024); yield Buffer.from('too large'); }
            finally { closed = true; }
        })());
        const message = { fileName: 'oversize.pdf' };
        const result = await make().process({ kind, text: '', [`${kind}Message`]: message } as any, 'Ana');
        expect(result.text).toContain('exceeds the inbound limit of 25 MiB');
        expect(closed).toBe(true);
        expect(await readdir(kind === 'document' ? documentDir : mediaDir)).toEqual([]);
        expect(mocks.pdfParse).not.toHaveBeenCalled();
    });

    it('rejects declared oversized media before opening a download', async () => {
        await make().process({ kind: 'image', text: '', imageMessage: { fileLength: 25 * 1024 * 1024 + 1 } }, 'Ana');
        expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
    });

    it('accepts exactly 25 MiB without concatenating transfer chunks', async () => {
        mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.alloc(25 * 1024 * 1024 - 1), Buffer.from('x')]));
        const concat = vi.spyOn(Buffer, 'concat');
        const result = await make().process({ kind: 'image', text: '', imageMessage: {} }, 'Ana');
        expect(result.imageBuffer?.length).toBe(25 * 1024 * 1024);
        expect(concat).not.toHaveBeenCalled();
    });

    it('creates private, exclusive, collision-resistant saved files', async () => {
        const service = make();
        await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'same.txt' } }, 'Ana');
        mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.from('media')]));
        await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'same.txt' } }, 'Ana');
        const files = await readdir(documentDir);
        expect(files).toHaveLength(2);
        expect(files[0]).not.toBe(files[1]);
        for (const file of files) expect((await stat(join(documentDir, file))).mode & 0o777).toBe(0o600);
        expect((await stat(documentDir)).mode & 0o777).toBe(0o700);
    });

    it('does not allow MIME-derived path separators in saved filenames', async () => {
        await make().process({ kind: 'video', text: '', videoMessage: { mimetype: 'video/mp4\\\\..\\\\secret' } }, 'Ana');
        const [file] = await readdir(mediaDir);
        expect(file).toMatch(/^video_[0-9]+_[a-f0-9-]+\.[a-z0-9]+$/i);
    });

    it('returns a readable fallback when image download fails', async () => {
        const service = new IncomingMediaService(audioService as any);
        mocks.downloadContentFromMessage.mockRejectedValue(new Error('download failed'));

        await expect(service.process({
            kind: 'image',
            text: '[Image]',
            imageMessage: {}
        }, 'Ana')).resolves.toEqual({
            text: '[Image (download failed)]'
        });
    });

    it('saves pdf documents and includes bounded extracted text preview', async () => {
        const longText = `First line\n${'A'.repeat(1800)}`;
        mocks.pdfParse.mockResolvedValueOnce({ text: longText });
        const result = await make().process({ kind: 'document', text: '[Document]',
            documentMessage: { fileName: 'contract.pdf', mimetype: 'application/pdf', fileLength: 5, caption: 'Read this' } }, 'Ana');
        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'contract.pdf' }), 'document');
        const [file] = await readdir(documentDir);
        expect(file).toMatch(/^1234567890_[a-f0-9-]+_contract\.pdf$/);
        expect(await readFile(join(documentDir, file))).toEqual(Buffer.from('media'));
        expect(mocks.pdfParse).toHaveBeenCalledWith(Buffer.from('media'));
        expect(result.text).toContain('[Document Received: contract.pdf]');
        expect(result.text).toContain('MIME Type: application/pdf');
        expect(result.text).toContain('Size: 0.0 KB');
        expect(result.text).toContain('PDF text preview:');
        expect(result.text).toContain('First line');
        expect(result.text).toContain('Description: Read this');
        expect(result.text).not.toContain('A'.repeat(1300));
    });

    it('keeps declared-size receipt text for small documents', async () => {
        mocks.downloadContentFromMessage.mockResolvedValue(zeros(2 * MIB));
        const result = await make().process({ kind: 'document', text: '', documentMessage: { fileName: 'a.txt', mimetype: 'text/plain', fileLength: 2 * MIB } }, 'Ana');
        expect(result.text).toContain('Size: 2.0 MB');
    });

    it('falls back gracefully when pdf parsing fails', async () => {
        const service = new IncomingMediaService(audioService as any);
        mocks.pdfParse.mockRejectedValueOnce(new Error('bad pdf'));

        const result = await service.process({
            kind: 'document',
            text: '[Document]',
            documentMessage: {
                fileName: 'scanned.pdf',
                mimetype: 'application/pdf',
                fileLength: 5
            }
        }, 'Ana');

        expect(result.text).toContain('[Document Received: scanned.pdf]');
        expect(result.text).toMatch(/Location: \.\/\.pi-data\/whatsapp\/documents\/1234567890_[a-f0-9-]+_scanned\.pdf/);
        expect(result.text).toContain('PDF text was not extracted automatically. The file is saved at the path above.');
        expect(result.text).not.toContain('PDF text preview:');
    });

    it('does not initialize native PDF resources for non-PDF traffic', async () => {
        const service = new IncomingMediaService(audioService as unknown as AudioService);
        await service.process({ kind: 'text', text: 'hello' }, 'Ana');
        expect(mocks.pdfConstructor).not.toHaveBeenCalled();
    });

    it('preserves the saved document when native PDF initialization fails', async () => {
        mocks.pdfConstructor.mockImplementationOnce(() => { throw new Error('native module unavailable'); });
        const service = new IncomingMediaService(audioService as unknown as AudioService);
        const result = await service.process({
            kind: 'document', text: '[Document]',
            documentMessage: { fileName: 'scan.pdf', mimetype: 'application/pdf' }
        }, 'Ana');
        expect(result.text).toContain('[Document Received: scan.pdf]');
        expect(result.text).toContain('PDF text was not extracted automatically.');
    });

    it.each([false, true])('closes native PDF resources after parsing (failure=%s)', async (failure) => {
        if (failure) mocks.pdfParse.mockRejectedValueOnce(new Error('bad pdf'));
        const service = new IncomingMediaService(audioService as unknown as AudioService);
        await service.process({
            kind: 'document', text: '[Document]',
            documentMessage: { fileName: 'scan.pdf', mimetype: 'application/pdf' }
        }, 'Ana');
        expect(mocks.pdfClose).toHaveBeenCalledOnce();
    });

    it('keeps non-pdf document behavior unchanged', async () => {
        const service = new IncomingMediaService(audioService as any);

        const result = await service.process({
            kind: 'document',
            text: '[Document]',
            documentMessage: {
                fileName: 'notes.txt',
                mimetype: 'text/plain',
                fileLength: 5
            }
        }, 'Ana');

        expect(mocks.pdfParse).not.toHaveBeenCalled();
        expect(result.text).toContain('[Document Received: notes.txt]');
        expect(result.text).not.toContain('PDF text preview:');
        expect(result.text).not.toContain('PDF text was not extracted automatically.');
    });

    describe('configurable inbound limit and 25 MiB processing ceiling', () => {
        it.each(['image', 'document'] as const)('stores a 40 MiB %s without automatic processing', async kind => {
            mocks.downloadContentFromMessage.mockResolvedValue(zeros(40 * MIB));
            const message = kind === 'image' ? { mimetype: 'image/png' } : { fileName: 'plan.pdf', mimetype: 'application/pdf', caption: 'Drawing' };
            const read = vi.spyOn(Buffer, 'from');
            const result = await make().process({ kind, text: kind === 'image' ? 'Look' : '[Document]', [`${kind}Message`]: message } as any, 'Ana',
                undefined, context({ limits: { inboundBytes: 512 * MIB, outboundBytes: 25 * MIB } }));
            expect(result.imageBuffer).toBeUndefined();
            expect(mocks.pdfParse).not.toHaveBeenCalled();
            expect(mocks.pdfConstructor).not.toHaveBeenCalled();
            expect(result.text).toContain('Automatic processing skipped');
            expect(result.text).toContain('Size: 40.0 MiB (41943040 bytes)');
            expect(result.text).toContain(kind === 'image' ? 'Caption: Look' : 'Caption: Drawing');
            expect(result.text).toMatch(kind === 'image' ? /Saved to: .*whatsapp-medias/ : /Saved to: \.\/\.pi-data\/whatsapp\/documents\//);
            expect(read.mock.calls.some(([value]) => typeof value === 'string' && value.length > MIB)).toBe(false);
        });

        it('stores large videos with the large receipt', async () => {
            mocks.downloadContentFromMessage.mockResolvedValue(zeros(30 * MIB));
            const result = await make().process({ kind: 'video', text: '[Video]', videoMessage: { mimetype: 'video/mp4' } }, 'Ana',
                undefined, context({ limits: { inboundBytes: 100 * MIB, outboundBytes: 25 * MIB } }));
            expect(result.text).toContain('[Video received: -]');
            expect(result.text).toContain('Automatic processing skipped');
        });

        it('keeps existing processing for an unknown-size file that finishes at or below 25 MiB', async () => {
            mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.from('media')]));
            const result = await make().process({ kind: 'document', text: '', documentMessage: { fileName: 'x.pdf', mimetype: 'application/pdf' } }, 'Ana',
                undefined, context({ limits: { inboundBytes: 512 * MIB, outboundBytes: 25 * MIB } }));
            expect(mocks.pdfParse).toHaveBeenCalledWith(Buffer.from('media'));
            expect(result.text).toContain('[Document Received: x.pdf]');
        });

        it('refuses non-audio media without downloading when limits are unavailable, but still transcribes audio', async () => {
            const service = make();
            const refused = await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'a.txt' } }, 'Ana', undefined, context({ limits: undefined }));
            expect(refused.text).toContain('media limits are unavailable');
            expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
            await expect(service.process({ kind: 'audio', text: '', audioMessage: {} } as any, 'Ana', undefined, context({ limits: undefined })))
                .resolves.toEqual({ text: '[Transcribed Audio]: audio text' });
        });

        it('bounds automatic quoted images by min(inbound, 25 MiB) and never downloads a known oversized quote', async () => {
            const service = make();
            const quoted = context({ quoted: true, limits: { inboundBytes: 512 * MIB, outboundBytes: 25 * MIB } });
            for (let i = 0; i < 3; i++) {
                const result = await service.process({ kind: 'image', text: 'q', imageMessage: { fileLength: 30 * MIB } }, 'Ana', undefined, quoted);
                expect(result.text).toContain('exceeds the inbound limit of 25 MiB');
            }
            expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
            mocks.downloadContentFromMessage.mockImplementation(async () => streamFrom([Buffer.from('media')]));
            await service.process({ kind: 'image', text: 'q', imageMessage: { fileLength: 5 } }, 'Ana', undefined, quoted);
            await service.process({ kind: 'image', text: 'q', imageMessage: { fileLength: 5 } }, 'Ana', undefined, quoted);
            expect(mocks.downloadContentFromMessage).toHaveBeenCalledTimes(2);
        });

        it('reports busy and interrupted refusals distinctly', async () => {
            const slots = new TransferSlots(1); const release = slots.tryAcquire('inbound')!;
            const service = new IncomingMediaService(audioService as any, undefined, new InboundMediaTransfer({ slots }), mediaDir);
            const busy = await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'big.bin' } }, 'Ana', undefined, context());
            expect(busy.text).toBe('[Document not received: big.bin; another large transfer is in progress]');
            release();
            mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.from('abc')]));
            const truncated = await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'cut.bin', fileLength: 10 } }, 'Ana', undefined, context());
            expect(truncated.text).toBe('[Document not received: cut.bin; transfer interrupted (fewer bytes than declared)]');
            expect(await readdir(documentDir)).toEqual([]);
        });

        it('treats an audio file sent as a document under document rules without transcribing it', async () => {
            mocks.downloadContentFromMessage.mockResolvedValue(zeros(30 * MIB));
            const result = await make().process({ kind: 'document', text: '', documentMessage: { fileName: 'voice.ogg', mimetype: 'audio/ogg' } }, 'Ana',
                undefined, context({ limits: { inboundBytes: 512 * MIB, outboundBytes: 512 * MIB } }));
            expect(audioService.transcribe).not.toHaveBeenCalled();
            expect(result.text).toContain('[Document received: voice.ogg]');
        });

        it('keeps small video receipt text unchanged', async () => {
            const result = await make().process({ kind: 'video', text: '', videoMessage: {} }, 'Ana', undefined, context());
            expect(result.text).toMatch(/^\[Video\]\n\[Video saved: /);
        });
    });
});
