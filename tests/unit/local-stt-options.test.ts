import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { isSttLanguageSyntax, resolveLocalSttLanguage, resolveLocalSttOptions } from '../../src/services/local-stt-options.ts';

describe('local STT language syntax', () => {
    it.each(['auto', 'pt', 'pt-BR', 'yue', 'en-US', 'abc-12345678'])('accepts %s', value => {
        expect(isSttLanguageSyntax(value)).toBe(true);
    });

    it.each(['', ' ', '\t', '--foo', '-l', 'EN', 'en_US', 'english', 'a', 'abcd', 'en-', 'en-123456789'])('rejects %j', value => {
        expect(isSttLanguageSyntax(value)).toBe(false);
    });

    it.each([undefined, null, 1, {}, ['en']])('rejects non-string input %j', value => {
        expect(isSttLanguageSyntax(value)).toBe(false);
    });
});

describe('local STT option resolution', () => {
    it('resolves language aliases, saved preference and default in order', () => {
        expect(resolveLocalSttLanguage({ CRISPASR_LANGUAGE: ' pt ', WHISPER_LANGUAGE: 'es' }, 'fr')).toEqual({ language: 'pt', source: 'CRISPASR_LANGUAGE' });
        expect(resolveLocalSttLanguage({ CRISPASR_LANGUAGE: ' ', WHISPER_LANGUAGE: 'es' }, 'fr')).toEqual({ language: 'es', source: 'WHISPER_LANGUAGE' });
        expect(resolveLocalSttLanguage({}, 'fr')).toEqual({ language: 'fr', source: 'saved' });
        expect(resolveLocalSttLanguage({}, undefined)).toEqual({ language: 'auto', source: 'default' });
        expect(resolveLocalSttLanguage({}, '--invalid-saved')).toEqual({ language: 'auto', source: 'default' });
    });

    it('does not fall through from a winning invalid environment language', () => {
        expect(resolveLocalSttLanguage({ CRISPASR_LANGUAGE: '--invalid', WHISPER_LANGUAGE: 'es' }, 'fr'))
            .toEqual({ language: '--invalid', source: 'CRISPASR_LANGUAGE' });
        expect(resolveLocalSttLanguage({ WHISPER_LANGUAGE: 'not a language' }, 'fr'))
            .toEqual({ language: 'not a language', source: 'WHISPER_LANGUAGE' });
    });

    it('resolves model path and its winning source from the same environment', () => {
        expect(resolveLocalSttOptions({ CRISPASR_MODEL_PATH: ' ./crisp.bin ', WHISPER_MODEL_PATH: './whisper.bin' }, 'pt'))
            .toMatchObject({ language: 'pt', modelPath: resolve('crisp.bin'), modelSource: 'CRISPASR_MODEL_PATH' });
        expect(resolveLocalSttOptions({ CRISPASR_MODEL_PATH: ' ', WHISPER_MODEL_PATH: './whisper.bin' }))
            .toMatchObject({ modelPath: resolve('whisper.bin'), modelSource: 'WHISPER_MODEL_PATH' });
        expect(resolveLocalSttOptions({})).toMatchObject({ modelSource: 'default' });
        expect(resolveLocalSttOptions({}).modelPath).toContain('ggml-base.bin');
    });

    it('reads each environment value once and freezes the operation snapshot', () => {
        let reads = 0;
        const env = new Proxy({ CRISPASR_LANGUAGE: 'pt', CRISPASR_MODEL_PATH: './model.bin' }, {
            get(target, property: string) { reads++; return Reflect.get(target, property); }
        });
        const options = resolveLocalSttOptions(env);
        expect(options).toMatchObject({ language: 'pt', modelSource: 'CRISPASR_MODEL_PATH' });
        expect(reads).toBe(2);
        expect(Object.isFrozen(options)).toBe(true);
    });
});
