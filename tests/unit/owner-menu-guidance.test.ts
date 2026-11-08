import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initI18n, resetI18n, t } from '../../src/i18n.js';
import { chooseWhatsAppSetting } from '../../src/ui/whatsapp-settings.view.js';

afterEach(() => { resetI18n(); vi.unstubAllEnvs(); });

describe.each(['en', 'pt-BR', 'es', 'fr'])('owner menu guidance (%s)', locale => {
    async function ownerRoute() {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const category = t('menu.category.chatsOwner');
        const select = vi.fn().mockResolvedValueOnce(category).mockResolvedValueOnce(t('voice.owner'));
        const ctx = { ui: { select } } as unknown as ExtensionCommandContext;
        const selected = await chooseWhatsAppSetting(ctx, () => ({ status: 'connected', enabled: true,
            registered: true, archive: true, optional: false, owner: true }), () => true);
        expect(select).toHaveBeenNthCalledWith(1, expect.any(String), expect.arrayContaining([category]));
        expect(select).toHaveBeenNthCalledWith(2, category, expect.arrayContaining([t('voice.owner')]));
        expect(selected).toBe(t('voice.owner'));
        return `/whatsapp > ${select.mock.calls[1][0]} > ${selected}`;
    }

    it('uses the rendered owner and Voice routes in authorization notices', async () => {
        const path = await ownerRoute();
        for (const key of ['voice.authUnknown', 'voice.authNoOwner', 'voice.authDenied'] as const) {
            expect(t(key)).toContain(path);
            if (key !== 'voice.authNoOwner') expect(t(key)).toContain(`/whatsapp > ${t('voice.menu')}`);
        }
    });

    it('uses grouped Owner and Recents routes and the Voice label in the pairing welcome', async () => {
        const path = await ownerRoute(); const welcome = t('service.whatsapp.qrWelcomeMessage');
        expect(welcome).toContain(path);
        expect(welcome.endsWith(t('voice.menu') + '.')).toBe(true);
        expect(welcome).toContain(`/whatsapp > ${t('menu.category.chatsOwner')} > ${t('menu.root.recents')}`);
    });
});
