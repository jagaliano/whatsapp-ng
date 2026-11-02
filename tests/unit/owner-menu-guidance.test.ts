import type { ExtensionCommandContext } from '@mariozechner/pi-coding-agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initI18n, resetI18n, t } from '../../src/i18n.js';
import { chooseWhatsAppSetting } from '../../src/ui/whatsapp-settings.view.js';

afterEach(() => { resetI18n(); vi.unstubAllEnvs(); });

describe.each(['en', 'pt-BR', 'es', 'fr'])('owner menu guidance (%s)', locale => {
    async function ownerRoute() {
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const select = vi.fn().mockResolvedValueOnce('Chats / Owner').mockResolvedValueOnce(t('voice.owner'));
        const ctx = { ui: { select } } as unknown as ExtensionCommandContext;
        const selected = await chooseWhatsAppSetting(ctx, () => ({ status: 'connected', enabled: true,
            registered: true, archive: true, optional: false, owner: true }), () => true);
        expect(select).toHaveBeenNthCalledWith(1, expect.any(String), expect.arrayContaining(['Chats / Owner']));
        expect(select).toHaveBeenNthCalledWith(2, 'Chats / Owner', expect.arrayContaining([t('voice.owner')]));
        expect(selected).toBe(t('voice.owner'));
        return `/whatsapp > ${select.mock.calls[1][0]} > ${selected}`;
    }

    it('uses the rendered owner route in every authorization notice', async () => {
        const path = await ownerRoute();
        for (const key of ['voice.authUnknown', 'voice.authNoOwner', 'voice.authDenied'] as const) {
            expect(t(key)).toContain(path);
        }
    });

    it('uses grouped Owner and Recents routes in the pairing welcome', async () => {
        const path = await ownerRoute(); const welcome = t('service.whatsapp.qrWelcomeMessage');
        expect(welcome).toContain(path);
        expect(welcome).toContain(`/whatsapp > Chats / Owner > ${t('menu.root.recents')}`);
    });
});
