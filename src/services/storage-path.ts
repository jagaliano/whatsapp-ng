import { access, mkdir, readdir, cp, stat, chmod } from 'fs/promises';
import { homedir } from 'os';
import { basename, join } from 'path';

export function getDefaultStorageRoot(): string {
    return join(homedir(), '.pi', 'agent', 'extensions', 'whatsapp-pi');
}

export function getDefaultLegacyStorageRoot(): string {
    return join(homedir(), '.pi', 'agent', 'extension', 'whatsapp-pi');
}

export interface StoragePaths {
    root: string;
    legacyRoot: string;
    authStateDir: string;
    configPath: string;
    recentsDir: string;
    recentsPath: string;
    archiveDir: string;
    logDir: string;
    logPath: string;
    mediaDir: string;
}

export function createStoragePaths(root = getDefaultStorageRoot(), legacyRoot = getDefaultLegacyStorageRoot()): StoragePaths {
    return {
        root,
        legacyRoot,
        authStateDir: join(root, 'auth'),
        configPath: join(root, 'config.json'),
        recentsDir: join(root, 'recents'),
        recentsPath: join(root, 'recents', 'recents.json'),
        archiveDir: join(root, 'archive'),
        logDir: root,
        logPath: join(root, 'whatsapp-pi.log'),
        mediaDir: join(root, 'whatsapp-medias')
    };
}

export async function ensureStorageDirectories(paths: Pick<StoragePaths, 'root' | 'authStateDir' | 'recentsDir' | 'logDir'>) {
    for (const directory of new Set([paths.root, paths.authStateDir, paths.recentsDir, paths.logDir])) {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await chmod(directory, 0o700);
    }
}

export async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function copyEntry(source: string, target: string) {
    const sourceStats = await stat(source);
    if (sourceStats.isDirectory()) {
        await mkdir(target, { recursive: true });
        const entries = await readdir(source, { withFileTypes: true });
        for (const entry of entries) {
            await copyEntry(join(source, entry.name), join(target, entry.name));
        }
        return;
    }

    if (await pathExists(target)) {
        return;
    }

    await cp(source, target, { force: false, preserveTimestamps: true });
}

function legacyStorageRoots(paths: Pick<StoragePaths, 'root' | 'legacyRoot'>): string[] {
    return [paths.legacyRoot, join(homedir(), '.pi', 'whatsapp-pi')]
        .filter((root, index, roots) => root && roots.indexOf(root) === index && root !== paths.root);
}

export function legacyAuthProfiles(paths: Pick<StoragePaths, 'root' | 'legacyRoot'>, profile: string): string[] {
    return legacyStorageRoots(paths).map(root => join(root, basename(profile)));
}

export async function migrateLegacyStorage(paths: Pick<StoragePaths, 'root' | 'legacyRoot'>): Promise<boolean> {
    const legacyRoots = legacyStorageRoots(paths);
    let migrated = false;

    await mkdir(paths.root, { recursive: true });

    for (const legacyRoot of legacyRoots) {
        if (!(await pathExists(legacyRoot))) {
            continue;
        }

        const entries = await readdir(legacyRoot, { withFileTypes: true });

        for (const entry of entries) {
            // Offline config/history reads must not adopt auth or another process's control files.
            if (/^\.?auth(?:[._-]|$)/.test(entry.name)) continue;
            await copyEntry(join(legacyRoot, entry.name), join(paths.root, entry.name));
        }

        migrated = true;
    }

    return migrated;
}
