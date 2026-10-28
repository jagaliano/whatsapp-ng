import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '../../src/services/session.manager.ts';
import { showOptionalOutputSettings } from '../../src/ui/optional-output-settings.view.ts';

const owner = { ownerJid: '15550000001@s.whatsapp.net', accountScope: 'fixture' };
describe('optional output settings consent', () => {
    let root: string; let session: SessionManager;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-optional-ui-')); session = new SessionManager(root); await session.ensureInitialized(); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });
    const ui = (...choices: string[]) => ({ ui: { select: vi.fn(async () => choices.shift()), confirm: vi.fn(async () => true), notify: vi.fn() } }) as any;
    const actions = () => ({ current: () => true, owner: () => owner, tools: () => ['screenshot', 'read', 'send_wa_media'] });
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
