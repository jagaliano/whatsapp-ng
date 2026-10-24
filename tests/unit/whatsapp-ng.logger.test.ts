import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppNgLogger } from '../../src/services/whatsapp-ng.logger.ts';

describe('WhatsAppNgLogger', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not write verbose logs when verbose is disabled', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const logger = new WhatsAppNgLogger(false);

        logger.log('[WhatsApp-NG] log');
        logger.warn('[WhatsApp-NG] warn');
        logger.error('[WhatsApp-NG] error');

        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it('always writes info logs', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new WhatsAppNgLogger(false);

        logger.info('[WhatsApp-NG] info');

        expect(logSpy).toHaveBeenCalledWith('[WhatsApp-NG] info');
    });

    it('writes verbose logs when verbose is enabled', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new WhatsAppNgLogger(false);

        logger.setVerbose(true);
        logger.log('[WhatsApp-NG] verbose log');

        expect(logSpy).toHaveBeenCalledWith('[WhatsApp-NG] verbose log');
    });
});
