import { constants, type Stats } from 'node:fs';
import { mkdir, realpath, open, lstat, unlink, chmod, readFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { t } from '../i18n.js';

export const PROFILE_IN_USE = 'WHATSAPP_NG_PROFILE_IN_USE';

/** Admitted auth I/O settles in order; retired callbacks cannot start more work. */
export class AuthOperationScope {
    private accepting = true;
    private tail: Promise<void> = Promise.resolve();

    constructor(private readonly checkOwner: () => Promise<void>, private readonly onClosed: () => void) {}

    get isOpen(): boolean { return this.accepting; }

    run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
        if (!this.accepting) return Promise.reject(new Error(t('profile.authClosed')));
        const work = this.tail.then(async () => {
            await this.checkOwner();
            return operation();
        });
        this.tail = work.then(() => {}, () => {});
        return work;
    }

    async close(): Promise<void> {
        this.accepting = false;
        await this.tail;
        this.onClosed();
    }
}

/** Cooperative process exclusion, independent of archive writer locking. */
export class TransportLease {
    private held = true;
    private releasing?: Promise<void>;
    private readonly scopes = new Set<AuthOperationScope>();

    private constructor(
        readonly profileDir: string,
        private readonly path: string,
        private readonly file: FileHandle,
        private readonly identity: Pick<Stats, 'dev' | 'ino'>
    ) {}

    static async acquire(profile: string): Promise<TransportLease> {
        await mkdir(profile, { recursive: true, mode: 0o700 });
        const canonical = await realpath(profile);
        // Sibling survives an explicitly authorized auth reset; it is not auth data.
        const path = canonical + '.transport-lock';
        const file = await TransportLease.openLockFile(path);
        let identity: Stats;
        try { identity = await file.stat(); }
        catch (error) { await file.close(); throw error; }
        const lease = new TransportLease(canonical, path, file, identity);
        try {
            await file.writeFile(JSON.stringify({ version: 1, pid: process.pid, token: randomUUID() }));
            await file.sync();
            await chmod(canonical, 0o700);
            return lease;
        } catch (error) {
            await lease.release();
            throw error;
        }
    }

    /**
     * A crashed owner leaves the lock behind: the file survives the process, so a
     * plain O_EXCL open would block every later start forever. Reclaim it only when
     * the recorded pid is provably gone, and only when the file is unchanged.
     */
    private static async openLockFile(path: string): Promise<FileHandle> {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                // false: a live or unverifiable owner holds it; true: stale lock reclaimed, retry.
                if (!await TransportLease.reclaimStale(path)) throw Object.assign(new Error(t('profile.inUse')), { code: PROFILE_IN_USE });
            }
        }
        throw Object.assign(new Error(t('profile.inUse')), { code: PROFILE_IN_USE });
    }

    private static pidAlive(pid: number): boolean {
        try { process.kill(pid, 0); return true; }
        catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
    }

    private static async reclaimStale(path: string): Promise<boolean> {
        let raw: string;
        try { raw = await readFile(path, 'utf8'); }
        catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT'; }
        let pid: number | undefined;
        try {
            const owner = JSON.parse(raw) as { pid?: unknown };
            if (typeof owner.pid === 'number' && Number.isSafeInteger(owner.pid) && owner.pid > 0) pid = owner.pid;
        } catch { return false; }
        if (pid === undefined || pid === process.pid) return false;
        if (TransportLease.pidAlive(pid)) return false;
        const current = await readFile(path, 'utf8').catch(() => undefined);
        if (current !== raw) return false;
        try { await unlink(path); return true; }
        catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT'; }
    }

    get isHeld(): boolean { return this.held && !this.releasing; }
    get hasAuthScope(): boolean { return this.scopes.size > 0; }

    async assertProfile(profile: string): Promise<void> {
        if (!this.held || await realpath(profile) !== this.profileDir) throw new Error(t('profile.changed'));
        const current = await lstat(this.path);
        if (!current.isFile() || current.dev !== this.identity.dev || current.ino !== this.identity.ino) {
            throw new Error(t('profile.lockChanged'));
        }
    }

    createScope(profile: string): AuthOperationScope {
        if (!this.isHeld) throw new Error(t('profile.authClosed'));
        if (this.scopes.size) throw Object.assign(new Error(t('profile.inUse')), { code: PROFILE_IN_USE });
        const scope = new AuthOperationScope(() => this.assertProfile(profile), () => this.scopes.delete(scope));
        this.scopes.add(scope);
        return scope;
    }

    release(): Promise<void> {
        this.releasing ??= this.releaseOwnedFile();
        return this.releasing;
    }

    private async releaseOwnedFile(): Promise<void> {
        try {
            // close() seals synchronously, then waits for all already admitted I/O.
            await Promise.all([...this.scopes].map(scope => scope.close()));
            const current = await lstat(this.path);
            if (!current.isFile() || current.dev !== this.identity.dev || current.ino !== this.identity.ino) {
                throw new Error(t('profile.lockChanged'));
            }
            await unlink(this.path);
        } finally {
            this.held = false;
            await this.file.close();
        }
    }
}
