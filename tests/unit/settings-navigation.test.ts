import { describe, expect, it, vi } from 'vitest';
import { withSettingsRequest } from '../../src/ui/whatsapp-settings.view.ts';
import { showVoiceSettings } from '../../src/ui/voice-settings.view.ts';
import { speechDefaults } from '../../src/services/speech-settings.ts';

function fixture(choices: Array<string | undefined> = []) {
    const ctx = { cwd: '/fixture', ui: { select: vi.fn(async () => choices.shift()), input: vi.fn(async () => undefined),
        editor: vi.fn(async () => undefined), confirm: vi.fn(async () => true), notify: vi.fn() } };
    const session = { getSpeechSettings: () => speechDefaults(), getSpeechRevision: () => 0, setSpeechSettings: vi.fn() };
    const actions = { current: () => true, chats: () => [], canonical: (jid: string) => jid, preview: vi.fn(), disclose: vi.fn() };
    return { ctx, session, actions };
}
describe('settings request public UI ports', () => {
    it('hints select, input and editor titles without changing confirmations or overlay close', async () => {
        const h = fixture(['chosen']);
        h.ctx.ui.input.mockResolvedValueOnce('value' as never);
        h.ctx.ui.editor.mockResolvedValueOnce('text' as never);
        const confirm = vi.fn(async () => false); const custom = vi.fn(async () => undefined);
        const ctx = { ...h.ctx, ui: { ...h.ctx.ui, confirm, custom } };
        await withSettingsRequest(ctx as any, () => () => true, async scoped => {
            await scoped.ui.select('Select', ['chosen']);
            await scoped.ui.input('Input', 'placeholder');
            await scoped.ui.editor('Editor', 'prefill');
            expect(await scoped.ui.confirm('Confirm', 'unchanged')).toBe(false);
            expect(await scoped.ui.custom(() => ({ render: () => [], invalidate: () => {} }))).toBeUndefined();
        });
        expect(h.ctx.ui.select).toHaveBeenCalledWith('Select\nEsc closes settings', ['chosen']);
        expect(h.ctx.ui.input).toHaveBeenCalledWith('Input\nEsc closes settings', 'placeholder');
        expect(h.ctx.ui.editor).toHaveBeenCalledWith('Editor\nEsc closes settings', 'prefill');
        expect(confirm).toHaveBeenCalledWith('Confirm', 'unchanged');
        expect(custom).toHaveBeenCalledOnce();
    });
    it('fences custom overlay results while retaining their local close behavior', async () => {
        const h = fixture(); let current = true; const custom = vi.fn(async () => { current = false; return 'reply'; });
        const ctx = { ...h.ctx, ui: { ...h.ctx.ui, custom } };
        await withSettingsRequest(ctx as any, () => () => current, async scoped => {
            await scoped.ui.custom(() => ({ render: () => [], invalidate: () => {} })); throw new Error('Expired overlay result admitted');
        });
        expect(custom).toHaveBeenCalledOnce(); expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Settings changed'), 'info');
    });
    it('preserves lazy native context getters instead of snapshotting them', async () => {
        const h = fixture(); let reads = 0; let active = true;
        Object.defineProperty(h.ctx, 'cwd', { get: () => { reads++; if (!active) throw new Error('Host context expired'); return '/fixture'; } });
        await withSettingsRequest(h.ctx as any, () => () => true, async scoped => {
            expect(reads).toBe(0); expect(scoped.cwd).toBe('/fixture'); active = false;
            expect(() => scoped.cwd).toThrow('Host context expired');
        });
        expect(reads).toBe(2);
    });
    it('resolves the host UI again on each call, including unwrapped UI methods', async () => {
        const h = fixture(['first']); const first = h.ctx.ui; const second = { ...first, select: vi.fn(async () => 'second'), notify: vi.fn() }; let port = first;
        Object.defineProperty(h.ctx, 'ui', { get: () => port });
        await withSettingsRequest(h.ctx as any, () => () => true, async scoped => {
            expect(await scoped.ui.select('fixture', ['first'])).toBe('first'); port = second;
            expect(await scoped.ui.select('fixture', ['second'])).toBe('second'); scoped.ui.notify('fixture', 'info');
        });
        expect(first.select).toHaveBeenCalledOnce(); expect(second.select).toHaveBeenCalledOnce(); expect(second.notify).toHaveBeenCalledOnce();
    });
    it('does not poison a reused original context after Esc', async () => {
        const h = fixture([undefined, 'next']); const capture = vi.fn(() => () => true);
        await withSettingsRequest(h.ctx as any, capture, async scoped => { await scoped.ui.select('fixture', []); throw new Error('Cancellation did not unwind'); });
        await withSettingsRequest(h.ctx as any, capture, async scoped => { expect(await scoped.ui.select('fixture', ['next'])).toBe('next'); });
        expect(capture).toHaveBeenCalledTimes(2); expect(h.ctx.ui.notify).not.toHaveBeenCalled();
    });
    it('unwinds Esc from inside the Voice catch without a failure notice or another dialog', async () => {
        const h = fixture(['Advanced speech settings', 'Speech service (Edge or remote)', 'Remote speech service (HTTP API)', 'OpenAI-compatible']);
        await withSettingsRequest(h.ctx as any, () => () => true, async (scoped, current) => {
            await showVoiceSettings(scoped, h.session as any, { ...h.actions, current });
        });
        expect(h.ctx.ui.select).toHaveBeenCalledTimes(4); expect(h.ctx.ui.input).toHaveBeenCalledOnce(); expect(h.ctx.ui.notify).not.toHaveBeenCalled();
        expect(h.session.setSpeechSettings).not.toHaveBeenCalled(); expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it('closes an expired nested dialog before accepting its answer or reopening', async () => {
        const h = fixture(); let current = true;
        h.ctx.ui.select.mockImplementation(async () => { current = false; return 'fixture'; });
        await withSettingsRequest(h.ctx as any, () => () => current, async scoped => {
            await scoped.ui.select('fixture', ['fixture']); throw new Error('Stale answer admitted');
        });
        expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Settings changed'), 'info'); expect(h.ctx.ui.select).toHaveBeenCalledOnce();
    });
});
