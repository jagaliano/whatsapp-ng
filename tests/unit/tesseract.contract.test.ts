import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { scannedImage } from '../helpers/pdf-fixtures.ts';

const hasTesseract = spawnSync('tesseract', ['--version'], { stdio: 'ignore', timeout: 5_000 }).status === 0;

describe.skipIf(!hasTesseract)('user-installed Tesseract', () => {
    it('provides the English data needed by default PDF OCR', () => {
        const result = spawnSync('tesseract', ['--list-langs'], { encoding: 'utf8', timeout: 5_000 });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        expect(`${result.stdout}\n${result.stderr}`).toMatch(/^eng\s*$/m);
    });
    it('recognizes a synthetic raster image without embedded text or a remote OCR server', () => {
        const result = spawnSync('tesseract', ['stdin', 'stdout', '-l', 'eng', '--psm', '6'], {
            input: scannedImage(), encoding: 'utf8', timeout: 15_000
        });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout.toUpperCase()).toMatch(/HELLO\s+WORLD/);
    }, 20_000);
});
