import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { t } from '../i18n.js';

export type SettingsNavigation = 'back' | void;
export type SettingsCategory = 'Connection' | 'Chats / Owner' | 'Replies' | 'Groups' | 'Advanced';
interface SettingsState { status: string; enabled: boolean; registered: boolean; archive: boolean; optional: boolean; owner: boolean }

class SettingsClosed extends Error {}
export const isSettingsClosed = (error: unknown): boolean => error instanceof SettingsClosed;
export function expireSettingsRequest(): never { throw new SettingsClosed('Settings request expired'); }
interface SettingsRequest { current(): boolean; closed: boolean; notifyExpired(): void }
const requests = new WeakMap<ExtensionCommandContext, SettingsRequest>();

/** Scope public UI ports, not Pi itself: recursive Back cannot renew authority,
 * and cancelled nested dialogs unwind without validation errors or retries. */
export async function withSettingsRequest(ctx: ExtensionCommandContext, capture: () => () => boolean,
    run: (ctx: ExtensionCommandContext, current: () => boolean) => Promise<void>): Promise<void> {
    const retained = requests.get(ctx);
    const request = retained ?? { current: capture(), closed: false, notifyExpired: () => {
        try { ctx.ui.notify('Settings changed while this menu was open. Reopen /whatsapp.', 'info'); }
        catch { /* Pi may already have retired its lazy UI context. */ }
    } };
    const check = () => {
        if (request.closed) throw new SettingsClosed();
        if (!request.current()) {
            request.closed = true;
            request.notifyExpired();
            throw new SettingsClosed();
        }
    };
    const answer = <T>(value: T | undefined): T => {
        check();
        if (value === undefined) { request.closed = true; throw new SettingsClosed(); }
        return value;
    };
    const dialogs: Partial<ExtensionCommandContext['ui']> = {
        select: async (...args) => { check(); return answer(await ctx.ui.select(...args)); },
        input: async (...args) => { check(); return answer(await ctx.ui.input(...args)); },
        editor: async (...args) => { check(); return answer(await ctx.ui.editor(...args)); },
        // Detail overlays use the same close result for Enter and Esc; preserve
        // that local close gesture, but never accept an expired overlay result.
        custom: async (...args) => { check(); const result = await ctx.ui.custom(...args); check(); return result; },
        confirm: async (...args) => { check(); const result = await ctx.ui.confirm(...args); check(); return result; },
        notify: (...args) => { if (!request.closed) ctx.ui.notify(...args); }
    };
    // Preserve Pi's lazy context getters and resolve its active UI on every call.
    const scoped: ExtensionCommandContext = retained ? ctx : Object.create(ctx);
    if (!retained) Object.defineProperty(scoped, 'ui', { value: new Proxy({} as ExtensionCommandContext['ui'], {
        get: (_target, key) => {
            if (Object.hasOwn(dialogs, key)) return Reflect.get(dialogs, key);
            const ui = ctx.ui; const value = Reflect.get(ui, key);
            return typeof value === 'function' ? value.bind(ui) : value;
        }
    }) });
    requests.set(scoped, request);
    try { check(); await run(scoped, () => !request.closed && request.current()); }
    catch (error) {
        if (!(error instanceof SettingsClosed)) throw error;
        if (!request.closed && error.message) { request.closed = true; request.notifyExpired(); }
    }
    finally { if (!retained) requests.delete(scoped); }
}
/** Navigation only: existing menu/controller views retain all mutations and history handling. */
export async function chooseWhatsAppSetting(ctx: ExtensionCommandContext, getState: () => SettingsState, current: () => boolean, resumeCategory?: SettingsCategory): Promise<string | undefined> {
    let category: string | undefined = resumeCategory;
    const back = t('menu.root.back');
    const categories = ['Connection', 'Chats / Owner', 'Replies', 'Voice', 'Groups', 'Advanced', back];
    const choices = (state: SettingsState): Record<string, string[]> => ({
        Connection: [...(state.status !== 'connected' || !state.enabled ? [t('menu.root.connectWhatsApp')] : []), ...(state.enabled ? ['Turn WhatsApp off'] : []), 'Auto-connect on startup', back],
        'Chats / Owner': [t('menu.root.recents'), t('menu.root.allowedNumbers'), ...(state.owner ? [t('voice.owner')] : []), back],
        Replies: [t('menu.replyDelivery.title'), ...(state.optional ? ['Optional outputs'] : []), back],
        Groups: [t('menu.root.allowedGroups'), 'Group replies', back],
        Advanced: ['Privacy and logs', ...(state.archive ? [t('archive.menu.scope')] : []), ...(state.registered ? [t('menu.root.logoffDeleteSession')] : []), back]
    });
    for (;;) {
        if (!current()) return;
        if (!category) {
            const state = getState();
            const choice = await ctx.ui.select(`WhatsApp — ${state.enabled ? 'Enabled' : 'Off'} (transport: ${state.status})`, categories);
            if (!choice || choice === back) return;
            if (!current()) return;
            if (choice === 'Voice') return t('voice.menu');
            category = choice;
        }
        const available = choices(getState());
        if (!Object.hasOwn(available, category)) return;
        const selected = await ctx.ui.select(category, available[category]);
        if (!selected) return;
        if (!current()) return;
        if (selected === back) { category = undefined; continue; }
        // Transport changes can keep the same account/session scope. Recheck
        // the offered action without rebinding an expired dialog's authority.
        if (!choices(getState())[category]?.includes(selected)) {
            ctx.ui.notify('Settings options changed. Choose again.', 'info');
            category = undefined;
            continue;
        }
        return selected;
    }
}
