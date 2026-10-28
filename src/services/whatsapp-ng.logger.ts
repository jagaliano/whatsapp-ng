import { constants, closeSync, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, renameSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createStoragePaths } from './storage-path.js';
import { StateMigrationService } from './state-migration.service.js';

export const METADATA_LOG_POLICY = 'Metadata only: whatsapp-ng.runtime.log, 5 MiB active plus one rotated backup. Older runtime backups expire on rotation. Historical whatsapp-ng.log and unrelated files are untouched. New runtime files are owner-only. Verbose shows extension metadata, never message bodies, speech text, protocol traces or key dumps. Shared Pi context/history is separate from logs.';
interface LoggerOptions { root?: string; maxBytes?: number }

/** Bounded best-effort metadata writer; never serializes error/argument payloads. */
export class WhatsAppNgLogger {
    private readonly paths;
    private readonly logFile: string;
    private readonly maxBytes: number;
    constructor(private verbose = false, private fileLogging = true, options: LoggerOptions = {}) {
        this.paths = createStoragePaths(options.root);
        this.logFile = join(this.paths.logDir, 'whatsapp-ng.runtime.log');
        this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
        if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 128 || this.maxBytes > 5 * 1024 * 1024) throw new Error('Invalid metadata log bound');
    }
    enableFileLogging(): void { this.fileLogging = true; }
    setVerbose(verbose: boolean): void { this.verbose = verbose; }

    private format(message: string, args: unknown[]): string {
        const types = args.map(value => {
            if (value instanceof Error) return '[Error]';
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
            if (typeof value === 'boolean') return String(value);
            return `[${typeof value}]`;
        });
        return [message, ...types].join(' ').replace(/[\p{Cc}\p{Cf}]/gu, ' ');
    }
    private fileSize(path: string): number | undefined {
        try {
            const entry = lstatSync(path);
            if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Unsafe metadata log destination');
            return entry.size;
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    }
    private writeToFile(level: string, text: string): void {
        if (!this.fileLogging) return;
        try {
            StateMigrationService.assertReady(this.paths.root);
            mkdirSync(this.paths.logDir, { recursive: true, mode: 0o700 });
            const raw = Buffer.from(`[${new Date().toISOString()}] [${level}] ${text}\n`);
            const limit = Math.min(this.maxBytes, 8 * 1024);
            const line = raw.length <= limit ? raw : Buffer.concat([raw.subarray(0, limit - 13), Buffer.from(' [truncated]\n')]);
            const size = this.fileSize(this.logFile);
            // Never truncate a pre-existing oversized file or follow a non-file.
            if (size !== undefined && size > this.maxBytes) return;
            if (size !== undefined && size + line.length > this.maxBytes) {
                const backup = this.logFile + '.1';
                const backupSize = this.fileSize(backup);
                if (backupSize !== undefined && backupSize > this.maxBytes) return;
                renameSync(this.logFile, backup);
            }
            const fd = openSync(this.logFile, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0), 0o600);
            try {
                const file = fstatSync(fd);
                if (!file.isFile() || file.size + line.length > this.maxBytes) return;
                fchmodSync(fd, 0o600);
                for (let offset = 0; offset < line.length;) {
                    const written = writeSync(fd, line, offset, line.length - offset);
                    if (!written) return;
                    offset += written;
                }
            } finally { closeSync(fd); }
        } catch { /* Diagnostics never reset storage or block application work. */ }
    }
    info(message: string, ...args: unknown[]): void {
        const text = this.format(message, args); console.log(text); this.writeToFile('INFO', text);
    }
    log(message: string, ...args: unknown[]): void {
        const text = this.format(message, args); this.writeToFile('LOG', text); if (this.verbose) console.log(text);
    }
    warn(message: string, ...args: unknown[]): void {
        const text = this.format(message, args); this.writeToFile('WARN', text); if (this.verbose) console.warn(text);
    }
    error(message: string, ...args: unknown[]): void {
        const text = this.format(message, args); this.writeToFile('ERROR', text); if (this.verbose) console.error(text);
    }
}
