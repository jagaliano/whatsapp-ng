import { describe, expect, it } from 'vitest';
import { formatWhatsAppText } from '../../src/services/whatsapp-text.ts';

describe('conservative assistant WhatsApp text adapter', () => {
    it('maps balanced Markdown headings, bold, strike and links without losing destinations', () => {
        expect(formatWhatsAppText('# Result\n**Done** and ~~old~~. [Docs](https://example.test/a_b)'))
            .toBe('*Result*\n*Done* and ~old~. Docs (https://example.test/a_b)');
    });
    it('preserves code bodies, inline code, URLs and existing WhatsApp formatting', () => {
        const code = '```ts\nconst x = "**literal**";\n// [not a link](https://example.test)\n```';
        expect(formatWhatsAppText(code)).toBe('```\nconst x = "**literal**";\n// [not a link](https://example.test)\n```');
        const line = '`**literal**` https://example.test/**path** *native* _italic_ 2*3*4';
        expect(formatWhatsAppText(line)).toBe(line);
    });
    it('keeps malformed markup, unmatched code and unsupported tables readable', () => {
        expect(formatWhatsAppText('**unclosed\n```js\n**do not touch**')).toBe('**unclosed\n```js\n**do not touch**');
        expect(formatWhatsAppText('| A | B |\n|---|---|\n| x | y |')).toBe('| A | B |\n|---|---|\n| x | y |');
        expect(formatWhatsAppText('[bad](javascript:alert(1))')).toBe('[bad](javascript:alert(1))');
    });
    it('preserves Unicode, CRLF and nested readable emphasis', () => {
        expect(formatWhatsAppText('## Hola 👋\r\n**yes ~~old~~**\r\n')).toBe('*Hola 👋*\r\n*yes ~old~*\r\n');
    });
    it('does not consume emphasis or link delimiters from code spans or URLs', () => {
        expect(formatWhatsAppText('**Files matching `**/*.ts`:**')).toBe('*Files matching `**/*.ts`:*');
        expect(formatWhatsAppText('~~Use `~~literal` safely~~')).toBe('~Use `~~literal` safely~');
        expect(formatWhatsAppText('[Use `](` literally](https://example.test)')).toBe('Use `](` literally (https://example.test)');
        expect(formatWhatsAppText('**Open https://example.test/**/a**')).toBe('**Open https://example.test/**/a**');
        expect(formatWhatsAppText('Inline `first\n**literal**\nlast` tail')).toBe('Inline `first\n**literal**\nlast` tail');
        expect(formatWhatsAppText('`first `` **literal** last`')).toBe('`first `` **literal** last`');
    });
    it('leaves oversized heading candidates literal and bounds unmatched link searches', () => {
        const heading = '# a' + ' '.repeat(60_000) + 'b'; expect(formatWhatsAppText(heading)).toBe(heading);
        const brackets = '['.repeat(4000); expect(formatWhatsAppText(brackets)).toBe(brackets);
    });
    it('does not run an unbounded parser over oversized output or reinterpret sentinel bytes', () => {
        const long = '**'+ 'x'.repeat(70_000)+'**'; expect(formatWhatsAppText(long)).toBe(long);
        expect(formatWhatsAppText('\u0000**literal**')).toBe('\u0000**literal**');
    });
});
