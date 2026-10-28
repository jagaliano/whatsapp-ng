import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowsPlainHttp, isLoopbackEndpoint } from '../../src/services/endpoint-policy.ts';

beforeEach(() => vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', ''));
afterEach(() => vi.unstubAllEnvs());
describe('lexical speech endpoint transport policy', () => {
    it.each(['127.0.0.1', '127.255.255.254', '[::1]', 'localhost', 'LOCALHOST', '127.1'])('allows normalized loopback HTTP: %s', host => {
        const url = new URL(`http://${host}:8098/speech`); expect(isLoopbackEndpoint(url)).toBe(true); expect(allowsPlainHttp(url)).toBe(true);
    });
    it.each(['127.0.0.1.example.test', 'localhost.example.test', '192.168.1.20', '[::]', '[::ffff:127.0.0.1]'])('does not infer loopback from a lookalike or other address: %s', host => {
        const url = new URL(`http://${host}/speech`); expect(isLoopbackEndpoint(url)).toBe(false); expect(allowsPlainHttp(url)).toBe(false);
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); expect(allowsPlainHttp(url)).toBe(true);
    });
    it.each(['ftp:', 'file:', 'ws:', 'wss:'])('never enables unsupported schemes through opt-in: %s', scheme => {
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); expect(allowsPlainHttp(new URL(`${scheme}//localhost/speech`))).toBe(false);
    });
    it('keeps HTTPS independent of opt-in and requires exactly 1 for remote HTTP', () => {
        expect(allowsPlainHttp(new URL('https://speech.example.test'))).toBe(true);
        for (const value of ['', 'true', 'yes', ' 1 ']) { vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', value); expect(allowsPlainHttp(new URL('http://speech.example.test'))).toBe(false); }
    });
});
