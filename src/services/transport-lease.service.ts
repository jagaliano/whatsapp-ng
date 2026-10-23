import { constants, type Stats } from 'node:fs';
import { mkdir, realpath, open, lstat, unlink, chmod } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { t } from '../i18n.js';

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
        let file: FileHandle;
        try {
            file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(t('profile.inUse'));
            throw error;
        }
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
        if (this.scopes.size) throw new Error(t('profile.inUse'));
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
