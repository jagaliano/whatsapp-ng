import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { getEffectiveLocale, isSupportedLocale, SUPPORTED_LOCALES, t } from '../i18n.js';
import type { SessionManager } from '../services/session.manager.js';
import { expireSettingsRequest, type SettingsNavigation } from './whatsapp-settings.view.js';

/** Terminal-only locale preference. Registration metadata changes only after Pi restarts. */
export async function showLocaleSettings(ctx: ExtensionCommandContext, session: SessionManager, current: () => boolean): Promise<SettingsNavigation> {
    const revision = session.getLocaleRevision();
    const valid = () => current() && revision === session.getLocaleRevision();
    const saved = session.getSavedLocale();
    const effective = getEffectiveLocale();
    let source: string = effective.source;
    if (effective.source === 'saved') source = t('settings.locale.sourceSaved');
    else if (effective.source === 'default') source = t('settings.locale.sourceDefault');
    const lines = [t('settings.locale.effective', { value: effective.locale ?? 'en', source })];
    if (saved.invalid) lines.push(t('settings.locale.invalid'));
    else if (saved.value && effective.source !== 'saved') lines.push(t('settings.locale.overridden', { value: saved.value, source: effective.source }));
    const set = t('settings.locale.set'); const clear = t('settings.locale.clear'); const back = t('menu.back.advanced');
    const choice = await ctx.ui.select(lines.join('\n'), [set, ...(saved.value || saved.invalid ? [clear] : []), back]);
    if (!valid()) expireSettingsRequest();
    if (choice === back) return 'back';
    try {
        if (choice === set) {
            const selected = await ctx.ui.select(t('settings.locale.prompt'), [...SUPPORTED_LOCALES, back]);
            if (!valid()) expireSettingsRequest();
            if (selected === back) return 'back';
            if (!isSupportedLocale(selected)) return;
            await session.setLocale(selected, revision, valid);
        } else if (choice === clear) {
            await session.clearLocale(revision, valid);
        } else return;
        ctx.ui.notify(t('settings.locale.restart'), 'info');
    } catch {
        if (!valid()) expireSettingsRequest();
        ctx.ui.notify(t('settings.locale.failed'), 'warning');
    }
}
