import { ConversationRouter, type RoutingSnapshot } from './conversation-router.service.js';
import type { MessageRequest, MessageResult, WhatsAppSessionContext } from '../models/whatsapp.types.js';
import { resolveTtsConfig, TTS_MAX_CHARACTERS, type TtsConfig } from './tts-config.js';
import { cleanSpeechText } from './whatsapp-text.js';
import type { PreparedSpeech, TtsSynthesisOptions } from './tts.service.js';

export type ReplyOutputMode = 'text' | 'voice' | 'both' | 'mirror';
export interface FinalOutputPolicy {
    mode: ReplyOutputMode;
    tts?: TtsConfig;
    approvedDestinationKey?: string;
    groupOptIn?: boolean;
    /** Trusted settings/consent revision check; never supplied by a model tool. */
    isCurrent?: () => boolean;
}
export interface FinalOutputResult {
    text?: MessageResult;
    voice?: MessageResult;
    fallback?: boolean;
    uncertain?: boolean;
    cancelled?: boolean;
    skipped?: boolean;
}
interface Dependencies {
    router: ConversationRouter;
    context(): WhatsAppSessionContext;
    contextCurrent(context: WhatsAppSessionContext): boolean;
    connected(): boolean;
    /** A5 supplies validated settings. Without it all existing chats remain text-only. */
    policy?: (snapshot: RoutingSnapshot) => FinalOutputPolicy;
    prepareSpeech(text: string, config: TtsConfig, options: TtsSynthesisOptions, workspaceRoot: string): Promise<PreparedSpeech>;
    sendText(snapshot: RoutingSnapshot, text: string, signal: AbortSignal, isCurrent: () => boolean): Promise<MessageResult>;
    /** The sender owns onSettled, including after an early delivery-unknown return. */
    sendVoice(snapshot: RoutingSnapshot, request: MessageRequest): Promise<MessageResult>;
    accepted(snapshot: RoutingSnapshot, context: WhatsAppSessionContext, kind: 'text' | 'voice', text: string, result: MessageResult): Promise<void>;
}
interface Captured {
    policy: Readonly<FinalOutputPolicy>;
    context: WhatsAppSessionContext;
    workspaceRoot: string;
    runSignal?: AbortSignal;
}
interface Job extends Captured {
    snapshot: RoutingSnapshot;
    controller: AbortController;
    allowFinalText: boolean;
    allowFinalVoice: boolean;
}

/** No summarization or truncation: unsuitable answers retain their complete text. */
function speechReplyText(text: string, allowLinkLabels = false): string | undefined {
    if (text.length > TTS_MAX_CHARACTERS * 2) return;
    const spoken = cleanSpeechText(text, { allowLinkLabels });
    return spoken && [...spoken].length <= TTS_MAX_CHARACTERS ? spoken : undefined;
}
export function isSpeakableReply(text: string): boolean {
    return speechReplyText(text) !== undefined;
}

/** Owns one eligible final response, never a tool/thinking/terminal message. */
export class FinalOutputCoordinator {
    private readonly captures = new WeakMap<RoutingSnapshot, Captured>();
    private readonly handled = new WeakSet<RoutingSnapshot>();
    private readonly active = new Set<Job>();
    constructor(private readonly dependencies: Dependencies) {}

    capture(snapshot: RoutingSnapshot, workspaceRoot: string, runSignal?: AbortSignal): void {
        let policy: FinalOutputPolicy;
        try { policy = this.dependencies.policy?.(snapshot) ?? { mode: 'text' }; }
        catch { policy = { mode: 'text' }; }
        if (!['text', 'voice', 'both', 'mirror'].includes(policy?.mode)) policy = { mode: 'text' };
        this.captures.set(snapshot, { workspaceRoot, runSignal, context: Object.freeze({ ...this.dependencies.context() }),
            policy: Object.freeze({ ...policy, tts: policy.tts ? Object.freeze({ ...policy.tts }) : undefined }) });
    }

    /** Refusal only: revocation cannot turn a captured spoken reply into a raw-text escape. */
    protectsAutomaticSpeech(snapshot: RoutingSnapshot): boolean {
        const captured = this.captures.get(snapshot);
        if (!captured || this.dependencies.router.getControlOrigin(snapshot) !== 'whatsapp') return false;
        try {
            const policy = captured.policy;
            return Boolean(policy.isCurrent && this.effectiveMode(snapshot, policy) !== 'text'
                && policy.approvedDestinationKey === resolveTtsConfig(policy.tts ?? {}).destinationKey);
        } catch { return false; }
    }

    cancelAll(): void {
        for (const job of this.active) job.controller.abort();
    }

    async deliver(snapshot: RoutingSnapshot, text: string): Promise<FinalOutputResult> {
        const captured = this.captures.get(snapshot);
        if (!captured || this.handled.has(snapshot) || !this.dependencies.router.claimFinalization(snapshot)) return { skipped: true };
        this.handled.add(snapshot);
        const job: Job = { ...captured, snapshot, controller: new AbortController(), allowFinalText: false, allowFinalVoice: false };
        this.active.add(job);
        const abortFromRun = () => job.controller.abort();
        job.runSignal?.addEventListener('abort', abortFromRun, { once: true });
        if (job.runSignal?.aborted) abortFromRun();
        const monitor = setInterval(() => { if (!this.current(job)) job.controller.abort(); }, 100);
        monitor.unref();
        const result: FinalOutputResult = {};
        let prepared: PreparedSpeech | undefined;
        let delegated = false;
        try {
            if (!this.current(job)) return { cancelled: true };
            let mode = this.effectiveMode(snapshot, job.policy);
            let spoken = mode === 'text' ? undefined : speechReplyText(text, mode === 'both');
            if (mode !== 'text' && spoken === undefined) { mode = 'text'; result.fallback = true; }
            if (mode === 'text' || mode === 'both') {
                result.text = await this.text(job, text);
                if (result.text.delivery === 'unknown') return { ...result, uncertain: true };
                if (mode === 'text') return this.current(job) ? result : { ...result, cancelled: true };
                // A failed text send cannot authorize speech that omits the only copy of a link address.
                if (!result.text.success) {
                    spoken = speechReplyText(text);
                    if (spoken === undefined) return this.current(job) ? { ...result, fallback: true } : { ...result, cancelled: true };
                }
                job.allowFinalText = true;
            }
            if (!this.current(job)) return { ...result, cancelled: true };
            try {
                const config = job.policy.tts ?? {};
                if (!job.policy.isCurrent || job.policy.approvedDestinationKey !== resolveTtsConfig(config).destinationKey) throw new Error('Speech consent required');
                if (spoken === undefined) throw new Error('Speech text unavailable');
                prepared = await this.dependencies.prepareSpeech(spoken, config, { signal: job.controller.signal,
                    isCurrent: () => this.current(job), approvedDestinationKey: job.policy.approvedDestinationKey }, job.workspaceRoot);
            } catch {
                if (!this.current(job)) return { ...result, cancelled: true };
                result.fallback = true;
                if (mode === 'voice') result.text = await this.text(job, text);
                return { ...result, uncertain: result.text?.delivery === 'unknown' };
            }
            if (!this.current(job)) return { ...result, cancelled: true };
            const upload = prepared;
            let settled = false;
            const request: MessageRequest = {
                recipientJid: snapshot.target!, text: '', content: upload.content, sessionContext: job.context,
                signal: job.controller.signal, isCurrent: () => this.current(job), sendTimeoutMs: 60_000,
                options: { brand: false, maxRetries: 1 }, sendOptions: { mediaUploadTimeoutMs: 60_000 },
                onSettled: async outcome => {
                    if (settled) return;
                    settled = true;
                    try { if (outcome.success && this.recordable(job)) await this.dependencies.accepted(snapshot, job.context, 'voice', '', outcome); }
                    finally { await upload.dispose(); }
                }
            };
            delegated = true;
            job.allowFinalVoice = true;
            try { result.voice = await this.dependencies.sendVoice(snapshot, request); }
            catch { result.voice = { success: false, delivery: 'unknown', attempts: 1 }; }
            finally { job.allowFinalVoice = false; }
            if (result.voice.delivery === 'unknown') return { ...result, uncertain: true };
            if (!result.voice.success && !this.current(job)) return { ...result, cancelled: true };
            if (!result.voice.success && mode === 'voice') {
                result.fallback = true;
                result.text = await this.text(job, text);
            } else if (!result.voice.success) result.fallback = true;
            return { ...result, uncertain: result.text?.delivery === 'unknown' };
        } finally {
            try { if (prepared && !delegated) await prepared.dispose(); }
            finally {
                clearInterval(monitor);
                job.runSignal?.removeEventListener('abort', abortFromRun);
                this.active.delete(job);
                this.dependencies.router.finishFinalization(snapshot);
            }
        }
    }

    private effectiveMode(snapshot: RoutingSnapshot, policy: Readonly<FinalOutputPolicy>): Exclude<ReplyOutputMode, 'mirror'> {
        const mode = policy.mode === 'mirror'
            ? this.dependencies.router.getRequestMetadata(snapshot).inputKind === 'audio' ? 'voice' : 'text'
            : policy.mode;
        return snapshot.target?.endsWith('@g.us') && policy.groupOptIn !== true ? 'text' : mode;
    }

    private async text(job: Job, text: string): Promise<MessageResult> {
        if (!this.current(job)) return { success: false, attempts: 0 };
        job.allowFinalText = true;
        let result: MessageResult;
        try { result = await this.dependencies.sendText(job.snapshot, text, job.controller.signal, () => this.current(job)); }
        catch { return { success: false, delivery: 'unknown', attempts: 1 }; }
        if (result.success && this.recordable(job)) {
            try { await this.dependencies.accepted(job.snapshot, job.context, 'text', text, result); }
            catch { /* History failure must not replay an accepted send or stop the other format. */ }
        }
        return result;
    }
    private recordable(job: Job): boolean {
        return this.dependencies.router.isCurrent(job.snapshot) && this.dependencies.contextCurrent(job.context);
    }
    private current(job: Job): boolean {
        try { return !job.controller.signal.aborted && !job.runSignal?.aborted && this.dependencies.connected() && this.recordable(job)
            && (!job.policy.isCurrent || job.policy.isCurrent()) && this.dependencies.router.canFinalize(job.snapshot, job.allowFinalText, job.allowFinalVoice); }
        catch { return false; }
    }
}
