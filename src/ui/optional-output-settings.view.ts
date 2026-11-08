import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import type { SessionManager } from '../services/session.manager.js';
import { validateOptionalOutputs, type OptionalOutputs } from '../services/optional-output.service.js';
import { t } from '../i18n.js';
import { expireSettingsRequest, type SettingsNavigation } from './whatsapp-settings.view.js';

export interface OptionalOutputSettingsActions {
    current(): boolean;
    tools(): string[];
    owner(): { ownerJid: string; accountScope: string } | undefined;
}
/** Explicit local/RPC command consent only; no model tool or phone command enables egress. */
export async function showOptionalOutputSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: OptionalOutputSettingsActions, ownerRevision = session.getOperatorRevision()): Promise<SettingsNavigation> {
    let settings: OptionalOutputs;
    try { settings = session.getOptionalOutputs(); }
    catch { ctx.ui.notify(t('menu.optional.invalid'), 'warning'); settings = validateOptionalOutputs(undefined); }
    const revision = session.getOptionalOutputsRevision();
    const current = () => actions.current() && ownerRevision === session.getOperatorRevision();
    const back = t('menu.back.replies');
    const images = t('menu.optional.chooseImages'); const clearImages = t('menu.optional.clearImages');
    const terminal = t(settings.terminal ? 'menu.optional.terminalOff' : 'menu.optional.terminalOn');
    const choice = await ctx.ui.select(t('menu.optional.status', { count: settings.imageTools.length, state: t(settings.terminal ? 'menu.on' : 'menu.off') }),
        [images, clearImages, terminal, back]);
    if (!current()) expireSettingsRequest();
    if (choice === back) return 'back';
    if (choice === clearImages) settings.imageTools = [];
    else if (choice === images) {
        const tools = [...new Set(actions.tools())].filter(name => {
            try { validateOptionalOutputs({ imageTools: [name] }); return true; } catch { return false; }
        }).sort((left, right) => left.localeCompare(right)).slice(0, 256);
        const imageBack = t('menu.back.optionalOutputs');
        const entries = tools.map(name => ({ name, label: t(settings.imageTools.includes(name) ? 'menu.optional.toolOff' : 'menu.optional.toolOn', { tool: name }) }));
        const selected = await ctx.ui.select(t('menu.optional.imageTitle'), [...entries.map(entry => entry.label), imageBack]);
        if (selected === imageBack) {
            if (!current()) expireSettingsRequest();
            return showOptionalOutputSettings(ctx, session, actions, ownerRevision);
        }
        const name = entries.find(entry => entry.label === selected)?.name; if (!name) return;
        if (settings.imageTools.includes(name)) settings.imageTools = settings.imageTools.filter(tool => tool !== name);
        else {
            if (!await ctx.ui.confirm('Allow automatic tool images?', `Image result blocks from ${name} in verified WhatsApp work will be uploaded to that owning chat. Any inline image returned by this tool may be uploaded, including files outside the workspace if the tool can read them. Images/screenshots may contain private information. The projection itself never reads paths or URLs from text/details, and never uploads terminal images. Limit: 4 images / 25 MiB per input.`)) return;
            settings.imageTools.push(name);
        }
    } else if (choice === terminal) {
        if (settings.terminal) settings = { imageTools: settings.imageTools };
        else {
            const owner = actions.owner();
            if (!owner) { ctx.ui.notify(t('menu.optional.ownerMissing'), 'warning'); return; }
            if (!await ctx.ui.confirm('Forward terminal answers?', `Future terminal/RPC final answers may contain workspace information and will be sent as text to the verified owner ${owner.ownerJid} only. No groups, previous-chat fallback, terminal screenshots or automatic raw thinking/tool-result streams. Sent answers follow normal WhatsApp history retention. Owner/account changes invalidate consent. Existing terminal history is not replayed.`)) return;
            const now = actions.owner();
            if (!now || now.ownerJid !== owner.ownerJid || now.accountScope !== owner.accountScope) expireSettingsRequest();
            settings.terminal = owner;
        }
    } else return;
    if (!current()) expireSettingsRequest();
    await session.setOptionalOutputs(settings, revision, current);
    ctx.ui.notify(t('menu.optional.saved'), 'info');
}
