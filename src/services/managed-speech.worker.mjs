// Owns one foreground server/endpoint lease; parent IPC loss retires it without Pi exit hooks.
import { spawn, execFile } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { promisify } from 'node:util';
import { mkdir, lstat, open, rm, readdir, readlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const { AbortController, AbortSignal, fetch } = globalThis;
const execFileAsync = promisify(execFile);
const controller = new AbortController();
let child; let exited; let childClosed = false; let stopping = false; let started = false;
let leaseFile; let leasePath; let identity; let descriptor; let apiKey; let checking; let startup;
const send = data => { if (process.connected) { try { process.send(data, () => {}); } catch { /* Parent already gone. */ } } };
const failure = code => Object.assign(new Error('Managed speech worker failure'), { code });
const alive = () => child && !childClosed && child.exitCode === null && !child.signalCode && !stopping;

async function releaseLease() {
    try {
        if (identity && leasePath) {
            const current = await lstat(leasePath, { bigint: true });
            if (current.isFile() && current.dev === identity.dev && current.ino === identity.ino) await rm(leasePath);
            else send({ type: 'notice', code: 'lease-cleanup' });
        }
    } catch { send({ type: 'notice', code: 'lease-cleanup' }); }
    try { await leaseFile?.close(); } catch { send({ type: 'notice', code: 'lease-cleanup' }); }
}
function signalOwned(signal) {
    if (!child || childClosed || !child.pid || child.exitCode !== null || child.signalCode) return;
    try { process.kill(-child.pid, signal); } catch { /* A settled child has no group to signal. */ }
}
async function stop(code) {
    if (stopping) return;
    stopping = true; controller.abort();
    if (code) send({ type: 'failed', code });
    await startup?.catch(() => {});
    if (child && !childClosed) {
        signalOwned('SIGTERM');
        await Promise.race([exited, delay(3000)]);
        if (!childClosed) { signalOwned('SIGKILL'); await Promise.race([exited, delay(2000)]); }
    }
    if (!child || childClosed) await releaseLease();
    else send({ type: 'notice', code: 'retirement-unconfirmed' });
    process.exit(code || !childClosed && child ? 1 : 0);
}
async function occupied(url) {
    return new Promise((resolve, reject) => {
        const socket = createConnection({ host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port) });
        const done = (error, result) => { socket.destroy(); error ? reject(failure('port-conflict')) : resolve(result); };
        socket.once('connect', () => done(undefined, true));
        socket.once('error', error => done(error.code === 'ECONNREFUSED' ? undefined : error, false));
        socket.setTimeout(1000, () => done(failure('port-conflict')));
    });
}
async function boundedFile(path, limit) {
    const file = await open(path, constants.O_RDONLY);
    try {
        const bytes = Buffer.alloc(limit + 1); let size = 0;
        while (size < bytes.length) { const { bytesRead } = await file.read(bytes, size, bytes.length - size, null); if (!bytesRead) break; size += bytesRead; }
        if (size > limit) throw failure('ownership');
        return bytes.subarray(0, size).toString('utf8');
    } finally { await file.close(); }
}
async function ownsListener(deadline = Infinity) {
    if (!alive()) return false;
    const url = new URL(descriptor.endpoint); const host = url.hostname;
    if (process.platform === 'darwin') {
        try {
            const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-nP', '-a', '-p', String(child.pid), '-iTCP:' + url.port, '-sTCP:LISTEN', '-Fn'],
                { timeout: Math.max(1, Math.min(1000, deadline - Date.now())), maxBuffer: 64 * 1024, env: { PATH: '/usr/bin:/bin:/usr/sbin' } });
            return alive() && stdout.split('\n').includes(`n${host}:${url.port}`);
        } catch (error) { if (error.code === 1) return false; throw failure(error.killed ? 'probe' : 'ownership'); }
    }
    if (process.platform !== 'linux') throw failure('platform');
    const names = await readdir(`/proc/${child.pid}/fd`); if (names.length > 4096) throw failure('ownership');
    const sockets = new Set();
    await Promise.all(names.map(async name => { try { const link = await readlink(`/proc/${child.pid}/fd/${name}`); const match = /^socket:\[(\d+)\]$/.exec(link); if (match) sockets.add(match[1]); } catch { /* A closing descriptor grants nothing. */ } }));
    const expectedAddress = host === '[::1]' ? '00000000000000000000000001000000' : host.split('.').reverse().map(value => Number(value).toString(16).padStart(2, '0')).join('').toUpperCase();
    let text;
    try { text = await boundedFile(host === '[::1]' ? '/proc/net/tcp6' : '/proc/net/tcp', 1024 * 1024); } catch { throw failure('ownership'); }
    return alive() && text.split('\n').slice(1).some(line => {
        const fields = line.trim().split(/\s+/); const address = fields[1]?.split(':');
        return fields[3] === '0A' && address?.[0] === expectedAddress && parseInt(address[1], 16) === Number(url.port) && sockets.has(fields[9]);
    });
}
async function json(path, authenticated = false, deadline = Infinity) {
    controller.signal.throwIfAborted();
    const response = await fetch(new URL(path, descriptor.endpoint), { redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now())))]),
        headers: authenticated ? { Authorization: `Bearer ${apiKey}` } : {} });
    if (!response.ok) { await response.body?.cancel(); return undefined; }
    if (Number(response.headers.get('content-length')) > 16_384 || !response.body) { await response.body?.cancel(); throw failure('probe'); }
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
        while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16_384) throw failure('probe'); chunks.push(Buffer.from(value)); }
        return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); }
}
const fatalProbe = error => ['ownership', 'backend', 'model', 'platform', 'configuration'].includes(error?.code);
async function probe(starting = false, deadline = Infinity) {
    const owned = async () => {
        if (await ownsListener(deadline)) return true;
        if (!starting) throw failure('ownership');
        return false;
    };
    if (!await owned()) return false;
    const health = await json('/health', false, deadline);
    if (!health || health.status !== 'ok' || typeof health.backend !== 'string') return false;
    if (health.backend !== descriptor.backend) throw failure('backend');
    // Never send credentials before proving the listener belongs to this still-live child.
    if (!await owned()) return false;
    const models = await json('/v1/models', true, deadline);
    if (!models || !Array.isArray(models.data) || !models.data.length
        || models.data.some(model => !model || typeof model.id !== 'string' || typeof model.backend !== 'string' || typeof model.owned_by !== 'string')) return false;
    if (!models.data.some(model => model.id === descriptor.loadedModel && model.backend === descriptor.backend && model.owned_by === 'crispasr')) throw failure('model');
    return await owned();
}
async function start(message) {
    if (started || stopping) return;
    started = true; descriptor = message.command; apiKey = message.key;
    try {
        if (!['darwin', 'linux'].includes(process.platform) || !descriptor || !Array.isArray(descriptor.args)
            || typeof message.leaseRoot !== 'string' || !/^[a-f0-9]{64}$/.test(message.lease)) throw failure('configuration');
        await mkdir(message.leaseRoot, { recursive: true, mode: 0o700 });
        const directory = await lstat(message.leaseRoot); if (!directory.isDirectory() || directory.isSymbolicLink()) throw failure('configuration');
        leasePath = join(message.leaseRoot, message.lease + '.lock');
        try { leaseFile = await open(leasePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); }
        catch (error) { throw failure(error.code === 'EEXIST' ? 'lease-busy' : 'configuration'); }
        identity = await leaseFile.stat({ bigint: true }); await leaseFile.writeFile(JSON.stringify({ version: 1, pid: process.pid, token: randomUUID() }));
        if (stopping) return;
        if (await occupied(new URL(descriptor.endpoint))) throw failure('port-conflict');
        if (stopping) return;
        child = spawn(descriptor.executable, descriptor.args, { cwd: descriptor.cwd, env: message.childEnv, detached: true, stdio: 'ignore' });
        exited = new Promise(resolve => child.once('close', () => { childClosed = true; resolve(); }));
        child.once('error', () => { void stop('spawn'); });
        child.once('exit', () => { if (!stopping) void stop('server-exited'); });
        const deadline = Date.now() + descriptor.startupTimeoutMs;
        while (!stopping && Date.now() < deadline) {
            try { if (await probe(true, deadline)) { if (!stopping && alive()) send({ type: 'ready' }); return; } }
            catch (error) { if (fatalProbe(error)) throw error; }
            await delay(100, undefined, { signal: controller.signal });
        }
        if (!stopping) throw failure('startup-timeout');
    } catch (error) { if (!stopping) void stop(['lease-busy', 'configuration', 'port-conflict', 'spawn', 'startup-timeout', 'ownership', 'backend', 'model', 'platform'].includes(error.code) ? error.code : 'probe'); }
}
process.on('message', message => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'start') startup = start(message);
    else if (message.type === 'stop') void stop();
    else if (message.type === 'check' && typeof message.id === 'number') {
        checking ??= probe().finally(() => { checking = undefined; });
        void checking.then(ok => { send({ type: 'checked', id: message.id, ok: ok && !stopping, fatal: false }); }, error => {
            const fatal = fatalProbe(error);
            send({ type: 'checked', id: message.id, ok: false, fatal, code: fatal ? error.code : 'probe' });
            if (fatal && !stopping) void stop(error.code);
        });
    }
});
process.on('disconnect', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
process.on('SIGHUP', () => { void stop(); });
process.on('uncaughtException', () => { void stop('worker-error'); });
process.on('unhandledRejection', () => { void stop('worker-error'); });
// A manually launched worker has no parent authority and must never keep itself alive.
if (!process.connected) void stop();
