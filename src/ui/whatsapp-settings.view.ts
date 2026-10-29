import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { t } from '../i18n.js';

interface SettingsState { status: string; enabled: boolean; registered: boolean; archive: boolean; optional: boolean; owner: boolean }
/** Navigation only: existing menu/controller views retain all mutations and history handling. */
export async function chooseWhatsAppSetting(ctx: ExtensionCommandContext, getState: () => SettingsState, current: () => boolean, resumeCategory?: 'Connection'): Promise<string | undefined> {
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
