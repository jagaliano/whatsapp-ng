import { constants, lstatSync, type Stats } from 'node:fs';
import { open, lstat, realpath, readdir, rename, unlink, chmod } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

interface MigrationRequest {
    version: 1;
    source: string;
    destination: string;
    identity: { dev: number; ino: number };
    phase: 'prepared' | 'moved';
}
interface OwnedLock { path: string; file: FileHandle; identity: Pick<Stats, 'dev' | 'ino'> }
interface StartupMigration { phase: 'running' | 'ready' | 'failed'; promise: Promise<boolean> }
type MigrationRuntime = typeof globalThis & { __whatsappNgMigrationStarts?: Map<string, StartupMigration> };
const noFollow = constants.O_NOFOLLOW ?? 0;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const problem = (reason: string) => new Error(`WhatsApp-NG storage migration: ${reason}`);

/** Explicit offline directory transfer. Auth contents are never read, copied or reconstructed. */
export class StateMigrationService {
    static pendingPath(destination: string): string { return resolve(destination) + '.migration.json'; }

    /** CLI flags survive session replacement; only a fresh process may initiate a migration. */
    static async startOnce(destination: string, source?: string): Promise<boolean> {
        destination = resolve(destination);
        const runtime = globalThis as MigrationRuntime;
        const starts = runtime.__whatsappNgMigrationStarts ??= new Map();
        const previous = starts.get(destination);
        if (previous) {
            await previous.promise;
            this.assertReady(destination);
            return false;
        }
        const start: StartupMigration = {
            phase: 'running',
            promise: Promise.resolve().then(async () => {
                try {
                    if (source) await this.queue(source, destination);
                    const moved = await this.runPending(destination);
                    start.phase = 'ready';
                    this.assertReady(destination);
                    return moved;
                } catch (error) { start.phase = 'failed'; throw error; }
            })
        };
        starts.set(destination, start);
        return start.promise;
    }

    static assertReady(destination: string): void {
        const startup = (globalThis as MigrationRuntime).__whatsappNgMigrationStarts?.get(resolve(destination));
        if (startup && startup.phase !== 'ready') throw problem('startup migration has not completed; a fresh process is required');
        for (const path of [this.pendingPath(destination), resolve(destination) + '.migration-lock']) {
            try { lstatSync(path); }
            catch (error) { if (missing(error)) continue; throw problem('cannot inspect pending migration safely'); }
            throw problem('pending or owned; finish the migration before initializing storage');
        }
    }

    static async queue(source: string, destination: string): Promise<void> {
        source = await this.canonicalPath(source);
        destination = await this.canonicalPath(destination);
        if (this.contains(source, destination) || this.contains(destination, source)) throw problem('overlapping paths');
        const lock = await this.acquire(destination + '.migration-lock');
        try {
            const previous = await this.readRequest(destination);
            if (previous) {
                if (previous.source !== source) throw problem('another source request already exists');
                return;
            }
            const info = await this.directory(source);
            if (!Number.isSafeInteger(info.dev) || !Number.isSafeInteger(info.ino)) throw problem('directory identity is not representable safely');
            if (await this.info(destination)) throw problem('destination already exists; merging is forbidden');
            const parent = await this.directory(dirname(destination));
            if (info.dev !== parent.dev) throw problem('cross-filesystem move is unsupported; no credential-copy fallback');
            await this.atomic(this.pendingPath(destination), {
                version: 1, source, destination, identity: { dev: info.dev, ino: info.ino }, phase: 'prepared'
            });
        } finally { await this.release(lock); }
    }

    static async runPending(destination: string): Promise<boolean> {
        // A first offline startup has no parent directory or request yet; it must remain side-effect free.
        if (!await this.info(this.pendingPath(destination))) return false;
        destination = await this.canonicalPath(destination);
        const request = await this.readRequest(destination);
        if (!request) return false;
        const locks: OwnedLock[] = [];
        let completed = false;
        let failure: unknown;
        try {
            for (const root of [request.source, destination].sort()) locks.push(await this.acquire(root + '.migration-lock'));
            const source = await this.info(request.source);
            const target = await this.info(destination);
            if (source) {
                if (target) throw problem('destination already exists; merging is forbidden');
                this.assertIdentity(source, request.identity);
                await this.validateTree(request.source);
                await this.directory(dirname(destination));
                const parent = await lstat(dirname(destination));
                if (parent.dev !== source.dev) throw problem('cross-filesystem move is unsupported');
                await this.assertLogTransfer(request.source, basename(request.source) + '.log');
                this.assertIdentity(await this.directory(request.source), request.identity);
                if (await this.info(destination)) throw problem('destination appeared during preparation');
                await rename(request.source, destination);
                await this.syncDirectory(dirname(request.source));
                if (dirname(request.source) !== dirname(destination)) await this.syncDirectory(dirname(destination));
                request.phase = 'moved';
                await this.atomic(this.pendingPath(destination), request);
            } else {
                if (!target) throw problem('source and destination are missing; preserve the request for recovery');
                this.assertIdentity(target, request.identity);
            }
            // A directory identity match also handles a crash between rename and journal update.
            this.assertIdentity(await this.directory(destination), request.identity);
            await this.validateTree(destination);
            await chmod(destination, 0o700);
            await chmod(join(destination, 'config.json'), 0o600);
            const oldLog = basename(request.source) + '.log';
            await this.assertLogTransfer(destination, oldLog);
            if (oldLog !== 'whatsapp-ng.log' && await this.info(join(destination, oldLog))) {
                await rename(join(destination, oldLog), join(destination, 'whatsapp-ng.log'));
                await this.syncDirectory(destination);
            }
            // Re-read before removal: another request must never be silently discarded.
            const current = await this.readRequest(destination);
            if (!current || current.source !== request.source || current.identity.dev !== request.identity.dev || current.identity.ino !== request.identity.ino) {
                throw problem('request identity changed; explicit recovery required');
            }
            await unlink(this.pendingPath(destination));
            await this.syncDirectory(dirname(destination));
            completed = true;
        } catch (error) {
            failure = error;
        } finally {
            const failures: unknown[] = [];
            for (const lock of locks.reverse()) {
                try {
                    await this.release(lock);
                } catch (error) { failures.push(error); }
            }
            if (failures.length && !failure) failure = problem('migration lock cleanup failed; explicit recovery required');
        }
        if (failure) throw failure;
        return completed;
    }

    private static contains(root: string, path: string): boolean {
        const child = relative(root, path);
        return child === '' || (!child.startsWith('..' + sep) && child !== '..' && !isAbsolute(child));
    }

    private static async canonicalPath(path: string): Promise<string> {
        if (!isAbsolute(path) || resolve(path) === dirname(resolve(path))) throw problem('an absolute non-root path is required');
        path = resolve(path);
        const leaf = await this.info(path);
        if (leaf?.isSymbolicLink()) throw problem('symlink root path is forbidden');
        return join(await realpath(dirname(path)), basename(path));
    }

    private static async info(path: string): Promise<Stats | undefined> {
        try { return await lstat(path); }
        catch (error) { if (missing(error)) return undefined; throw problem('cannot inspect path safely'); }
    }

    private static async directory(path: string): Promise<Stats> {
        const info = await this.info(path);
        if (!info?.isDirectory() || info.isSymbolicLink()) throw problem('directory path missing or unsafe');
        if (process.getuid && info.uid !== process.getuid()) throw problem('directory is not owned by the current user');
        return info;
    }

    private static assertIdentity(info: Stats, identity: MigrationRequest['identity']): void {
        if (!info.isDirectory() || info.isSymbolicLink() || info.dev !== identity.dev || info.ino !== identity.ino) throw problem('directory identity changed');
    }

    private static async readRequest(destination: string): Promise<MigrationRequest | undefined> {
        let file: FileHandle | undefined;
        try {
            file = await open(this.pendingPath(destination), constants.O_RDONLY | noFollow);
            const info = await file.stat();
            if (!info.isFile() || info.size > 16384) throw new Error();
            const value = JSON.parse(await file.readFile('utf8')) as Partial<MigrationRequest>;
            if (Object.keys(value).sort().join(',') !== 'destination,identity,phase,source,version' || value.version !== 1
                || value.destination !== destination || typeof value.source !== 'string' || !isAbsolute(value.source)
                || !value.identity || Object.keys(value.identity).sort().join(',') !== 'dev,ino'
                || !Number.isSafeInteger(value.identity.dev) || !Number.isSafeInteger(value.identity.ino)
                || !['prepared', 'moved'].includes(value.phase ?? '')) throw new Error();
            if (this.contains(value.source, destination) || this.contains(destination, value.source)) throw new Error();
            return value as MigrationRequest;
        } catch (error) {
            if (missing(error)) return undefined;
            throw problem('invalid or unsupported request metadata; original preserved');
        } finally { await file?.close(); }
    }

    private static async validateTree(root: string): Promise<void> {
        const config = await this.info(join(root, 'config.json'));
        if (!config?.isFile() || config.isSymbolicLink()) throw problem('configuration file missing or unsafe');
        const configFile = await open(join(root, 'config.json'), constants.O_RDONLY | noFollow);
        try {
            if ((await configFile.stat()).size > 1024 * 1024) throw problem('configuration exceeds migration budget');
            let value: Record<string, unknown>;
            try { value = JSON.parse(await configFile.readFile('utf8')) as Record<string, unknown>; }
            catch { throw problem('invalid configuration; original preserved'); }
            if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.allowList)
                || ['allowedGroups', 'ignoredNumbers'].some(key => value[key] !== undefined && !Array.isArray(value[key]))) throw problem('invalid configuration; original preserved');
        } finally { await configFile.close(); }
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (!/^auth(?:[-_].*)?$/.test(entry.name) || entry.name.endsWith('.auth-profile.json')) continue;
            if (!entry.isDirectory() || entry.isSymbolicLink()) throw problem('unsafe auth profile directory');
            const names = await readdir(join(root, entry.name));
            if (names.length && !names.includes('creds.json')) throw problem('incomplete native profile; original preserved');
        }
        let count = 0;
        const visit = async (path: string): Promise<void> => {
            for (const entry of await readdir(path, { withFileTypes: true })) {
                if (++count > 100000) throw problem('file inventory limit exceeded');
                const file = join(path, entry.name);
                const info = await lstat(file);
                if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw problem('unsafe symlink or nonregular file');
                if (entry.name.endsWith('.transport-lock') || entry.name.endsWith('.migration-lock') || entry.name.endsWith('.lock')) throw problem('runtime lock remains; stop all owners and recover locks explicitly');
                if (/^config\.json\..*\.tmp$/.test(entry.name) || /^\.auth.*(?:import|retired)/.test(entry.name)) throw problem('interrupted state requires explicit recovery');
                if (path === root && entry.name.endsWith('.auth-profile.json')) {
                    const fileHandle = await open(file, constants.O_RDONLY | noFollow);
                    try {
                        if ((await fileHandle.stat()).size > 4096) throw problem('invalid profile metadata');
                        let marker;
                        try { marker = JSON.parse(await fileHandle.readFile('utf8')) as { version?: number; state?: string }; }
                        catch { throw problem('invalid profile metadata'); }
                        if (Object.keys(marker).sort().join(',') !== 'state,version' || marker.version !== 1 || !['empty', 'stable'].includes(marker.state ?? '')) throw problem('interrupted or unsupported profile metadata');
                    } finally { await fileHandle.close(); }
                }
                if (info.isDirectory()) await visit(file);
            }
        };
        await visit(root);
    }

    private static async assertLogTransfer(root: string, sourceName: string): Promise<void> {
        if (sourceName === 'whatsapp-ng.log') return;
        if (await this.info(join(root, sourceName)) && await this.info(join(root, 'whatsapp-ng.log'))) throw problem('destination log conflict; originals preserved');
    }

    private static async acquire(path: string): Promise<OwnedLock> {
        let file: FileHandle;
        try { file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600); }
        catch { throw problem('migration lock exists or cannot be acquired; no takeover'); }
        const identity = await file.stat();
        try { await file.writeFile(JSON.stringify({ version: 1, pid: process.pid, token: randomUUID() })); await file.sync(); }
        catch {
            await this.release({ path, file, identity });
            throw problem('cannot persist migration lock');
        }
        return { path, file, identity };
    }

    private static async release(lock: OwnedLock): Promise<void> {
        try {
            const current = await lstat(lock.path);
            if (!current.isFile() || current.dev !== lock.identity.dev || current.ino !== lock.identity.ino) throw problem('migration lock identity changed');
            await unlink(lock.path);
        } finally { await lock.file.close(); }
    }

    private static async atomic(path: string, value: unknown): Promise<void> {
        const temp = path + '.' + randomUUID() + '.tmp';
        const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
        try {
            try { await file.writeFile(JSON.stringify(value)); await file.sync(); }
            finally { await file.close(); }
            await rename(temp, path);
            await this.syncDirectory(dirname(path));
        } catch (error) {
            try { await unlink(temp); } catch (cleanup) { if (!missing(cleanup)) throw problem('temporary journal cleanup failed'); }
            throw error;
        }
    }

    private static async syncDirectory(path: string): Promise<void> {
        const file = await open(path, constants.O_RDONLY);
        try { await file.sync(); } finally { await file.close(); }
    }
}
