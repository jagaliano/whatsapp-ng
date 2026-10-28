import { extractMessageContent, type proto } from 'baileys';
import { extractContextInfo } from './incoming-message.resolver.js';

export type GroupReplyMode = 'mentions-or-replies' | 'mentions' | 'replies' | 'all';
export interface GroupReplies { mode: GroupReplyMode; context: boolean }
export const groupReplyModes: readonly GroupReplyMode[] = ['mentions-or-replies', 'mentions', 'replies', 'all'];
export function validateGroupReplies(value: unknown): GroupReplies {
    if (value === undefined) return { mode: 'mentions-or-replies', context: false };
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid group reply settings');
    const input = value as Record<string, unknown>;
    if (Object.keys(input).length !== 2 || Object.keys(input).some(key => key !== 'mode' && key !== 'context') || !groupReplyModes.includes(input.mode as GroupReplyMode) || typeof input.context !== 'boolean') throw new Error('Invalid group reply settings');
    return { mode: input.mode as GroupReplyMode, context: input.context };
}

/** Addressing is protocol metadata, never a textual @name or supplied quoted body. */
export function groupAddressing(message: proto.IMessage | null | undefined, chat: string, isOwn: (jid: string) => boolean) {
    const content = message ? extractMessageContent(message) : undefined;
    const context = extractContextInfo(content) as proto.IContextInfo | undefined;
    const mentioned = (context?.mentionedJid ?? []).some(jid => typeof jid === 'string' && isOwn(jid));
    const quote = context?.stanzaId && context.stanzaId.length <= 256 && context.participant
        && /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(context.participant)
        && (!context.remoteJid || context.remoteJid === chat)
        ? { id: context.stanzaId, participant: context.participant } : undefined;
    return { mentioned, replied: !!quote && isOwn(quote.participant), quote };
}

interface GroupInput {
    chat: string; scope: string; revision: number; admission: string; settings: GroupReplies;
    content?: proto.IMessage | null; plainText?: string; isOwn: (jid: string) => boolean;
}
interface ContextEntry { admission: string; messages: Array<{ text: string; at: number }> }
const TTL = 30 * 60 * 1000;

/** Memory-only live text; one unref'd expiry timer, no media, authority or replay. */
export class GroupMessagePolicy {
    private readonly contexts = new Map<string, ContextEntry>();
    private scope?: string;
    private revision?: number;
    private timer?: ReturnType<typeof setTimeout>;
    constructor(private readonly now = () => Date.now()) {}
    reset(): void { clearTimeout(this.timer); this.timer = undefined; this.contexts.clear(); this.scope = undefined; this.revision = undefined; }
    clearChat(chat: string): void { this.contexts.delete(chat); this.scheduleExpiry(); }
    private scheduleExpiry(): void {
        clearTimeout(this.timer); this.timer = undefined;
        const earliest = Math.min(...[...this.contexts.values()].flatMap(entry => entry.messages.map(message => message.at + TTL)));
        if (!Number.isFinite(earliest)) return;
        const scope = this.scope!; const revision = this.revision!;
        const timer = setTimeout(() => {
            if (this.timer !== timer) return;
            this.timer = undefined; this.synchronize(scope, revision);
        }, Math.max(1, earliest - this.now()));
        this.timer = timer; timer.unref?.();
    }
    synchronize(scope: string, revision: number): void {
        if (this.scope !== scope || this.revision !== revision) {
            this.reset(); this.scope = scope; this.revision = revision;
        }
        const now = this.now();
        for (const [chat, entry] of this.contexts) {
            entry.messages = entry.messages.filter(message => now - message.at < TTL && now >= message.at);
            if (!entry.messages.length) this.contexts.delete(chat);
        }
        this.scheduleExpiry();
    }
    evaluate(input: GroupInput): { admit: boolean; preceding: string[] } {
        this.synchronize(input.scope, input.revision); const now = this.now();
        const old = this.contexts.get(input.chat);
        if (!input.settings.context || (old && old.admission !== input.admission)) this.contexts.delete(input.chat);
        const { mentioned, replied } = groupAddressing(input.content, input.chat, input.isOwn);
        const admit = input.settings.mode === 'all' || (input.settings.mode === 'mentions' && mentioned)
            || (input.settings.mode === 'replies' && replied) || (input.settings.mode === 'mentions-or-replies' && (mentioned || replied));
        if (admit) {
            const preceding = this.contexts.get(input.chat)?.messages.map(message => message.text) ?? [];
            this.contexts.delete(input.chat); this.scheduleExpiry(); return { admit: true, preceding };
        }
        if (input.settings.context && input.plainText?.trim()) {
            const entry = this.contexts.get(input.chat) ?? { admission: input.admission, messages: [] };
            entry.messages.push({ text: input.plainText.slice(0, 2000), at: now }); entry.messages = entry.messages.slice(-20);
            this.contexts.delete(input.chat); this.contexts.set(input.chat, entry);
            while (this.contexts.size > 50) this.contexts.delete(this.contexts.keys().next().value!);
        }
        this.scheduleExpiry();
        return { admit: false, preceding: [] };
    }
}
