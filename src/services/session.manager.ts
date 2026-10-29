import { useMultiFileAuthState, type SignalKeyStore, type SignalDataTypeMap } from 'baileys';
import { basename, join, relative } from 'path';
import { randomUUID } from 'node:crypto';
import { loadSpeechSettings, speechDefaults, storedSpeechFields, validateSpeechSettings, matchingChatPreferences, settingsJid, TTS_CONFIG_FIELDS, type SpeechSettings } from './speech-settings.js';
import { readFile, writeFile, mkdir, rm, rename, readdir, chmod, open, lstat } from 'fs/promises';
import { SessionStatus } from '../models/whatsapp.types.js';
import type { SttConfig } from './audio-transcriber.js';
import { t } from '../i18n.js';
import { TransportLease } from './transport-lease.service.js';
import { AuthProfileService } from './auth-profile.service.js';
import { StateMigrationService } from './state-migration.service.js';
import { validateGroupReplies, type GroupReplies } from './group-message.policy.js';
import { validateOptionalOutputs, type OptionalOutputs } from './optional-output.service.js';
import { validateReplyReporting, type ReplyReporting } from './run-report.service.js';
import {
    getDefaultLegacyStorageRoot,
    getDefaultStorageRoot,
    createStoragePaths,
    ensureStorageDirectories as ensureStorageRoots,
    migrateLegacyStorage,
    type StoragePaths
} from './storage-path.js';

class ConfigWriterBusyError extends Error {}

export interface Contact {
    number: string;
    name?: string;
    sendNumber?: string;
}

export class SessionManager {
    private readonly storagePaths: StoragePaths;
    private authStateDir: string;
    private readonly configPath: string;

    static isGroupJid(jid: string): boolean {
        return jid.endsWith('@g.us');
    }

    /**
     * Sets a group-specific auth directory so each agent bound to a group
     * registers as its own WhatsApp linked device.
     */
    setGroupJidForAuth(groupJid: string) {
        const sanitized = groupJid.replace(/[^a-zA-Z0-9]/g, '_');
        this.authStateDir = join(this.storagePaths.root, `auth-${sanitized}`);
    }

    private status: SessionStatus = 'logged-out';
    private allowList: Contact[] = [];
    private allowedGroups: Contact[] = [];
    private ignoredNumbers: Contact[] = [];
    private hasAuthState = false;
    private openaiKey: string = '';
    private visionModel: string = 'gpt-4o';
    private sttConfig: SttConfig = {};
    private operatorJid: string = '';
    private finalAfterAttachments = true;
    private storedAutoConnect: unknown;
    private autoConnectRevision = 0;
    private autoConnectReadFailure = false;
    private configLockDiagnostic = '';
    private storedReplyStats: unknown;
    private replyStatsRevision = 0;
    private storedReplyReporting: unknown;
    private replyReportingRevision = 0;
    private storedGroupReplies: unknown;
    private groupRepliesRevision = 0;
    private storedOptionalOutputs: unknown;
    private optionalOutputsRevision = 0;
    private speechSettings = speechDefaults();
    private storedSpeechState: Record<string, unknown> = {};
    private speechConfigInvalid = false;
    private speechRevision = 0;
    private operatorRevision = 0;
    private admissionEra = randomUUID();
    private readonly chatReplyVersions = new Map<string, string>();
    private configWrites: Promise<unknown> = Promise.resolve();
    private configLoaded = false;
    private configReadFailure = false;
    private initialization?: Promise<void>;
    private authEpoch = 0;

    constructor(baseDir = getDefaultStorageRoot(), legacyBaseDir = baseDir === getDefaultStorageRoot() ? getDefaultLegacyStorageRoot() : baseDir) {
        this.storagePaths = createStoragePaths(baseDir, legacyBaseDir);
        this.authStateDir = this.storagePaths.authStateDir;
        this.configPath = this.storagePaths.configPath;
    }

    private async ensureStorageDirectories() {
        await ensureStorageRoots({
            root: this.storagePaths.root,
            authStateDir: this.authStateDir,
            recentsDir: this.storagePaths.recentsDir,
            logDir: this.storagePaths.logDir
        });
    }

    private async migrateLegacyStorageIfNeeded() {
        await migrateLegacyStorage({
            root: this.storagePaths.root,
            legacyRoot: this.storagePaths.legacyRoot
        });
    }

    public assertStorageReady(): void { StateMigrationService.assertReady(this.storagePaths.root); }

    public async ensureInitialized() {
        this.assertStorageReady();
        if (this.initialization) return this.initialization;
        const pending = this.initializeConfig();
        this.initialization = pending;
        try { await pending; }
        finally { if (this.initialization === pending) this.initialization = undefined; }
    }

    private async initializeConfig() {
        try {
            await this.ensureStorageDirectories();
            await this.migrateLegacyStorageIfNeeded();
            try { await chmod(this.configPath, 0o600); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
            let writerBusy: ConfigWriterBusyError | undefined;
            if (!this.configLoaded) {
                try { await this.queueConfig(() => this.withConfigWriter(() => this.cleanupStaleConfigTempFiles())); }
                catch (error) { if (error instanceof ConfigWriterBusyError) writerBusy = error; else throw error; }
                // A retained writer lock protects mutations, not existing readable settings.
                await this.loadConfig();
                this.configLoaded = true;
            }
            if (!writerBusy) {
                try { await this.queueConfig(() => this.withConfigWriter(() => this.refreshAutoConnect())); }
                catch (error) { if (error instanceof ConfigWriterBusyError) writerBusy = error; else throw error; }
            }
            if (writerBusy) {
                this.reportConfigLock(writerBusy.message);
                await this.queueConfig(() => this.refreshAutoConnect());
            }
            await this.syncAuthStateFromDisk();
        } catch {
            if (!this.configLoaded) this.configReadFailure = true;
            // Ordinary initialization stays best-effort; guarded mutations reject.
        }
    }

    private async loadConfig() {
        try {
            const data = await readFile(this.configPath, 'utf-8');
            const { config, recovered } = this.parseConfig(data);
            
            const cleanContact = (item: any): Contact | null => {
                if (typeof item === 'string') return { number: item };
                if (item && typeof item === 'object') {
                    let num = item.number;
                    // Unroll nested objects if any
                    while (num && typeof num === 'object' && num.number) {
                        num = num.number;
                    }
                    if (typeof num === 'string') {
                        const sendNumber = typeof item.sendNumber === 'string' ? item.sendNumber : undefined;
                        return { number: num, name: item.name, sendNumber };
                    }
                }
                return null;
            };

            const loadedAllowList = (config.allowList || []).map(cleanContact).filter(Boolean) as Contact[];
            const loadedAllowedGroups = (config.allowedGroups || []).map(cleanContact).filter(Boolean) as Contact[];
            const migratedGroups = loadedAllowList.filter(c => SessionManager.isGroupJid(c.number));
            this.allowList = loadedAllowList.filter(c => !SessionManager.isGroupJid(c.number));
            this.allowedGroups = this.mergeContacts(loadedAllowedGroups, migratedGroups);
            this.ignoredNumbers = (config.ignoredNumbers || []).map(cleanContact).filter(Boolean) as Contact[];
            this.status = config.status || 'logged-out';
            this.hasAuthState = Boolean(config.hasAuthState);
            this.openaiKey = config.openaiKey || '';
            this.visionModel = config.visionModel || 'gpt-4o';
            this.sttConfig = { sttEndpoint: config.sttEndpoint, sttModel: config.sttModel, sttEnv: config.sttEnv, sttLanguage: config.sttLanguage };
            this.operatorJid = config.operatorJid || '';
            this.finalAfterAttachments = config.finalAfterAttachments !== false;
            this.storedAutoConnect = config.autoConnect;
            this.storedReplyStats = config.replyStats;
            this.storedReplyReporting = config.replyReporting;
            this.storedGroupReplies = config.groupReplies;
            this.storedOptionalOutputs = config.optionalOutputs;
            this.storedSpeechState = Object.fromEntries([...TTS_CONFIG_FIELDS, 'voicePreferences'].flatMap(key => config[key] === undefined ? [] : [[key, config[key]]]));
            try { this.speechSettings = loadSpeechSettings(config); this.speechConfigInvalid = false; }
            catch { this.speechSettings = speechDefaults(); this.speechConfigInvalid = true; }

            if (recovered) {
                await this.saveConfig();
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.configReadFailure = true;
        }
    }

    public getAutoConnect(): boolean { return !this.configReadFailure && !this.autoConnectReadFailure && this.storedAutoConnect === true; }
    public getAutoConnectRevision(): number { return this.autoConnectRevision; }
    public async setAutoConnect(enabled: boolean, expectedRevision: number, current: () => boolean = () => true): Promise<void> {
        if (typeof enabled !== 'boolean') throw new Error('Auto-connect preference must be a boolean');
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            const valid = () => expectedRevision === this.autoConnectRevision && current();
            if (!valid()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, valid, 'atomic', this.finalAfterAttachments,
                this.storedReplyStats, this.storedGroupReplies, this.storedOptionalOutputs, this.storedReplyReporting, this.sttConfig, enabled);
            this.storedAutoConnect = enabled; this.autoConnectRevision++;
        });
    }

    public getFinalAfterAttachments(): boolean {
        return this.finalAfterAttachments;
    }

    public async setFinalAfterAttachments(enabled: boolean, current: () => boolean = () => true): Promise<void> {
        if (typeof enabled !== 'boolean') throw new Error('Final-after-attachment preference must be a boolean');
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            if (!current()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, current, 'atomic', enabled);
            this.finalAfterAttachments = enabled;
        });
    }

    public getReplyStats(): boolean { return !this.configReadFailure && this.storedReplyStats === true; }
    public getReplyStatsRevision(): number { return this.replyStatsRevision; }
    public async setReplyStats(enabled: boolean, current: () => boolean = () => true): Promise<void> {
        if (typeof enabled !== 'boolean') throw new Error('Final stats preference must be a boolean');
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            if (!current()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, current, 'atomic', this.finalAfterAttachments, enabled);
            this.storedReplyStats = enabled; this.replyStatsRevision++;
        });
    }

    public getReplyReporting(): ReplyReporting {
        if (this.configReadFailure) throw new Error('Invalid saved reply reporting settings');
        return validateReplyReporting(this.storedReplyReporting);
    }
    public getReplyReportingRevision(): number { return this.replyReportingRevision; }
    public async setReplyReporting(value: ReplyReporting, expectedRevision: number, current: () => boolean = () => true): Promise<void> {
        if (value === undefined) throw new Error('Invalid reply reporting settings');
        const next = validateReplyReporting(value);
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            const valid = () => expectedRevision === this.replyReportingRevision && current();
            if (!valid()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, valid, 'atomic', this.finalAfterAttachments, this.storedReplyStats, this.storedGroupReplies, this.storedOptionalOutputs, next);
            this.storedReplyReporting = next; this.replyReportingRevision++;
        });
    }

    public getGroupReplies(): GroupReplies {
        if (this.configReadFailure) throw new Error('Invalid saved group settings');
        return validateGroupReplies(this.storedGroupReplies);
    }
    public getGroupRepliesRevision(): number { return this.groupRepliesRevision; }
    public async setGroupReplies(value: GroupReplies, expectedRevision: number, current: () => boolean = () => true): Promise<void> {
        if (value === undefined) throw new Error('Invalid group reply settings');
        const next = validateGroupReplies(value);
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            const valid = () => expectedRevision === this.groupRepliesRevision && current();
            if (!valid()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, valid, 'atomic', this.finalAfterAttachments, this.storedReplyStats, next);
            this.storedGroupReplies = next; this.groupRepliesRevision++;
        });
    }

    public getOptionalOutputs(): OptionalOutputs {
        if (this.configReadFailure) throw new Error('Invalid saved optional output settings');
        return validateOptionalOutputs(this.storedOptionalOutputs);
    }
    public getOptionalOutputsRevision(): number { return this.optionalOutputsRevision; }
    public async setOptionalOutputs(value: OptionalOutputs, expectedRevision: number, current: () => boolean = () => true): Promise<void> {
        if (value === undefined) throw new Error('Invalid optional output settings');
        const next = validateOptionalOutputs(value);
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            const valid = () => expectedRevision === this.optionalOutputsRevision && current();
            if (!valid()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, valid, 'atomic', this.finalAfterAttachments, this.storedReplyStats, this.storedGroupReplies, next);
            this.storedOptionalOutputs = next; this.optionalOutputsRevision++;
        });
    }

    private parseConfig(data: string): { config: any; recovered: boolean } {
        try {
            return { config: JSON.parse(data), recovered: false };
        } catch (error) {
            const objectEnd = this.findFirstJsonObjectEnd(data);
            if (objectEnd < 0) {
                throw error;
            }

            return {
                config: JSON.parse(data.slice(0, objectEnd + 1)),
                recovered: true
            };
        }
    }

    private findFirstJsonObjectEnd(data: string): number {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < data.length; i++) {
            const char = data[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }

        return -1;
    }

    private queueConfig<T>(operation: () => Promise<T>): Promise<T> {
        const pending = this.configWrites.then(operation);
        this.configWrites = pending.catch(() => {});
        return pending;
    }

    public async saveConfig() {
        this.assertStorageReady();
        try {
            if (this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
            await this.queueConfig(() => this.writeConfig());
        }
        catch { console.error(t('session.manager.failedSaveConfig')); }
    }

    private reportConfigLock(message: string): void {
        if (message !== this.configLockDiagnostic) { this.configLockDiagnostic = message; console.error(message); }
    }

    /** Serialize cooperating config writers and startup temp cleanup; never break an unknown lock. */
    private async withConfigWriter<T>(operation: () => Promise<T>): Promise<T> {
        this.assertStorageReady();
        const path = this.configPath + '.lock';
        let file: Awaited<ReturnType<typeof open>>;
        for (let attempt = 0; ; attempt++) {
            try { file = await open(path, 'wx', 0o600); break; }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                if (attempt >= 100) throw new ConfigWriterBusyError(`Configuration writer lock retained at ${path}; writes are busy. Inspect ownership locally before recovery.`);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        this.configLockDiagnostic = '';
        let identity: { dev: number; ino: number } | undefined;
        const cleanupNotice = `Configuration writer lock cleanup unconfirmed at ${path}; inspect ownership locally.`;
        try {
            identity = await file.stat();
            await file.writeFile(JSON.stringify({ version: 1, pid: process.pid }));
            return await operation();
        } finally {
            // Cleanup diagnostics must not disguise an already committed write or its original error.
            try {
                const current = await lstat(path);
                if (identity && current.isFile() && current.dev === identity.dev && current.ino === identity.ino) await rm(path);
                else this.reportConfigLock(cleanupNotice);
            } catch { this.reportConfigLock(cleanupNotice); }
            try { await file.close(); } catch { this.reportConfigLock(cleanupNotice); }
        }
    }

    /** Only this new preference is refreshed; this is not a general cross-process settings merge. */
    private async refreshAutoConnect(): Promise<void> {
        let value: unknown;
        try {
            const { config } = this.parseConfig(await readFile(this.configPath, 'utf8'));
            if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid configuration');
            value = Object.hasOwn(config, 'autoConnect') ? config.autoConnect : undefined;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.autoConnectReadFailure = true;
                throw new Error('Configuration is unreadable; originals preserved');
            }
        }
        this.autoConnectReadFailure = false;
        if (JSON.stringify(value) !== JSON.stringify(this.storedAutoConnect)) {
            this.storedAutoConnect = value; this.autoConnectRevision++;
        }
    }

    private async writeConfig(speech = this.storedSpeechState, owner = this.operatorJid, current: () => boolean = () => true, commit: 'ordinary' | 'atomic' = 'ordinary', finalAfterAttachments = this.finalAfterAttachments, replyStats = this.storedReplyStats, groupReplies = this.storedGroupReplies, optionalOutputs = this.storedOptionalOutputs, replyReporting = this.storedReplyReporting, sttConfig = this.sttConfig, autoConnect?: boolean): Promise<void> {
        this.assertStorageReady();
        await mkdir(this.storagePaths.root, { recursive: true, mode: 0o700 });
        await chmod(this.storagePaths.root, 0o700);
        await this.withConfigWriter(async () => {
            const tempPath = `${this.configPath}.${process.pid}.${randomUUID()}.tmp`;
            try {
                await this.refreshAutoConnect();
                const savedAutoConnect = autoConnect === undefined ? this.storedAutoConnect : autoConnect;
                this.hasAuthState = this.hasAuthState || await this.hasCredentialsFile();
                const serialized = JSON.stringify({
                    allowList: this.allowList, allowedGroups: this.allowedGroups, ignoredNumbers: this.ignoredNumbers,
                    status: this.status, hasAuthState: this.hasAuthState, openaiKey: this.openaiKey,
                    ...(savedAutoConnect === undefined ? {} : { autoConnect: savedAutoConnect }),
                    visionModel: this.visionModel, ...sttConfig, operatorJid: owner,
                    finalAfterAttachments, ...(replyStats === undefined ? {} : { replyStats }), ...(groupReplies === undefined ? {} : { groupReplies }), ...(optionalOutputs === undefined ? {} : { optionalOutputs }), ...(replyReporting === undefined ? {} : { replyReporting }), ...speech
                }, null, 2);
                if (!current()) throw new Error('Settings request expired');
                await writeFile(tempPath, serialized, { mode: 0o600, flag: 'wx' });
                await chmod(tempPath, 0o600);
                // Recheck authority while retaining the cooperative writer lock through publication.
                if (!current()) throw new Error('Settings request expired');
                try { await rename(tempPath, this.configPath); }
                catch (error) {
                    if (commit === 'atomic') throw error;
                    // Preserve the existing Windows compatibility path for ordinary state saves.
                    await writeFile(this.configPath, serialized, { mode: 0o600 });
                    await chmod(this.configPath, 0o600);
                }
            } finally { await this.removeConfigTempFile(tempPath); }
        });
    }

    getSpeechSettings(): SpeechSettings {
        if (this.configReadFailure || this.speechConfigInvalid) throw new Error('Invalid saved voice settings; repair them in terminal /whatsapp > Voice');
        return structuredClone(this.speechSettings);
    }
    getSpeechRevision(): number { return this.speechRevision; }
    getOperatorRevision(): number { return this.operatorRevision; }

    async setSpeechSettings(value: SpeechSettings, expectedRevision: number, current: () => boolean = () => true): Promise<void> {
        const next = validateSpeechSettings(value);
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        return this.queueConfig(async () => {
            if (this.speechRevision !== expectedRevision || !current()) throw new Error('Settings request expired');
            const fields = storedSpeechFields(next);
            await this.writeConfig(fields, this.operatorJid, current, 'atomic');
            for (const key of new Set([...Object.keys(this.speechSettings.chats), ...Object.keys(next.chats)])) {
                if (this.speechSettings.chats[key]?.automaticReplies !== next.chats[key]?.automaticReplies) {
                    if (this.chatReplyVersions.size >= 500 && !this.chatReplyVersions.has(key)) { this.chatReplyVersions.clear(); this.admissionEra = randomUUID(); }
                    this.chatReplyVersions.set(key, randomUUID());
                }
            }
            this.speechSettings = next;
            this.storedSpeechState = fields;
            this.speechConfigInvalid = false;
            this.speechRevision++;
        });
    }

    getReplyAdmissionKey(jid: string, canonical: (jid: string) => string | undefined): string {
        if (this.configReadFailure || this.speechConfigInvalid) throw new Error('Invalid saved voice settings');
        const target = canonical(settingsJid(jid));
        if (!target) throw new Error('Conversation identity unavailable');
        const keys = new Set(matchingChatPreferences(this.speechSettings, jid, canonical).map(([key]) => key));
        for (const key of this.chatReplyVersions.keys()) if (canonical(key) === target) keys.add(key);
        return JSON.stringify([this.admissionEra, [...keys].sort((left, right) => left.localeCompare(right)).map(key => [key, this.chatReplyVersions.get(key) ?? 'initial'])]);
    }

    /** Re-adding an allowed chat grants new work, never its pre-revocation output. */
    private retireReplyAdmission(value: string): void {
        let key: string;
        try { key = settingsJid(value); } catch { this.admissionEra = randomUUID(); return; }
        if (this.chatReplyVersions.size >= 500 && !this.chatReplyVersions.has(key)) { this.chatReplyVersions.clear(); this.admissionEra = randomUUID(); }
        this.chatReplyVersions.set(key, randomUUID());
    }

    private async cleanupStaleConfigTempFiles() {
        const configFileName = basename(this.configPath);
        let files: string[];

        try {
            files = await readdir(this.storagePaths.root);
        } catch {
            return;
        }

        await Promise.all(files.flatMap(fileName => fileName.startsWith(`${configFileName}.`) && fileName.endsWith('.tmp')
            ? [this.removeConfigTempFile(join(this.storagePaths.root, basename(fileName)))] : []));
    }

    private async removeConfigTempFile(tempPath: string) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await rm(tempPath, { force: true });
                return;
            } catch {
                await new Promise(resolve => setTimeout(resolve, 25));
            }
        }
    }

    getAllowList(): Contact[] {
        return this.allowList;
    }

    getAllowedContact(number: string): Contact | undefined {
        return this.allowList.find(c => c.number === number);
    }

    getAllowedGroups(): Contact[] {
        return this.allowedGroups;
    }

    getAllowedGroup(groupJid: string): Contact | undefined {
        return this.allowedGroups.find(c => c.number === groupJid);
    }

    getIgnoredNumbers(): Contact[] {
        return this.ignoredNumbers;
    }

    async removeIgnoredNumber(number: string) {
        this.ignoredNumbers = this.ignoredNumbers.filter(c => c.number !== number);
        await this.saveConfig();
    }

    async addNumber(number: any, name?: string) {
        // Handle potential nested objects from legacy bugs
        let cleanNumber = number;
        while (cleanNumber && typeof cleanNumber === 'object' && cleanNumber.number) {
            cleanNumber = cleanNumber.number;
        }

        if (typeof cleanNumber !== 'string') {
            return;
        }

        const existing = this.allowList.find(c => c.number === cleanNumber);
        if (!existing) {
            if (SessionManager.isGroupJid(cleanNumber)) {
                await this.addAllowedGroup(cleanNumber, name);
                return;
            }
            this.allowList.push({ number: cleanNumber, name });
            this.ignoredNumbers = this.ignoredNumbers.filter(c => c.number !== cleanNumber);
            await this.saveConfig();
            return;
        }

        if (name && !existing.name) {
            existing.name = name;
            await this.saveConfig();
        }
    }

    async removeNumber(number: string) {
        if (this.allowList.some(contact => contact.number === number)) this.retireReplyAdmission(number);
        this.allowList = this.allowList.filter(c => c.number !== number);
        await this.saveConfig();
    }

    async addAllowedGroup(groupJid: string, name?: string) {
        if (!SessionManager.isGroupJid(groupJid)) {
            return;
        }

        const existing = this.allowedGroups.find(c => c.number === groupJid);
        if (!existing) {
            this.allowedGroups.push({ number: groupJid, name });
            this.ignoredNumbers = this.ignoredNumbers.filter(c => c.number !== groupJid);
            await this.saveConfig();
            return;
        }

        if (name && !existing.name) {
            existing.name = name;
            await this.saveConfig();
        }
    }

    async removeAllowedGroup(groupJid: string) {
        if (this.allowedGroups.some(group => group.number === groupJid)) this.retireReplyAdmission(groupJid);
        this.allowedGroups = this.allowedGroups.filter(c => c.number !== groupJid);
        await this.saveConfig();
    }

    async setAllowedContactAlias(number: string, alias: string) {
        const trimmedAlias = alias.trim();
        if (!trimmedAlias) {
            return;
        }

        const contact = this.getAllowedContact(number);
        if (!contact) {
            return;
        }

        contact.name = trimmedAlias;
        await this.saveConfig();
    }

    async removeAllowedContactAlias(number: string) {
        const contact = this.getAllowedContact(number);
        if (!contact || !contact.name) {
            return;
        }

        contact.name = undefined;
        await this.saveConfig();
    }

    async setContactSendNumber(number: string, sendNumber: string) {
        const contact = this.getAllowedContact(number);
        if (!contact) return;
        contact.sendNumber = sendNumber.trim();
        await this.saveConfig();
    }

    async removeContactSendNumber(number: string) {
        const contact = this.getAllowedContact(number);
        if (!contact) return;
        contact.sendNumber = undefined;
        await this.saveConfig();
    }

    async setAllowedGroupAlias(groupJid: string, alias: string) {
        const trimmedAlias = alias.trim();
        if (!trimmedAlias) {
            return;
        }

        const group = this.getAllowedGroup(groupJid);
        if (!group) {
            return;
        }

        group.name = trimmedAlias;
        await this.saveConfig();
    }

    async removeAllowedGroupAlias(groupJid: string) {
        const group = this.getAllowedGroup(groupJid);
        if (!group || !group.name) {
            return;
        }

        group.name = undefined;
        await this.saveConfig();
    }

    isAllowed(number: string): boolean {
        return this.allowList.some(c => c.number === number);
    }

    isAllowedGroup(groupJid: string): boolean {
        return this.allowedGroups.some(c => c.number === groupJid);
    }

    isConversationAllowed(sender: string): boolean {
        return SessionManager.isGroupJid(sender)
            ? this.isAllowedGroup(sender)
            : this.isAllowed(sender);
    }

    async trackIgnoredNumber(number: string, name?: string) {
        // Only track if not already allowed or ignored.
        if (!this.isConversationAllowed(number) &&
            !this.ignoredNumbers.find(c => c.number === number)) {
            this.ignoredNumbers.push({ number, name });
            await this.saveConfig();
        }
    }

    private mergeContacts(primary: Contact[], secondary: Contact[]): Contact[] {
        const merged = [...primary];
        for (const contact of secondary) {
            const existing = merged.find(c => c.number === contact.number);
            if (!existing) {
                merged.push(contact);
            } else {
                if (!existing.name && contact.name) {
                    existing.name = contact.name;
                }
            }
        }
        return merged;
    }

    public async isRegistered(): Promise<boolean> {
        await this.syncAuthStateFromDisk();
        return this.hasAuthState;
    }

    async markAuthStateAvailable() {
        if (!this.hasAuthState) {
            this.hasAuthState = true;
            await this.saveConfig();
        }
    }

    async getAuthState(lease: TransportLease) {
        this.assertStorageReady();
        if (!lease?.isHeld) throw new Error(t('profile.ownerRequired'));
        await lease.assertProfile(this.authStateDir);
        const epoch = ++this.authEpoch;
        const profile = new AuthProfileService(this.storagePaths, this.authStateDir, lease);
        await profile.prepare();
        const auth = await useMultiFileAuthState(lease.profileDir);
        const assertCurrent = async () => {
            if (epoch !== this.authEpoch) throw new Error(t('profile.authClosed'));
            await lease.assertProfile(lease.profileDir);
        };
        // rc14 uses Promise.all internally: first rejection need not settle other file I/O.
        // Single-entry calls keep every admitted operation fenced until all its I/O settles.
        const keys: SignalKeyStore = {
            get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
                await assertCurrent();
                const result: { [id: string]: SignalDataTypeMap[T] } = {};
                for (const id of ids) {
                    await assertCurrent();
                    Object.assign(result, await auth.state.keys.get(type, [id]));
                }
                return result;
            },
            set: async data => {
                await assertCurrent();
                for (const [category, values] of Object.entries(data)) {
                    for (const [id, value] of Object.entries(values ?? {})) {
                        await assertCurrent();
                        await auth.state.keys.set({ [category]: { [id]: value } } as Parameters<SignalKeyStore['set']>[0]);
                    }
                }
            }
        };
        return {
            state: { creds: auth.state.creds, keys },
            saveCreds: async () => { await assertCurrent(); await auth.saveCreds(); await profile.confirmSaved(); }
        };
    }

    private async syncAuthStateFromDisk() {
        const nextHasAuthState = await this.hasCredentialsFile();
        const nextStatus = nextHasAuthState || this.status !== 'connected'
            ? this.status
            : 'disconnected';

        if (nextHasAuthState !== this.hasAuthState || nextStatus !== this.status) {
            this.hasAuthState = nextHasAuthState;
            this.status = nextStatus;
            await this.saveConfig();
        }
    }

    private async hasCredentialsFile(): Promise<boolean> {
        return AuthProfileService.hasSavedState(this.storagePaths, this.authStateDir);
    }

    async deleteAuthState(owner?: TransportLease) {
        const lease = owner ?? await TransportLease.acquire(this.authStateDir);
        try {
            await lease.assertProfile(this.authStateDir);
            if (lease.hasAuthScope) throw new Error(t('profile.retireRequired'));
            this.authEpoch++;
            await new AuthProfileService(this.storagePaths, this.authStateDir, lease).reset();
            this.status = 'logged-out';
            this.hasAuthState = false;
            await this.saveConfig();
        } finally { if (!owner) await lease.release(); }
    }

    getStatus(): SessionStatus {
        return this.status;
    }

    async setStatus(status: SessionStatus) {
        this.status = status;
        await this.saveConfig();
    }

    getOpenaiKey(): string {
        return this.openaiKey;
    }

    async setOpenaiKey(key: string) {
        this.openaiKey = key;
        await this.saveConfig();
    }

    getSttConfig(): SttConfig {
        return { ...this.sttConfig };
    }

    async setSttConfig(config: SttConfig, current: () => boolean = () => true): Promise<void> {
        const next = { sttEndpoint: config.sttEndpoint, sttModel: config.sttModel, sttEnv: config.sttEnv, sttLanguage: config.sttLanguage };
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            if (!current()) throw new Error('Settings request expired');
            await this.writeConfig(this.storedSpeechState, this.operatorJid, current, 'atomic', this.finalAfterAttachments,
                this.storedReplyStats, this.storedGroupReplies, this.storedOptionalOutputs, this.storedReplyReporting, next);
            this.sttConfig = next;
        });
    }

    getVisionModel(): string {
        return this.visionModel;
    }

    async setVisionModel(model: string) {
        this.visionModel = model;
        await this.saveConfig();
    }

    getOperatorJid(): string {
        return this.operatorJid;
    }

    async setOperatorJid(jid: string, current: () => boolean = () => true) {
        const next = jid ? settingsJid(jid) : '';
        if (next.endsWith('@g.us')) throw new Error('Owner must be a person, not a group');
        await this.ensureInitialized();
        if (!this.configLoaded || this.configReadFailure) throw new Error('Configuration is unreadable; originals preserved');
        await this.queueConfig(async () => {
            if (!current()) throw new Error('Settings request expired');
            let outputs = this.storedOptionalOutputs;
            if (next !== this.operatorJid && outputs !== undefined) {
                try { outputs = { imageTools: validateOptionalOutputs(outputs).imageTools }; }
                catch { /* Preserve invalid originals, which cannot authorize forwarding. */ }
            }
            await this.writeConfig(this.storedSpeechState, next, current, 'atomic', this.finalAfterAttachments, this.storedReplyStats, this.storedGroupReplies, outputs);
            this.storedOptionalOutputs = outputs; this.optionalOutputsRevision++;
            this.operatorJid = next;
            this.operatorRevision++;
            this.speechRevision++;
        });
    }

    getArchiveStorageOptions() {
        return { root: this.storagePaths.archiveDir, authProfile: relative(this.storagePaths.root, this.authStateDir), legacyPath: this.storagePaths.recentsPath };
    }

    getAuthStateDir(): string {
        return this.authStateDir;
    }
}
