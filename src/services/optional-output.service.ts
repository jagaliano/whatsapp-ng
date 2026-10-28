import { createHash } from 'node:crypto';
import type { ConversationRouter, RoutingSnapshot } from './conversation-router.service.js';
import type { MessageRequest, MessageResult } from '../models/whatsapp.types.js';
import type { PreparedOutgoingMedia } from './outgoing-media.service.js';

export interface OptionalOutputs {
    imageTools: string[];
    terminal?: { ownerJid: string; accountScope: string };
}
export function validateOptionalOutputs(value: unknown): OptionalOutputs {
    if (value === undefined) return { imageTools: [] };
    const invalid = () => { throw new Error('Invalid optional output settings'); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some(key => !['imageTools', 'terminal'].includes(key)) || !Array.isArray(record.imageTools) || record.imageTools.length > 32) return invalid();
    const tools = record.imageTools;
    if (tools.some(name => typeof name !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(name) || ['send_wa_media', 'send_wa_message', 'send_reaction'].includes(name.split(/[.:]/).at(-1) ?? '')) || new Set(tools).size !== tools.length) return invalid();
    let terminal: OptionalOutputs['terminal'];
    if (record.terminal !== undefined) {
        const item = record.terminal as Record<string, unknown>;
        if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['ownerJid', 'accountScope'].includes(key))
            || typeof item.ownerJid !== 'string' || !/^\d+@(s\.whatsapp\.net|lid)$/.test(item.ownerJid)
            || typeof item.accountScope !== 'string' || !item.accountScope || item.accountScope.length > 256) return invalid();
        terminal = { ownerJid: item.ownerJid, accountScope: item.accountScope };
    }
    return { imageTools: [...tools], ...(terminal ? { terminal } : {}) };
}
export interface OptionalOutputPolicy {
    settings: OptionalOutputs;
    ownerJid?: string;
    accountScope: string;
    isCurrent(): boolean;
    terminalCurrent?(): boolean;
}
interface Dependencies {
    router: ConversationRouter;
    policy(): OptionalOutputPolicy;
    allowed(jid: string): boolean;
    prepareImage(data: string, mimeType: string, workspace: string, signal: AbortSignal): Promise<Pick<PreparedOutgoingMedia, 'content' | 'dispose'>>;
    /** Owns onSettled even when returning a delivery-unknown result early. */
    send(snapshot: RoutingSnapshot, request: MessageRequest, attachment: boolean): Promise<MessageResult>;
    notify(text: string): void;
}
interface Admission { policy: OptionalOutputPolicy; hashes: Set<string>; bytes: number; count: number }
interface Frame { admission: Admission; snapshot: RoutingSnapshot; workspace: string; signal?: AbortSignal; origin: 'terminal' | 'whatsapp' | 'unknown' }
const MAX_BYTES = 25 * 1024 * 1024;

/** Default-off egress from verified lifecycle content, never tool paths, URLs or guessed destinations. */
export class OptionalOutputService {
    private admission?: Admission;
    private frames = new WeakMap<RoutingSnapshot, Frame>();
    private readonly tools = new Map<string, { name: string; frame: Frame }>();
    private readonly jobs = new Set<AbortController>();
    constructor(private readonly dependencies: Dependencies) {}

    noteInput(): void {
        this.reset();
        try {
            const policy = this.dependencies.policy();
            this.admission = { policy: { ...policy, settings: validateOptionalOutputs(policy.settings) }, hashes: new Set(), bytes: 0, count: 0 };
        } catch { /* Malformed/unavailable settings cannot opt in. */ }
    }
    capture(snapshot: RoutingSnapshot, workspace: string, signal?: AbortSignal): void {
        if (!this.admission) return;
        this.frames.set(snapshot, { admission: this.admission, snapshot, workspace, signal, origin: this.dependencies.router.getControlOrigin(snapshot) });
    }
    toolStarted(id: string, name: string, snapshot?: RoutingSnapshot): void {
        const frame = snapshot ? this.frames.get(snapshot) : undefined;
        if (!frame || frame.origin !== 'whatsapp' || !frame.snapshot.target || !this.current(frame, frame.snapshot.target)
            || !frame.admission.policy.settings.imageTools.includes(name) || this.tools.has(id) || this.tools.size >= 256) return;
        this.tools.set(id, { name, frame });
    }
    async toolEnded(id: string, name: string, result: unknown, isError: boolean): Promise<void> {
        const tool = this.tools.get(id); this.tools.delete(id);
        if (!tool || tool.name !== name || isError || !result || typeof result !== 'object' || (result as { isError?: unknown }).isError === true) return;
        const { frame } = tool; const target = frame.snapshot.target;
        if (!target || !this.current(frame, target)) return;
        const content = (result as { content?: unknown }).content;
        if (!Array.isArray(content)) return;
        // Bound even malformed plugin outputs without inspecting arbitrary details.
        for (const block of content.slice(0, 32)) {
            if (!this.current(frame, target) || frame.admission.count >= 4) break;
            if (!block || block.type !== 'image' || typeof block.data !== 'string' || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(block.mimeType)) continue;
            if (!block.data.length || block.data.length > Math.ceil(MAX_BYTES / 3) * 4 || block.data.length % 4) continue;
            const bytes = Buffer.from(block.data, 'base64');
            if (!bytes.length || bytes.length + frame.admission.bytes > MAX_BYTES || bytes.toString('base64') !== block.data) continue;
            const hash = createHash('sha256').update(bytes).digest('hex');
            if (frame.admission.hashes.has(hash)) continue;
            // Reserve before awaiting: parallel and repeated results cannot resend.
            frame.admission.hashes.add(hash); frame.admission.bytes += bytes.length; frame.admission.count++;
            await this.deliver(frame, target, '', { data: block.data, mimeType: block.mimeType });
        }
    }
    async forwardTerminal(): Promise<void> {
        const snapshot = this.dependencies.router.snapshot(); const frame = snapshot ? this.frames.get(snapshot) : undefined;
        const policy = frame?.admission.policy; const consent = policy?.settings.terminal;
        if (!frame || frame.origin !== 'terminal' || !consent || consent.ownerJid !== policy?.ownerJid || consent.accountScope !== policy.accountScope
            || !this.current(frame, consent.ownerJid)) return;
        const answer = this.dependencies.router.takeTerminalAnswer(consent.ownerJid);
        if (!answer || answer.snapshot !== snapshot) return;
        if (Buffer.byteLength(answer.text, 'utf8') > 64 * 1024) { this.notify('Terminal answer exceeds 64 KiB; kept local.'); return; }
        await this.deliver(frame, consent.ownerJid, answer.text);
    }
    reset(): void {
        for (const controller of this.jobs) controller.abort();
        this.tools.clear(); this.frames = new WeakMap(); this.admission = undefined;
    }
    private notify(text: string): void {
        try { this.dependencies.notify(text); } catch { /* UI failure does not replay egress or block model work. */ }
    }
    private current(frame: Frame, target: string): boolean {
        try { return this.admission === frame.admission && !frame.signal?.aborted && frame.admission.policy.isCurrent()
            && (frame.origin !== 'terminal' || !frame.admission.policy.terminalCurrent || frame.admission.policy.terminalCurrent())
            && this.dependencies.router.isActive() && this.dependencies.router.isCurrent(frame.snapshot) && this.dependencies.allowed(target); }
        catch { return false; }
    }
    private async deliver(frame: Frame, target: string, text: string, image?: { data: string; mimeType: string }): Promise<void> {
        if (this.jobs.size >= 4) { this.notify('Optional output capacity reached; not queued or retried.'); return; }
        const controller = new AbortController(); this.jobs.add(controller);
        const abort = () => controller.abort(); frame.signal?.addEventListener('abort', abort, { once: true });
        const current = () => !controller.signal.aborted && this.current(frame, target);
        let upload: Pick<PreparedOutgoingMedia, 'content' | 'dispose'> | undefined; let delegated = false; let settled = false;
        const cleanup = async () => {
            if (settled) return; settled = true;
            try { await upload?.dispose(); } finally { frame.signal?.removeEventListener('abort', abort); this.jobs.delete(controller); }
        };
        try {
            if (!current()) return;
            if (image) upload = await this.dependencies.prepareImage(image.data, image.mimeType, frame.workspace, controller.signal);
            if (!current()) return;
            delegated = true;
            const result = await this.dependencies.send(frame.snapshot, { recipientJid: target, text, ...(upload ? { content: upload.content } : {}),
                signal: controller.signal, isCurrent: current, onSettled: cleanup, sendTimeoutMs: 60_000,
                sendOptions: { mediaUploadTimeoutMs: 60_000 }, options: { maxRetries: 1 } }, Boolean(image));
            if (!result.success) this.notify(result.delivery === 'unknown' ? 'Optional output delivery unknown; not retried.' : 'Optional output could not be sent.');
        } catch { this.notify('Optional output failed or was cancelled; no automatic retry.'); }
        finally { if (!delegated) await cleanup(); }
    }
}
