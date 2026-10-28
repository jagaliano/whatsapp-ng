import { describe, expect, it } from 'vitest';
import { cleanSpeechText, formatWhatsAppText } from '../../src/services/whatsapp-text.ts';

describe('plain speech projection', () => {
    it.each([
        ['He said "hello".', 'He said "hello".'],
        [String.raw`He said \"hello\".`, 'He said "hello".'],
        ['**Important** and *ready*.', 'Important and ready.'],
        ['__Bold__ and _italic_ with ~~old~~ and ~new~.', 'Bold and italic with old and new.'],
        ['***Very important*** and **very *important***.', 'Very important and very important.'],
        ['Use “*Voz*” and ‘_Mirror_’.', 'Use “Voz” and ‘Mirror’.'],
        ['# Update\n- **Ready**\n* Done\n+ Complete\n• Listo', 'Update\nReady\nDone\nComplete\nListo'],
        ['> "Hello."\n> **Ready.**', '"Hello."\nReady.'],
        ['Open `config.json` from `/whatsapp` with `--verbose`.', 'Open config.json from /whatsapp with --verbose.'],
        ['The label is `"hello"` or `` Voice settings ``.', 'The label is "hello" or Voice settings.'],
        ['The label is `' + String.raw`\"hello\"` + '`.', 'The label is "hello".'],
        ['See [**the guide**](https://example.test/setup).', 'See the guide.'],
        ['[Guide](https://example.test/setup)', 'Guide'],
        ['Use https://example.test/a_b and keep snake_case.', 'Use https://example.test/a_b and keep snake_case.'],
        ['The result is 2*3*4, or 2 * 3. C++ works.', 'The result is 2*3*4, or 2 * 3. C++ works.'],
        ['  **Listo**\r\n\r\n  Todo bien.  ', 'Listo\n\nTodo bien.'],
        ['Hello\n\n---\n\nWorld', 'Hello\n\nWorld'],
        ['**Sí**: café, mañana, ação, 日本語, 👋.', 'Sí: café, mañana, ação, 日本語, 👋.']
    ])('cleans %s without changing its words', (input, expected) => {
        expect(cleanSpeechText(input, { allowLinkLabels: true })).toBe(expected);
    });
    it('keeps a Markdown link intact unless a separate text copy is available', () => {
        const input = 'Read [the guide](https://example.test/setup).';
        expect(cleanSpeechText(input)).toBeUndefined();
        expect(cleanSpeechText(input, { allowLinkLabels: false })).toBeUndefined();
        expect(cleanSpeechText(input, { allowLinkLabels: true })).toBe('Read the guide.');
        // URL-shaped labels remain opaque; their addresses must not disappear during cleanup.
        const literal = 'Read [https://example.test/setup](https://example.test/setup).';
        expect(cleanSpeechText(literal)).toBe(literal);
    });
    it.each(['It takes ~5 minutes.', 'About ~50 MB.', '(~2 s)', '~5 to ~10 min'])('preserves ordinary approximate prose: %s', input => {
        expect(cleanSpeechText(input)).toBe(input);
    });
    it.each([
        'docker compose up -d', 'yarn install', 'pnpm test', 'ls -la', 'cd whatsapp-ng-release', 'make build',
        'chmod +x run.sh', 'pi install npm:whatsapp-ng', 'bun run test', 'cargo build', 'brew install tool', 'Docker compose up -d'
    ])('does not turn command-like inline text into a spoken label: %s', command => {
        expect(cleanSpeechText('Run `' + command + '` in the project folder.')).toBeUndefined();
        expect(cleanSpeechText('Run `' + command + '`.', { allowLinkLabels: true })).toBeUndefined();
    });
    it('retains short words and human labels after tightening command-like snippets', () => {
        expect(cleanSpeechText('Use `config.json`, `/whatsapp`, `--verbose`, `Voice settings` and `Voice + text`.'))
            .toBe('Use config.json, /whatsapp, --verbose, Voice settings and Voice + text.');
    });
    it('does not run the heading regex on candidates longer than 1024 characters', () => {
        const heading = '# ' + 'a'.repeat(1023);
        expect(cleanSpeechText(heading)).toBe(heading);
        expect(cleanSpeechText('# ' + 'a'.repeat(1022))).toBe('a'.repeat(1022));
    });
    it.each([
        '```ts\nconst a = 1;\n```', '~~~sh\ngit status\n~~~', '> ~~~\n> code\n> ~~~', '- ```\ncode\n```',
        '    const a = 1;', 'const a = 1;', 'const a = 1;\nconst b = 2;\nreturn a + b;',
        'git status', 'npm install', '$ echo hello', 'Run `git status`.', 'Use `const a = 1`.',
        'Match `**/*.ts`.', 'Use `/usr/bin/ffmpeg`.', 'Unclosed `label', '**unclosed',
        '| Key | Value |\n| --- | --- |\n| n | 42 |', '{"answer":42}', '[1, 2, 3]',
        '[bad](javascript:alert(1))', '![image](https://example.test/image.png)', '', '   ', '*', '**', '_', '~~', '***', '\u0000unsafe'
    ])('retains unsupported/code content as text: %s', input => {
        expect(cleanSpeechText(input)).toBeUndefined();
    });
    it('bounds input and inline labels without silently truncating content', () => {
        expect(cleanSpeechText('a'.repeat(65_537))).toBeUndefined();
        expect(cleanSpeechText('`' + 'a'.repeat(81) + '`')).toBeUndefined();
    });
});

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
