import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import type { SessionManager } from '../services/session.manager.js';
import { DEFAULT_MEDIA_LIMIT_MIB, MIB, parseMediaLimitInput, type MediaDirection, type MediaLimits } from '../services/media-limits.js';
import { t } from '../i18n.js';
import { expireSettingsRequest, type SettingsNavigation } from './whatsapp-settings.view.js';

/** Terminal Advanced → Media limits: one direction per change, captured revision, confirmation for inbound raises above 25 MiB. */
export async function showMediaLimitsSettings(ctx: ExtensionCommandContext, session: SessionManager, current: () => boolean): Promise<SettingsNavigation> {
    let limits: MediaLimits;
    try { limits = session.getMediaLimits(); }
    catch { ctx.ui.notify(t('menu.mediaLimits.unavailable'), 'warning'); return 'back'; }
    const revision = session.getMediaLimitsRevision();
    const valid = () => current() && revision === session.getMediaLimitsRevision();
    const inboundMiB = limits.inboundBytes / MIB;
    const outboundMiB = limits.outboundBytes / MIB;
    const inbound = t('menu.mediaLimits.inbound'); const outbound = t('menu.mediaLimits.outbound'); const back = t('menu.back.advanced');
    const choice = await ctx.ui.select(`${t('menu.mediaLimits.title', { inbound: inboundMiB, outbound: outboundMiB })}\n${t('menu.mediaLimits.help')}`, [inbound, outbound, back]);
    if (!valid()) expireSettingsRequest();
    if (choice === back) return 'back';
    if (choice !== inbound && choice !== outbound) return;
    const direction: MediaDirection = choice === inbound ? 'inbound' : 'outbound';
    const text = await ctx.ui.input(t(direction === 'inbound' ? 'menu.mediaLimits.inboundPrompt' : 'menu.mediaLimits.outboundPrompt'));
    if (!valid()) expireSettingsRequest();
    if (text === undefined) return;
    const value = parseMediaLimitInput(text);
    if (value === undefined) { ctx.ui.notify(t('menu.mediaLimits.invalid'), 'warning'); return; }
    // Every inbound increase to a value above 25 MiB widens what all allowed chats may send.
    if (direction === 'inbound' && value > DEFAULT_MEDIA_LIMIT_MIB && value > inboundMiB) {
        if (!await ctx.ui.confirm(t('menu.mediaLimits.confirm'), t('menu.mediaLimits.raiseWarning', { value }))) return;
        if (!valid()) expireSettingsRequest();
    }
    try {
        await session.setMediaLimit(direction, value, revision, valid);
        ctx.ui.notify(t('menu.mediaLimits.saved'), 'info');
    } catch (error) {
        if (!valid()) expireSettingsRequest();
        ctx.ui.notify(t('menu.mediaLimits.failed', { error: error instanceof Error ? error.message : String(error) }), 'warning');
    }
}
