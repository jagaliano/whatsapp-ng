import { createHash, randomUUID } from 'node:crypto';
import type { WAMessageKey } from 'baileys';
import type { WhatsAppInputKind, WhatsAppRequestMetadata } from '../models/whatsapp.types.js';
import { t } from '../i18n.js';

type ContentBlock = { type: string; text?: string; data?: string; mimeType?: string };
export type RoutedContent = string | ContentBlock[];
interface RoutedMessage {
    role: string;
    content?: RoutedContent;
    stopReason?: string;
}
interface PendingRequest {
    key: WAMessageKey;
    scope: string;
    observed: boolean;
    expiresAt: number;
    inputKind: WhatsAppInputKind;
    actorJid?: string;
    admissionCurrent?: () => boolean;
}
export type SendPurpose = 'explicit-text' | 'attachment' | 'tool-image' | 'progress' | 'final-text' | 'final-voice';
interface SendState { inFlight: number; confirmed: boolean; unknown: boolean }
interface Epoch {
    scope: string;
    origins: Map<string, string>;
    unowned: boolean;
    sends: Map<string, Map<SendPurpose, SendState>>;
    finalAfterAttachments: boolean;
    ambiguityNotified: boolean;
    inputKinds: Set<WhatsAppInputKind>;
    actors: Set<string>;
    unknownActor: boolean;
    sources: Set<'terminal' | 'whatsapp' | 'unknown'>;
    admissionChecks: Array<() => boolean>;
}
export interface RoutingSnapshot {
    readonly target?: string;
    readonly canonicalTarget?: string;
    readonly epoch: Epoch;
    readonly runtimeId: string;
    readonly metadata: WhatsAppRequestMetadata;
    readonly controlOrigin: 'terminal' | 'whatsapp' | 'unknown';
}
interface SendToken { epoch: Epoch; target: string; purpose: SendPurpose }
interface SendOutcome { success: boolean; delivery?: 'unknown' }

/** Correlates exact submitted user content; never derives a destination from message text. */
export class ConversationRouter {
    private readonly pending = new Map<string, PendingRequest>();
    private epoch?: Epoch;
    private accumulating = false;
    private frozen?: RoutingSnapshot;
    private buffered?: { snapshot: RoutingSnapshot; text: string; eligible: boolean };
    private active = false;
    private runtimeId = randomUUID();
    private readonly claimedResponses = new WeakSet<RoutingSnapshot>();
    private readonly finalizing = new WeakMap<Epoch, RoutingSnapshot>();
    private readonly knownSnapshots = new WeakSet<RoutingSnapshot>();
    private terminalInput?: { digest: string; scope: string; expiresAt: number };

    constructor(
        private readonly canonical: (jid: string) => string | undefined = jid => jid,
        private readonly scope: () => string = () => 'default',
        private readonly onConsumed: (key: WAMessageKey) => void = () => {},
        private readonly onSuppress: (target: string, state: SendState) => void = () => {},
        private readonly finalAfterAttachments: () => boolean = () => true,
        private readonly resolveActor: (key: WAMessageKey) => string | undefined = key => key.fromMe === false
            ? (key.remoteJid?.endsWith('@g.us') ? key.participant ?? undefined : key.remoteJid ?? undefined)
            : undefined,
        private readonly retiredInputs = new Set<string>()
    ) {}

    public getRuntimeId(): string {
        return this.runtimeId;
    }

    public prepare<T extends RoutedContent>(content: T, key: WAMessageKey, metadata: Partial<Pick<WhatsAppRequestMetadata, 'inputKind'>> & { admissionCurrent?: () => boolean } = {}): { content: T; requestId: string } {
        this.retireExpiredPending();
        if (!key.remoteJid || !key.id || !this.canonical(key.remoteJid)) throw new Error(t('routing.destinationRequired'));
        // Reserve capacity before submission: Pi owns queued follow-ups and
        // abort does not prove their removal. Never evict their stop fences.
        if (this.pending.size + this.retiredInputs.size >= 500) throw new Error(t('routing.pendingLimit'));
        const requestId = randomUUID();
        const prefix = `[WhatsApp request ${requestId}]\n`;
        const marked = (typeof content === 'string' ? prefix + content : [
            { type: 'text', text: prefix }, ...content
        ]) as T;
        const actorJid = this.resolveActor({ ...key });
        this.pending.set(this.digest(marked), {
            key: { ...key }, scope: this.scope(), observed: false,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            inputKind: this.inputKind(metadata.inputKind),
            actorJid: actorJid && this.personCanonical(actorJid) ? actorJid : undefined,
            admissionCurrent: metadata.admissionCurrent
        });
        return { content: marked, requestId };
    }

    public observeInput(input: { source: string; text: string; images?: ContentBlock[] }): void {
        const content: RoutedContent = [{ type: 'text', text: input.text }, ...(input.images ?? [])];
        const digest = this.digest(content);
        // Positive local provenance, not "no WhatsApp target". Any newer input
        // invalidates an unconsumed local proof, including handled/transformed input.
        this.terminalInput = undefined;
        const pending = this.pending.get(digest);
        if (input.source === 'interactive' || input.source === 'rpc') {
            this.retiredInputs.delete(digest);
            this.pending.delete(digest);
            this.terminalInput = { digest, scope: this.scope(), expiresAt: Date.now() + 5 * 60 * 1000 };
        } else if (pending && input.source === 'extension') pending.observed = true;
        else if (pending) this.pending.delete(digest);
    }

    public consume(message: RoutedMessage): void {
        if (message.role !== 'user' && message.role !== 'custom') return;
        if (!this.accumulating) {
            this.epoch = this.createEpoch(false);
            this.accumulating = true;
        }
        const epoch = this.epoch;
        if (!epoch) return;
        const digest = this.digest(message.content ?? '');
        const local = this.terminalInput;
        this.terminalInput = undefined;
        if (message.role === 'user' && local?.digest === digest && local.scope === this.scope() && local.expiresAt > Date.now()) {
            epoch.sources.add('terminal');
            epoch.unowned = true; // Terminal work still has no WhatsApp reply target.
            return;
        }
        const request = message.role === 'user' ? this.pending.get(digest) : undefined;
        this.pending.delete(digest);
        const jid = request?.key.remoteJid;
        const canonical = jid ? this.canonical(jid) : undefined;
        if (!request?.observed || request.expiresAt <= Date.now() || request.scope !== this.scope() || !jid || !canonical) {
            epoch.unowned = true;
            epoch.sources.add('unknown');
            return;
        }
        if (request.admissionCurrent) epoch.admissionChecks.push(request.admissionCurrent);
        epoch.sources.add('whatsapp');
        epoch.origins.set(canonical, jid);
        epoch.inputKinds.add(request.inputKind);
        if (request.actorJid) epoch.actors.add(request.actorJid);
        else epoch.unknownActor = true;
        this.onConsumed(request.key);
    }

    public startRun(): void {
        this.active = true;
    }

    public freeze(): void {
        this.accumulating = false;
        this.buffered = undefined;
        const epoch = this.epoch ?? this.createEpoch(true);
        const origins = new Map<string, string>();
        for (const jid of epoch.origins.values()) {
            const canonical = this.canonical(jid);
            if (canonical) origins.set(canonical, jid);
            else epoch.unowned = true;
        }
        epoch.origins = origins;
        const entry = !epoch.unowned && epoch.scope === this.scope() && origins.size === 1
            ? origins.entries().next().value : undefined;
        // Each assistant message_start gets a fresh snapshot: its identity is the
        // local response ID, independent of answer text and later turn callbacks.
        const actors = [...epoch.actors].map(jid => this.personCanonical(jid));
        const actorJid = entry && !epoch.unknownActor && actors.every(Boolean) && new Set(actors).size === 1
            ? actors[0] : undefined;
        const inputKind = entry && epoch.inputKinds.size === 1
            ? epoch.inputKinds.values().next().value ?? 'unknown' : 'unknown';
        this.frozen = Object.freeze({
            epoch, canonicalTarget: entry?.[0], target: entry?.[1], runtimeId: this.runtimeId,
            metadata: Object.freeze({ inputKind, actorJid }),
            controlOrigin: epoch.sources.size === 1 && epoch.sources.has('terminal') ? 'terminal'
                : entry && epoch.sources.size === 1 && epoch.sources.has('whatsapp') ? 'whatsapp' : 'unknown'
        });
        this.knownSnapshots.add(this.frozen);
    }

    public snapshot(): RoutingSnapshot | undefined {
        return this.frozen;
    }

    public isActive(): boolean {
        return this.active;
    }

    /** Revalidate before using metadata for reply mode or future owner checks. */
    public getRequestMetadata(snapshot = this.frozen): WhatsAppRequestMetadata {
        if (!snapshot?.target || !this.isCurrent(snapshot) || !this.canonical(snapshot.target)) return { inputKind: 'unknown' };
        return {
            inputKind: snapshot.metadata.inputKind,
            actorJid: snapshot.metadata.actorJid ? this.personCanonical(snapshot.metadata.actorJid) : undefined
        };
    }

    public isCurrent(snapshot: RoutingSnapshot): boolean {
        try { return snapshot.runtimeId === this.runtimeId && snapshot.epoch.scope === this.scope() && snapshot.epoch.admissionChecks.every(check => check()); }
        catch { return false; }
    }

    public getControlOrigin(snapshot = this.frozen): 'terminal' | 'whatsapp' | 'unknown' {
        // Control authority belongs to this exact consumed-input/assistant frame.
        // Sender snapshots intentionally remain separately usable for settlement.
        return snapshot && snapshot === this.frozen && snapshot.epoch === this.epoch
            && this.knownSnapshots.has(snapshot) && this.isCurrent(snapshot) ? snapshot.controlOrigin : 'unknown';
    }

    public defaultTarget(): string | undefined {
        const snapshot = this.frozen;
        return snapshot?.target && this.isCurrent(snapshot) && this.canonical(snapshot.target)
            ? snapshot.target : undefined;
    }

    public buffer(message: RoutedMessage): void {
        if (message.role !== 'assistant' || !this.frozen) return;
        const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content ?? [];
        this.buffered = {
            snapshot: this.frozen,
            text: blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n'),
            eligible: !blocks.some(block => block.type === 'toolCall')
                && message.stopReason !== 'error' && message.stopReason !== 'aborted'
        };
    }

    public mirror(): { snapshot: RoutingSnapshot; text: string } | undefined {
        const buffered = this.buffered;
        if (!buffered?.eligible || !buffered.text || !buffered.snapshot.target || !buffered.snapshot.canonicalTarget) return undefined;
        if (!this.isCurrent(buffered.snapshot) || this.claimedResponses.has(buffered.snapshot) || this.finalizing.has(buffered.snapshot.epoch)) return undefined;
        const target = this.canonical(buffered.snapshot.target);
        if (!target) return undefined;
        const covered = this.coveringSend(buffered.snapshot.epoch, target);
        if (covered) {
            this.onSuppress(target, covered);
            return undefined;
        }
        // Claim before returning, not after the asynchronous network send. Even a
        // failed final send must not be replayed by duplicate lifecycle callbacks.
        this.claimedResponses.add(buffered.snapshot);
        return { snapshot: buffered.snapshot, text: buffered.text };
    }

    /** Read-only terminal projection: never assigns a WhatsApp target to local work. */
    public takeTerminalAnswer(ownerJid: string): { snapshot: RoutingSnapshot; text: string } | undefined {
        const buffered = this.buffered; const target = this.canonical(ownerJid);
        if (!buffered?.eligible || !buffered.text || !target || this.getControlOrigin(buffered.snapshot) !== 'terminal'
            || this.claimedResponses.has(buffered.snapshot) || this.coveringSend(buffered.snapshot.epoch, target)) return undefined;
        this.claimedResponses.add(buffered.snapshot);
        return { snapshot: buffered.snapshot, text: buffered.text };
    }

    /** Reserve the whole finalization, including synthesis before a send starts. */
    public claimFinalization(snapshot: RoutingSnapshot): boolean {
        if (this.finalizing.has(snapshot.epoch) || !this.canFinalize(snapshot)) return false;
        this.finalizing.set(snapshot.epoch, snapshot);
        return true;
    }

    public finishFinalization(snapshot: RoutingSnapshot): void {
        if (this.finalizing.get(snapshot.epoch) === snapshot) this.finalizing.delete(snapshot.epoch);
    }

    public canFinalize(snapshot: RoutingSnapshot, allowFinalText = false, allowFinalVoice = false): boolean {
        if (!snapshot.target || !snapshot.canonicalTarget || !this.isCurrent(snapshot)) return false;
        const target = this.canonical(snapshot.target);
        const owner = this.finalizing.get(snapshot.epoch);
        return Boolean(target && target === this.canonical(snapshot.canonicalTarget) && (!owner || owner === snapshot)
            && !this.coveringSend(snapshot.epoch, target, !snapshot.epoch.finalAfterAttachments, allowFinalText, allowFinalVoice));
    }

    public takeAmbiguityNotice(): { snapshot: RoutingSnapshot; targets: string[] } | undefined {
        const buffered = this.buffered;
        if (!buffered?.eligible || !buffered.text || buffered.snapshot.target || !this.isCurrent(buffered.snapshot)) return undefined;
        const epoch = buffered.snapshot.epoch;
        if (epoch.ambiguityNotified) return undefined;
        const targets = [...new Set(epoch.origins.values())].filter(jid => {
            const canonical = this.canonical(jid);
            // An attachment is not an explicit answer to the ambiguous request,
            // including when legacy mode suppresses ordinary final text.
            return canonical && !this.coveringSend(epoch, canonical, false);
        });
        if (!targets.length) return undefined;
        epoch.ambiguityNotified = true;
        return { snapshot: buffered.snapshot, targets };
    }

    public beginSend(snapshot: RoutingSnapshot | undefined, jid: string, purpose: SendPurpose = 'explicit-text'): SendToken | undefined {
        const target = this.canonical(jid);
        if (!snapshot || !target || !this.isCurrent(snapshot)) return undefined;
        const purposes = snapshot.epoch.sends.get(target) ?? new Map<SendPurpose, SendState>();
        const state = purposes.get(purpose) ?? { inFlight: 0, confirmed: false, unknown: false };
        state.inFlight++;
        purposes.set(purpose, state);
        snapshot.epoch.sends.set(target, purposes);
        return { epoch: snapshot.epoch, target, purpose };
    }

    public finishSend(token: SendToken | undefined, result: SendOutcome): void {
        if (!token) return;
        const purposes = token.epoch.sends.get(token.target);
        const state = purposes?.get(token.purpose);
        if (!state || !purposes) return;
        state.inFlight = Math.max(0, state.inFlight - 1);
        state.confirmed ||= result.success;
        state.unknown ||= result.delivery === 'unknown';
        if (!state.inFlight && !state.confirmed && !state.unknown) purposes.delete(token.purpose);
        if (!purposes.size) token.epoch.sends.delete(token.target);
    }

    public endRun(recoverable: boolean): void {
        this.active = false;
        this.buffered = undefined;
        this.frozen = undefined;
        if (!recoverable) {
            this.epoch = undefined;
            this.accumulating = false;
        }
    }

    /** Public lifecycle fence for Pi-owned follow-ups: abort() does not clear its queue. */
    public isRetiredInput(message: RoutedMessage): boolean {
        this.retireExpiredPending();
        if (message.role !== 'user') return false;
        const digest = this.digest(message.content ?? ''); const pending = this.pending.get(digest);
        if (pending?.admissionCurrent) {
            let current = false; try { current = pending.admissionCurrent(); } catch { /* Invalid policy cannot admit old work. */ }
            if (!current) { this.pending.delete(digest); this.retiredInputs.add(digest); }
        }
        return this.retiredInputs.has(digest);
    }

    /** Called only as Pi consumes that exact user message; retain on abort failure. */
    public abortRetiredInput(message: RoutedMessage, abort: () => void): boolean {
        if (!this.isRetiredInput(message)) return false;
        abort();
        this.retiredInputs.delete(this.digest(message.content ?? ''));
        return true;
    }

    private retireExpiredPending(): void {
        for (const [digest, request] of this.pending) if (request.expiresAt <= Date.now()) {
            this.retiredInputs.add(digest); this.pending.delete(digest);
        }
    }

    public reset(): void {
        this.runtimeId = randomUUID();
        for (const digest of this.pending.keys()) this.retiredInputs.add(digest);
        this.pending.clear();
        this.terminalInput = undefined;
        this.epoch = undefined;
        this.frozen = undefined;
        this.buffered = undefined;
        this.accumulating = false;
        this.active = false;
    }

    private coveringSend(epoch: Epoch, target: string, includeAttachments = !epoch.finalAfterAttachments, allowFinalText = false, allowFinalVoice = false): SendState | undefined {
        for (const [jid, purposes] of epoch.sends) {
            if (this.canonical(jid) !== target) continue;
            for (const [purpose, state] of purposes) {
                if (purpose === 'progress' || purpose === 'tool-image' || (purpose === 'attachment' && !includeAttachments) || (purpose === 'final-text' && allowFinalText) || (purpose === 'final-voice' && allowFinalVoice)) continue;
                if (state.inFlight > 0 || state.confirmed || state.unknown) return state;
            }
        }
        return undefined;
    }

    private createEpoch(unowned: boolean): Epoch {
        return {
            scope: this.scope(), origins: new Map(), unowned, sends: new Map(),
            finalAfterAttachments: this.finalAfterAttachments(), ambiguityNotified: false,
            inputKinds: new Set(), actors: new Set(), unknownActor: false,
            sources: new Set(), admissionChecks: []
        };
    }

    private inputKind(kind: unknown): WhatsAppInputKind {
        switch (kind) {
            case 'text': case 'audio': case 'image': case 'video': case 'document': case 'contact': case 'location':
                return kind;
            default: return 'unknown';
        }
    }

    private personCanonical(jid: string): string | undefined {
        const canonical = this.canonical(jid);
        return canonical && /^\d+@(s\.whatsapp\.net|lid)$/.test(canonical) ? canonical : undefined;
    }

    private digest(content: RoutedContent): string {
        const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
        const normalized = {
            text: blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n'),
            images: blocks.filter(block => block.type === 'image').map(block => ({ data: block.data, mimeType: block.mimeType }))
        };
        return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    }
}
