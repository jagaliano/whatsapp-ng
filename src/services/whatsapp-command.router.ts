import { randomUUID } from 'node:crypto';
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { fuzzyFilter } from '@mariozechner/pi-tui';
import type { IncomingMessageEnvelope, MessageResult } from '../models/whatsapp.types.js';
import type { SessionManager } from './session.manager.js';
import { CommandMenuService, safeLabel, type CommandMenuBinding, type CommandPollInput } from './command-menu.service.js';
import { chatReplyPolicy, outputMode, setChatReplyPreferences } from './speech-settings.js';
import { resolveTtsConfig } from './tts-config.js';
import { t } from '../i18n.js';

type Model = NonNullable<ExtensionContext['model']>;
type Thinking = ReturnType<ExtensionAPI['getThinkingLevel']>;
type Action = { command: 'model' | 'think' | 'voice' | 'replies' | 'new' | 'off' | 'quit'; value: string; revision?: number; query?: string };
interface Frame extends CommandMenuBinding { revision: number }
interface ResumeTicket { profile: string; account: string; sessionId: string; actor: string; chat: string; expires: number }
const handoffs = globalThis as typeof globalThis & { __whatsappNgControlHandoffs?: Map<string, ResumeTicket> };
const commands = new Set(['help', 'status', 'stop', 'abort', 'model', 'think', 'compact', 'new', 'voice', 'replies', 'off', 'quit']);

export interface PhoneControlPorts {
    pi: Pick<ExtensionAPI, 'getThinkingLevel' | 'setThinkingLevel' | 'setModel' | 'sendUserMessage'>;
    session: SessionManager;
    context: () => ExtensionContext | undefined;
    scope: () => string;
    account: () => string;
    allowed: (chat: string) => boolean;
    canonical: (jid: string) => string | undefined;
    actor: (key: IncomingMessageEnvelope['key']) => string | undefined;
    owner: (actor: string | undefined) => boolean;
    send: (chat: string, text: string, current: () => boolean) => Promise<MessageResult>;
    poll?: (chat: string, content: ReturnType<CommandMenuService<Action>['create']>['poll'], current: () => boolean) => Promise<MessageResult>;
    stop: (ctx: ExtensionContext) => Promise<void>;
    off: (ctx: ExtensionContext) => Promise<void>;
    resume: (current: () => boolean, account: string) => Promise<boolean>;
    notify: (text: string) => void;
}

/** Exact phone control, never shell dispatch or a model-generated authorization decision. */
export class WhatsAppCommandRouter {
    private readonly menus: CommandMenuService<Action>;
    private readonly sequences = new Map<string, number>();
    private epoch = 0;
    private mutation?: symbol;
    private readonly newTickets = new Map<string, { frame: Frame; expires: number }>();
    constructor(private readonly ports: PhoneControlPorts) { this.menus = new CommandMenuService(ports.canonical); }
    reset(): void { this.epoch++; this.mutation = undefined; this.sequences.clear(); this.newTickets.clear(); this.menus.reset(); }
    private lock(): () => void {
        const token = Symbol(); this.mutation = token;
        return () => { if (this.mutation === token) this.mutation = undefined; };
    }
    private binding(chat: string, actor: string, privileged: boolean): Frame {
        const scope = this.ports.scope(); const epoch = this.epoch;
        const revision = this.ports.session.getOperatorRevision(); const key = this.ports.canonical(chat);
        const sequence = key ? this.sequences.get(key) : undefined;
        return { chat, actor, scope, revision, current: () => epoch === this.epoch && scope === this.ports.scope()
            && !!key && sequence === this.sequences.get(key) && this.ports.allowed(chat)
            && (!privileged || (revision === this.ports.session.getOperatorRevision() && this.ports.owner(actor))) };
    }
    private invalidate(chat: string): void {
        const key = this.ports.canonical(chat); if (!key) return;
        if (this.sequences.size >= 50 && !this.sequences.has(key)) this.reset();
        this.sequences.set(key, (this.sequences.get(key) ?? 0) + 1); this.menus.cancel(chat);
    }
    private async reply(frame: CommandMenuBinding, text: string): Promise<void> {
        if (!frame.current()) return;
        const result = await this.ports.send(frame.chat, text, frame.current);
        if (!result.success) this.ports.notify(result.delivery === 'unknown' ? 'Control reply delivery is uncertain; it will not be repeated.' : 'Control reply failed.');
    }
    private idle(ctx: ExtensionContext): boolean { return ctx.isIdle() && !ctx.hasPendingMessages() && !this.mutation; }

    async handle(message: IncomingMessageEnvelope, text: string, quotedId?: string): Promise<boolean> {
        const chat = message.key.remoteJid; const actor = this.ports.actor(message.key);
        const match = /^\s*\/(\S+)(?:\s+([\s\S]*))?$/.exec(text);
        const command = match?.[1].toLowerCase(); const argument = match?.[2]?.trim() ?? '';
        if (!this.ports.allowed(chat) || !actor) return !!command && commands.has(command);
        if (!command || !commands.has(command)) {
            const selection = this.menus.select({ chat, actor, scope: this.ports.scope(), text, quotedId });
            if (selection.value && selection.current?.() && this.ports.owner(actor)) {
                await this.apply(selection.value, { ...this.binding(chat, actor, true), current: selection.current });
            }
            return selection.handled;
        }
        const privileged = command !== 'help' && command !== 'status';
        if (privileged && !this.ports.owner(actor)) { await this.reply(this.binding(chat, actor, false), t('phone.denied', { chatsOwner: t('menu.category.chatsOwner'), owner: t('voice.owner') })); return true; }
        // Another allowed group participant cannot invalidate the owner's menu
        // or an already-authorized asynchronous command by sending /help.
        if (this.ports.owner(actor)) this.invalidate(chat);
        const frame = this.binding(chat, actor, privileged);
        if (!frame.current()) return true;
        const ctx = this.ports.context(); if (!ctx) return true;
        try {
            if (text.length > 2048) { await this.reply(frame, t('phone.tooLong')); return true; }
            if (command === 'help') {
                await this.reply(frame, this.helpText(chat));
            } else if (command === 'status') {
                const usage = ctx.getContextUsage(); const speech = this.ports.session.getSpeechSettings();
                const policy = chatReplyPolicy(speech, chat, this.ports.canonical);
                await this.reply(frame, [
                    t('phone.status.shared'),
                    t('phone.status.whatsapp', { value: t(`menu.status.${this.ports.session.getStatus()}`) }),
                    t('phone.status.pi', { value: t(this.idle(ctx) ? 'phone.status.idle' : 'phone.status.busy') }),
                    t('phone.status.model', { value: ctx.model ? modelLabel(ctx.model) : t('phone.status.unavailable') }),
                    t('phone.status.thinking', { value: t(`phone.level.${this.ports.pi.getThinkingLevel()}`) }),
                    t('phone.status.context', { value: usage?.percent == null ? t('phone.status.unknown') : `${Math.round(usage.percent)}%` }),
                    t('phone.status.replyDelivery', { value: t(this.ports.session.getFinalAfterAttachments() ? 'phone.status.explainAfter' : 'phone.status.captionOnly') }),
                    t('phone.status.finalStats', { value: t(this.ports.session.getReplyStats() ? 'phone.status.on' : 'phone.status.off') }),
                    t('phone.shared'), '', t('phone.status.chat'),
                    t('phone.status.automaticReplies', { value: t(policy.automaticReplies ? 'phone.status.enabled' : 'phone.status.paused') }),
                    t('phone.status.voice', { value: t(`phone.mode.${policy.mode}`) })
                ].join('\n'));
            } else if (command === 'stop' || command === 'abort') {
                if (argument) await this.reply(frame, t('phone.usage', { command: '/stop (or /abort)' }));
                else { await this.ports.stop(ctx); await this.reply(frame, t('phone.stopped')); }
            } else if (command === 'compact') {
                if (!this.idle(ctx)) await this.reply(frame, t('phone.busy'));
                else {
                    const release = this.lock();
                    try {
                        if (!frame.current()) { release(); return true; }
                        ctx.compact({ customInstructions: argument.slice(0, 512) || undefined,
                            onComplete: () => { release(); void this.reply(frame, t('phone.compact.done')).catch(() => this.ports.notify('Compaction reply failed.')); },
                            onError: () => { release(); void this.reply(frame, t('phone.compact.failed')).catch(() => this.ports.notify('Compaction reply failed.')); } });
                        await this.reply(frame, t('phone.compact.requested'));
                    } catch { release(); throw new Error('Compaction failed'); }
                }
            } else if (command === 'model') await this.models(frame, argument);
            else if (command === 'think') {
                if (argument) await this.apply({ command, value: argument.toLowerCase() }, frame);
                else if (ctx.model) {
                    const model = `${ctx.model.provider}/${ctx.model.id}`;
                    await this.menu({ ...frame, current: () => frame.current() && `${this.ports.context()?.model?.provider}/${this.ports.context()?.model?.id}` === model },
                        t('phone.think.title'), supportedThinking(ctx.model).map(value => ({ label: this.mark(t(`phone.level.${value}`), value === this.ports.pi.getThinkingLevel()), value: { command: 'think', value } })), t('phone.shared'));
                } else await this.reply(frame, t('phone.model.noCurrent'));
            } else if (command === 'voice') {
                if (argument) await this.apply({ command, value: argument.toLowerCase() }, frame);
                else {
                    let mode: ReturnType<typeof chatReplyPolicy>['mode'] | undefined;
                    try { mode = chatReplyPolicy(this.ports.session.getSpeechSettings(), chat, this.ports.canonical).mode; }
                    catch { /* Unreadable preferences hide the marker, not the existing menu or action guards. */ }
                    await this.menu(frame, t('phone.voice.title'), (['text', 'voice', 'both', 'mirror'] as const).map(value => ({ label: this.mark(t(`phone.mode.${value}`), value === mode), value: { command: 'voice', value } })));
                }
            } else if (command === 'replies') {
                if (argument) await this.reply(frame, t('phone.usage', { command: '/replies' }));
                else {
                    const revision = this.ports.session.getReplyStatsRevision();
                    let flags = { changedFiles: false, interimText: false, liveActivity: false }; let invalid = false;
                    try { flags = this.ports.session.getReplyReporting(); } catch { invalid = true; }
                    const reportingRevision = this.ports.session.getReplyReportingRevision();
                    const reporting = ([['changedFiles', 'files'], ['interimText', 'interim'], ['liveActivity', 'activity']] as const).map(([key, label]) => ({
                        label: t(`phone.replies.${label}.${flags[key] ? 'off' : 'on'}`), value: { command: 'replies' as const, value: `report:${key}:${flags[key] ? 'off' : 'on'}`, revision: reportingRevision } }));
                    const stats = t(this.ports.session.getReplyStats() ? 'phone.status.on' : 'phone.status.off');
                    const disclosure = t('phone.replies.disclosure', { stats,
                        files: t(flags.changedFiles ? 'phone.status.on' : 'phone.status.off'),
                        interim: t(flags.interimText ? 'phone.status.on' : 'phone.status.off'),
                        activity: t(flags.liveActivity ? 'phone.status.on' : 'phone.status.off')
                    }) + (invalid ? ` ${t('phone.replies.invalid')}` : '');
                    await this.menu(frame, t('phone.replies.title', { stats }), [
                        { label: this.mark(t('phone.replies.explain'), this.ports.session.getFinalAfterAttachments()), value: { command: 'replies', value: 'explain' } },
                        { label: this.mark(t('phone.replies.caption'), !this.ports.session.getFinalAfterAttachments()), value: { command: 'replies', value: 'caption' } },
                        { label: this.mark(t('phone.replies.statsOn'), this.ports.session.getReplyStats()), value: { command: 'replies', value: 'stats:on', revision } },
                        { label: this.mark(t('phone.replies.statsOff'), !this.ports.session.getReplyStats()), value: { command: 'replies', value: 'stats:off', revision } }, ...reporting], disclosure);
                }
            } else if (!argument && (command === 'new' || command === 'off' || command === 'quit')) {
                await this.menu(frame, t(`phone.${command}.title`), [
                    { label: t('phone.cancel'), value: { command, value: 'cancel' } }, { label: t('phone.confirm'), value: { command, value: 'confirm' } }], t(`phone.${command}.body`, { shared: t('phone.shared') }));
            } else await this.reply(frame, t('phone.usage', { command: `/${command}` }));
        } catch { await this.reply(frame, t('phone.failed')); }
        return true;
    }

    private mark(label: string, current: boolean): string {
        const suffix = current ? ` ${t('phone.current')}` : '';
        return label + suffix;
    }

    private helpText(chat: string): string {
        return [
            t('phone.help.title'), '',
            t('phone.help.info'), t('phone.help.cmd.help'), t('phone.help.cmd.status'), '',
            t('phone.help.shared'), t('phone.help.cmd.stop'), t('phone.help.cmd.model'), t('phone.help.cmd.think'),
            t('phone.help.cmd.compact'), t('phone.help.cmd.new'), t('phone.help.cmd.replies'), '',
            t('phone.help.chat'), t('phone.help.cmd.voice'), '',
            t('phone.help.process'), t('phone.help.cmd.off'), t('phone.help.cmd.quit'), '',
            t('phone.shared'), t('phone.help.ownerOnly'), t('phone.help.expiry'),
            t('phone.help.mode', { mode: t(`phone.mode.${chatReplyPolicy(this.ports.session.getSpeechSettings(), chat, this.ports.canonical).mode}`) })
        ].join('\n');
    }

    private async menu(frame: Frame, title: string, options: Array<{ label: string; value: Action }>, body?: string): Promise<void> {
        if (!frame.current()) return;
        const menu = this.menus.create(frame, title, options, body);
        const sent = await this.ports.send(frame.chat, menu.text, frame.current);
        if (!frame.current() || (!sent.success && sent.delivery !== 'unknown') || !sent.messageId) { this.menus.discard(menu.id); return; }
        if (!this.menus.activate(menu.id, sent.messageId)) return;
        // Never add another message after an uncertain first send.
        if (sent.success && this.ports.poll) {
            const poll = await this.ports.poll(frame.chat, menu.poll, frame.current);
            if ((poll.success || poll.delivery === 'unknown') && poll.messageId) this.menus.activate(menu.id, poll.messageId, true);
        }
    }
    private async models(frame: Frame, argument: string, page?: number): Promise<void> {
        const ctx = this.ports.context(); if (!ctx) return;
        const models = await ctx.modelRegistry.getAvailable(); if (!frame.current()) return;
        // Only a typed exact identifier selects directly; navigation always stays a menu.
        if (argument && page === undefined && models.some(model => `${model.provider}/${model.id}` === argument)) {
            await this.apply({ command: 'model', value: argument }, frame); return;
        }
        if (!models.length) { await this.reply(frame, t('phone.model.noAvailable')); return; }
        const ordered = [...models].sort((a, b) => `${a.provider}/${a.id}`.localeCompare(`${b.provider}/${b.id}`));
        // Private identifiers stay browsable, but neither their paths nor placeholders are search terms.
        const choices = argument ? fuzzyFilter(ordered, argument, model => publicModelIdentifier(model) ?? '') : ordered;
        if (!choices.length) { await this.reply(frame, t('phone.model.noMatches')); return; }
        const currentPage = Math.min(page ?? 0, Math.floor((choices.length - 1) / 10));
        const options: Array<{ label: string; value: Action }> = choices.slice(currentPage * 10, currentPage * 10 + 10)
            .map(model => {
                const current = model.provider === ctx.model?.provider && model.id === ctx.model?.id;
                const reserve = current ? t('phone.current').length + 1 : 0;
                return { label: this.mark(modelLabel(model).slice(0, 120 - reserve), current), value: { command: 'model', value: `${model.provider}/${model.id}` } };
            });
        if (currentPage > 0) options.push({ label: t('phone.model.previous'), value: { command: 'model', value: `page:${currentPage - 1}`, query: argument } });
        if ((currentPage + 1) * 10 < choices.length) options.push({ label: t('phone.model.next'), value: { command: 'model', value: `page:${currentPage + 1}`, query: argument } });
        await this.menu(frame, t(argument ? 'phone.model.titleMatches' : 'phone.model.title', { page: currentPage + 1 }), options, t('phone.shared'));
    }
    private async apply(action: Action, frame: Frame): Promise<void> {
        const ctx = this.ports.context(); if (!ctx || !frame.current()) return;
        if (action.value === 'cancel') { await this.reply(frame, t('phone.cancelled')); return; }
        if (action.command === 'model' && /^page:\d+$/.test(action.value)) { await this.models(frame, action.query ?? '', Number(action.value.slice(5))); return; }
        if (!['off', 'quit'].includes(action.command) && !this.idle(ctx)) { await this.reply(frame, t('phone.busy')); return; }
        const release = this.lock();
        try {
            if (action.command === 'model') {
                const choices = await ctx.modelRegistry.getAvailable();
                const model = choices.find(choice => `${choice.provider}/${choice.id}` === action.value);
                if (!frame.current()) return;
                if (!ctx.isIdle() || ctx.hasPendingMessages()) { await this.reply(frame, t('phone.busy')); return; }
                if (!model) await this.reply(frame, t('phone.model.unavailable'));
                else if (await this.ports.pi.setModel(model)) await this.reply(frame, t('phone.model.selected', { model: modelLabel(model) }));
                else await this.reply(frame, t('phone.model.noAuth'));
            } else if (action.command === 'think') {
                if (!ctx.model || !supportedThinking(ctx.model).includes(action.value as Thinking)) await this.reply(frame, t('phone.think.unsupported'));
                else if (frame.current()) { this.ports.pi.setThinkingLevel(action.value as Thinking); await this.reply(frame, t('phone.think.saved', { level: t(`phone.level.${action.value as Thinking}`) })); }
            } else if (action.command === 'voice') {
                if (!outputMode(action.value)) { await this.reply(frame, t('phone.usage', { command: '/voice text|voice|both|mirror' })); return; }
                const revision = this.ports.session.getSpeechRevision(); const settings = this.ports.session.getSpeechSettings();
                const policy = chatReplyPolicy(settings, frame.chat, this.ports.canonical);
                const missing = [
                    ...(!settings.enabled ? [t('phone.voice.disabled')] : []),
                    ...(settings.approvedDestinationKey !== resolveTtsConfig(settings.config).destinationKey ? [t('phone.voice.unapproved')] : []),
                    ...(frame.chat.endsWith('@g.us') && !policy.groupOptIn ? [t('phone.voice.groupMissing')] : [])
                ];
                if (action.value !== 'text' && missing.length) {
                    await this.reply(frame, t('phone.voice.setup', { missing: missing.join('; '), voice: t('voice.menu'), setup: t('voice.setupChat') }));
                    return;
                }
                await this.ports.session.setSpeechSettings(setChatReplyPreferences(settings, frame.chat, { mode: action.value }, this.ports.canonical), revision, frame.current);
                await this.reply(frame, t('phone.voice.saved', { mode: t(`phone.mode.${action.value}`) }));
            } else if (action.command === 'replies') {
                const report = /^report:(changedFiles|interimText|liveActivity):(on|off)$/.exec(action.value);
                if (report && action.revision !== undefined) {
                    let settings = { changedFiles: false, interimText: false, liveActivity: false };
                    try { settings = this.ports.session.getReplyReporting(); } catch { /* Only an explicit reporting selection replaces malformed fields. */ }
                    await this.ports.session.setReplyReporting({ ...settings, [report[1]]: report[2] === 'on' }, action.revision, frame.current);
                    await this.reply(frame, t('phone.reporting.saved', { state: t(report[2] === 'on' ? 'phone.enabled' : 'phone.disabled'), shared: t('phone.shared') }));
                } else if (action.value === 'stats:on' || action.value === 'stats:off') {
                    await this.ports.session.setReplyStats(action.value === 'stats:on', () => frame.current()
                        && action.revision !== undefined && action.revision === this.ports.session.getReplyStatsRevision());
                    await this.reply(frame, t('phone.stats.saved', { state: t(action.value === 'stats:on' ? 'phone.stats.enabled' : 'phone.stats.disabled') }));
                } else if (action.value === 'explain' || action.value === 'caption') {
                    await this.ports.session.setFinalAfterAttachments(action.value === 'explain', frame.current);
                    await this.reply(frame, t('phone.attachment.saved', { policy: t(action.value === 'explain' ? 'phone.status.explainAfter' : 'phone.status.captionOnly') }));
                }

            } else if (action.command === 'new') {
                const token = randomUUID(); this.newTickets.clear(); this.newTickets.set(token, { frame, expires: Date.now() + 15_000 });
                this.ports.pi.sendUserMessage(`/whatsapp --internal control-new ${token}`, { expandPromptTemplates: true, deliverAs: 'followUp' });
            } else if (action.command === 'off') {
                await this.reply(frame, t('phone.off.done'));
                if (frame.current()) await this.ports.off(ctx);
            } else if (action.command === 'quit') {
                await this.reply(frame, t('phone.quit.done'));
                if (frame.current()) ctx.shutdown();
            }
        } catch { await this.reply(frame, t('phone.failed')); }
        finally { release(); }
    }

    async handlePoll(input: CommandPollInput): Promise<void> {
        if (!this.ports.allowed(input.chat) || !this.ports.owner(input.actor)) return;
        const selected = this.menus.selectPoll(input);
        if (selected.rejection) this.ports.notify('Native poll vote could not be decrypted; use the numbered menu. No action was applied.');
        if (selected.value && selected.current?.()) await this.apply(selected.value, { ...this.binding(input.chat, input.actor, true), current: selected.current });
    }

    /** Native command context only. Tokens are in-memory, one-use, scoped and never supplied by a phone payload. */
    async gateway(args: string, ctx: ExtensionCommandContext): Promise<void> {
        const match = /^--internal control-(new|resume) ([a-f0-9-]{36})$/.exec(args);
        if (!match) { ctx.ui.notify('Internal phone control cannot be invoked manually.', 'warning'); return; }
        const token = match[2];
        if (match[1] === 'new') {
            const ticket = this.newTickets.get(token); this.newTickets.delete(token);
            const frame = ticket?.frame;
            if (!ticket || ticket.expires <= Date.now() || !frame?.current() || !ctx.isIdle() || ctx.hasPendingMessages()) { ctx.ui.notify('Phone session request expired or Pi is busy.', 'warning'); return; }
            const profile = this.ports.session.getAuthStateDir(); const account = this.ports.account();
            const result = await ctx.newSession({ withSession: async replacement => {
                const resume = randomUUID();
                const tickets = handoffs.__whatsappNgControlHandoffs ??= new Map();
                for (const [id, ticket] of tickets) if (ticket.expires <= Date.now() || ticket.profile === profile) tickets.delete(id);
                if (tickets.size >= 10) tickets.delete(tickets.keys().next().value!);
                tickets.set(resume, { profile, account, sessionId: replacement.sessionManager.getSessionId(), actor: frame.actor, chat: frame.chat, expires: Date.now() + 30_000 });
                await replacement.sendUserMessage(`/whatsapp --internal control-resume ${resume}`, { expandPromptTemplates: true, deliverAs: 'followUp' });
            } });
            if (result.cancelled) ctx.ui.notify('New session cancelled; the original session remains available.', 'info');
            return;
        }
        const ticket = handoffs.__whatsappNgControlHandoffs?.get(token); handoffs.__whatsappNgControlHandoffs?.delete(token);
        if (!ticket || ticket.expires <= Date.now() || ticket.sessionId !== ctx.sessionManager.getSessionId()
            || ticket.profile !== this.ports.session.getAuthStateDir() || !this.ports.owner(ticket.actor) || !this.ports.allowed(ticket.chat)) {
            ctx.ui.notify('Phone reconnect request expired.', 'warning'); return;
        }
        const revision = this.ports.session.getOperatorRevision(); const sessionId = ctx.sessionManager.getSessionId();
        const current = () => revision === this.ports.session.getOperatorRevision() && this.ports.owner(ticket.actor)
            && this.ports.allowed(ticket.chat) && sessionId === this.ports.context()?.sessionManager.getSessionId();
        if (await this.ports.resume(current, ticket.account) && current()) await this.ports.send(ticket.chat, t('phone.new.ready'), current);
        else ctx.ui.notify('New Pi session created; reconnect WhatsApp from the terminal.', 'warning');
    }
}

function publicModelIdentifier(model: Model): string | undefined {
    const privatePath = (value: string) => /^(?:[\\/]|\.{1,2}[\\/]|~[^\\/]*[\\/]|[a-z]:|file:)|(?:^|[\\/])(?:Users|home|private|tmp)[\\/]/i.test(value.trim());
    return privatePath(model.provider) || privatePath(model.id) ? undefined : `${model.provider}/${model.id}`;
}

function modelLabel(model: Model): string {
    const identifier = publicModelIdentifier(model);
    return identifier === undefined ? t('phone.model.private') : safeLabel(identifier);
}

/** Mirrors the public model capability map; never request a level Pi would silently clamp. */
export function supportedThinking(model: Model): Thinking[] {
    const levels: Thinking[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    return model.reasoning ? levels.filter(level => model.thinkingLevelMap?.[level] !== null
        && (!['xhigh', 'max'].includes(level) || model.thinkingLevelMap?.[level] !== undefined)) : ['off'];
}
