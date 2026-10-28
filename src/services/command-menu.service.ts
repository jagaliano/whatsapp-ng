import { randomBytes, randomUUID } from 'node:crypto';
import { decryptPollVote, getAggregateVotesInPollMessage, getKeyAuthor, jidNormalizedUser, type WAMessageKey, proto } from 'baileys';

export interface CommandMenuBinding {
    chat: string;
    actor: string;
    scope: string;
    current: () => boolean;
}
export interface CommandMenuInput { chat: string; actor: string; scope: string; text: string; quotedId?: string }
export interface CommandPollInput {
    chat: string; actor: string; scope: string; selfJid: string;
    /** Own LID from the connected socket, never a voter-supplied identity claim. */
    selfLid?: string;
    creationKey: WAMessageKey; voterKey: WAMessageKey; vote: proto.Message.IPollEncValue;
}
interface Menu<T> {
    id: string; binding: CommandMenuBinding; expires: number; textId?: string; pollId?: string;
    options: Array<{ label: string; value: T }>; secret: Buffer; timer?: ReturnType<typeof setTimeout>;
}

/** Ephemeral control UI only. Poll keys never enter an archive, log or model prompt. */
export class CommandMenuService<T> {
    private readonly menus = new Map<string, Menu<T>>();
    constructor(private readonly canonical: (jid: string) => string | undefined, private readonly now = Date.now) {}

    private remove(key: string): void {
        const menu = this.menus.get(key); if (menu?.timer) clearTimeout(menu.timer);
        menu?.secret.fill(0); this.menus.delete(key);
    }
    private prune(): void {
        for (const [key, menu] of this.menus) if (menu.expires <= this.now() || !menu.binding.current()) this.remove(key);
    }
    get size(): number { this.prune(); return this.menus.size; }
    reset(): void { for (const key of this.menus.keys()) this.remove(key); }
    cancel(chat: string, actor?: string): void {
        const key = this.canonical(chat); const menu = key ? this.menus.get(key) : undefined;
        if (key && menu && (!actor || this.sameActor(menu, actor))) this.remove(key);
    }
    discard(id: string): void { for (const [key, menu] of this.menus) if (menu.id === id) { this.remove(key); return; } }
    private sameActor(menu: Menu<T>, actor: string): boolean {
        const expected = this.canonical(menu.binding.actor); return !!expected && expected === this.canonical(actor);
    }
    create(binding: CommandMenuBinding, title: string, options: Array<{ label: string; value: T }>) {
        this.prune(); const key = this.canonical(binding.chat);
        if (!key || !this.canonical(binding.actor) || !binding.current() || !options.length || options.length > 12) throw new Error('Control menu unavailable');
        this.cancel(binding.chat);
        if (this.menus.size >= 50) this.remove(this.menus.keys().next().value!);
        const frozen = structuredClone(options).map((option, i) => ({ ...option, label: `${i + 1}. ${safeLabel(option.label)}` }));
        const menu: Menu<T> = { id: randomUUID(), binding: { ...binding }, expires: this.now() + 300_000,
            options: frozen, secret: randomBytes(32) };
        this.menus.set(key, menu);
        menu.timer = setTimeout(() => { if (this.menus.get(key) === menu) this.remove(key); }, 300_000);
        menu.timer.unref?.();
        return { id: menu.id, text: `${safeLabel(title)}\n${frozen.map(option => option.label).join('\n')}\nReply with a number within 5 minutes${key.endsWith('@g.us') ? ', quoting this menu' : ''}. Ordinary text cancels this menu.`,
            poll: { name: safeLabel(title), values: frozen.map(option => option.label), selectableCount: 1 as const, messageSecret: menu.secret } };
    }
    activate(id: string, messageId: string, poll = false): boolean {
        this.prune(); const menu = [...this.menus.values()].find(item => item.id === id);
        if (!menu || !messageId || messageId.length > 128) return false;
        if (poll) menu.pollId = messageId; else menu.textId = messageId;
        return true;
    }
    select(input: CommandMenuInput): { handled: boolean; value?: T; current?: () => boolean } {
        this.prune(); const key = this.canonical(input.chat); const menu = key ? this.menus.get(key) : undefined;
        if (!key || !menu) return { handled: false };
        const numeric = /^[1-9]\d?$/.test(input.text.trim());
        if (!this.sameActor(menu, input.actor)) return { handled: numeric && !!input.quotedId && (input.quotedId === menu.textId || input.quotedId === menu.pollId) };
        if (menu.binding.scope !== input.scope || !numeric || (key.endsWith('@g.us') && (!input.quotedId || (input.quotedId !== menu.textId && input.quotedId !== menu.pollId)))) {
            this.remove(key); return { handled: false };
        }
        if (!menu.textId) return { handled: false };
        const option = menu.options[Number(input.text.trim()) - 1];
        if (!option) return { handled: true };
        this.remove(key); return { handled: true, value: option.value, current: menu.binding.current };
    }
    selectPoll(input: CommandPollInput): { value?: T; current?: () => boolean; rejection?: 'decryption' } {
        this.prune(); const key = this.canonical(input.chat); const menu = key ? this.menus.get(key) : undefined;
        if (!key || !menu || !this.sameActor(menu, input.actor) || menu.binding.scope !== input.scope
            || !menu.pollId || menu.pollId !== input.creationKey.id || input.creationKey.fromMe !== true
            // Own-direction references can omit the implicit enclosing chat;
            // rc14 cleanMessage only fills it for votes from another account.
            || (input.creationKey.remoteJid && this.canonical(input.creationKey.remoteJid) !== key)
            || this.canonical(input.voterKey.remoteJid ?? '') !== key
            || !input.vote.encPayload || input.vote.encPayload.byteLength > 2048 || input.vote.encIv?.byteLength !== 12) return {};
        try {
            const actor = this.canonical(input.actor); const self = this.canonical(input.selfJid);
            if (!actor || !self || this.canonical(getKeyAuthor(input.voterKey, input.selfJid)) !== actor) return {};
            const protocolIds = (values: Array<string | null | undefined>) => [...new Set(values.filter(Boolean)
                .map(value => jidNormalizedUser(value!)).filter(value => /^\d+@(s\.whatsapp\.net|lid)$/.test(value)))];
            const ownLid = input.selfLid?.endsWith('@lid') ? jidNormalizedUser(input.selfLid) : undefined;
            // Authorization stays canonical. HKDF/AAD must use the sender's raw
            // protocol namespace instead: normalizing LID to PN breaks GCM.
            const creators = protocolIds([input.selfJid, ownLid, input.creationKey.participant, input.creationKey.participantAlt,
                input.voterKey.remoteJid, input.voterKey.remoteJidAlt, input.voterKey.participant, input.voterKey.participantAlt])
                .filter(jid => jid === ownLid || this.canonical(jid) === self).slice(0, 2);
            const voters = input.voterKey.fromMe === true ? creators : protocolIds(input.chat.endsWith('@g.us')
                ? [input.voterKey.participant, input.voterKey.participantAlt] : [input.voterKey.remoteJid, input.voterKey.remoteJidAlt])
                .filter(jid => this.canonical(jid) === actor).slice(0, 2);
            let vote: ReturnType<typeof decryptPollVote> | undefined;
            for (const creator of creators) {
                for (const voter of voters) {
                    try { vote = decryptPollVote(input.vote, { pollEncKey: menu.secret, pollMsgId: menu.pollId, pollCreatorJid: creator, voterJid: voter }); break; }
                    catch { /* At most four authenticated attempts over verified protocol aliases. */ }
                }
                if (vote) break;
            }
            if (!vote) return { rejection: 'decryption' };
            if (vote.selectedOptions?.length !== 1) return {};
            const result = getAggregateVotesInPollMessage({ message: { pollCreationMessageV3: { options: menu.options.map(option => ({ optionName: option.label })) } },
                pollUpdates: [{ pollUpdateMessageKey: input.voterKey, vote }] }, input.selfJid)
                .filter(option => option.voters.some(voter => this.canonical(voter) === actor));
            const selected = result.length === 1 ? menu.options.find(option => option.label === result[0].name) : undefined;
            if (!selected || !menu.binding.current()) return {};
            this.remove(key); return { value: selected.value, current: menu.binding.current };
        } catch { return {}; }
    }
}

export function safeLabel(value: string): string {
    return [...value].filter(character => {
        const code = character.codePointAt(0)!; return code >= 32 && (code < 127 || code > 159);
    }).join('').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 120);
}
