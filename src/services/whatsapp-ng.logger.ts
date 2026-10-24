import { appendFileSync, mkdirSync } from 'fs';
import { createStoragePaths } from './storage-path.js';
import { StateMigrationService } from './state-migration.service.js';

export class WhatsAppNgLogger {
    private logFile: string;

    constructor(private verbose = false, private fileLogging = true) {
        this.logFile = createStoragePaths().logPath;
    }

    enableFileLogging(): void { this.fileLogging = true; }

    setVerbose(verbose: boolean) {
        this.verbose = verbose;
    }

    private writeToFile(level: string, message: string, args: unknown[]) {
        if (!this.fileLogging) return;
        try {
            const paths = createStoragePaths();
            StateMigrationService.assertReady(paths.root);
            mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
        } catch { return; }
        const timestamp = new Date().toISOString();
        const extra = args.length ? ' ' + args.map(a => String(a)).join(' ') : '';
        const line = `[${timestamp}] [${level}] ${message}${extra}\n`;
        try { appendFileSync(this.logFile, line); } catch {
            // File logging is best-effort.
        }
    }

    info(message: string, ...args: unknown[]) {
        console.log(message, ...args);
        this.writeToFile('INFO', message, args);
    }

    log(message: string, ...args: unknown[]) {
        this.writeToFile('LOG', message, args);
        if (this.verbose) {
            console.log(message, ...args);
        }
    }

    warn(message: string, ...args: unknown[]) {
        this.writeToFile('WARN', message, args);
        if (this.verbose) {
            console.warn(message, ...args);
        }
    }

    error(message: string, ...args: unknown[]) {
        this.writeToFile('ERROR', message, args);
        if (this.verbose) {
            console.error(message, ...args);
        }
    }
}
