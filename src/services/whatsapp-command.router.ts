import { randomUUID } from 'node:crypto';
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import type { IncomingMessageEnvelope, MessageResult } from '../models/whatsapp.types.js';
import type { SessionManager } from './session.manager.js';
import { CommandMenuService, safeLabel, type CommandMenuBinding, type CommandPollInput } from './command-menu.service.js';
import { chatReplyPolicy, outputMode, setChatReplyPreferences } from './speech-settings.js';
import { resolveTtsConfig } from './tts-config.js';

type Model = NonNullable<ExtensionContext['model']>;
type Thinking = ReturnType<ExtensionAPI['getThinkingLevel']>;
type Action = { command: 'model' | 'think' | 'voice' | 'replies' | 'new' | 'off' | 'quit'; value: string; revision?: number };
interface Frame extends CommandMenuBinding { revision: number }
interface ResumeTicket { profile: string; account: string; sessionId: string; actor: string; chat: string; expires: number }
const handoffs = globalThis as typeof globalThis & { __whatsappNgControlHandoffs?: Map<string, ResumeTicket> };
const commands = new Set(['help', 'status', 'stop', 'abort', 'model', 'think', 'compact', 'new', 'voice', 'replies', 'off', 'quit']);
const DENIED = 'Owner authorization required. Choose the owner in terminal /whatsapp > Owner.';
const BUSY = 'The shared Pi session is busy. Use /stop explicitly before changing it.';
const SHARED = 'This affects the shared Pi session, not a private chat session.';

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
        if (privileged && !this.ports.owner(actor)) { await this.reply(this.binding(chat, actor, false), DENIED); return true; }
        // Another allowed group participant cannot invalidate the owner's menu
        // or an already-authorized asynchronous command by sending /help.
        if (this.ports.owner(actor)) this.invalidate(chat);
        const frame = this.binding(chat, actor, privileged);
        if (!frame.current()) return true;
        const ctx = this.ports.context(); if (!ctx) return true;
        try {
            if (text.length > 2048) { await this.reply(frame, 'Command is too long.'); return true; }
            if (command === 'help') {
                await this.reply(frame, `/help /status /stop (/abort) /model [provider/model] /think [level] /compact [focus] /new /voice [text|voice|both|mirror] /replies /off /quit\n${SHARED}\nState-changing commands are owner-only. Menu choices expire after five minutes.\nCurrent chat mode: ${chatReplyPolicy(this.ports.session.getSpeechSettings(), chat, this.ports.canonical).mode}.`);
            } else if (command === 'status') {
                const usage = ctx.getContextUsage(); const speech = this.ports.session.getSpeechSettings();
                await this.reply(frame, `WhatsApp: ${this.ports.session.getStatus()}\nPi: ${this.idle(ctx) ? 'idle' : 'busy'}\nModel: ${ctx.model ? modelLabel(ctx.model) : 'unavailable'}\nThinking: ${this.ports.pi.getThinkingLevel()}\nContext: ${usage?.percent == null ? 'unknown' : `${Math.round(usage.percent)}%`}\nReplies: ${this.ports.session.getFinalAfterAttachments() ? 'explain after attachments' : 'caption/tool only'}\nAutomatic replies: ${chatReplyPolicy(speech, chat, this.ports.canonical).automaticReplies ? 'Enabled' : 'Paused'}\nVoice: ${chatReplyPolicy(speech, chat, this.ports.canonical).mode}\nFinal stats: ${this.ports.session.getReplyStats() ? 'On' : 'Off'}\n${SHARED}`);
            } else if (command === 'stop' || command === 'abort') {
                if (argument) await this.reply(frame, 'Usage: /stop (or /abort)');
                else { await this.ports.stop(ctx); await this.reply(frame, 'Shared Pi run and owned speech stopped.'); }
            } else if (command === 'compact') {
                if (!this.idle(ctx)) await this.reply(frame, BUSY);
                else {
                    const release = this.lock();
                    try {
                        if (!frame.current()) { release(); return true; }
                        ctx.compact({ customInstructions: argument.slice(0, 512) || undefined,
                            onComplete: () => { release(); void this.reply(frame, 'Shared Pi session compacted.').catch(() => this.ports.notify('Compaction reply failed.')); },
                            onError: () => { release(); void this.reply(frame, 'Shared Pi compaction failed; the session remains available.').catch(() => this.ports.notify('Compaction reply failed.')); } });
                        await this.reply(frame, 'Shared Pi compaction requested.');
                    } catch { release(); throw new Error('Compaction failed'); }
                }
            } else if (command === 'model') await this.models(frame, argument);
            else if (command === 'think') {
                if (argument) await this.apply({ command, value: argument.toLowerCase() }, frame);
                else if (ctx.model) {
                    const model = `${ctx.model.provider}/${ctx.model.id}`;
                    await this.menu({ ...frame, current: () => frame.current() && `${this.ports.context()?.model?.provider}/${this.ports.context()?.model?.id}` === model },
                        `Thinking — ${SHARED}`, supportedThinking(ctx.model).map(value => ({ label: value, value: { command: 'think', value } })));
                } else await this.reply(frame, 'No current model.');
            } else if (command === 'voice') {
                if (argument) await this.apply({ command, value: argument.toLowerCase() }, frame);
                else await this.menu(frame, 'Voice for this chat', ['text', 'voice', 'both', 'mirror'].map(value => ({ label: value, value: { command: 'voice', value } })));
            } else if (command === 'replies') {
                if (argument) await this.reply(frame, 'Usage: /replies');
                else {
                    const revision = this.ports.session.getReplyStatsRevision();
                    let flags = { changedFiles: false, interimText: false, liveActivity: false }; let invalid = false;
                    try { flags = this.ports.session.getReplyReporting(); } catch { invalid = true; }
                    const reportingRevision = this.ports.session.getReplyReportingRevision();
                    const reporting = ([['changedFiles', 'Observed file paths'], ['interimText', 'Interim assistant text'], ['liveActivity', 'Live tool activity']] as const).map(([key, label]) => ({
                        label: `${flags[key] ? 'Disable' : 'Enable'} ${label.toLowerCase()}`, value: { command: 'replies' as const, value: `report:${key}:${flags[key] ? 'off' : 'on'}`, revision: reportingRevision } }));
                    await this.menu(frame, `Shared replies — final stats ${this.ports.session.getReplyStats() ? 'On' : 'Off'}; files ${flags.changedFiles ? 'On' : 'Off'}, interim ${flags.interimText ? 'On' : 'Off'}, activity ${flags.liveActivity ? 'On' : 'Off'}. Enabling shares workspace-relative paths/intermediate assistant text or tool names with allowed chats; never thinking/tool bodies.${invalid ? ' Saved optional settings are invalid; selecting a reporting option replaces them.' : ''}`, [
                        { label: 'Explain after attachments', value: { command: 'replies', value: 'explain' } },
                        { label: 'Caption/tool only', value: { command: 'replies', value: 'caption' } },
                        { label: 'Enable final stats for allowed chats', value: { command: 'replies', value: 'stats:on', revision } },
                        { label: 'Disable final stats', value: { command: 'replies', value: 'stats:off', revision } }, ...reporting]);
                }
            } else if (!argument && (command === 'new' || command === 'off' || command === 'quit')) {
                await this.menu(frame, command === 'new' ? `Start a fresh shared Pi session? Login/settings/history stay. ${SHARED}`
                    : command === 'off' ? 'Stop WhatsApp and disable outbound tools? Turning it on requires the terminal.'
                        : 'Shut down this Pi process? WhatsApp credentials will be retained.', [
                    { label: 'Cancel', value: { command, value: 'cancel' } }, { label: 'Confirm', value: { command, value: 'confirm' } }]);
            } else await this.reply(frame, `Usage: /${command}`);
        } catch { await this.reply(frame, 'Phone command failed; no automatic retry. Check terminal settings/status.'); }
        return true;
    }

    private async menu(frame: Frame, title: string, options: Array<{ label: string; value: Action }>): Promise<void> {
        if (!frame.current()) return;
        const menu = this.menus.create(frame, title, options);
        const sent = await this.ports.send(frame.chat, menu.text, frame.current);
        if (!frame.current() || (!sent.success && sent.delivery !== 'unknown') || !sent.messageId) { this.menus.discard(menu.id); return; }
        if (!this.menus.activate(menu.id, sent.messageId)) return;
        // Never add another message after an uncertain first send.
        if (sent.success && this.ports.poll) {
            const poll = await this.ports.poll(frame.chat, menu.poll, frame.current);
            if ((poll.success || poll.delivery === 'unknown') && poll.messageId) this.menus.activate(menu.id, poll.messageId, true);
        }
    }
    private async models(frame: Frame, argument: string, page = 0): Promise<void> {
        const ctx = this.ports.context(); if (!ctx) return;
        if (argument) { await this.apply({ command: 'model', value: argument }, frame); return; }
        const models = await ctx.modelRegistry.getAvailable(); if (!frame.current()) return;
        const choices = [...models].sort((a, b) => `${a.provider}/${a.id}`.localeCompare(`${b.provider}/${b.id}`));
        if (!choices.length) { await this.reply(frame, 'No authenticated models available. Configure provider login in the terminal.'); return; }
        const options: Array<{ label: string; value: Action }> = choices.slice(page * 10, page * 10 + 10)
            .map(model => ({ label: modelLabel(model), value: { command: 'model', value: `${model.provider}/${model.id}` } }));
        if (page > 0) options.push({ label: 'Previous page', value: { command: 'model', value: `page:${page - 1}` } });
        if ((page + 1) * 10 < choices.length) options.push({ label: 'Next page', value: { command: 'model', value: `page:${page + 1}` } });
        await this.menu(frame, `Authenticated models, page ${page + 1}. ${SHARED}`, options);
    }
    private async apply(action: Action, frame: Frame): Promise<void> {
        const ctx = this.ports.context(); if (!ctx || !frame.current()) return;
        if (action.value === 'cancel') { await this.reply(frame, 'Cancelled.'); return; }
        if (action.command === 'model' && /^page:\d+$/.test(action.value)) { await this.models(frame, '', Number(action.value.slice(5))); return; }
        if (!['off', 'quit'].includes(action.command) && !this.idle(ctx)) { await this.reply(frame, BUSY); return; }
        const release = this.lock();
        try {
            if (action.command === 'model') {
                const choices = await ctx.modelRegistry.getAvailable();
                const model = choices.find(choice => `${choice.provider}/${choice.id}` === action.value);
                if (!frame.current()) return;
                if (!ctx.isIdle() || ctx.hasPendingMessages()) { await this.reply(frame, BUSY); return; }
                if (!model) await this.reply(frame, 'Exact authenticated model unavailable. Nothing changed.');
                else if (await this.ports.pi.setModel(model)) await this.reply(frame, `Shared model selected: ${modelLabel(model)}.`);
                else await this.reply(frame, 'Model authentication unavailable. Nothing changed.');
            } else if (action.command === 'think') {
                if (!ctx.model || !supportedThinking(ctx.model).includes(action.value as Thinking)) await this.reply(frame, 'Unsupported thinking level. Nothing changed. Use /think.');
                else if (frame.current()) { this.ports.pi.setThinkingLevel(action.value as Thinking); await this.reply(frame, `Shared thinking level: ${action.value}.`); }
            } else if (action.command === 'voice') {
                if (!outputMode(action.value)) { await this.reply(frame, 'Usage: /voice text|voice|both|mirror'); return; }
                const revision = this.ports.session.getSpeechRevision(); const settings = this.ports.session.getSpeechSettings();
                const policy = chatReplyPolicy(settings, frame.chat, this.ports.canonical);
                if (action.value !== 'text' && (!settings.enabled || settings.approvedDestinationKey !== resolveTtsConfig(settings.config).destinationKey
                    || (frame.chat.endsWith('@g.us') && !policy.groupOptIn))) { await this.reply(frame, 'Approve this speech destination and any group opt-in in terminal /whatsapp > Voice first. No speech was enabled.'); return; }
                await this.ports.session.setSpeechSettings(setChatReplyPreferences(settings, frame.chat, { mode: action.value }, this.ports.canonical), revision, frame.current);
                await this.reply(frame, `This chat's reply mode: ${action.value}.`);
            } else if (action.command === 'replies') {
                const report = /^report:(changedFiles|interimText|liveActivity):(on|off)$/.exec(action.value);
                if (report && action.revision !== undefined) {
                    let settings = { changedFiles: false, interimText: false, liveActivity: false };
                    try { settings = this.ports.session.getReplyReporting(); } catch { /* Only an explicit reporting selection replaces malformed fields. */ }
                    await this.ports.session.setReplyReporting({ ...settings, [report[1]]: report[2] === 'on' }, action.revision, frame.current);
                    await this.reply(frame, `Optional reply reporting ${report[2] === 'on' ? 'enabled' : 'disabled'} for future owned WhatsApp inputs; prior reporting work is withdrawn. ${SHARED}`);
                } else if (action.value === 'stats:on' || action.value === 'stats:off') {
                    await this.ports.session.setReplyStats(action.value === 'stats:on', () => frame.current()
                        && action.revision !== undefined && action.revision === this.ports.session.getReplyStatsRevision());
                    await this.reply(frame, `Shared final stats ${action.value === 'stats:on' ? 'enabled' : 'disabled'} for future WhatsApp replies; pending stats are withdrawn.`);
                } else if (action.value === 'explain' || action.value === 'caption') {
                    await this.ports.session.setFinalAfterAttachments(action.value === 'explain', frame.current);
                    await this.reply(frame, `Shared attachment policy: ${action.value === 'explain' ? 'explain after attachments' : 'caption/tool only'}.`);
                }

            } else if (action.command === 'new') {
                const token = randomUUID(); this.newTickets.clear(); this.newTickets.set(token, { frame, expires: Date.now() + 15_000 });
                this.ports.pi.sendUserMessage(`/whatsapp --internal control-new ${token}`, { expandPromptTemplates: true, deliverAs: 'followUp' });
            } else if (action.command === 'off') {
                await this.reply(frame, 'WhatsApp is turning off. Use the terminal to turn it on again; login/history are retained.');
                if (frame.current()) await this.ports.off(ctx);
            } else if (action.command === 'quit') {
                await this.reply(frame, 'Pi shutdown requested. WhatsApp credentials are retained.');
                if (frame.current()) ctx.shutdown();
            }
        } catch { await this.reply(frame, 'Phone command failed; no automatic retry. Check terminal settings/status.'); }
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
        if (await this.ports.resume(current, ticket.account) && current()) await this.ports.send(ticket.chat, 'A fresh shared Pi session is ready. Login, settings and history were retained.', current);
        else ctx.ui.notify('New Pi session created; reconnect WhatsApp from the terminal.', 'warning');
    }
}

function modelLabel(model: Model): string {
    const privatePath = (value: string) => /^(?:[\\/]|\.{1,2}[\\/]|~[^\\/]*[\\/]|[a-z]:|file:)|(?:^|[\\/])(?:Users|home|private|tmp)[\\/]/i.test(value.trim());
    return privatePath(model.provider) || privatePath(model.id) ? 'Configured model (private identifier hidden)' : safeLabel(`${model.provider}/${model.id}`);
}

/** Mirrors the public model capability map; never request a level Pi would silently clamp. */
export function supportedThinking(model: Model): Thinking[] {
    const levels: Thinking[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    return model.reasoning ? levels.filter(level => model.thinkingLevelMap?.[level] !== null
        && (!['xhigh', 'max'].includes(level) || model.thinkingLevelMap?.[level] !== undefined)) : ['off'];
}
