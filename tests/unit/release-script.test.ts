import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandRunner, release, releaseTag, versionParts } from '../../scripts/release.mjs';

let root: string;
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const write = (name: string, data: unknown) => { const path = resolve(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(data)); };
const receiptPath = '.pi/cache/releases/prepared.json';
const attemptPath = '.pi/cache/releases/publish-1.1.0-rc.1.attempt.json';
const integrity = (data: Buffer) => 'sha512-' + createHash('sha512').update(data).digest('base64');

function fixture() {
    const state = { dirty: false, rootPrefix: '', head: 'fixture-head', failedScript: '', existing: false, viewError: 'E404', publishError: false, unexpected: false, missingWorker: false, wrongIntegrity: false };
    const files = ['package.json', 'package-lock.json', 'README.md', 'LICENSE', 'whatsapp-ng.ts', 'src/services/edge-tts.worker.mjs', 'docs/reference.md', 'docs/crispasr.md', 'docs/releases.md'];
    write('package.json', { name: 'whatsapp-ng', version: '1.1.0-rc.1', private: false, main: 'whatsapp-ng.ts', publishConfig: { tag: 'next', access: 'public' } });
    write('package-lock.json', { name: 'whatsapp-ng', version: '1.1.0-rc.1', packages: { '': { name: 'whatsapp-ng', version: '1.1.0-rc.1' }, dependency: { version: '2.0.0' } } });
    for (const file of files.slice(2)) { const path = resolve(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, 'synthetic public source'); }
    const run = vi.fn((command: string, args: string[], _options: { cwd: string; env?: NodeJS.ProcessEnv; interactive?: boolean }) => {
        if (command === 'git') {
            if (args[0] === 'status') return state.dirty ? ' M README.md' : '';
            if (args[0] === 'ls-files') return files.join('\0') + '\0';
            if (args[0] === 'rev-parse') {
                if (args[1] === '--show-cdup') return state.rootPrefix;
                if (args[1] === '--show-toplevel') return 'C:/Different/Root/Spelling';
                return state.head;
            }
            throw new Error('Unexpected fixture Git operation');
        }
        if (command !== 'npm') throw new Error('Unexpected fixture executable');
        if (args[0] === 'run') { if (args[1] === state.failedScript) throw new Error('Synthetic validation failure'); return ''; }
        if (args[0] === 'audit') return JSON.stringify({ metadata: { vulnerabilities: { total: 0 } } });
        if (args[0] === 'version') {
            const manifest = read('package.json'); manifest.version = args[1]; write('package.json', manifest);
            const lock = read('package-lock.json'); lock.version = args[1]; lock.packages[''].version = args[1]; write('package-lock.json', lock); return args[1];
        }
        if (args[0] === 'pack') {
            const directory = args[args.indexOf('--pack-destination') + 1]; const manifest = read('package.json');
            const filename = `whatsapp-ng-${manifest.version}.tgz`; const bytes = Buffer.from('synthetic archive bytes');
            writeFileSync(resolve(directory, filename), bytes);
            const publicFiles = files.filter(file => file !== 'package-lock.json' && !(state.missingWorker && file.endsWith('worker.mjs')));
            return JSON.stringify([{ name: manifest.name, version: manifest.version, filename, integrity: integrity(bytes), files: [...publicFiles, ...(state.unexpected ? ['.env'] : [])].map(path => ({ path })) }]);
        }
        if (args[0] === 'publish') {
            if (args.includes('--dry-run')) return JSON.stringify({ 'whatsapp-ng': { integrity: state.wrongIntegrity ? 'wrong' : integrity(readFileSync(args[1])) } });
            expect(read(`.pi/cache/releases/publish-${read('package.json').version}.attempt.json`).outcome).toBe('unknown');
            if (state.publishError) throw new Error('Synthetic lost publication response');
            return '';
        }
        if (args[0] === 'view') {
            if (state.existing) return '"1.1.0-rc.1"';
            const error = new Error('Synthetic registry result') as Error & { code?: string }; error.code = state.viewError; throw error;
        }
        if (args[0] === 'whoami') return 'fixture-owner';
        throw new Error('Unexpected fixture npm operation');
    });
    const invoke = (...args: string[]) => release(args, { root, run, log: vi.fn() });
    const publish = () => invoke('publish', '--confirm', '1.1.0-rc.1', '--tag', 'next');
    const actualPublishes = () => run.mock.calls.filter(([command, args]) => command === 'npm' && args[0] === 'publish' && !args.includes('--dry-run'));
    return { state, run, invoke, publish, actualPublishes };
}
beforeEach(() => { root = mkdtempSync(resolve(tmpdir(), 'wa-release-unit-')); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

describe('real release command runner with synthetic npm entry', () => {
    it('requires npm routing before starting a child', () => {
        vi.stubEnv('npm_execpath', '');
        expect(() => commandRunner('npm', ['view', 'fixture'], { cwd: root, env: {} })).toThrow(/through npm run/);
    });
    it.each([
        ['stdout', JSON.stringify({ error: { code: 'E404' } }), 'private-output-sentinel', 'E404'],
        ['stderr', '', JSON.stringify({ error: { code: 'E404' } }), 'E404'],
        ['both', JSON.stringify({ error: { code: 'E404' } }), JSON.stringify({ error: { code: 'E404' } }), 'E404'],
        ['conflicting', JSON.stringify({ error: { code: 'E401' } }), JSON.stringify({ error: { code: 'E404' } }), undefined],
        ['unstructured', 'private-output-sentinel', 'E404', undefined],
        ['malformed', '{"error":', '', undefined],
        ['non-string', JSON.stringify({ error: { code: { value: 'E404' } } }), '', undefined]
    ])('classifies %s errors without replaying child output', (_name, stdout, stderr, expected) => {
        const cli = resolve(root, 'npm-cli.cjs');
        writeFileSync(cli, `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = 1;`);
        vi.stubEnv('npm_execpath', cli);
        let failure: (Error & { code?: string }) | undefined;
        try { commandRunner('npm', ['view', 'fixture'], { cwd: root, env: {} }); }
        catch (error) { failure = error as Error & { code?: string }; }
        expect(failure?.code).toBe(expected); expect(failure?.message).toContain('output withheld');
        expect(failure?.message).not.toContain('private-output-sentinel'); expect(failure).not.toHaveProperty('stdout'); expect(failure).not.toHaveProperty('stderr');
    });
    it('returns successful structured output unchanged', () => {
        const cli = resolve(root, 'npm-cli.cjs'); writeFileSync(cli, 'process.stdout.write(JSON.stringify({ ok: true }));'); vi.stubEnv('npm_execpath', cli);
        expect(commandRunner('npm', ['view', 'fixture'], { cwd: root, env: {} })).toBe('{"ok":true}');
    });
});

describe('explicit local release commands', () => {
    it.each(['1.1.0-rc.1', '1.1.0-rc.2', '2.0.0-beta.10', '1.1.0'])('accepts canonical version %s', version => {
        expect(() => versionParts(version)).not.toThrow(); expect(releaseTag(version)).toBe(version.includes('-') ? 'next' : 'latest');
    });
    it.each(['../escape', 'v1.1.0', '1.1', '01.1.0', '1.1.0-rc.01', '1.1.0+build', '1.1.0;echo nope'])('rejects invalid version %s', version => {
        expect(() => versionParts(version)).toThrow();
    });
    it('updates both version files without Git tags, dependency edits or publication', () => {
        const h = fixture(); h.invoke('version', '1.1.0-rc.2');
        expect(read('package.json').version).toBe('1.1.0-rc.2'); expect(read('package-lock.json').packages[''].version).toBe('1.1.0-rc.2');
        expect(read('package-lock.json').packages.dependency.version).toBe('2.0.0');
        expect(h.run.mock.calls.find(([name, args]) => name === 'npm' && args[0] === 'version')?.[1]).toEqual(['version', '1.1.0-rc.2', '--no-git-tag-version', '--ignore-scripts']);
        expect(h.actualPublishes()).toHaveLength(0); expect(read('package.json').publishConfig.tag).toBe('next');
    });
    it('requires an explicit stable target to switch the channel to latest', () => {
        const h = fixture(); h.invoke('version', '1.1.0'); expect(read('package.json').publishConfig.tag).toBe('latest');
        expect(h.actualPublishes()).toHaveLength(0);
    });
    it('returns to next only through an explicit greater prerelease target', () => {
        const h = fixture(); h.invoke('version', '1.1.0'); h.invoke('version', '1.2.0-rc.1');
        expect(read('package.json').version).toBe('1.2.0-rc.1'); expect(read('package.json').publishConfig.tag).toBe('next');
        expect(h.actualPublishes()).toHaveLength(0);
    });
    it.each(['1.0.0', '1.1.0-rc.0', '1.1.0-rc.1'])('rejects same/older target %s without modifying files', version => {
        const h = fixture(); expect(() => h.invoke('version', version)).toThrow(/greater/); expect(read('package.json').version).toBe('1.1.0-rc.1');
    });
    it('orders numeric prerelease components numerically', () => {
        const h = fixture(); h.invoke('version', '1.1.0-rc.10'); expect(read('package.json').version).toBe('1.1.0-rc.10');
    });
    it('restores both originals after a partially failed npm version operation', () => {
        const h = fixture(); const original = h.run.getMockImplementation()!;
        h.run.mockImplementation((name, args, options) => { const result = original(name, args, options); if (args[0] === 'version') throw new Error('Synthetic partial update'); return result; });
        expect(() => h.invoke('version', '1.1.0-rc.2')).toThrow(/partial/);
        expect(read('package.json').version).toBe('1.1.0-rc.1'); expect(read('package-lock.json').version).toBe('1.1.0-rc.1');
    });
    it('refuses dirty or untracked source before running npm', () => {
        const h = fixture(); h.state.dirty = true;
        expect(() => h.invoke('prepare')).toThrow(/clean working tree/); expect(h.run.mock.calls.some(([name]) => name === 'npm')).toBe(false);
    });
    it('uses the relative Git root check without comparing platform path spellings', () => {
        const h = fixture(); h.invoke('prepare');
        expect(h.run.mock.calls.some(([name, args]) => name === 'git' && args[1] === '--show-cdup')).toBe(true);
        expect(h.run.mock.calls.some(([name, args]) => name === 'git' && args[1] === '--show-toplevel')).toBe(false);
    });
    it('refuses a source subdirectory rather than the repository root', () => {
        const h = fixture(); h.state.rootPrefix = '../';
        expect(() => h.invoke('prepare')).toThrow(/repository root/); expect(h.run.mock.calls.some(([name]) => name === 'npm')).toBe(false);
    });
    it('rejects package/lock/channel mismatches', () => {
        const h = fixture(); const lock = read('package-lock.json'); lock.version = '9.0.0'; write('package-lock.json', lock);
        expect(() => h.invoke('prepare')).toThrow(/mismatch/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('prepares an immutable receipt after validation/audit/dry-run only', () => {
        const h = fixture(); vi.stubEnv('RELEASE_TEST_SECRET', 'synthetic-do-not-inherit'); h.invoke('prepare');
        const receipt = read(receiptPath); expect(receipt).toMatchObject({ name: 'whatsapp-ng', packageVersion: '1.1.0-rc.1', commit: 'fixture-head', tag: 'next', registry: 'https://registry.npmjs.org' });
        expect(receipt.integrity).toBe(integrity(readFileSync(resolve(root, '.pi/cache/releases', receipt.artifact))));
        const gates = h.run.mock.calls.filter(([name, args]) => name === 'npm' && args[0] === 'run');
        expect(gates.map(([, args]) => args[1])).toEqual(['test', 'lint', 'typecheck']);
        for (const [, , options] of gates) { expect(options.env).not.toHaveProperty('RELEASE_TEST_SECRET'); expect(options.env?.PI_OFFLINE).toBe('1'); expect(options.env?.HOME).not.toBe(process.env.HOME); }
        expect(h.actualPublishes()).toHaveLength(0);
    });
    it('invalidates a previous receipt before running fresh gates', () => {
        const h = fixture(); h.invoke('prepare'); h.state.failedScript = 'lint';
        expect(() => h.invoke('prepare')).toThrow(/validation failure/); expect(existsSync(resolve(root, receiptPath))).toBe(false);
    });
    it.each(['unexpected', 'missingWorker', 'wrongIntegrity'] as const)('refuses %s packaging failures', key => {
        const h = fixture(); h.state[key] = true; expect(() => h.invoke('prepare')).toThrow();
        expect(existsSync(resolve(root, receiptPath))).toBe(false); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('stops if HEAD changes while validation is running', () => {
        const h = fixture(); const original = h.run.getMockImplementation()!;
        h.run.mockImplementation((name, args, options) => { const result = original(name, args, options); if (args[0] === 'run' && args[1] === 'typecheck') h.state.head = 'changed'; return result; });
        expect(() => h.invoke('prepare')).toThrow(/HEAD changed/); expect(existsSync(resolve(root, receiptPath))).toBe(false);
    });
    it('stops on an unsuccessful production audit', () => {
        const h = fixture(); const original = h.run.getMockImplementation()!;
        h.run.mockImplementation((name, args, options) => args[0] === 'audit' ? JSON.stringify({ metadata: { vulnerabilities: { total: 1 } } }) : original(name, args, options));
        expect(() => h.invoke('prepare')).toThrow(/audit/); expect(existsSync(resolve(root, receiptPath))).toBe(false);
    });
    it.each([['--confirm', '1.1.0-rc.2', '--tag', 'next'], ['--confirm', '1.1.0-rc.1', '--tag', 'latest'], []])('requires exact version/tag confirmation: %j', (...args) => {
        const h = fixture(); h.invoke('prepare'); expect(() => h.invoke('publish', ...args)).toThrow(); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('rejects changed HEAD and artifact bytes', () => {
        const h = fixture(); h.invoke('prepare'); h.state.head = 'replacement'; expect(h.publish).toThrow(/receipt/);
        h.state.head = 'fixture-head'; const receipt = read(receiptPath); writeFileSync(resolve(root, '.pi/cache/releases', receipt.artifact), 'tampered');
        expect(h.publish).toThrow(/integrity/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('rejects a receipt escaping the release directory', () => {
        const h = fixture(); h.invoke('prepare'); write(receiptPath, { ...read(receiptPath), artifact: '../../package.json' });
        expect(h.publish).toThrow(/receipt/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('never republishes an existing immutable registry version', () => {
        const h = fixture(); h.invoke('prepare'); h.state.existing = true; expect(h.publish).toThrow(/already exists/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('does not interpret a blank successful registry response as absence', () => {
        const h = fixture(); h.invoke('prepare'); const original = h.run.getMockImplementation()!;
        h.run.mockImplementation((name, args, options) => args[0] === 'view' ? '' : original(name, args, options));
        expect(h.publish).toThrow(/already exists/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('permits latest only after an explicit stable target and matching confirmation', () => {
        const h = fixture(); h.invoke('version', '1.1.0'); h.invoke('prepare');
        expect(() => h.invoke('publish', '--confirm', '1.1.0', '--tag', 'next')).toThrow(/matching/);
        h.invoke('publish', '--confirm', '1.1.0', '--tag', 'latest');
        const args = h.actualPublishes()[0][1]; expect(args[args.indexOf('--tag') + 1]).toBe('latest');
    });
    it.each(['E401', 'ENOTFOUND', undefined])('does not treat registry error %s as version absence', code => {
        const h = fixture(); h.invoke('prepare'); h.state.viewError = code!; expect(h.publish).toThrow(/registry result/); expect(h.actualPublishes()).toHaveLength(0);
    });
    it('records one publication attempt before the side effect and never retries it', () => {
        const h = fixture(); h.invoke('prepare'); h.publish(); expect(h.actualPublishes()).toHaveLength(1);
        expect(read(attemptPath).outcome).toBe('npm-command-succeeded'); expect(h.publish).toThrow(/already attempted/);
        const args = h.actualPublishes()[0][1]; expect(args).toContain('--ignore-scripts'); expect(args).toContain('--registry=https://registry.npmjs.org'); expect(args[args.indexOf('--tag') + 1]).toBe('next');
    });
    it('retains uncertain publication across a fresh preparation instead of retrying', () => {
        const h = fixture(); h.invoke('prepare'); h.state.publishError = true;
        expect(h.publish).toThrow(/lost publication response/); expect(read(attemptPath).outcome).toBe('unknown');
        h.invoke('prepare'); expect(h.publish).toThrow(/already attempted/); expect(h.actualPublishes()).toHaveLength(1);
    });
    it('shows CLI help without Git, npm or publication', () => {
        const output = execFileSync(process.execPath, [resolve(import.meta.dirname, '../../scripts/release.mjs'), '--help'], { cwd: root, env: {}, encoding: 'utf8' });
        expect(output).toContain('no automatic Git changes'); expect(existsSync(resolve(root, '.pi'))).toBe(false);
    });
});
