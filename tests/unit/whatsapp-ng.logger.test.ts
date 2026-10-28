import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WhatsAppNgLogger } from '../../src/services/whatsapp-ng.logger.ts';

/** All log files are generated fixtures; never use the real extension data root. */
describe('WhatsAppNgLogger', () => {
    let root: string;
    beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'wa-logs-')); });
    afterEach(() => { vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });
    const quietConsole = () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        return { log, warn, error };
    };
    const path = () => join(root, 'whatsapp-ng.runtime.log');
    it('keeps console verbosity separate from file logging and does not write in the constructor', () => {
        const spies = quietConsole(); const logger = new WhatsAppNgLogger(false, true, { root });
        expect(readdirSync(root)).toEqual([]); logger.log('metadata'); logger.warn('warning'); logger.error('failure');
        expect(spies.log).not.toHaveBeenCalled(); expect(spies.warn).not.toHaveBeenCalled(); expect(spies.error).not.toHaveBeenCalled();
        expect(readFileSync(path(), 'utf8')).toContain('metadata');
    });
    it('always displays info and displays metadata diagnostics only when verbose', () => {
        const spies = quietConsole(); const logger = new WhatsAppNgLogger(false, false, { root });
        logger.info('info'); expect(spies.log).toHaveBeenCalledWith('info');
        logger.setVerbose(true); logger.log('metadata'); expect(spies.log).toHaveBeenCalledWith('metadata'); expect(readdirSync(root)).toEqual([]);
    });
    it('creates owner-only runtime files while preserving historical logs untouched', () => {
        quietConsole(); const old = join(root, 'whatsapp-ng.log'); writeFileSync(old, 'historical private data', { mode: 0o644 });
        new WhatsAppNgLogger(false, true, { root }).log('new metadata');
        expect(statSync(path()).mode & 0o777).toBe(0o600); expect(readFileSync(old, 'utf8')).toBe('historical private data');
    });
    it('bounds the active log and one backup without deleting unrelated files', () => {
        quietConsole(); const other = join(root, 'old-debug.log'); writeFileSync(other, 'preserve');
        const logger = new WhatsAppNgLogger(false, true, { root, maxBytes: 256 });
        for (let i = 0; i < 40; i++) logger.log(`bounded event ${i}`);
        expect(statSync(path()).size).toBeLessThanOrEqual(256); expect(statSync(path()+'.1').size).toBeLessThanOrEqual(256);
        expect(statSync(path()+'.1').mode & 0o777).toBe(0o600); expect(readdirSync(root).sort()).toEqual(['old-debug.log','whatsapp-ng.runtime.log','whatsapp-ng.runtime.log.1']);
        expect(readFileSync(other, 'utf8')).toBe('preserve'); expect(readFileSync(path(), 'utf8')).toContain('39');
    });
    it('bounds an oversized entry and does not serialize error messages, stacks or argument objects', () => {
        quietConsole(); const logger = new WhatsAppNgLogger(true, true, { root, maxBytes: 256 });
        const error = new Error('PRIVATE-SPEECH-TEXT'); logger.error('Processing failed', error, { token: 'PRIVATE-TOKEN' });
        expect(readFileSync(path(), 'utf8')).not.toMatch(/PRIVATE-SPEECH-TEXT|PRIVATE-TOKEN|Error:/);
        logger.log('x'.repeat(50_000)); expect(statSync(path()).size).toBeLessThanOrEqual(256);
    });
    it('rejects symlink log destinations and preserves oversized pre-existing files', () => {
        quietConsole(); const outside = join(root, 'outside.txt'); writeFileSync(outside, 'preserve'); symlinkSync(outside, path());
        const logger = new WhatsAppNgLogger(false, true, { root, maxBytes: 256 }); logger.log('not followed'); expect(readFileSync(outside, 'utf8')).toBe('preserve');
        rmSync(path()); writeFileSync(path(), 'p'.repeat(400)); logger.log('not truncated'); expect(readFileSync(path(), 'utf8')).toBe('p'.repeat(400));
    });
});
