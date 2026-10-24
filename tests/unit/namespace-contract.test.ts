import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDefaultStorageRoot, getDefaultLegacyStorageRoot } from '../../src/services/storage-path.js';

const root = resolve(import.meta.dirname, '../..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
// The README is the authority for historical names; do not embed a second legacy namespace in code.
const legacy = /Legacy project identifier: `([^`]+)`/.exec(readme)?.[1];

describe('independent maintained namespace', () => {
    it('keeps the legacy identifier only in the README, not current files or filenames', () => {
        expect(legacy).toMatch(/^[a-z]+-[a-z]+$/);
        const pattern = new RegExp(legacy!.replace('-', '[-_ ]?'), 'i');
        const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
        const offenders: string[] = [];
        for (const name of new Set(files)) {
            if (!name || name === 'README.md' || name.startsWith('.pi/') || name.startsWith('node_modules/') || !existsSync(resolve(root, name))) continue;
            if (pattern.test(name) || pattern.test(readFileSync(resolve(root, name), 'utf8'))) offenders.push(name);
        }
        expect(offenders).toEqual([]);
    });
    it('uses the new default root without an implicit legacy root probe', () => {
        expect(getDefaultStorageRoot()).toMatch(/[\\/]extensions[\\/]whatsapp-ng$/);
        expect(getDefaultLegacyStorageRoot()).toBe(getDefaultStorageRoot());
    });
    it('binds the new public entry and startup flag while retaining generic tool contracts', () => {
        const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
        expect(manifest.main).toBe('whatsapp-ng.ts');
        expect(manifest.pi.extensions).toEqual(['./whatsapp-ng.ts']);
        expect(manifest.private).toBe(false);
        const entry = readFileSync(resolve(root, manifest.main), 'utf8');
        expect(entry).toContain('"whatsapp-ng-online"');
        expect(entry).toContain('"whatsapp-ng-migrate-from"');
        expect(entry).toContain('"whatsapp-ng-state"');
        expect(entry).toContain('__whatsappNgShutdown');
        expect(entry).toContain('pi.registerCommand("whatsapp"');
        expect(entry).toContain('name: "send_wa_message"');
    });
});
