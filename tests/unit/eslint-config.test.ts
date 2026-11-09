import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const source = 'process.cwd(); Buffer.alloc(0); setTimeout(() => {}, 1); clearTimeout(0); console.log(globalThis);';

describe('fixture ESLint environment', () => {
    it('recognizes Node globals in fixture MJS without disabling undefined-name checks', async () => {
        const lint = new ESLint();
        const [valid] = await lint.lintText(source, { filePath: 'tests/fixtures/synthetic-globals.mjs' });
        expect(valid.messages).toEqual([]);
        const [invalid] = await lint.lintText('unknownFixtureGlobal();', { filePath: 'tests/fixtures/synthetic-globals.mjs' });
        expect(invalid.messages.map(message => message.ruleId)).toEqual(['no-undef']);
    });
    it('does not leak Node globals into unrelated JavaScript', async () => {
        const lint = new ESLint();
        const [result] = await lint.lintText('process.cwd();', { filePath: 'synthetic-browser.mjs' });
        expect(result.messages.map(message => message.ruleId)).toEqual(['no-undef']);
    });
});
