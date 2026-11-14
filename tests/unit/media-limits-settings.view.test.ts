import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '../../src/services/session.manager.ts';
import { showMediaLimitsSettings } from '../../src/ui/media-limits-settings.view.ts';
import { withSettingsRequest } from '../../src/ui/whatsapp-settings.view.ts';
import { t } from '../../src/i18n.ts';
import { MIB } from '../../src/services/media-limits.ts';

describe('media limits settings view', () => {
    let root: string; let session: SessionManager;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-limits-ui-')); session = new SessionManager(root); await session.ensureInitialized(); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });
    const ui = (choices: string[], inputs: Array<string | undefined> = [], confirm = true) => ({ ui: {
        select: vi.fn(async () => choices.shift()), input: vi.fn(async () => inputs.shift()), confirm: vi.fn(async () => confirm), notify: vi.fn()
    } }) as any;
    const inbound = () => t('menu.mediaLimits.inbound');
    const outbound = () => t('menu.mediaLimits.outbound');
    const back = () => t('menu.back.advanced');

    it('shows both values, range, audio exclusion, processing ceiling and resource notes; Back never saves', async () => {
        await session.setMediaLimit('outbound', 100, 0);
        const ctx = ui([back()]);
        expect(await showMediaLimitsSettings(ctx, session, () => true)).toBe('back');
        const [title, options] = ctx.ui.select.mock.calls[0];
        expect(title).toContain('inbound 25 MiB, outbound 100 MiB');
        expect(title).toContain('1 to 512');
        expect(title).toContain('voice notes stay at 25 MiB');
        expect(title).toContain('generated speech at 8 MiB');
        expect(title).toContain('above 25 MiB are stored without automatic');
        expect(title).toContain('RAM-backed');
        expect(options).toEqual([inbound(), outbound(), back()]);
        expect(session.getMediaLimitsRevision()).toBe(1);
    });

    it('saves an outbound change without confirmation', async () => {
        const ctx = ui([outbound()], ['200']);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(ctx.ui.confirm).not.toHaveBeenCalled();
        expect(session.getMediaLimits()).toEqual({ inboundBytes: 25 * MIB, outboundBytes: 200 * MIB });
        expect(ctx.ui.notify).toHaveBeenCalledWith(t('menu.mediaLimits.saved'), 'info');
    });

    it.each([['25', '100'], ['100', '200']])('requires confirmation for an inbound increase %s → %s MiB', async (from, to) => {
        if (from !== '25') await session.setMediaLimit('inbound', Number(from), 0);
        const ctx = ui([inbound()], [to]);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(ctx.ui.confirm).toHaveBeenCalledWith(t('menu.mediaLimits.confirm'), t('menu.mediaLimits.raiseWarning', { value: to }));
        expect(session.getMediaLimits().inboundBytes).toBe(Number(to) * MIB);
    });

    it('leaves the inbound limit unchanged when the confirmation is cancelled', async () => {
        const ctx = ui([inbound()], ['300'], false);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(session.getMediaLimits().inboundBytes).toBe(25 * MIB);
        expect(session.getMediaLimitsRevision()).toBe(0);
    });

    it.each([['200', '50'], ['25', '10'], ['25', '25']])('does not confirm inbound %s → %s MiB (not an increase above 25)', async (from, to) => {
        if (from !== '25') await session.setMediaLimit('inbound', Number(from), 0);
        const ctx = ui([inbound()], [to]);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(ctx.ui.confirm).not.toHaveBeenCalled();
        expect(session.getMediaLimits().inboundBytes).toBe(Number(to) * MIB);
    });

    it.each(['0', '513', '1.5', '+5', '25MiB', ' 25', '025', ''])('rejects input %j without saving', async value => {
        const ctx = ui([outbound()], [value]);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(ctx.ui.notify).toHaveBeenCalledWith(t('menu.mediaLimits.invalid'), 'warning');
        expect(session.getMediaLimitsRevision()).toBe(0);
    });

    it('cancelled input changes nothing', async () => {
        const ctx = ui([outbound()], [undefined]);
        await showMediaLimitsSettings(ctx, session, () => true);
        expect(session.getMediaLimitsRevision()).toBe(0);
        expect(ctx.ui.notify).not.toHaveBeenCalled();
    });

    it('expires instead of saving when settings changed while the prompt was open', async () => {
        const ctx = ui([outbound()]);
        ctx.ui.input.mockImplementationOnce(async () => { await session.setMediaLimit('inbound', 40, 0); return '300'; });
        await withSettingsRequest(ctx, () => () => true, async scoped => { await showMediaLimitsSettings(scoped, session, () => true); });
        expect(session.getMediaLimits()).toEqual({ inboundBytes: 40 * MIB, outboundBytes: 25 * MIB });
        expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Settings changed'), 'info');
    });

    it('expires when the captured menu authority ends during confirmation', async () => {
        let current = true;
        const ctx = ui([inbound()], ['400']);
        ctx.ui.confirm.mockImplementationOnce(async () => { current = false; return true; });
        await withSettingsRequest(ctx, () => () => true, async scoped => { await showMediaLimitsSettings(scoped, session, () => current); });
        expect(session.getMediaLimitsRevision()).toBe(0);
    });

    it('shows a repair notice and offers no edit when saved limits are malformed', async () => {
        await writeFile(join(root, 'config.json'), JSON.stringify({ mediaLimits: { outboundMiB: 'big' } }));
        const broken = new SessionManager(root); await broken.ensureInitialized();
        const ctx = ui([]);
        expect(await showMediaLimitsSettings(ctx, broken, () => true)).toBe('back');
        expect(ctx.ui.notify).toHaveBeenCalledWith(t('menu.mediaLimits.unavailable'), 'warning');
        expect(ctx.ui.select).not.toHaveBeenCalled();
        expect(JSON.parse(await readFile(join(root, 'config.json'), 'utf8')).mediaLimits).toEqual({ outboundMiB: 'big' });
    });
});
