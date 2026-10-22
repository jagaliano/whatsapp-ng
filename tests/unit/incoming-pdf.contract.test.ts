import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiteParse } from '@llamaindex/liteparse';
import { IncomingMediaService } from '../../src/services/incoming-media.service.ts';
import type { AudioService } from '../../src/services/audio.service.ts';
import { scannedPdf, textPdf } from '../helpers/pdf-fixtures.ts';

const mocks = vi.hoisted(() => ({ bytes: Buffer.alloc(0) }));
vi.mock('baileys', () => ({
    downloadContentFromMessage: async function* () { yield mocks.bytes; }
}));

const options = { quiet: true, numWorkers: 1, poolSize: 1, parseTimeoutMs: 15_000 };
const hasTesseract = spawnSync('tesseract', ['--version'], { encoding: 'utf8' }).status === 0;

afterEach(() => { vi.restoreAllMocks(); });

describe('real LiteParse native PDF contract', () => {
    it('extracts synthetic text with OCR disabled and recovers after a corrupt PDF', async () => {
        const parser = new LiteParse({ ...options, ocrEnabled: false });
        try {
            await expect(parser.parse(Buffer.from('not a PDF'))).rejects.toThrow();
            const result = await parser.parse(textPdf());
            expect(result.totalPages).toBe(1);
            expect(result.text).toContain('Synthetic PDF preview');
        } finally {
            parser.close();
            parser.close();
        }
    }, 30_000);

    it('does not fabricate text for a raster-only scan with OCR off', async () => {
        const parser = new LiteParse({ ...options, ocrEnabled: false });
        try {
            const result = await parser.parse(scannedPdf());
            expect(result.totalPages).toBe(1);
            expect(result.text.trim()).toBe('');
        } finally { parser.close(); }
    }, 30_000);

    it.skipIf(!hasTesseract)('extracts raster-only text through real local OCR', async () => {
        const parser = new LiteParse({ ...options, ocrEnabled: true, ocrFailureFatal: true });
        try {
            const result = await parser.parse(scannedPdf());
            expect(result.text.toUpperCase()).toMatch(/HELLO\s+WORLD/);
        } finally { parser.close(); }
    }, 30_000);

    it.each([false, true])('retains saved bytes and bounded preview/fallback (corrupt=%s)', async (corrupt) => {
        const root = await mkdtemp(join(tmpdir(), 'wa-pdf-contract-'));
        vi.spyOn(process, 'cwd').mockReturnValue(root);
        mocks.bytes = corrupt ? Buffer.from('broken PDF') : textPdf('Synthetic PDF preview');
        const audio = { transcribe: vi.fn() } as unknown as AudioService;
        try {
            const service = new IncomingMediaService(audio);
            const result = await service.process({
                kind: 'document', text: '[Document]',
                documentMessage: { fileName: 'synthetic.pdf', mimetype: 'application/pdf' }
            }, 'Fixture');
            const directory = join(root, '.pi-data', 'whatsapp', 'documents');
            const [file] = await readdir(directory);
            expect(await readFile(join(directory, file))).toEqual(mocks.bytes);
            expect(result.text).toContain('[Document Received: synthetic.pdf]');
            if (corrupt) expect(result.text).toContain('PDF text was not extracted automatically.');
            else expect(result.text).toContain('Synthetic PDF preview');
        } finally { await rm(root, { recursive: true, force: true }); }
    }, 30_000);

    it.each([false, true])('reaps actual pool children after idempotent close (corrupt=%s)', async (corrupt) => {
        const script = `
            import cp from 'node:child_process';
            import { syncBuiltinESMExports } from 'node:module';
            import { once } from 'node:events';
            const children = [];
            const originalFork = cp.fork;
            cp.fork = (...args) => {
                const child = originalFork(...args);
                children.push(child);
                return child;
            };
            syncBuiltinESMExports();
            const { LiteParse } = await import(${JSON.stringify(import.meta.resolve('@llamaindex/liteparse'))});
            const parser = new LiteParse({ ...${JSON.stringify(options)}, ocrEnabled: false });
            try {
                let rejected = false;
                try {
                    await parser.parse(Buffer.from(${JSON.stringify((corrupt ? Buffer.from('not a PDF') : textPdf()).toString('base64'))}, 'base64'));
                } catch (error) {
                    if (!${corrupt}) throw error;
                    rejected = true;
                }
                if (${corrupt} && !rejected) throw new Error('Corrupt PDF unexpectedly parsed');
            } finally {
                const exits = children.map(child => child.exitCode === null && child.signalCode === null ? once(child, 'exit') : Promise.resolve());
                // Idle native workers are unref'ed; keep this observer alive until exit.
                const deadline = setTimeout(() => { throw new Error('Worker not reaped'); }, 5_000);
                parser.close(); parser.close();
                await Promise.all(exits);
                clearTimeout(deadline);
            }
            if (children.length !== ${corrupt ? 2 : 1}) throw new Error('Unexpected parser worker count');
            console.log('worker reaped');
        `;
        const root = await mkdtemp(join(tmpdir(), 'wa-pdf-worker-'));
        try {
            const path = join(root, 'cleanup.mjs');
            await writeFile(path, script);
            const result = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 20_000 });
            expect(result.error).toBeUndefined();
            expect(result.status, result.stderr).toBe(0);
            expect(result.stdout).toContain('worker reaped');
        } finally { await rm(root, { recursive: true, force: true }); }
    }, 30_000);
});
