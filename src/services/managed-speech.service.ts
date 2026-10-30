import { fork, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioTranscriptionOptions, SttConfig } from './audio-transcriber.js';
import { resolveTtsConfig, type TtsConfig } from './tts-config.js';

export type ManagedSpeechRole = 'stt' | 'tts';
export interface ManagedSpeechCommand {
    executable: string; args: string[]; cwd: string; endpoint: string; backend: string;
    model: string; loadedModel: string; env: string[]; startupTimeoutMs: number;
}
interface Selection { endpoint: string; model: string; env: string; protocol: string }
interface SpeechState { connected: boolean; scope: string; stt: SttConfig; tts?: TtsConfig }
type Status = 'disabled' | 'stopped' | 'starting' | 'ready' | 'failed';
interface Entry {
    role: ManagedSpeechRole; key: string; command: ManagedSpeechCommand; selection: Selection;
    controller: AbortController; status: Status; retired: boolean; worker?: ChildProcess;
    ready: Promise<void>; resolve(): void; reject(error: Error): void; exited?: Promise<void>;
    timer?: ReturnType<typeof setTimeout>; stopping?: Promise<void>;
    checks: Map<number, { resolve(): void; reject(error: Error): void }>;
}
interface Options {
    root: string; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; notify?: (text: string) => void;
}
const roles: ManagedSpeechRole[] = ['stt', 'tts'];
const codes = new Set(['configuration', 'platform', 'lease-busy', 'port-conflict', 'spawn', 'startup-timeout', 'ownership', 'backend', 'model', 'server-exited', 'worker-exited', 'probe', 'worker-error']);
const error = (role: ManagedSpeechRole, code: string) => new Error(`Managed ${role.toUpperCase()} unavailable (${code})`);
function loopback(url: URL): boolean { return /^127(?:\.\d{1,3}){3}$/.test(url.hostname) || url.hostname === '[::1]'; }
function canonicalEndpoint(value: string): string { const url = new URL(value); url.pathname = url.pathname.replace(/\/+$/, '') || '/'; return url.href.replace(/\/$/, ''); }

/** Trusted process configuration only; never parse a shell or infer binding from command arguments. */
export function parseManagedSpeechCommand(value: string | undefined, role: ManagedSpeechRole): ManagedSpeechCommand | undefined {
    if (!value?.trim()) return undefined;
    const invalid = () => { throw error(role, 'configuration'); };
    if (value.length > 32_768) return invalid();
    let data: Record<string, unknown>;
    try { data = JSON.parse(value) as Record<string, unknown>; } catch { return invalid(); }
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || Object.keys(data).some(key => !['executable', 'args', 'cwd', 'endpoint', 'backend', 'model', 'loadedModel', 'env', 'startupTimeoutMs'].includes(key))) return invalid();
    for (const key of ['executable', 'cwd', 'endpoint', 'backend', 'model', 'loadedModel']) {
        if (typeof data[key] !== 'string' || !data[key] || (data[key] as string).length > 4096 || /[\r\n\0]/.test(data[key] as string)) return invalid();
    }
    if (!isAbsolute(data.executable as string) || !isAbsolute(data.cwd as string)
        || /^(?:ba|z|fi|da|k)?sh(?:\.exe)?$|^(?:cmd|powershell|pwsh)(?:\.exe)?$/i.test(basename(data.executable as string))
        || !/^[a-zA-Z0-9_.-]{1,80}$/.test(data.backend as string)) return invalid();
    if (!Array.isArray(data.args) || data.args.length > 128 || data.args.some(arg => typeof arg !== 'string' || arg.length > 4096 || /[\r\n\0]/.test(arg)
        || /^--(?:api-keys?|auth-token|hf-token)(?:=|$)/i.test(arg))) return invalid();
    const names = data.env ?? [];
    if (!Array.isArray(names) || names.length > 32 || names.some(name => typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)
        || ['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES'].includes(name))) return invalid();
    let url: URL;
    try { url = new URL(data.endpoint as string); } catch { return invalid(); }
    if (url.protocol !== 'http:' || !loopback(url) || !url.port || url.username || url.password || url.search || url.hash
        || url.pathname.replace(/\/+$/, '') !== (role === 'stt' ? '/v1' : '/v1/audio/speech')) return invalid();
    const timeout = data.startupTimeoutMs ?? 180_000;
    if (typeof timeout !== 'number' || !Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) return invalid();
    return { executable: data.executable as string, args: [...data.args] as string[], cwd: data.cwd as string,
        endpoint: canonicalEndpoint(url.href), backend: data.backend as string, model: data.model as string,
        loadedModel: data.loadedModel as string, env: [...names] as string[], startupTimeoutMs: timeout };
}
function selection(role: ManagedSpeechRole, config: SttConfig | TtsConfig | undefined): Selection | undefined {
    try {
        if (role === 'stt') {
            const value = config as SttConfig | undefined;
            return value?.sttEndpoint && value.sttModel && value.sttEnv
                ? { endpoint: canonicalEndpoint(value.sttEndpoint), model: value.sttModel, env: value.sttEnv, protocol: 'openai-compatible' } : undefined;
        }
        if (!config) return undefined;
        const value = resolveTtsConfig(config as TtsConfig);
        return value.endpoint ? { endpoint: canonicalEndpoint(value.endpoint), model: value.model ?? '', env: value.env ?? '', protocol: value.provider } : undefined;
    } catch { return undefined; }
}
function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => { cleanup(); reject(new Error('Managed speech request cancelled')); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        // Observe settlement even when cancellation already won; an abandoned check may reject later.
        void promise.then(value => { cleanup(); resolve(value); }, failure => { cleanup(); reject(failure); });
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
    });
}

/** Owns opt-in process lifetimes and request gates, not speech consent or provider selection. */
export class ManagedSpeechService {
    private readonly commands = new Map<ManagedSpeechRole, ManagedSpeechCommand>();
    private readonly invalid = new Set<ManagedSpeechRole>();
    private readonly failed = new Set<ManagedSpeechRole>();
    private readonly entries = new Map<ManagedSpeechRole, Entry>();
    private readonly retiring = new Map<ManagedSpeechRole, Promise<void>>();
    private readonly env: NodeJS.ProcessEnv;
    private state?: SpeechState;
    private serial = 0;
    constructor(private readonly options: Options) {
        this.env = options.env ?? process.env;
        for (const role of roles) {
            try { const command = parseManagedSpeechCommand(this.env[`CRISPASR_${role.toUpperCase()}_CMD`], role); if (command) this.commands.set(role, command); }
            catch { this.invalid.add(role); }
        }
        const stt = this.commands.get('stt'); const tts = this.commands.get('tts');
        if (stt && tts && new URL(stt.endpoint).origin === new URL(tts.endpoint).origin) { this.invalid.add('stt'); this.invalid.add('tts'); }
    }
    getStatus(role: ManagedSpeechRole): Status {
        if (this.invalid.has(role) || this.failed.has(role)) return 'failed';
        return this.entries.get(role)?.status ?? (this.commands.has(role) ? 'stopped' : 'disabled');
    }
    /** Synchronous invalidation precedes asynchronous retirement/startup. */
    update(state: SpeechState): void {
        this.state = state;
        for (const role of roles) {
            const command = this.commands.get(role); const selected = selection(role, state[role]);
            const matches = selected && command && selected.endpoint === command.endpoint && selected.model === command.model && selected.protocol === 'openai-compatible';
            const key = state.connected && matches ? JSON.stringify([state.scope, selected]) : '';
            const previous = this.entries.get(role);
            if (previous?.key === key) continue;
            if (previous) { this.entries.delete(role); this.queueRetirement(previous); }
            // Malformed descriptors have no command/key; report before that skip, matching gate's fail-closed scope.
            if (this.invalid.has(role)) {
                if (state.connected && selected && loopback(new URL(selected.endpoint))) this.failRole(role, 'configuration');
                continue;
            }
            if (!key || !command || !selected || this.failed.has(role)) continue;
            if (!['darwin', 'linux'].includes(this.options.platform ?? process.platform)) { this.failRole(role, 'platform'); continue; }
            const keyValue = this.env[selected.env];
            if (!keyValue?.trim() || keyValue.length > 8192 || /[\r\n\0]/.test(keyValue)) { this.failRole(role, 'configuration'); continue; }
            let resolve!: () => void; let reject!: (failure: Error) => void;
            const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); void ready.catch(() => {});
            const entry: Entry = { role, key, command, selection: selected, controller: new AbortController(), status: 'starting', retired: false, ready, resolve, reject, checks: new Map() };
            this.entries.set(role, entry); void this.start(entry, keyValue.trim());
        }
    }
    /** Explicit terminal Connect/new runtime may retry; incoming requests never do. */
    retry(): void {
        this.failed.clear();
        for (const entry of this.entries.values()) if (entry.status === 'failed') { this.entries.delete(entry.role); this.queueRetirement(entry); }
    }
    async disconnect(): Promise<void> {
        if (this.state) this.state = { ...this.state, connected: false };
        for (const entry of this.entries.values()) this.queueRetirement(entry);
        this.entries.clear();
        await Promise.all(this.retiring.values());
    }
    async gate(role: ManagedSpeechRole, config: SttConfig | TtsConfig, options: AudioTranscriptionOptions = {}): Promise<AudioTranscriptionOptions> {
        const selected = selection(role, config); const command = this.commands.get(role);
        if (this.invalid.has(role) && selected && loopback(new URL(selected.endpoint))) throw error(role, 'configuration');
        if (!selected || !command || selected.endpoint !== command.endpoint) return options;
        if (selected.model !== command.model || selected.protocol !== 'openai-compatible') throw error(role, 'configuration');
        const entry = this.entries.get(role);
        if (!entry || !this.current(entry) || JSON.stringify(entry.selection) !== JSON.stringify(selected)) throw error(role, this.failed.has(role) ? 'failed' : 'stopped');
        const caller = new AbortController();
        const signal = AbortSignal.any([entry.controller.signal, caller.signal, ...(options.signal ? [options.signal] : [])]);
        const isCurrent = options.isCurrent;
        if (isCurrent && !isCurrent()) throw error(role, 'cancelled');
        const timer = isCurrent ? setInterval(() => { try { if (!isCurrent()) caller.abort(); } catch { caller.abort(); } }, 100) : undefined;
        timer?.unref();
        try {
            await waitFor(entry.ready, signal);
            if (!this.current(entry)) throw error(role, 'cancelled');
            await waitFor(this.check(entry), signal);
            if (!this.current(entry) || (isCurrent && !isCurrent())) throw error(role, 'cancelled');
            return { ...options, signal, isCurrent: () => this.current(entry) && !signal.aborted && (!isCurrent || isCurrent()) };
        } finally { clearInterval(timer); }
    }
    private current(entry: Entry): boolean { return !!this.state?.connected && this.entries.get(entry.role) === entry && !entry.retired && !entry.controller.signal.aborted; }
    private notify(text: string): void { try { this.options.notify?.(text); } catch { /* Diagnostics cannot prevent retirement. */ } }
    private failRole(role: ManagedSpeechRole, code: string): void {
        if (!this.failed.has(role)) this.notify(error(role, code).message + '; inspect local settings and use terminal Off/Connect or reload before retry.');
        this.failed.add(role);
    }
    private fail(entry: Entry, code: string): void {
        if (entry.retired) return;
        entry.status = 'failed'; this.failRole(entry.role, codes.has(code) ? code : 'worker-error');
        entry.reject(error(entry.role, code)); this.queueRetirement(entry);
    }
    private queueRetirement(entry: Entry): void {
        if (entry.stopping) return;
        entry.retired = true; entry.controller.abort(); clearTimeout(entry.timer); entry.reject(error(entry.role, 'cancelled'));
        for (const check of entry.checks.values()) check.reject(error(entry.role, 'cancelled')); entry.checks.clear();
        const previous = this.retiring.get(entry.role) ?? Promise.resolve();
        entry.stopping = previous.catch(() => {}).then(async () => {
            const worker = entry.worker;
            if (!worker || worker.exitCode !== null || worker.signalCode) return;
            if (worker.connected) worker.send({ type: 'stop' }, () => {});
            let timer: ReturnType<typeof setTimeout> | undefined;
            try { await Promise.race([entry.exited, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(error(entry.role, 'stop-timeout')), 10_000); })]); }
            finally { clearTimeout(timer); }
        }).catch(() => {
            this.failed.add(entry.role);
            this.notify(error(entry.role, 'stop-timeout').message + '; owned process retirement is unconfirmed.');
        });
        this.retiring.set(entry.role, entry.stopping);
    }
    private childEnvironment(command: ManagedSpeechCommand): NodeJS.ProcessEnv {
        const result: NodeJS.ProcessEnv = {};
        for (const key of ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'SystemRoot', 'WINDIR', ...command.env]) {
            if (this.env[key] !== undefined) result[key] = this.env[key];
        }
        return result;
    }
    private async start(entry: Entry, key: string): Promise<void> {
        try {
            await this.retiring.get(entry.role);
            if (!this.current(entry)) return;
            if (this.failed.has(entry.role)) { this.fail(entry, 'retirement-unconfirmed'); return; }
            const worker = fork(fileURLToPath(new URL('./managed-speech.worker.mjs', import.meta.url)), [],
                { execArgv: [], env: this.childEnvironment({ ...entry.command, env: [] }), stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
            entry.worker = worker;
            entry.exited = new Promise<void>(resolve => worker.once('close', () => resolve()));
            worker.on('error', () => this.fail(entry, 'worker-error'));
            worker.on('exit', () => { if (!entry.retired) this.fail(entry, 'worker-exited'); });
            worker.on('message', (message: unknown) => {
                if (!message || typeof message !== 'object' || !('type' in message)) return;
                const data = message as { type: string; code?: string; id?: number; ok?: boolean; fatal?: boolean };
                if (data.type === 'notice' && ['lease-cleanup', 'retirement-unconfirmed'].includes(data.code ?? '')) {
                    this.notify(error(entry.role, data.code!).message + '; inspect locally; retained locks are never stolen.'); return;
                }
                if (!this.current(entry)) return;
                if (data.type === 'ready') { clearTimeout(entry.timer); entry.status = 'ready'; entry.resolve(); }
                else if (data.type === 'failed') this.fail(entry, codes.has(data.code ?? '') ? data.code! : 'worker-error');
                else if (data.type === 'checked' && typeof data.id === 'number') {
                    const check = entry.checks.get(data.id); entry.checks.delete(data.id);
                    const code = data.code && codes.has(data.code) ? data.code : 'ownership';
                    if (data.ok) check?.resolve(); else {
                        check?.reject(error(entry.role, data.fatal ? code : 'probe'));
                        if (data.fatal) this.fail(entry, code);
                    }
                }
            });
            entry.timer = setTimeout(() => this.fail(entry, 'startup-timeout'), entry.command.startupTimeoutMs + 5000);
            const endpoint = new URL(entry.command.endpoint);
            const lease = createHash('sha256').update(endpoint.origin).digest('hex');
            worker.send({ type: 'start', command: entry.command, childEnv: this.childEnvironment(entry.command), key, leaseRoot: join(this.options.root, 'managed-speech'), lease }, failure => { if (failure) this.fail(entry, 'worker-error'); });
        } catch { this.fail(entry, 'worker-error'); }
    }
    private check(entry: Entry): Promise<void> {
        return new Promise((resolve, reject) => {
            const id = ++this.serial;
            const timer = setTimeout(() => { entry.checks.delete(id); reject(error(entry.role, 'probe')); }, 8000);
            entry.checks.set(id, { resolve: () => { clearTimeout(timer); resolve(); }, reject: failure => { clearTimeout(timer); reject(failure); } });
            if (!entry.worker?.connected) { clearTimeout(timer); entry.checks.delete(id); reject(error(entry.role, 'worker-exited')); return; }
            entry.worker.send({ type: 'check', id }, failure => { if (failure) { entry.checks.get(id)?.reject(error(entry.role, 'worker-exited')); entry.checks.delete(id); } });
        });
    }
}
