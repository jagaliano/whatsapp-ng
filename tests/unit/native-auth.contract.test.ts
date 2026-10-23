import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionManager } from '../../src/services/session.manager.ts';
import { TransportLease } from '../../src/services/transport-lease.service.ts';
import { serializedCredentials } from '../fixtures/auth-creds.ts';

const fixture = vi.hoisted(() => ({ home: '/__wa_native_auth_fixture__' }));
vi.mock('os', async importOriginal => ({ ...await importOriginal<typeof import('node:os')>(), homedir: () => fixture.home }));
let root: string;
let leases: TransportLease[];
let children: Array<{ child: ChildProcess; exited: Promise<number | null> }>;
async function deadline<T>(work: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work, new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Native auth fixture deadline')), 5000);
    })]); } finally { clearTimeout(timeout); }
}
async function seed(path: string) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    // Complete pinned-schema fixture with deliberately non-cryptographic bytes.
    await writeFile(join(path, 'creds.json'), serializedCredentials(), { mode: 0o600 });
}
async function guarded() {
    const manager = new SessionManager(join(root, 'current'), join(root, 'current'));
    const lease = await TransportLease.acquire(manager.getAuthStateDir()); leases.push(lease);
    await seed(lease.profileDir);
    return { manager, lease, auth: await manager.getAuthState(lease) };
}
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wa-native-auth-')); fixture.home = join(root, 'empty-home'); leases = []; children = [];
});
afterEach(async () => {
    for (const { child, exited } of children) {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        await deadline(exited);
    }
    await Promise.allSettled(leases.map(lease => lease.release()));
    await rm(root, { recursive: true, force: true });
});

describe('pinned Baileys native auth contract', () => {
    it('characterizes first rejection while a native FIFO write remains pending', async () => {
        const folder = join(root, 'raw'); await seed(folder);
        await mkdir(join(folder, 'session-a.json'));
        const fifo = join(folder, 'session-b.json');
        expect(spawnSync('mkfifo', [fifo]).status).toBe(0);
        const moduleUrl = pathToFileURL(createRequire(import.meta.url).resolve('baileys')).href;
        const program = `import { useMultiFileAuthState } from ${JSON.stringify(moduleUrl)};
            const auth = await useMultiFileAuthState(${JSON.stringify(folder)});
            try { await auth.state.keys.set({ session: { a: Uint8Array.of(1), b: Uint8Array.of(2) } }); }
            catch (error) { process.stdout.write(JSON.stringify({ phase: 'first-rejection', code: error.code }) + '\\n'); }`;
        const child = spawn(process.execPath, ['--input-type=module', '--eval', program], { stdio: ['ignore', 'pipe', 'pipe'] });
        const exited = new Promise<number | null>(done => {
            child.once('exit', code => done(code)); child.once('error', () => done(-1));
        });
        children.push({ child, exited });
        const [chunk] = await deadline(once(child.stdout!, 'data'));
        expect(JSON.parse(String(chunk))).toEqual({ phase: 'first-rejection', code: 'EISDIR' });
        expect(child.exitCode).toBeNull();
        // Only now open a reader: any received data was written AFTER first rejection.
        const reader = await open(fifo, constants.O_RDONLY | constants.O_NONBLOCK);
        try {
            expect(await deadline(exited)).toBe(0);
            const data = Buffer.alloc(4096);
            expect((await reader.read(data, 0, data.length, null)).bytesRead).toBeGreaterThan(0);
        } finally { await reader.close(); }
    });
    it('never submits the second native write when the first guarded write fails', async () => {
        const { lease, auth } = await guarded();
        await mkdir(join(lease.profileDir, 'session-a.json'));
        await expect(auth.state.keys.set({ session: { a: Uint8Array.of(1), b: Uint8Array.of(2) } })).rejects.toMatchObject({ code: 'EISDIR' });
        await lease.release();
        const next = await TransportLease.acquire(lease.profileDir); leases.push(next);
        await new Promise<void>(done => setImmediate(done));
        await expect(stat(join(lease.profileDir, 'session-b.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    it('keeps newly saved native credentials private and fences retired handles', async () => {
        const { manager, lease, auth } = await guarded();
        const previous = process.umask(0o022);
        try {
            await unlink(join(lease.profileDir, 'creds.json'));
            await auth.saveCreds();
            expect((await stat(join(lease.profileDir, 'creds.json'))).mode & 0o777).toBe(0o600);
            await manager.deleteAuthState(lease);
            await expect(auth.saveCreds()).rejects.toThrow(/closed/i);
            await expect(auth.state.keys.set({})).rejects.toThrow(/closed/i);
        } finally { process.umask(previous); }
    });
    it('accepts fresh native rc14 credentials without constructing a socket', async () => {
        const manager = new SessionManager(join(root, 'fresh'), join(root, 'fresh'));
        const lease = await TransportLease.acquire(manager.getAuthStateDir()); leases.push(lease);
        const auth = await manager.getAuthState(lease);
        await auth.saveCreds();
        expect((await stat(join(lease.profileDir, 'creds.json'))).mode & 0o777).toBe(0o600);
    });
    it('protects native key files with a private directory, without claiming a native leaf-mode guarantee', async () => {
        const { lease, auth } = await guarded(); const previous = process.umask(0o022);
        try {
            await auth.state.keys.set({ session: { fixture: Uint8Array.of(1) } });
            expect((await stat(lease.profileDir)).mode & 0o777).toBe(0o700);
            expect((await stat(join(lease.profileDir, 'session-fixture.json'))).mode & 0o777).toBe(0o644);
        } finally { process.umask(previous); }
    });
});
