import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readdir, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BufferJSON } from 'baileys';
import { t } from '../i18n.js';
import { legacyAuthProfiles, type StoragePaths } from './storage-path.js';
import { TransportLease } from './transport-lease.service.js';

type ProfileState = 'empty' | 'stable' | 'adopting' | 'resetting';
interface ProfileMarker { version: 1; state: ProfileState }
const states = new Set<ProfileState>(['empty', 'stable', 'adopting', 'resetting']);
const noFollow = constants.O_NOFOLLOW ?? 0;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

function object(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function bytes(value: unknown, length: number): boolean {
    return value instanceof Uint8Array && value.byteLength === length;
}
function keyPair(value: unknown): boolean {
    const pair = object(value);
    return Boolean(pair && bytes(pair.public, 32) && bytes(pair.private, 32));
}
function integer(value: unknown, minimum: number): boolean {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

// Pinned rc14 required fields/shapes, not cryptographic validity or key-pair verification.
function validCredentials(value: unknown): boolean {
    const creds = object(value);
    if (!creds) return false;
    const preKey = object(creds.signedPreKey);
    const settings = object(creds.accountSettings);
    const me = object(creds.me);
    return keyPair(creds.noiseKey) && keyPair(creds.pairingEphemeralKeyPair) && keyPair(creds.signedIdentityKey)
        && Boolean(preKey && keyPair(preKey.keyPair) && bytes(preKey.signature, 64) && integer(preKey.keyId, 1))
        && integer(creds.registrationId, 0) && (creds.registrationId as number) <= 16383
        && typeof creds.advSecretKey === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(creds.advSecretKey)
        && Buffer.from(creds.advSecretKey, 'base64').toString('base64') === creds.advSecretKey
        && Array.isArray(creds.processedHistoryMessages) && integer(creds.nextPreKeyId, 1)
        && integer(creds.firstUnuploadedPreKeyId, 1) && integer(creds.accountSyncCounter, 0)
        && Boolean(settings && typeof settings.unarchiveChats === 'boolean')
        && typeof creds.registered === 'boolean'
        && (creds.me === undefined || Boolean(me && typeof me.id === 'string' && me.id.length))
        && (!creds.registered || Boolean(me && typeof me.id === 'string' && me.id.length));
}

async function names(directory: string): Promise<string[]> {
    try { return await readdir(directory); }
    catch (error) { if (missing(error)) return []; throw error; }
}

async function readMarker(path: string): Promise<ProfileMarker | undefined> {
    let file;
    try {
        file = await open(path, constants.O_RDONLY | noFollow);
        const info = await file.stat();
        if (!info.isFile() || info.size > 4096) throw new Error();
        const value: unknown = JSON.parse(await file.readFile('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        const marker = value as Partial<ProfileMarker>;
        if (Object.keys(value).length !== 2 || marker.version !== 1 || !marker.state || !states.has(marker.state)) throw new Error();
        return { version: 1, state: marker.state };
    } catch (error) {
        if (missing(error)) return undefined;
        // Never surface JSON parser excerpts from persisted state.
        throw new Error(t('profile.invalidMetadata'));
    } finally { await file?.close(); }
}

/** Auth adoption is a connect-time operation, never a side effect of offline history. */
export class AuthProfileService {
    private marker?: ProfileMarker;
    private readonly markerPath: string;

    constructor(
        private readonly paths: Pick<StoragePaths, 'root' | 'legacyRoot'>,
        private readonly profile: string,
        private readonly lease: TransportLease
    ) {
        this.markerPath = lease.profileDir + '.auth-profile.json';
    }

    static async hasSavedState(paths: Pick<StoragePaths, 'root' | 'legacyRoot'>, profile: string): Promise<boolean> {
        if ((await names(profile)).length) return true;
        const canonical = await realpath(profile).catch(error => { if (missing(error)) return resolve(profile); throw error; });
        const marker = await readMarker(canonical + '.auth-profile.json');
        if (marker) return marker.state !== 'empty';
        for (const source of legacyAuthProfiles(paths, profile)) {
            if ((await names(source)).length) return true;
            const sourcePath = await realpath(source).catch(error => { if (missing(error)) return resolve(source); throw error; });
            const prior = await readMarker(sourcePath + '.auth-profile.json');
            if (prior) return prior.state !== 'empty';
        }
        return false;
    }

    async prepare(): Promise<void> {
        await this.lease.assertProfile(this.profile);
        this.marker = await readMarker(this.markerPath);
        if (this.marker?.state === 'adopting' || this.marker?.state === 'resetting') throw new Error(t('profile.interrupted'));
        const current = await this.inspect(this.lease.profileDir, true);
        if (current.length) {
            if (this.marker?.state !== 'stable') await this.writeMarker('stable');
            return;
        }
        if (this.marker?.state === 'stable') throw new Error(t('profile.invalidAuth'));
        if (this.marker) return; // Explicit reset/new pairing must not resurrect legacy credentials.
        for (const candidate of legacyAuthProfiles(this.paths, this.profile)) {
            let canonical: string;
            try { canonical = await realpath(candidate); }
            catch (error) {
                if (!missing(error)) throw error;
                const prior = await readMarker(resolve(candidate) + '.auth-profile.json');
                if (!prior) continue;
                if (prior.state !== 'empty') throw new Error(t('profile.interrupted'));
                await this.writeMarker('empty');
                return;
            }
            if (canonical === this.lease.profileDir) continue;
            const source = await TransportLease.acquire(candidate);
            try {
                const prior = await readMarker(source.profileDir + '.auth-profile.json');
                if (prior?.state === 'adopting' || prior?.state === 'resetting') throw new Error(t('profile.interrupted'));
                const files = await this.inspect(source.profileDir, false);
                if (!files.length) {
                    if (prior?.state === 'stable') throw new Error(t('profile.invalidAuth'));
                    if (!prior) continue;
                    await this.writeMarker('empty');
                    return;
                }
                await this.writeMarker('adopting');
                let stage: string | undefined = await mkdtemp(join(dirname(this.lease.profileDir), `.${basename(this.lease.profileDir)}.import-`));
                try {
                    for (const name of files) {
                        await source.assertProfile(candidate);
                        const data = await this.readAuthFile(join(source.profileDir, name), false);
                        const file = await open(join(stage, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
                        try { await file.writeFile(data); await file.sync(); }
                        finally { await file.close(); }
                    }
                    await this.syncDirectory(stage);
                    await this.lease.assertProfile(this.profile);
                    if ((await names(this.lease.profileDir)).length) throw new Error(t('profile.invalidAuth'));
                    await rename(stage, this.lease.profileDir);
                    stage = undefined;
                    await this.syncDirectory(dirname(this.lease.profileDir));
                    await this.writeMarker('stable');
                    return;
                } finally { if (stage) await rm(stage, { recursive: true, force: true }); }
            } finally { await source.release(); }
        }
        await this.writeMarker('empty');
    }

    async confirmSaved(): Promise<void> {
        await this.lease.assertProfile(this.profile);
        await this.readAuthFile(join(this.lease.profileDir, 'creds.json'), true);
        if (this.marker?.state !== 'stable') await this.writeMarker('stable');
    }

    async reset(): Promise<void> {
        await this.lease.assertProfile(this.profile);
        if (this.lease.hasAuthScope) throw new Error(t('profile.retireRequired'));
        await readMarker(this.markerPath); // Preserve corrupt/future metadata for explicit recovery.
        await this.writeMarker('resetting');
        const retired = join(dirname(this.lease.profileDir), `.${basename(this.lease.profileDir)}.retired-${randomUUID()}`);
        await rename(this.lease.profileDir, retired);
        try {
            await mkdir(this.lease.profileDir, { mode: 0o700 });
            await this.syncDirectory(dirname(this.lease.profileDir));
            await this.writeMarker('empty');
        } finally {
            // Even a failed recursive cleanup cannot subsequently delete a new owner's files.
            await rm(retired, { recursive: true, force: true });
        }
    }

    private async inspect(directory: string, harden: boolean): Promise<string[]> {
        const entries = await readdir(directory, { withFileTypes: true });
        if (!entries.length) return [];
        if (!entries.some(entry => entry.name === 'creds.json')) throw new Error(t('profile.invalidAuth'));
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) throw new Error(t('profile.invalidAuth'));
            await this.readAuthFile(join(directory, entry.name), harden);
        }
        return entries.map(entry => entry.name);
    }

    private async readAuthFile(path: string, harden: boolean): Promise<Buffer> {
        let file;
        try {
            file = await open(path, constants.O_RDONLY | noFollow);
            if (!(await file.stat()).isFile()) throw new Error();
            if (harden) await file.chmod(0o600);
            const bytes = await file.readFile();
            const value: unknown = JSON.parse(bytes.toString('utf8'), BufferJSON.reviver);
            if (basename(path) === 'creds.json' && !validCredentials(value)) throw new Error();
            return bytes;
        } catch {
            throw new Error(t('profile.invalidAuth'));
        } finally { await file?.close(); }
    }

    private async syncDirectory(path: string): Promise<void> {
        const file = await open(path, constants.O_RDONLY);
        try { await file.sync(); } finally { await file.close(); }
    }

    private async writeMarker(state: ProfileState): Promise<void> {
        await this.lease.assertProfile(this.profile);
        const temp = this.markerPath + `.${randomUUID()}.tmp`;
        let created = false;
        try {
            const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
            created = true;
            try { await file.writeFile(JSON.stringify({ version: 1, state })); await file.sync(); }
            finally { await file.close(); }
            await rename(temp, this.markerPath);
            await this.syncDirectory(dirname(this.markerPath));
            this.marker = { version: 1, state };
        } finally { if (created) await rm(temp, { force: true }); }
    }
}
