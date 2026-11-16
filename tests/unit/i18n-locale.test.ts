import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEffectiveLocale, initI18n, resetI18n, resolveLocale, t } from '../../src/i18n.ts';

const env = (value?: string) => ({ WHATSAPP_NG_LOCALE: value });

beforeEach(() => {
    vi.stubEnv('WHATSAPP_NG_LOCALE', '');
    resetI18n();
});

afterEach(() => {
    resetI18n();
    vi.unstubAllEnvs();
});

describe('extension locale resolution', () => {
    it('resolves environment, flag, saved locale and English in order', () => {
        expect(resolveLocale({ env: env(' es '), argv: ['--whatsapp-ng-locale=fr'], saved: 'pt-BR' })).toEqual({ locale: 'es', source: 'WHATSAPP_NG_LOCALE' });
        expect(resolveLocale({ env: env(' '), argv: ['--whatsapp-ng-locale=fr'], saved: 'pt-BR' })).toEqual({ locale: 'fr', source: '--whatsapp-ng-locale' });
        expect(resolveLocale({ env: env(), argv: ['--whatsapp-ng-locale', 'es'], saved: 'pt-BR' })).toEqual({ locale: 'es', source: '--whatsapp-ng-locale' });
        expect(resolveLocale({ env: env(), argv: [], saved: 'pt-BR' })).toEqual({ locale: 'pt-BR', source: 'saved' });
        expect(resolveLocale({ env: env(), argv: [] })).toEqual({ locale: undefined, source: 'default' });
    });

    it('keeps a present blank flag in English instead of selecting the saved locale', () => {
        for (const argv of [['--whatsapp-ng-locale='], ['--whatsapp-ng-locale'], ['--whatsapp-ng-locale', ' ']]) {
            expect(resolveLocale({ env: env(), argv, saved: 'fr' })).toEqual({ locale: undefined, source: '--whatsapp-ng-locale' });
            initI18n(undefined, 'fr');
        }
    });

    it('does not substitute a saved locale for an invalid winning override', () => {
        expect(resolveLocale({ env: env('unsupported'), argv: [], saved: 'fr' })).toEqual({ locale: 'unsupported', source: 'WHATSAPP_NG_LOCALE' });
        vi.stubEnv('WHATSAPP_NG_LOCALE', 'unsupported');
        initI18n(undefined, 'fr');
        expect(t('voice.menu')).toBe('Voice');
    });

    it('resets a stale override when reinitialized without one', () => {
        vi.stubEnv('WHATSAPP_NG_LOCALE', 'fr');
        initI18n(undefined);
        expect(t('voice.menu')).toBe('Voix');
        vi.stubEnv('WHATSAPP_NG_LOCALE', '');
        initI18n(undefined, 'es');
        expect(t('voice.menu')).toBe('Voz');
        expect(getEffectiveLocale()).toEqual({ locale: 'es', source: 'saved' });
        initI18n(undefined);
        expect(t('voice.menu')).toBe('Voice');
        expect(getEffectiveLocale()).toEqual({ locale: undefined, source: 'default' });
    });

    it('uses the saved locale only when it is supported', () => {
        initI18n(undefined, 'fr');
        expect(t('voice.menu')).toBe('Voix');
        initI18n(undefined, 'de' as any);
        expect(t('voice.menu')).toBe('Voice');
    });
});
