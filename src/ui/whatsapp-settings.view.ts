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
        try { ctx.ui.notify(t('menu.expired'), 'info'); }
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
        select: async (title, ...args) => { check(); return answer(await ctx.ui.select(`${title}\n${t('menu.hint.esc')}`, ...args)); },
        input: async (title, ...args) => { check(); return answer(await ctx.ui.input(`${title}\n${t('menu.hint.esc')}`, ...args)); },
        editor: async (title, ...args) => { check(); return answer(await ctx.ui.editor(`${title}\n${t('menu.hint.esc')}`, ...args)); },
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
    let category: SettingsCategory | undefined = resumeCategory;
    const back = t('menu.back.main'); const close = t('menu.close');
    const labels: Record<SettingsCategory | 'Voice', string> = {
        Connection: t('menu.category.connection'), 'Chats / Owner': t('menu.category.chatsOwner'),
        Replies: t('menu.category.replies'), Voice: t('voice.menu'), Groups: t('menu.category.groups'), Advanced: t('menu.category.advanced')
    };
    const categories = [...Object.values(labels), close];
    const statuses: Record<string, Parameters<typeof t>[0]> = { connected: 'menu.status.connected', disconnected: 'menu.status.disconnected', pairing: 'menu.status.pairing', 'logged-out': 'menu.status.logged-out' };
    const choices = (state: SettingsState): Record<string, string[]> => ({
        Connection: [...(state.status !== 'connected' || !state.enabled ? [t('menu.root.connectWhatsApp')] : []), ...(state.enabled ? [t('menu.connection.turnOff')] : []), t('menu.connection.autoConnect'), back],
        'Chats / Owner': [t('menu.root.recents'), t('menu.root.allowedNumbers'), ...(state.owner ? [t('voice.owner')] : []), back],
        Replies: [t('menu.replyDelivery.title'), ...(state.optional ? [t('menu.optional.title')] : []), back],
        Groups: [t('menu.root.allowedGroups'), t('menu.groups.replies'), back],
        Advanced: [t('menu.advanced.privacy'), ...(state.archive ? [t('archive.menu.scope')] : []), ...(state.registered ? [t('menu.root.logoffDeleteSession')] : []), back]
    });
    for (;;) {
        if (!current()) return;
        if (!category) {
            const state = getState();
            const statusKey = statuses[state.status];
            const choice = await ctx.ui.select(t('menu.root.title', { state: t(state.enabled ? 'menu.state.enabled' : 'menu.state.off'),
                status: statusKey ? t(statusKey) : state.status }), categories);
            if (!choice || choice === close) return;
            if (!current()) return;
            if (choice === labels.Voice) return t('voice.menu');
            category = (Object.keys(labels) as Array<SettingsCategory | 'Voice'>).find(id => id !== 'Voice' && labels[id] === choice) as SettingsCategory | undefined;
            if (!category) return;
        }
        const available = choices(getState());
        if (!Object.hasOwn(available, category)) return;
        const selected = await ctx.ui.select(labels[category], available[category]);
        if (!selected) return;
        if (!current()) return;
        if (selected === back) { category = undefined; continue; }
        // Transport changes can keep the same account/session scope. Recheck
        // the offered action without rebinding an expired dialog's authority.
        if (!choices(getState())[category]?.includes(selected)) {
            ctx.ui.notify(t('menu.optionsChanged'), 'info');
            category = undefined;
            continue;
        }
        return selected;
    }
}
