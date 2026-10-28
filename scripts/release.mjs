/** Explicit local/GitHub release operations; never commits, tags, pushes, or retries publication. */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const registry = 'https://registry.npmjs.org';
const usage = `Local release commands (no automatic Git changes):
  npm run release:version -- <version>
  npm run release:prepare
  npm run release:publish -- --confirm <version> --tag <next|latest>
Version leaves package.json/package-lock.json edits for review and commit.
Prepare requires clean committed source; validates, audits, packs and dry-runs only.
Publish requires the unchanged prepared commit and exact artifact/version/tag.
An attempted publish is never automatically retried, even after an error.`;

export function versionParts(version) {
    if (typeof version !== 'string' || version.length > 64) throw new Error('Invalid release version');
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
    if (!match) throw new Error('Use a full SemVer version without build metadata');
    const core = match.slice(1, 4).map(Number); const pre = match[4]?.split('.') ?? [];
    if (core.some(value => !Number.isSafeInteger(value)) || pre.some(value => /^\d+$/.test(value) && /^0\d/.test(value))) throw new Error('Invalid release version');
    return { core, pre };
}
export function releaseTag(version) { return versionParts(version).pre.length ? 'next' : 'latest'; }
function compareVersions(a, b) {
    const left = versionParts(a); const right = versionParts(b);
    for (let i = 0; i < 3; i++) if (left.core[i] !== right.core[i]) return left.core[i] > right.core[i] ? 1 : -1;
    if (!left.pre.length || !right.pre.length) return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1;
    for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
        const x = left.pre[i]; const y = right.pre[i];
        if (x === y) continue;
        if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
        const xn = /^\d+$/.test(x); const yn = /^\d+$/.test(y);
        if (xn !== yn) return xn ? -1 : 1;
        if (xn && x.length !== y.length) return x.length > y.length ? 1 : -1;
        return x > y ? 1 : -1;
    }
    return 0;
}
const digest = bytes => createHash('sha512').update(bytes).digest('base64');
const json = path => {
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw new Error('Invalid or missing local release JSON; operation refused'); }
};
function save(path, value, exclusive = false) {
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
}
export function commandRunner(command, args, options = {}) {
    // npm's JS entry avoids shell invocation and npm.cmd quoting problems on Windows.
    const npm = process.env.npm_execpath;
    if (command === 'npm' && !npm) throw new Error('Run release commands through npm run');
    try {
        return execFileSync(command === 'npm' ? process.execPath : command, command === 'npm' ? [npm, ...args] : args,
            { cwd: options.cwd, env: options.env ?? process.env, encoding: 'utf8', stdio: options.interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'], timeout: 20 * 60_000, maxBuffer: 16 * 1024 * 1024 }) ?? '';
    } catch (error) {
        // Only npm's structured code is used to recognize absent versions; never replay raw error output.
        const codes = new Set();
        for (const stream of [error.stdout, error.stderr]) {
            try {
                const code = JSON.parse(String(stream)).error?.code;
                if (typeof code === 'string') codes.add(code);
            } catch { /* Only complete structured errors count; raw diagnostic text is not evidence. */ }
        }
        const failure = new Error(`${command} ${args[0]} failed; output withheld. Check credentials/diagnostics locally.`);
        // Conflicting structured errors cannot turn an auth failure into absence proof.
        failure.code = codes.size === 1 ? [...codes][0] : undefined; throw failure;
    }
}

export function release(args, { root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), run = commandRunner, log = console.log, github = process.env } = {}) {
    if (args.length === 0 || args.includes('--help')) { log(usage); return; }
    const [action, ...rest] = args;
    if (!['version', 'prepare', 'publish', 'check-tag', 'publish-ci'].includes(action)) throw new Error(usage);
    if ((action === 'version' && rest.length !== 1) || (['prepare', 'check-tag', 'publish-ci'].includes(action) && rest.length)
        || (action === 'publish' && (rest.length !== 4 || rest[0] !== '--confirm' || rest[2] !== '--tag'))) throw new Error(usage);
    const git = (...values) => String(run('git', values, { cwd: root })).trim();
    const npm = (values, options = {}) => run('npm', values, { cwd: root, ...options });
    const npmJson = values => {
        const output = npm(values);
        try { return JSON.parse(output); }
        catch { throw new Error('Malformed npm JSON; publication refused or remains unverified'); }
    };
    const clean = () => {
        // Git's relative root check avoids Windows separator/case and symlink spelling differences.
        if (git('rev-parse', '--show-cdup') !== '') throw new Error('Run from the release repository root');
        if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Release requires a clean working tree and index, including untracked files');
    };
    const manifestPath = resolve(root, 'package.json'); const lockPath = resolve(root, 'package-lock.json');
    const manifest = json(manifestPath); const lock = json(lockPath);
    const tag = releaseTag(manifest.version);
    if (manifest.name !== 'whatsapp-ng' || lock.name !== manifest.name || lock.version !== manifest.version || lock.packages?.['']?.version !== manifest.version
        || lock.packages[''].name !== manifest.name || manifest.private !== false || manifest.publishConfig?.access !== 'public' || manifest.publishConfig?.tag !== tag) throw new Error('Package/lock identity, version or release channel mismatch');
    clean();
    if (action === 'version') {
        const target = rest[0]; const nextTag = releaseTag(target);
        if (compareVersions(target, manifest.version) <= 0) throw new Error('New version must be greater than the current version');
        const previousManifest = readFileSync(manifestPath); const previousLock = readFileSync(lockPath);
        try {
            npm(['version', target, '--no-git-tag-version', '--ignore-scripts']);
            const changed = json(manifestPath); const changedLock = json(lockPath);
            if (changed.version !== target || changedLock.version !== target || changedLock.packages?.['']?.version !== target) throw new Error('npm did not update both version files');
            changed.publishConfig.tag = nextTag; save(manifestPath, changed);
        } catch (error) { writeFileSync(manifestPath, previousManifest); writeFileSync(lockPath, previousLock); throw error; }
        log(`Version ${target}; channel ${nextTag}. Review changes/changelog, then commit manually. Nothing tagged or published.`); return;
    }
    const head = git('rev-parse', 'HEAD');
    const ciPublish = action === 'publish-ci';
    if (action === 'check-tag' || ciPublish) {
        const ref = `refs/tags/v${manifest.version}`;
        if (github.GITHUB_ACTIONS !== 'true' || github.GITHUB_EVENT_NAME !== 'push' || github.GITHUB_REPOSITORY !== 'jagaliano/whatsapp-ng'
            || github.GITHUB_REF_TYPE !== 'tag' || github.GITHUB_REF !== ref
            || github.GITHUB_WORKFLOW_REF !== `jagaliano/whatsapp-ng/.github/workflows/publish.yml@${ref}`
            || !/^[a-f0-9]{40}$/.test(github.GITHUB_SHA ?? '')) throw new Error('Not an exact release-tag event from the expected GitHub workflow');
        if (git('rev-parse', `${github.GITHUB_SHA}^{commit}`) !== head || git('rev-parse', `${ref}^{commit}`) !== head) throw new Error('Release tag/event does not match the checked-out commit');
        git('merge-base', '--is-ancestor', head, 'origin/main');
        if (ciPublish && (github.NPM_PUBLISH_ENABLED !== 'true' || github.GITHUB_RUN_ATTEMPT !== '1'
            || !github.ACTIONS_ID_TOKEN_REQUEST_URL || !github.ACTIONS_ID_TOKEN_REQUEST_TOKEN || github.NODE_AUTH_TOKEN || github.NPM_TOKEN)) throw new Error('OIDC publishing is disabled, is a rerun, or has an unexpected credential source');
        if (action === 'check-tag') { log(JSON.stringify({ name: manifest.name, version: manifest.version, tag, commit: head })); return; }
        if (compareVersions(String(npm(['--version'])).trim(), '11.5.1') < 0) throw new Error('Trusted publishing requires npm 11.5.1 or newer');
    }
    const output = resolve(root, '.pi/cache/releases');
    const receiptPath = resolve(output, 'prepared.json');
    const attemptPath = resolve(output, `publish-${manifest.version}.attempt.json`);
    if ((action === 'publish' || ciPublish) && existsSync(attemptPath)) throw new Error('Publication was already attempted. Check the registry; do not retry an uncertain outcome.');
    const current = () => { clean(); if (git('rev-parse', 'HEAD') !== head) throw new Error('HEAD changed during release operation'); };
    if (action === 'prepare') {
        rmSync(receiptPath, { force: true });
        const home = mkdtempSync(resolve(tmpdir(), 'whatsapp-ng-release-'));
        const env = {};
        for (const key of ['PATH', 'Path', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key];
        Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: resolve(home, 'AppData/Roaming'), LOCALAPPDATA: resolve(home, 'AppData/Local'), PI_CODING_AGENT_DIR: resolve(home, 'agent'), PI_OFFLINE: '1', WHATSAPP_NG_LOCALE: 'en' });
        try {
            for (const script of ['test', 'lint', 'typecheck']) {
                log(`Running ${script} with isolated HOME and no inherited credential variables`);
                npm(['run', script, ...(script === 'test' ? ['--', '--maxWorkers=2'] : [])], { env });
            }
        } finally { rmSync(home, { recursive: true, force: true }); }
        const audit = npmJson(['audit', '--omit=dev', '--json', '--registry='+registry]);
        if (audit.metadata?.vulnerabilities?.total !== 0) throw new Error('Production dependency audit is not clean');
        current();
        const directory = resolve(output, `${manifest.version}-${randomUUID()}`); mkdirSync(directory, { recursive: true, mode: 0o700 });
        const [packed] = npmJson(['pack', '--ignore-scripts', '--json', '--pack-destination', directory]);
        if (packed.name !== manifest.name || packed.version !== manifest.version || packed.filename !== `${manifest.name}-${manifest.version}.tgz`) throw new Error('Packed identity differs from source');
        const allowed = new Set(git('ls-files', '-z').split('\0'));
        const required = new Set(['package.json', 'README.md', 'LICENSE', manifest.main, 'src/services/edge-tts.worker.mjs', 'docs/reference.md', 'docs/crispasr.md', 'docs/releases.md']);
        for (const file of packed.files) {
            const name = file.path;
            const publicFile = ['package.json', 'README.md', 'LICENSE', 'SECURITY.md', 'LICENSING.md', 'CHANGELOG.md', 'DEPENDENCIES.md', manifest.main, 'docs/reference.md', 'docs/crispasr.md', 'docs/releases.md'].includes(name)
                || (name.startsWith('src/') && /\.(ts|mjs)$/.test(name));
            if (!publicFile || !allowed.has(name) || name.split('/').some(part => part === '..' || part.startsWith('.')) || !lstatSync(resolve(root, name)).isFile()) throw new Error('Unexpected packaged file');
            required.delete(name);
        }
        if (required.size) throw new Error('Required runtime/license/documentation file is missing');
        const artifact = resolve(directory, packed.filename); const integrity = 'sha512-'+digest(readFileSync(artifact));
        if (packed.integrity !== integrity) throw new Error('Packed integrity mismatch');
        const dry = npmJson(['publish', artifact, '--dry-run', '--ignore-scripts', '--tag', tag, '--access', 'public', '--registry='+registry, '--json']);
        if ((dry[manifest.name] ?? dry).integrity !== integrity) throw new Error('Publish dry-run integrity mismatch');
        current();
        if ('sha512-'+digest(readFileSync(artifact)) !== integrity) throw new Error('Artifact changed during preparation');
        save(receiptPath, { version: 1, name: manifest.name, packageVersion: manifest.version, tag, registry, commit: head, artifact: relative(output, artifact), integrity });
        log(`Prepared ${manifest.name}@${manifest.version} for ${tag}: ${artifact}\nIntegrity: ${integrity}\nReceipt: ${receiptPath}\nNot published. Installed-Pi/live/platform acceptance and host/development audit review remain separate.`); return;
    }
    if (!ciPublish && (rest[1] !== manifest.version || rest[3] !== tag)) throw new Error('Confirm the exact prepared version and matching distribution tag');
    const receipt = json(receiptPath);
    if (receipt.version !== 1 || receipt.name !== manifest.name || receipt.packageVersion !== manifest.version || receipt.tag !== tag || receipt.registry !== registry || receipt.commit !== head
        || typeof receipt.artifact !== 'string' || isAbsolute(receipt.artifact) || receipt.artifact.split(/[\\/]/).includes('..')) throw new Error('Prepared receipt does not match current source');
    const artifact = resolve(output, receipt.artifact);
    if (!lstatSync(artifact).isFile() || lstatSync(artifact).isSymbolicLink() || 'sha512-'+digest(readFileSync(artifact)) !== receipt.integrity) throw new Error('Prepared artifact integrity mismatch');
    // E404 is the only absence proof; successful, blank, auth and network responses never authorize publication.
    let absent = false;
    try { npm(['view', `${manifest.name}@${manifest.version}`, 'version', '--json', '--registry='+registry]); }
    catch (error) { if (error.code !== 'E404') throw error; absent = true; }
    if (!absent) throw new Error('This version already exists in the registry; do not republish');
    if (ciPublish) {
        // Explicit selectors also support an existing prerelease-only package with no latest tag.
        let existingPackage = false;
        for (const existingTag of ['next', 'latest']) {
            try {
                const packageName = npmJson(['view', `${manifest.name}@${existingTag}`, 'name', '--json', '--registry='+registry]);
                if (packageName !== manifest.name) throw new Error('Unexpected registry package identity');
                existingPackage = true; break;
            } catch (error) { if (error.code !== 'E404') throw error; }
        }
        if (!existingPackage) throw new Error('Bootstrap the first package publication manually before enabling OIDC');
    } else npm(['whoami', '--registry='+registry]);
    current();
    if ('sha512-'+digest(readFileSync(artifact)) !== receipt.integrity) throw new Error('Prepared artifact changed');
    const attempt = { ...receipt, startedAt: new Date().toISOString(), outcome: 'unknown' };
    save(attemptPath, attempt, true);
    log(`Publishing ${manifest.name}@${manifest.version} under ${tag}. Never retry an uncertain outcome; check ${attemptPath}.`);
    npm(['publish', artifact, '--ignore-scripts', '--tag', tag, '--access', 'public', '--registry='+registry, ...(ciPublish ? ['--provenance'] : [])], { interactive: !ciPublish });
    save(attemptPath, { ...attempt, outcome: 'npm-command-succeeded' });
    if (ciPublish) {
        const published = npmJson(['view', `${manifest.name}@${manifest.version}`, 'version', 'dist.integrity', '--json', '--registry='+registry]);
        const tags = npmJson(['view', `${manifest.name}@${manifest.version}`, 'dist-tags', '--json', '--registry='+registry]);
        if (published.version !== manifest.version || (published['dist.integrity'] ?? published.dist?.integrity) !== receipt.integrity || tags[tag] !== manifest.version) throw new Error('Publication returned success but registry integrity/tag verification failed; do not republish');
        save(attemptPath, { ...attempt, outcome: 'registry-verified' });
        log(JSON.stringify({ version: manifest.version, tag, integrity: receipt.integrity, next: tags.next, latest: tags.latest }));
    }
    log('npm publish returned success. Verify registry integrity/tag and installed-package behavior before creating the Git tag or GitHub release.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try { release(process.argv.slice(2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
