import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
    name: string;
    version: string;
    private: boolean;
    author: string;
    license: string;
    main: string;
    repository: { url: string };
    bugs: { url: string };
    homepage: string;
    publishConfig: { tag: string; access: string };
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    pi: { extensions: string[] };
}

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as PackageManifest;

describe('maintained candidate packaging', () => {
    it('identifies the fork without replacing the original author', () => {
        expect(manifest.name).toBe('whatsapp-ng');
        expect(manifest.version).toBe('1.1.0-rc.1');
        expect(manifest.author).toBe('Rapha');
        expect(manifest.repository.url).toBe('git+https://github.com/jagaliano/whatsapp-ng.git');
        expect(manifest.bugs.url).toBe('https://github.com/jagaliano/whatsapp-ng/issues');
        expect(manifest.homepage).toBe('https://github.com/jagaliano/whatsapp-ng#readme');
    });

    it('includes the accepted MIT terms and both contributor notices', () => {
        const license = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8');

        expect(manifest.license).toBe('MIT');
        expect(license).toContain('Copyright (c) 2026 José Antonio Galiano Sandoval');
        expect(license).toContain('Copyright (c) Rapha Castelloes\n');
        expect(license).toContain('Permission is hereby granted, free of charge');
        expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    });

    it('uses host-provided wildcard peers, not bundled runtime copies', () => {
        for (const name of ['@mariozechner/pi-coding-agent', '@mariozechner/pi-tui', '@sinclair/typebox']) {
            expect(manifest.peerDependencies[name]).toBe('*');
            expect(manifest.dependencies[name]).toBeUndefined();
            expect(manifest.devDependencies[name]).toBeDefined();
        }
    });

    it('keeps publication blocked while recording the selected prerelease tag', () => {
        expect(manifest.private).toBe(true);
        expect(manifest.publishConfig).toEqual({ tag: 'next', access: 'public' });
    });

    it('preserves entry identity and leaves the M2 transport policy unchanged', () => {
        expect(manifest.main).toBe('whatsapp-pi.ts');
        expect(manifest.pi.extensions).toEqual(['./whatsapp-pi.ts']);
        expect(manifest.dependencies.baileys).toBe('^7.0.0-rc14');
        expect(manifest.dependencies['@llamaindex/liteparse']).toBe('^1.5.3');
    });
});
