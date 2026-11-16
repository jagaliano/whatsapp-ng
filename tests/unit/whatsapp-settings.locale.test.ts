import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n, resetI18n } from '../../src/i18n.ts';
import { showLocaleSettings } from '../../src/ui/locale-settings.view.ts';
import { withSettingsRequest } from '../../src/ui/whatsapp-settings.view.ts';
import type { Locale } from '../../src/i18n.ts';

function fixture(selects: string[], initial?: string) {
    let saved = initial ? { value: initial, invalid: false } : { invalid: false };
    let revision = 0;
    let current = true;
    const session = {
        getSavedLocale: vi.fn(() => structuredClone(saved)),
        getLocaleRevision: vi.fn(() => revision),
        setLocale: vi.fn(async (value: Locale, expected: number, guard: () => boolean) => {
            if (expected !== revision || !guard()) throw new Error('fixture stale');
            saved = { value, invalid: false }; revision++;
        }),
        clearLocale: vi.fn(async (expected: number, guard: () => boolean) => {
            if (expected !== revision || !guard()) throw new Error('fixture stale');
            saved = { invalid: false }; revision++;
        })
    };
    const ctx = { ui: {
        select: vi.fn(async () => selects.shift() ?? 'Back to Advanced'),
        notify: vi.fn()
    } };
    return { session, ctx, saved: () => saved, expire: () => { current = false; }, current: () => current };
}

beforeEach(() => { resetI18n(); vi.stubEnv('WHATSAPP_NG_LOCALE', ''); });
afterEach(() => { resetI18n(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('terminal extension locale settings', () => {
    it('sets a supported locale and says a Pi restart is required', async () => {
        initI18n(undefined);
        const h = fixture(['Set extension language', 'fr']);
        await showLocaleSettings(h.ctx as any, h.session as any, h.current);
        expect(h.session.setLocale).toHaveBeenCalledWith('fr', 0, expect.any(Function));
        expect(h.saved()).toEqual({ value: 'fr', invalid: false });
        expect(h.ctx.ui.notify).toHaveBeenCalledWith('Saved. Restart Pi to apply the extension language.', 'info');
        expect(JSON.stringify(h.ctx.ui.notify.mock.calls)).not.toContain('/reload');
    });

    it('clears only through the explicit Clear action and applies that after restart too', async () => {
        initI18n(undefined, 'es');
        const h = fixture(['Borrar idioma guardado de la extensión'], 'es');
        await showLocaleSettings(h.ctx as any, h.session as any, h.current);
        expect(h.session.clearLocale).toHaveBeenCalledWith(0, expect.any(Function));
        expect(h.saved()).toEqual({ invalid: false });
        expect(h.ctx.ui.notify).toHaveBeenCalledWith('Guardado. Reinicia Pi para aplicar el idioma de la extensión.', 'info');
    });

    it('shows the saved effective source', async () => {
        initI18n(undefined, 'pt-BR');
        const h = fixture(['Back to Advanced'], 'pt-BR');
        await showLocaleSettings(h.ctx as any, h.session as any, h.current);
        expect(h.ctx.ui.select).toHaveBeenCalledWith(expect.stringContaining('pt-BR (salvo)'), expect.any(Array));
    });

    it('shows an environment override and marks the saved locale overridden', async () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', 'es'); initI18n(undefined, 'fr');
        const h = fixture(['Back to Advanced'], 'fr');
        await showLocaleSettings(h.ctx as any, h.session as any, h.current);
        expect(h.ctx.ui.select).toHaveBeenCalledWith(expect.stringContaining('es (WHATSAPP_NG_LOCALE)'), expect.any(Array));
        expect(h.ctx.ui.select).toHaveBeenCalledWith(expect.stringContaining('Guardado: fr (anulado por WHATSAPP_NG_LOCALE)'), expect.any(Array));
    });

    it('does not save after the settings request becomes stale', async () => {
        initI18n(undefined);
        const h = fixture(['Set extension language', 'fr']);
        h.session.setLocale.mockImplementationOnce(async () => { h.expire(); throw new Error('fixture expired'); });
        await withSettingsRequest(h.ctx as any, () => h.current, async (scoped, current) => {
            await showLocaleSettings(scoped as any, h.session as any, current);
        });
        expect(h.saved()).toEqual({ invalid: false });
        expect(h.ctx.ui.notify).toHaveBeenCalledWith('Settings changed while this menu was open. Reopen /whatsapp.', 'info');
        expect(h.ctx.ui.notify).not.toHaveBeenCalledWith(expect.stringContaining('Restart Pi'), 'info');
    });
});
