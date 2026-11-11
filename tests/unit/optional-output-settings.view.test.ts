import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '../../src/services/session.manager.ts';
import { showOptionalOutputSettings } from '../../src/ui/optional-output-settings.view.ts';
import { t } from '../../src/i18n.ts';
import { withSettingsRequest } from '../../src/ui/whatsapp-settings.view.ts';

const owner = { ownerJid: '15550000001@s.whatsapp.net', accountScope: 'fixture' };
describe('optional output settings consent', () => {
    let root: string; let session: SessionManager;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-optional-ui-')); session = new SessionManager(root); await session.ensureInitialized(); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });
    const ui = (...choices: string[]) => ({ ui: { select: vi.fn(async () => choices.shift()), confirm: vi.fn(async () => true), notify: vi.fn() } }) as any;
    const actions = () => ({ current: () => true, owner: () => owner, tools: () => ['screenshot', 'read', 'send_wa_media'], groups: () => [{ jid: '120363000001@g.us', label: 'Fixture group' }] });
    it('returns from tool-picker Back to Optional outputs without saving', async () => {
        const ctx = ui('Choose automatic image tools', 'Back to Optional outputs', 'Back to Replies');
        expect(await showOptionalOutputSettings(ctx, session, actions())).toBe('back');
        expect(ctx.ui.select).toHaveBeenCalledTimes(3); expect(ctx.ui.confirm).not.toHaveBeenCalled(); expect(ctx.ui.notify).not.toHaveBeenCalled();
        expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
    it('does not renew owner authority when Back exits the tool picker', async () => {
        const ctx = ui(); ctx.ui.select.mockResolvedValueOnce('Choose automatic image tools').mockImplementationOnce(async () => {
            await session.setOperatorJid(owner.ownerJid); return 'Back to Optional outputs';
        });
        await withSettingsRequest(ctx, () => () => true, async scoped => { await showOptionalOutputSettings(scoped, session, actions()); });
        expect(ctx.ui.select).toHaveBeenCalledTimes(2); expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Settings changed'), 'info');
        expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
    const background = () => t('menu.optional.background', { state: t('menu.off') });
    it('enables background answers to the owner without asking for a group or changing other outputs', async () => {
        const ctx = ui(background(), t('menu.optional.backgroundOwner'));
        await showOptionalOutputSettings(ctx, session, actions());
        expect(session.getOptionalOutputs().autonomous).toEqual({ kind: 'owner', jid: owner.ownerJid, ...owner });
        expect(ctx.ui.confirm).not.toHaveBeenCalled();
        expect(ctx.ui.select.mock.calls[0][1]).toContain(background());
    });
    it('requires group disclosure, lists allowed groups only and preserves independent settings', async () => {
        await session.setOptionalOutputs({ imageTools: ['read'], terminal: owner }, 0);
        const ctx = ui(background(), t('menu.optional.backgroundGroup'), 'Fixture group');
        await showOptionalOutputSettings(ctx, session, actions());
        expect(ctx.ui.confirm).toHaveBeenCalledWith(t('menu.optional.backgroundDisclosureTitle'), expect.stringContaining('All members'));
        expect(ctx.ui.select.mock.calls[2][1]).toEqual(['Fixture group', 'Back to Optional outputs']);
        expect(session.getOptionalOutputs()).toEqual({ imageTools: ['read'], terminal: owner,
            autonomous: { kind: 'group', jid: '120363000001@g.us', ...owner } });
        const disableTerminal = ui('Disable terminal forwarding'); await showOptionalOutputSettings(disableTerminal, session, actions());
        expect(session.getOptionalOutputs().autonomous?.kind).toBe('group');
        const off = ui(t('menu.optional.background', { state: '120363000001@g.us' }), t('menu.optional.backgroundOff'));
        await showOptionalOutputSettings(off, session, actions()); expect(session.getOptionalOutputs()).toEqual({ imageTools: ['read'] });
    });
    it('does not change consent after group decline, no groups or a missing owner', async () => {
        const decline = ui(background(), t('menu.optional.backgroundGroup'), 'Fixture group'); decline.ui.confirm.mockResolvedValue(false);
        await showOptionalOutputSettings(decline, session, actions()); expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
        const empty = ui(background(), t('menu.optional.backgroundGroup'));
        await showOptionalOutputSettings(empty, session, { ...actions(), groups: () => [] }); expect(empty.ui.notify).toHaveBeenCalled();
        const missing = ui(background(), t('menu.optional.backgroundOwner'));
        await showOptionalOutputSettings(missing, session, { ...actions(), owner: () => undefined }); expect(missing.ui.notify).toHaveBeenCalled();
        expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
    it.each(['owner', 'revision', 'session', 'group-removed'])('expires background group consent on %s change during disclosure', async change => {
        let info = owner; let current = true; let groups = actions().groups();
        const ctx = ui(background(), t('menu.optional.backgroundGroup'), 'Fixture group');
        ctx.ui.confirm.mockImplementation(async () => {
            if (change === 'owner') info = { ...owner, ownerJid: '15550000002@s.whatsapp.net' };
            else if (change === 'revision') await session.setOptionalOutputs({ imageTools: ['read'] }, 0);
            else if (change === 'session') current = false;
            else groups = [];
            return true;
        });
        await expect(showOptionalOutputSettings(ctx, session, { ...actions(), owner: () => info, current: () => current, groups: () => groups })).rejects.toThrow('expired');
        expect(session.getOptionalOutputs().autonomous).toBeUndefined();
    });
    it('does not renew an optional-output revision on background Back', async () => {
        const ctx = ui(background());
        ctx.ui.select.mockResolvedValueOnce(background()).mockImplementationOnce(async () => {
            await session.setOptionalOutputs({ imageTools: ['read'] }, 0); return 'Back to Optional outputs';
        });
        await expect(showOptionalOutputSettings(ctx, session, actions())).rejects.toThrow('expired');
        expect(ctx.ui.select).toHaveBeenCalledTimes(2);
    });
    it('background Back returns to Optional outputs without saving or renewing authority', async () => {
        const ctx = ui(background(), 'Back to Optional outputs', 'Back to Replies');
        expect(await showOptionalOutputSettings(ctx, session, actions())).toBe('back');
        expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
    it('enables only one explicitly selected tool after confirmation', async () => {
        const ctx = ui('Choose automatic image tools', 'Enable screenshot'); await showOptionalOutputSettings(ctx, session, actions());
        expect(ctx.ui.confirm).toHaveBeenCalledTimes(1); expect(session.getOptionalOutputs()).toEqual({ imageTools: ['screenshot'] });
        expect(ctx.ui.select.mock.calls[1]?.[1] ?? []).not.toContain('Enable send_wa_media');
    });
    it('requires private-owner confirmation and never sends a preview', async () => {
        const ctx = ui('Enable terminal forwarding to owner'); await showOptionalOutputSettings(ctx, session, actions());
        expect(ctx.ui.confirm).toHaveBeenCalledWith('Forward terminal answers?', expect.stringContaining('workspace information'));
        expect(session.getOptionalOutputs().terminal).toEqual(owner);
    });
    it('does not enable after refusal or without an owner', async () => {
        const ctx = ui('Enable terminal forwarding to owner'); ctx.ui.confirm.mockResolvedValue(false);
        await showOptionalOutputSettings(ctx, session, actions()); expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
        const missing = ui('Enable terminal forwarding to owner'); await showOptionalOutputSettings(missing, session, { ...actions(), owner: () => undefined });
        expect(missing.ui.confirm).not.toHaveBeenCalled(); expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
    it('rejects a changed owner or stale session while a consent dialog is open', async () => {
        let current = true; const ctx = ui('Enable terminal forwarding to owner'); ctx.ui.confirm.mockImplementation(async () => { current = false; return true; });
        await expect(showOptionalOutputSettings(ctx, session, { ...actions(), current: () => current })).rejects.toThrow('expired');
        let info = owner; const other = ui('Enable terminal forwarding to owner'); other.ui.confirm.mockImplementation(async () => { info = { ...owner, ownerJid: '15550000002@s.whatsapp.net' }; return true; });
        await expect(showOptionalOutputSettings(other, session, { ...actions(), owner: () => info })).rejects.toThrow('expired');
        expect(session.getOptionalOutputs()).toEqual({ imageTools: [] });
    });
});
