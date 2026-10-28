/** Optional owned-input reports: counts, observed file labels, bounded interims and one edited activity message. */
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import type { MessageResult } from '../models/whatsapp.types.ts';
import type { ConversationRouter, RoutingSnapshot } from './conversation-router.service.ts';

export interface ReplyReporting { changedFiles: boolean; interimText: boolean; liveActivity: boolean }
export function validateReplyReporting(value: unknown): ReplyReporting {
    if (value === undefined) return { changedFiles: false, interimText: false, liveActivity: false };
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid reply reporting settings');
    const input = value as Record<string, unknown>; const keys = ['changedFiles', 'interimText', 'liveActivity'];
    if (Object.keys(input).length !== keys.length || Object.keys(input).some(key => !keys.includes(key)) || keys.some(key => typeof input[key] !== 'boolean')) throw new Error('Invalid reply reporting settings');
    return { changedFiles: input.changedFiles as boolean, interimText: input.interimText as boolean, liveActivity: input.liveActivity as boolean };
}
interface ReportPolicy { enabled: boolean; flags?: ReplyReporting; isCurrent: () => boolean }
interface ReportMessage { role: string; content?: unknown; stopReason?: string }
interface Report {
    snapshot: RoutingSnapshot; started: number; succeeded: number; failed: number; partial: boolean;
    stats: boolean; flags: ReplyReporting; workspace?: string; files: Set<string>; filesPartial: boolean;
    current: () => boolean; signal?: AbortSignal; finished: boolean;
    interimCount: number; interimBusy: boolean; pendingInterim?: string; interims: WeakSet<RoutingSnapshot>;
    activityId?: string; activityBusy: boolean; activityStopped: boolean; pendingActivity?: string;
    lastActivityAt: number; timer?: ReturnType<typeof setTimeout>;
}
interface TrackedTool { report: Report; name: string; file?: string; fileTool: boolean }
type Send = (snapshot: RoutingSnapshot, text: string, signal: AbortSignal, isCurrent: () => boolean, onSettled: () => void) => Promise<MessageResult>;
interface Ports {
    router: Pick<ConversationRouter, 'isCurrent'>;
    policy(snapshot?: RoutingSnapshot): ReportPolicy;
    send: Send;
    edit?(snapshot: RoutingSnapshot, messageId: string, text: string, signal: AbortSignal, isCurrent: () => boolean, onSettled: () => void): Promise<MessageResult>;
    notify?(message: string): void;
    now?: () => number;
}
const MAX_REPORTS = 8;
const MAX_TOOLS = 500;
const ACTIVITY_INTERVAL_MS = 2000;

export class RunReportService {
    private readonly reports = new Map<object, Report>();
    private readonly completed = new WeakSet<object>();
    private readonly tools = new Map<string, TrackedTool>();
    private readonly seenTools = new Set<string>();
    private readonly controllers = new Set<AbortController>();
    private readonly jobs = new Set<Promise<void>>();
    private readonly activities = new Set<Report>();
    private nextInput?: { started: number; policy: ReportPolicy };
    private warned = false;
    private generation = 0;
    constructor(private readonly ports: Ports, private readonly clock = () => performance.now()) {}
    private now(): number { return this.ports.now?.() ?? this.clock(); }
    private warn(message = 'Optional reply reporting stopped or was omitted; no automatic retry.'): void {
        if (this.warned) return; this.warned = true;
        try { this.ports.notify?.(message); } catch { /* Local diagnostics cannot own delivery. */ }
    }
    private track(job: Promise<void>): void {
        const safe = job.catch(() => { this.warn(); }); this.jobs.add(safe); void safe.then(() => this.jobs.delete(safe));
    }
    /** Native agent_start: no prior Pi run's clock, signals or tools can be reused. */
    startRun(): void { this.reset(); this.warned = false; }
    /** Latch before message_start returns, not after an optional egress await. */
    noteInput(): void {
        if (this.nextInput) return;
        try { const policy = this.ports.policy(); this.nextInput = { started: this.now(), policy: { ...policy, flags: validateReplyReporting(policy.flags) } }; }
        catch { this.nextInput = { started: this.now(), policy: { enabled: false, isCurrent: () => false } }; }
    }
    capture(snapshot: RoutingSnapshot | undefined, signal?: AbortSignal, workspace?: string): void {
        const input = this.nextInput; this.nextInput = undefined;
        if (!snapshot || this.completed.has(snapshot.epoch)) return;
        const previous = this.reports.get(snapshot.epoch);
        if (previous) {
            if (!snapshot.target || !snapshot.canonicalTarget || snapshot.canonicalTarget !== previous.snapshot.canonicalTarget) {
                previous.current = () => false; this.close(snapshot);
            } else previous.snapshot = snapshot;
            return;
        }
        let policy: ReportPolicy;
        try { policy = this.ports.policy(snapshot); } catch { this.completed.add(snapshot.epoch); return; }
        const flags = input?.policy.flags ?? validateReplyReporting(undefined);
        let eligible = false;
        try { eligible = Boolean(input && (input.policy.enabled || Object.values(flags).some(Boolean)) && snapshot.target && snapshot.canonicalTarget
            && input.policy.isCurrent() && policy.isCurrent() && this.ports.router.isCurrent(snapshot)); } catch { /* Invalid optional policy cannot fail an answer. */ }
        if (!eligible || !input) { this.completed.add(snapshot.epoch); return; }
        if (this.reports.size + this.controllers.size >= MAX_REPORTS) { this.completed.add(snapshot.epoch); this.warn('Optional reply reporting capacity reached; this report was omitted.'); return; }
        const generation = this.generation;
        const current = () => { try { return generation === this.generation && !signal?.aborted && this.ports.router.isCurrent(snapshot) && input.policy.isCurrent() && policy.isCurrent(); } catch { return false; } };
        const report: Report = { snapshot, started: input.started, succeeded: 0, failed: 0, partial: false,
            stats: input.policy.enabled, flags: { ...flags }, workspace, files: new Set(), filesPartial: false, current, signal, finished: false,
            interimCount: 0, interimBusy: false, interims: new WeakSet(), activityBusy: false, activityStopped: !flags.liveActivity || !this.ports.edit, lastActivityAt: -Infinity };
        this.reports.set(snapshot.epoch, report);
        if (!report.activityStopped) { this.activities.add(report); this.activity(report, 'Activity: Working.'); }
    }
    toolStarted(toolCallId: string, snapshot?: RoutingSnapshot, toolName = 'tool', args?: unknown): void {
        const report = snapshot && this.reports.get(snapshot.epoch);
        if (!report || report.finished || !report.current()) return;
        if (typeof toolCallId !== 'string' || !toolCallId || toolCallId.length > 256 || this.seenTools.has(toolCallId)) { report.partial = true; report.filesPartial = true; return; }
        if (this.seenTools.size >= MAX_TOOLS) { report.partial = true; report.filesPartial = true; return; }
        this.seenTools.add(toolCallId);
        const name = /^[a-zA-Z0-9_.:-]{1,64}$/.test(toolName) ? toolName : 'tool';
        const fileTool = name === 'write' || name === 'edit';
        const file = fileTool && report.flags.changedFiles ? safeFile(args, report.workspace) : undefined;
        this.tools.set(toolCallId, { report, name, file, fileTool }); this.activity(report, this.status(report));
    }
    toolEnded(toolCallId: string, isError: boolean): void {
        const tool = this.tools.get(toolCallId); if (!tool) return; this.tools.delete(toolCallId);
        const report = tool.report; if (report.finished || !report.current()) return;
        if (isError) report.failed++; else {
            report.succeeded++;
            if (tool.fileTool && report.flags.changedFiles) {
                if (!tool.file || (report.files.size >= 20 && !report.files.has(tool.file))) report.filesPartial = true;
                else report.files.add(tool.file);
            }
        }
        this.activity(report, this.status(report));
    }
    /** Only a completed tool-bearing assistant frame. Final output remains the final coordinator's job. */
    interim(snapshot: RoutingSnapshot | undefined, message: ReportMessage): void {
        const report = snapshot && this.reports.get(snapshot.epoch);
        if (!report || !snapshot || report.finished || !report.flags.interimText || !report.current() || !toolTurn(message) || report.interims.has(snapshot) || report.interimCount >= 4) return;
        report.interims.add(snapshot);
        const text = (message.content as Array<{ type?: string; text?: unknown }>).filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n').trim();
        if (!text) return; const output = `Progress:\n${text}`;
        if (Buffer.byteLength(output) > 4096) { this.warn('Oversized interim text omitted; the final answer is unaffected.'); return; }
        report.interimCount++; report.pendingInterim = output; this.pumpInterim(report);
    }
    private pumpInterim(report: Report): void {
        if (report.interimBusy || !report.pendingInterim || report.finished || !report.current()) return;
        const text = report.pendingInterim; report.pendingInterim = undefined; report.interimBusy = true;
        this.track((async () => { try { await this.dispatch(report, text, 'interim'); }
            finally { report.interimBusy = false; this.pumpInterim(report); } })());
    }
    /** No post-final summary unless an owned automatic final was accepted. */
    finish(snapshot: RoutingSnapshot | undefined, message: ReportMessage): void {
        if (!snapshot || message.role !== 'assistant' || message.stopReason === 'aborted' || message.stopReason === 'error' || toolTurn(message)) return;
        const report = this.close(snapshot); if (!report || !report.current()) return;
        const parts: string[] = [];
        if (report.stats) {
            const seconds = Math.max(0, (this.now() - report.started) / 1000);
            parts.push(`Reply stats: ${seconds.toFixed(1)}s elapsed; tools ${report.succeeded} succeeded, ${report.failed} failed${report.partial ? ' (partial tracking)' : ''}.`);
        }
        if (report.flags.changedFiles) parts.push(`Observed successful write/edit files (workspace-relative${report.filesPartial ? '; partial tracking' : ''}):${report.files.size ? '\n' + [...report.files].map(file => `- \`${file}\``).join('\n') : ' none observed.'}`);
        if (parts.length) this.track(this.dispatch(report, parts.join('\n\n'), 'summary').then(() => undefined));
    }
    /** Suppressed/failed finals stop progress but cannot manufacture a successful final report. */
    endResponse(snapshot: RoutingSnapshot | undefined, message: ReportMessage): void {
        if (snapshot && message.role === 'assistant' && !toolTurn(message)) this.close(snapshot);
    }
    private close(snapshot: RoutingSnapshot): Report | undefined {
        if (this.completed.has(snapshot.epoch)) return undefined; this.completed.add(snapshot.epoch);
        const report = this.reports.get(snapshot.epoch); if (!report) return undefined;
        this.reports.delete(snapshot.epoch); report.finished = true; report.pendingInterim = undefined;
        for (const [id, tool] of this.tools) if (tool.report === report) { this.tools.delete(id); report.partial = true; report.filesPartial = true; }
        if (report.activityId || report.activityBusy) this.activity(report, 'Activity: Finished.'); else this.haltActivity(report);
        return report;
    }
    private status(report: Report): string {
        const running = [...this.tools.values()].filter(tool => tool.report === report).map(tool => tool.name);
        return running.length ? `Activity: Running ${running.slice(0, 3).join(', ')}${running.length > 3 ? ` (+${running.length - 3})` : ''}.`
            : `Activity: Working; tools ${report.succeeded} succeeded, ${report.failed} failed.`;
    }
    private activity(report: Report, text: string): void {
        if (report.activityStopped || !report.current()) { this.haltActivity(report); return; }
        report.pendingActivity = text;
        if (report.activityBusy || report.timer) return;
        const delay = Math.max(0, ACTIVITY_INTERVAL_MS - (this.now() - report.lastActivityAt));
        if (delay > 0) { report.timer = setTimeout(() => { report.timer = undefined; this.pumpActivity(report); }, delay); report.timer.unref?.(); }
        else this.pumpActivity(report);
    }
    private pumpActivity(report: Report): void {
        if (report.activityStopped || !report.current() || !report.pendingActivity || (report.finished && !report.activityId)) { this.haltActivity(report); return; }
        const text = report.pendingActivity; report.pendingActivity = undefined;
        const id = report.activityId; report.activityBusy = true; report.lastActivityAt = this.now();
        this.track((async () => {
            try {
                const result = await this.dispatch(report, text, 'activity', id);
                if (!result.success || result.delivery === 'unknown' || (!id && !result.messageId) || !report.current()) { this.haltActivity(report); return; }
                if (!id) report.activityId = result.messageId;
            } finally {
                report.activityBusy = false;
                if (!report.activityStopped && report.pendingActivity) this.activity(report, report.pendingActivity);
                else if (report.finished) this.haltActivity(report);
            }
        })());
    }
    private haltActivity(report: Report): void {
        if (report.timer) clearTimeout(report.timer); report.timer = undefined; report.pendingActivity = undefined;
        report.activityStopped = true; this.activities.delete(report);
    }
    private async dispatch(report: Report, text: string, kind: 'summary' | 'interim' | 'activity', editId?: string): Promise<MessageResult> {
        const controller = new AbortController();
        const current = () => !controller.signal.aborted && report.current() && (kind !== 'interim' || !report.finished) && (kind !== 'activity' || Boolean(editId) || !report.finished);
        if (!current()) return { success: false, attempts: 0 };
        if (this.controllers.size >= MAX_REPORTS) { this.warn('Optional reply reporting capacity reached; this update was omitted.'); return { success: false, attempts: 0 }; }
        this.controllers.add(controller); let senderSettled = false; let retainLease = false;
        const abort = () => controller.abort(); report.signal?.addEventListener('abort', abort, { once: true }); if (report.signal?.aborted) abort();
        const release = () => { senderSettled = true; report.signal?.removeEventListener('abort', abort); this.controllers.delete(controller); };
        try {
            // Reserve first, but let immediate cancellation withdraw an unissued update.
            await Promise.resolve(); if (!current()) return { success: false, attempts: 0 };
            const result = editId && this.ports.edit
                ? await this.ports.edit(report.snapshot, editId, text, controller.signal, current, release)
                : await this.ports.send(report.snapshot, text, controller.signal, current, release);
            if (result.delivery === 'unknown') { retainLease = !senderSettled; if (current()) this.warn('Optional report delivery unknown; not retried.'); }
            else if (!result.success && current()) this.warn();
            return result;
        } catch { retainLease = !senderSettled; if (current()) this.warn(); return { success: false, delivery: 'unknown', attempts: 1 }; }
        finally { if (!retainLease) release(); }
    }
    reset(): void {
        this.generation++; for (const controller of this.controllers) controller.abort();
        for (const report of this.activities) this.haltActivity(report);
        for (const epoch of this.reports.keys()) this.completed.add(epoch);
        this.reports.clear(); this.tools.clear(); this.seenTools.clear(); this.nextInput = undefined; this.warned = false;
    }
    async settled(): Promise<void> { while (this.jobs.size) await Promise.all([...this.jobs]); }
}
function toolTurn(message: ReportMessage): boolean {
    return message.role === 'assistant' && message.stopReason !== 'aborted' && message.stopReason !== 'error' && Array.isArray(message.content) && message.content.some(block => block?.type === 'toolCall');
}
function safeFile(args: unknown, workspace?: string): string | undefined {
    if (!workspace || !args || typeof args !== 'object' || Array.isArray(args)) return undefined;
    const path = (args as { path?: unknown }).path;
    if (typeof path !== 'string' || !path || /^(?:~(?:[\\/]|$)|[a-zA-Z]:|file:)/.test(path) || path.length > 4096 || /[\p{Cc}\p{Cf}`]/u.test(path) || (win32.isAbsolute(path) && !isAbsolute(path))) return undefined;
    const local = relative(resolve(workspace), resolve(workspace, path));
    if (!local || local === '..' || local.startsWith('..' + sep) || isAbsolute(local) || Buffer.byteLength(local) > 160) return undefined;
    const pieces = local.split(/[\\/]/);
    if (pieces.some(piece => piece.startsWith('.') || /(?:auth|credential|secret|token|private[-_]?key)|\.(?:pem|key|p12|pfx)$/i.test(piece))) return undefined;
    return pieces.join('/');
}
