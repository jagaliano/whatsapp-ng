import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rename, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PROFILE_IN_USE, TransportLease } from '../../src/services/transport-lease.service.ts';

let root: string;
let leases: TransportLease[];
function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}
async function acquire(profile = join(root, 'auth')) {
    const lease = await TransportLease.acquire(profile);
    leases.push(lease);
    return lease;
}
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-lease-')); leases = []; });
afterEach(async () => {
    await Promise.allSettled(leases.map(lease => lease.release()));
    await rm(root, { recursive: true, force: true });
});

describe('TransportLease', () => {
    it('excludes another owner before auth access and releases idempotently', async () => {
        const profile = join(root, 'auth');
        const first = await acquire(profile);
        await expect(TransportLease.acquire(profile)).rejects.toMatchObject({ code: PROFILE_IN_USE });
        const closing = first.release();
        expect(first.release()).toBe(closing);
        await closing;
        const second = await acquire(profile);
        expect(second.isHeld).toBe(true);
    });
    it('does not serialize independent profiles', async () => {
        const first = await acquire(join(root, 'a'));
        const second = await acquire(join(root, 'b'));
        expect(first.isHeld && second.isHeld).toBe(true);
    });
    it('protects its lock metadata and auth directory under umask 022', async () => {
        const previous = process.umask(0o022);
        try {
            const lease = await acquire();
            expect((await stat(lease.profileDir)).mode & 0o777).toBe(0o700);
            expect((await stat(lease.profileDir + '.transport-lock')).mode & 0o777).toBe(0o600);
            const owner = JSON.parse(await readFile(lease.profileDir + '.transport-lock', 'utf8'));
            expect(owner).toEqual({ version: 1, pid: process.pid, token: expect.any(String) });
        } finally { process.umask(previous); }
    });
    it.each(['unrecognized lock', JSON.stringify({ version: 1, pid: 2147483647, token: 'synthetic-stale' })])(
        'does not steal an unknown/stale lock (%s)', async content => {
            const profile = join(root, 'auth'); await mkdir(profile);
            const lock = profile + '.transport-lock';
            await writeFile(lock, content, { mode: 0o600 });
            await expect(TransportLease.acquire(profile)).rejects.toThrow(/profile.*use/i);
            expect(await readFile(lock, 'utf8')).toBe(content);
        }
    );
    it('canonicalizes aliases to the same physical auth profile', async () => {
        const first = await acquire(); const alias = join(root, 'alias');
        await symlink(first.profileDir, alias, 'dir');
        await expect(TransportLease.acquire(alias)).rejects.toThrow(/profile.*use/i);
    });
    it('rejects an auth operation if its profile alias changes', async () => {
        const profile = join(root, 'auth'); await mkdir(profile);
        const alias = join(root, 'alias'); await symlink(profile, alias, 'dir');
        const lease = await acquire(alias); const scope = lease.createScope(alias);
        const other = join(root, 'other'); await mkdir(other);
        await unlink(alias); await symlink(other, alias, 'dir');
        let writes = 0;
        await expect(scope.run(() => { writes++; })).rejects.toThrow(/profile.*changed/i);
        expect(writes).toBe(0);
        await lease.release();
    });
    it('never removes a replaced foreign lock and fences further auth writes', async () => {
        const lease = await acquire(); const scope = lease.createScope(lease.profileDir);
        const path = lease.profileDir + '.transport-lock';
        await rename(path, path + '.original');
        await writeFile(path, 'foreign owner', { mode: 0o600 });
        let writes = 0;
        await expect(scope.run(() => { writes++; })).rejects.toThrow(/lock ownership changed/i);
        await expect(lease.release()).rejects.toThrow(/lock ownership changed/i);
        expect(writes).toBe(0);
        expect(await readFile(path, 'utf8')).toBe('foreign owner');
    });
    it('drains admitted writes before unlock and rejects late callbacks', async () => {
        const lease = await acquire(); const scope = lease.createScope(lease.profileDir);
        const started = deferred(); const finish = deferred();
        const order: string[] = [];
        const first = scope.run(async () => { order.push('first-start'); started.resolve(); await finish.promise; order.push('first-end'); });
        const second = scope.run(() => { order.push('second'); });
        await started.promise;
        const closing = lease.release();
        expect(() => lease.createScope(lease.profileDir)).toThrow(/closed/i);
        await expect(scope.run(() => { order.push('late'); })).rejects.toThrow(/closed/i);
        await expect(TransportLease.acquire(lease.profileDir)).rejects.toThrow(/profile.*use/i);
        expect(order).toEqual(['first-start']);
        finish.resolve(); await first; await second; await closing;
        expect(order).toEqual(['first-start', 'first-end', 'second']);
        await acquire(lease.profileDir);
        await expect(scope.run(() => { order.push('late'); })).rejects.toThrow(/closed/i);
    });
    it('requires the preceding auth generation to retire before opening another', async () => {
        const lease = await acquire(); const first = lease.createScope(lease.profileDir);
        expect(() => lease.createScope(lease.profileDir)).toThrow(/profile.*use/i);
        await first.close();
        const second = lease.createScope(lease.profileDir);
        await expect(first.run(() => 'late')).rejects.toThrow(/closed/i);
        await expect(second.run(() => 'current')).resolves.toBe('current');
    });
    it('does not poison the I/O queue after a failed admitted operation', async () => {
        const lease = await acquire(); const scope = lease.createScope(lease.profileDir);
        await expect(scope.run(() => { throw new Error('synthetic I/O failure'); })).rejects.toThrow('synthetic I/O failure');
        await expect(scope.run(() => 'next')).resolves.toBe('next');
        await scope.close();
        await expect(scope.run(() => 'late')).rejects.toThrow(/closed/i);
    });
});
