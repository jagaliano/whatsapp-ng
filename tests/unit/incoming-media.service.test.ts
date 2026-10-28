import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncomingMediaService } from '../../src/services/incoming-media.service.ts';
import type { AudioService } from '../../src/services/audio.service.ts';

const mocks = vi.hoisted(() => ({
    downloadContentFromMessage: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    pdfParse: vi.fn(),
    pdfClose: vi.fn(),
    pdfConstructor: vi.fn()
}));

vi.mock('baileys', () => ({
    downloadContentFromMessage: mocks.downloadContentFromMessage
}));

vi.mock('node:fs/promises', () => ({
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile
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

describe('IncomingMediaService', () => {
    const audioService = {
        transcribe: vi.fn()
    };

    beforeEach(() => {
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
        const service = new IncomingMediaService(audioService as any, logger as any);
        audioService.transcribe.mockResolvedValue('PRIVATE-C4-SPEECH');
        const data = { fileName: 'PRIVATE-C4-FILENAME.pdf', mimetype: 'application/pdf', caption: 'PRIVATE-C4-CAPTION' };
        await service.process({ kind, text: 'PRIVATE-C4-CAPTION', [`${kind}Message`]: data } as any, 'PRIVATE-C4-NAME');
        expect(JSON.stringify(logger.log.mock.calls)).not.toContain('PRIVATE-C4-');
    });
    it('passes through non-media resolved content', async () => {
        const service = new IncomingMediaService(audioService as any);

        await expect(service.process({ kind: 'text', text: 'hello' }, 'Ana')).resolves.toEqual({
            text: 'hello'
        });
    });

    it('transcribes audio messages', async () => {
        const service = new IncomingMediaService(audioService as any);
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
        await new IncomingMediaService(audioService as any).process({ kind: 'audio', text: '[Audio Message]', audioMessage }, 'Ana', options);
        expect(audioService.transcribe).toHaveBeenCalledWith(audioMessage, options);
    });

    it('downloads images and normalizes image/jpg MIME type', async () => {
        const service = new IncomingMediaService(audioService as any);

        const result = await service.process({
            kind: 'image',
            text: 'caption',
            imageMessage: { mimetype: 'image/jpg; charset=utf-8' }
        }, 'Ana');

        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith(
            { mimetype: 'image/jpg; charset=utf-8' },
            'image'
        );
        expect(result).toEqual({
            text: 'caption',
            imageBuffer: Buffer.from('media'),
            imageMimeType: 'image/jpeg'
        });
    });

    it('downloads videos to the WhatsApp media directory', async () => {
        const service = new IncomingMediaService(audioService as any);

        const result = await service.process({
            kind: 'video',
            text: '[Video]',
            videoMessage: { mimetype: 'video/mp4' }
        }, 'Ana');

        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith(
            { mimetype: 'video/mp4' },
            'video'
        );
        expect(mocks.mkdir).toHaveBeenCalledWith(
            expect.stringContaining('whatsapp-medias'),
            { recursive: true, mode: 0o700 }
        );
        expect(mocks.writeFile).toHaveBeenCalledWith(
            expect.stringMatching(/whatsapp-medias[\\/]video_1234567890_[a-f0-9-]+\.mp4$/),
            Buffer.from('media'),
            { mode: 0o600, flag: 'wx' }
        );
        expect(result.text).toContain('[Video saved:');
    });

    it.each(['image', 'video', 'document'] as const)('bounds streamed %s downloads and closes the stream without saving', async kind => {
        let closed = false;
        mocks.downloadContentFromMessage.mockResolvedValue((async function* () {
            try { yield Buffer.alloc(25 * 1024 * 1024); yield Buffer.from('too large'); }
            finally { closed = true; }
        })());
        const message = { fileName: 'oversize.pdf' };
        const result = await new IncomingMediaService(audioService as any).process({ kind, text: '', [`${kind}Message`]: message } as any, 'Ana');
        expect(result.text).toMatch(/download failed/i);
        expect(closed).toBe(true);
        expect(mocks.writeFile).not.toHaveBeenCalled();
        expect(mocks.pdfParse).not.toHaveBeenCalled();
    });

    it('rejects declared oversized media before opening a download', async () => {
        await new IncomingMediaService(audioService as any).process({ kind: 'image', text: '', imageMessage: { fileLength: 25 * 1024 * 1024 + 1 } }, 'Ana');
        expect(mocks.downloadContentFromMessage).not.toHaveBeenCalled();
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it('accepts exactly 25 MiB and concatenates multiple chunks once', async () => {
        mocks.downloadContentFromMessage.mockResolvedValue(streamFrom([Buffer.alloc(25 * 1024 * 1024 - 1), Buffer.from('x')]));
        const concat = vi.spyOn(Buffer, 'concat');
        const result = await new IncomingMediaService(audioService as any).process({ kind: 'image', text: '', imageMessage: {} }, 'Ana');
        expect(result.imageBuffer?.length).toBe(25 * 1024 * 1024);
        expect(concat).toHaveBeenCalledOnce();
        concat.mockRestore();
    });

    it('creates private, exclusive, collision-resistant saved files', async () => {
        const service = new IncomingMediaService(audioService as any);
        await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'same.txt' } }, 'Ana');
        await service.process({ kind: 'document', text: '', documentMessage: { fileName: 'same.txt' } }, 'Ana');
        const [first, second] = mocks.writeFile.mock.calls;
        expect(first[0]).not.toBe(second[0]);
        expect(first[2]).toEqual({ mode: 0o600, flag: 'wx' });
        expect(mocks.mkdir).toHaveBeenCalledWith(expect.stringContaining('documents'), { recursive: true, mode: 0o700 });
    });

    it('does not allow MIME-derived path separators in saved filenames', async () => {
        await new IncomingMediaService(audioService as any).process({ kind: 'video', text: '', videoMessage: { mimetype: 'video/mp4\\\\..\\\\secret' } }, 'Ana');
        expect(mocks.writeFile.mock.calls[0][0].split(/[\\\\/]/).pop()).toMatch(/^video_[0-9]+_[a-f0-9-]+\.[a-z0-9]+$/i);
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
        const service = new IncomingMediaService(audioService as any);
        const longText = `First line\n${'A'.repeat(1800)}`;
        mocks.pdfParse.mockResolvedValueOnce({ text: longText });

        const result = await service.process({
            kind: 'document',
            text: '[Document]',
            documentMessage: {
                fileName: 'contract.pdf',
                mimetype: 'application/pdf',
                fileLength: 2 * 1024 * 1024,
                caption: 'Read this'
            }
        }, 'Ana');

        expect(mocks.downloadContentFromMessage).toHaveBeenCalledWith(
            expect.objectContaining({ fileName: 'contract.pdf' }),
            'document'
        );
        expect(mocks.mkdir).toHaveBeenCalledWith(
            expect.stringMatching(/\.pi-data[/\\]whatsapp[/\\]documents/),
            { recursive: true, mode: 0o700 }
        );
        expect(mocks.writeFile).toHaveBeenCalledWith(
            expect.stringMatching(/1234567890_[a-f0-9-]+_contract\.pdf$/),
            Buffer.from('media'),
            { mode: 0o600, flag: 'wx' }
        );
        expect(mocks.pdfParse).toHaveBeenCalledWith(Buffer.from('media'));
        expect(result.text).toContain('[Document Received: contract.pdf]');
        expect(result.text).toContain('MIME Type: application/pdf');
        expect(result.text).toContain('Size: 2.0 MB');
        expect(result.text).toContain('PDF text preview:');
        expect(result.text).toContain('First line');
        expect(result.text).toContain('Description: Read this');
        expect(result.text).not.toContain('A'.repeat(1300));
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
                fileLength: 512000
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
                fileLength: 1024
            }
        }, 'Ana');

        expect(mocks.pdfParse).not.toHaveBeenCalled();
        expect(result.text).toContain('[Document Received: notes.txt]');
        expect(result.text).not.toContain('PDF text preview:');
        expect(result.text).not.toContain('PDF text was not extracted automatically.');
    });
});
