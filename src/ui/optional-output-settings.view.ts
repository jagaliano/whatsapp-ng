import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import type { SessionManager } from '../services/session.manager.js';
import { validateOptionalOutputs, type OptionalOutputs } from '../services/optional-output.service.js';

export interface OptionalOutputSettingsActions {
    current(): boolean;
    tools(): string[];
    owner(): { ownerJid: string; accountScope: string } | undefined;
}
/** Explicit local/RPC command consent only; no model tool or phone command enables egress. */
export async function showOptionalOutputSettings(ctx: ExtensionCommandContext, session: SessionManager, actions: OptionalOutputSettingsActions): Promise<void> {
    let settings: OptionalOutputs;
    try { settings = session.getOptionalOutputs(); }
    catch { ctx.ui.notify('Invalid optional output settings. An explicit choice will repair them.', 'warning'); settings = validateOptionalOutputs(undefined); }
    const revision = session.getOptionalOutputsRevision(); const ownerRevision = session.getOperatorRevision();
    const current = () => actions.current() && ownerRevision === session.getOperatorRevision();
    const images = 'Choose automatic image tools'; const clearImages = 'Disable automatic images';
    const terminal = settings.terminal ? 'Disable terminal forwarding' : 'Enable terminal forwarding to owner';
    const choice = await ctx.ui.select(`Optional outputs — image tools: ${settings.imageTools.length}; terminal forwarding: ${settings.terminal ? 'On' : 'Off'}`,
        [images, clearImages, terminal, 'Back']);
    if (choice === clearImages) settings.imageTools = [];
    else if (choice === images) {
        const tools = [...new Set(actions.tools())].filter(name => {
            try { validateOptionalOutputs({ imageTools: [name] }); return true; } catch { return false; }
        }).sort((left, right) => left.localeCompare(right)).slice(0, 256);
        const entries = tools.map(name => ({ name, label: `${settings.imageTools.includes(name) ? 'Disable' : 'Enable'} ${name}` }));
        const selected = await ctx.ui.select('Only actual image result blocks from individually selected tools', [...entries.map(entry => entry.label), 'Back']);
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
            if (!owner) { ctx.ui.notify('Connect WhatsApp and configure an allowed private owner first. Group binding or gateway redirects cannot be bypassed.', 'warning'); return; }
            if (!await ctx.ui.confirm('Forward terminal answers?', `Future terminal/RPC final answers may contain workspace information and will be sent as text to the verified owner ${owner.ownerJid} only. No groups, previous-chat fallback, terminal screenshots or automatic raw thinking/tool-result streams. Sent answers follow normal WhatsApp history retention. Owner/account changes invalidate consent. Existing terminal history is not replayed.`)) return;
            const now = actions.owner();
            if (!now || now.ownerJid !== owner.ownerJid || now.accountScope !== owner.accountScope) throw new Error('Settings request expired');
            settings.terminal = owner;
        }
    } else return;
    await session.setOptionalOutputs(settings, revision, current);
    ctx.ui.notify('Optional outputs saved for new inputs. Already-running work is not opted in.', 'info');
}
