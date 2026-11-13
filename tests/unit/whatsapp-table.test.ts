import { describe, expect, it } from 'vitest';
import { OutputBudget, isUnsafeCell } from '../../src/services/whatsapp-table.ts';
import { formatWhatsAppText as format } from '../../src/services/whatsapp-text.ts';

const legacy = (text: string): string => format(text, { tables: false });
// T044: a fixed '---' first line inside the block works around first-line misalignment on iPhone/WhatsApp Web.
const box = (lines: string[], end = '\n', last = ''): string => '```' + end + '---' + end + lines.map(line => line + end).join('') + '```' + last;
const AB = ['┌───┬───┐', '│ A │ B │', '├───┼───┤', '│ x │ y │', '└───┴───┘'];

describe('table foundations', () => {
    it.each(['a\tb', 'a\rb', 'a\u202Eb', '\u2066x', 'x\uD800', '\uDC00x', 'a```b', '\u0007'])('treats %j as unsafe', cell => {
        expect(isUnsafeCell(cell)).toBe(true);
    });
    it.each(['plain', 'café', '👋 日本語', 'a``b', ''])('treats %j as safe', cell => {
        expect(isUnsafeCell(cell)).toBe(false);
    });
    it('accepts output up to exactly 65,536 UTF-16 units', () => {
        const budget = new OutputBudget();
        expect(budget.fits(65_536)).toBe(true); expect(budget.fits(65_537)).toBe(false);
        expect(budget.add('x'.repeat(65_535))).toBe(true); expect(budget.fits(1)).toBe(true); expect(budget.fits(2)).toBe(false);
        expect(budget.add('yy')).toBe(false); expect(budget.used).toBe(65_535);
    });
});

describe('boxed tables', () => {
    it('renders the approved basic box golden example and is stable', () => {
        const input = '| Key | Value |\n|---|---:|\n| n | 42 |';
        const expected = box(['┌─────┬───────┐', '│ Key │ Value │', '├─────┼───────┤', '│ n   │    42 │', '└─────┴───────┘']);
        expect(format(input)).toBe(expected);
        expect(format(expected)).toBe(expected);
    });
    it('follows delimiter alignment with one padding space per side and odd centered spare on the right', () => {
        expect(format('| a | b | c | d |\n|---|:---|---:|:---:|\n| xx | xx | xx | xx |')).toBe(box([
            '┌────┬────┬────┬────┐', '│ a  │ b  │  c │ d  │', '├────┼────┼────┼────┤', '│ xx │ xx │ xx │ xx │', '└────┴────┴────┴────┘']));
        expect(format('| h | v |\n|:---:|---|\n| abcd | x |')).toBe(box(['┌──────┬───┐', '│  h   │ v │', '├──────┼───┤', '│ abcd │ x │', '└──────┴───┘']));
    });
    it('boxes a 28-column table and labels a 29-column one', () => {
        const fits = format('| aaaaaa | bbbbbb | cccccc |\n|---|---|---|\n| 1 | 2 | 3 |');
        const lines = fits.split('\n');
        expect(lines.slice(0, 2)).toEqual(['```', '---']); expect(lines.at(-1)).toBe('```');
        const frame = lines.slice(2, -1); expect(frame).toHaveLength(5);
        expect(frame.every(line => [...line].length === 28)).toBe(true);
        expect(format('| aaaaaaa | bbbbbb | cccccc |\n|---|---|---|\n| 1 | 2 | 3 |')).toBe('aaaaaaa: 1 · bbbbbb: 2 · cccccc: 3');
    });
    it('counts supported accents and attached combining marks, but not standalone marks', () => {
        expect(format('| café | e\u0301 |\n|---|---|\n| 1 | 2 |')).toBe(box(['┌──────┬───┐', '│ café │ e\u0301 │', '├──────┼───┤', '│ 1    │ 2 │', '└──────┴───┘']));
        expect(format('| \u0301 | b |\n|---|---|\n| 1 | 2 |')).toBe('\u0301: 1 · b: 2');
    });
    it('preserves CRLF, missing final newline and lone CR prose', () => {
        expect(format('| A | B |\r\n|---|---|\r\n| x | y |\r\n')).toBe(box(AB, '\r\n', '\r\n'));
        expect(format('| A | B |\r\n|---|---|\r\n| x | y |')).toBe(box(AB, '\r\n'));
        expect(format('a\rb\n\n| A | B |\n|---|---|\n| x | y |\n')).toBe('a\rb\n\n' + box(AB, '\n', '\n'));
    });
    it('splits cells at unescaped pipes before inline projection', () => {
        expect(format('| H | I |\n|---|---|\n| a\\|b | c |')).toBe(box(['┌─────┬───┐', '│ H   │ I │', '├─────┼───┤', '│ a|b │ c │', '└─────┴───┘']));
        const even = '| H | I |\n|---|---|\n| a\\\\|b | c |'; expect(format(even)).toBe(legacy(even));
        expect(format('| H | I |\n|---|---|\n| a\\\\\\|b | c |')).toContain('│ a\\\\|b │ c │');
        expect(format('| H | I |\n|---|---|\n| `a\\|b` | c |')).toContain('│ a|b │ c │');
        expect(format('| K | V |\n|---|---|\n| `` a`b `` | x |')).toContain('│  a`b  │ x │');
    });
    it('projects links, strong markers and opaque URLs only in supported shapes', () => {
        expect(format('| L | V |\n|---|---|\n| [a\\|b](https://example.test) | x |')).toBe('L: a|b (https://example.test) · V: x');
        expect(format('| U | V |\n|---|---|\n| https://example.test/**path** | x |')).toBe('U: https://example.test/**path** · V: x');
        expect(format('| A | B |\n|---|---|\n| **x** | __y__ |')).toBe(box(AB));
        expect(format('| A | B |\n|---|---|\n| ~~s~~ | *a* |')).toContain('│ ~~s~~ │ *a* │');
        const label511 = 'x'.repeat(511); const label512 = 'x'.repeat(512);
        expect(format(`| L | V |\n|---|---|\n| [${label511}](https://e.test) | 1 |`)).toBe(`L: ${label511} (https://e.test) · V: 1`);
        expect(format(`| L | V |\n|---|---|\n| [${label512}](https://e.test) | 1 |`)).toBe(`L: [${label512}](https://e.test) · V: 1`);
    });
    it('keeps images and HTML literal in cells while projecting the rest (FR-013)', () => {
        const image = format('| A | B |\n|---|---|\n| ![**x**](https://e) | 1 |');
        expect(image).toBe(box(['┌─────────────────────┬───┐', '│ A                   │ B │', '├─────────────────────┼───┤', '│ ![**x**](https://e) │ 1 │', '└─────────────────────┴───┘']));
        expect(format(image)).toBe(image);
        const html = format('| A | B |\n|---|---|\n| <b t="**x**">y</b> | 1 |');
        expect(html).toBe(box(['┌────────────────────┬───┐', '│ A                  │ B │', '├────────────────────┼───┤', '│ <b t="**x**">y</b> │ 1 │', '└────────────────────┴───┘']));
        expect(format('| A | B |\n|---|---|\n| ![i](https://e) **y** | <i>__z__ |')).toContain('│ ![i](https://e) y │ <i>z │');
        for (const cell of ['![**x**](https://e)', '<b t="**x**">y</b>']) {
            const wide = `| A | B | C | D | E |\n|---|---|---|---|---|\n| ${cell} | 2 | 3 | 4 | 5 |`; expect(format(wide)).toBe(legacy(wide));
        }
    });
    it('keeps long, unclosed and comment-like opaque constructs literal (FR-013)', () => {
        const long = `| A | B |\n|---|---|\n| ![${'a'.repeat(506)} **x**](https://e) | 1 |`;
        expect(format(long)).toBe(legacy(long)); // Labeled text would be unstable, so the run keeps today's projection.
        expect(format('| A | B |\n|---|---|\n| ![**x** | 1 |')).toContain('│ ![**x** │ 1 │');
        expect(format('| A | B |\n|---|---|\n| <!--**x**--> | **y** |')).toContain('│ <!--**x**--> │ y │');
        expect(format('| A | B |\n|---|---|\n| <!--**x** | **y** |')).toContain('│ <!--**x** │ y │');
        const link511 = `| L | V |\n|---|---|\n| [${'x'.repeat(511)}](https://e.test) | 1 |`; expect(format(link511)).toBe(`L: ${'x'.repeat(511)} (https://e.test) · V: 1`);
    });
    it('keeps complete image destinations literal, including parentheses (FR-013)', () => {
        const cell = (value: string): string => format(`| A | B |\n|---|---|\n| ${value} | 1 |`);
        for (const value of ['![x](https://e/(a)**b**)', '![x](https://e/((a))**b**)', '![x](https://e/\\)**b**)']) expect(cell(value), value).toBe(`A: ${value} · B: 1`);
        expect(cell('![x](https://e/(a)) **y**')).toBe('A: ![x](https://e/(a)) y · B: 1');
        for (const value of ['![x](https://e/(a**b**', '![x](https://e/((a)**b**']) {
            const input = `| A | B |\n|---|---|\n| ${value} | 1 |`; expect(format(input), value).toBe(legacy(input));
        }
    });
    it('finds image label ends past escaped and nested brackets (FR-013)', () => {
        for (const value of ['![a\\](b) **x**](https://e)', '![a [b](c) **x**](https://e)']) {
            const input = `| A | B |\n|---|---|\n| ${value} | 1 |`; expect(format(input), value).toBe(legacy(input));
        }
        for (const value of ['![a\\](b) **x**](h)', '![a [b](c) **x**](h)']) expect(format(`| A | B |\n|---|---|\n| ${value} | 1 |`), value).toContain(`│ ${value} │ 1 │`);
        expect(format('| A | B |\n|---|---|\n| ![`](`](h) **y** | 1 |')).toContain('│ ![`](`](h) y │ 1 │');
        const unclosed = '| A | B |\n|---|---|\n| ![`](h) **y** | 1 |'; expect(format(unclosed)).toBe(legacy(unclosed));
    });
    it('refuses ambiguous quoted image boundaries and keeps the whole legacy projection (FR-013)', () => {
        for (const [value, expected] of [['![x](h "t) **x**")', '| A | B |\n|---|---|\n| ![x](h "t) *x*") | 1 |'],
            ['![<b t="](h) **x**">](h)', '| A | B |\n|---|---|\n| ![<b t="](h) *x*">](h) | 1 |']]) {
            const input = `| A | B |\n|---|---|\n| ${value} | 1 |`;
            expect(format(input), value).toBe(expected); expect(format(input)).toBe(legacy(input));
        }
    });
    it('detects only conservative row candidates outside protected code', () => {
        expect(format('   | A | B |\n   |---|---|\n   | x | y |')).toBe(box(AB));
        for (const input of ['    | A | B |\n    |---|---|\n    | x | y |', '\t| A | B |\n|---|---|\n| x | y |', '> | A | B |\n|---|---|\n| x | y |',
            '- | A | B |\n|---|---|\n| x | y |', '1. | A | B |\n|---|---|\n| x | y |', '2) | A | B |\n|---|---|\n| x | y |', '* | A | B |\n|---|---|\n| x | y |',
            '+ | A | B |\n|---|---|\n| x | y |', '```\n| A | B |\n|---|---|\n| x | y |\n```', '```\n| A | B |\n|---|---|\n| x | y |', '| A | B | C |\n|---|---|\n| x | y |']) {
            expect(format(input), input).toBe(legacy(input));
        }
        expect(format('| Z |\n| A | B |\n|---|---|\n| x | y |')).toBe('| Z |\n' + box(AB));
    });
    it('treats pipe prose directly after a table as a row, but not after a blank line', () => {
        expect(format('| A | B |\n|---|---|\n| x | y |\nsee a | b')).toBe(box(['┌───────┬───┐', '│ A     │ B │', '├───────┼───┤', '│ x     │ y │', '│ see a │ b │', '└───────┴───┘']));
        expect(format('| A | B |\n|---|---|\n| x | y |\n\nsee a | b')).toBe(box(AB, '\n', '\n') + '\nsee a | b');
    });
});

describe('labeled table rows', () => {
    it('renders the approved emoji/CJK golden example', () => {
        expect(format('| A | B |\n|---|---|\n| 👋 | 日本語 |')).toBe('A: 👋 · B: 日本語');
    });
    it('labels five-column and unsupported-width tables and stays stable', () => {
        const five = format('| a | b | c | d | e |\n|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 |');
        expect(five).toBe('a: 1 · b: 2 · c: 3 · d: 4 · e: 5'); expect(format(five)).toBe(five);
        for (const value of ['❤', '❤️', '👨‍👩‍👧', '🇧🇷', '1️⃣', '日本']) expect(format(`| A | B |\n|---|---|\n| ${value} | x |`)).toBe(`A: ${value} · B: x`);
    });
    it('applies positional pair rules', () => {
        expect(format('|  | B |\n|---|---|\n| x | 1 👋 |')).toBe('x · B: 1 👋');
        expect(format('| A | B |\n|---|---|\n|  | 👋 |')).toBe('A: · B: 👋');
        expect(format('|  |  | C |\n|---|---|---|\n|  |  | 👋 |')).toBe(' ·  · C: 👋');
        expect(format('| A | A |\n|---|---|\n| 1 | 👋 |')).toBe('A: 1 · A: 👋');
        expect(format('| A | B | C |\n|---|---|---|\n| 👋 |')).toBe('A: 👋 · B: · C:');
        expect(format('| A | B |\r\n|---|---|\r\n| 👋 | 1 |\n| 2 | 👋 |\r\n| 3 | 4 |')).toBe('A: 👋 · B: 1\nA: 2 · B: 👋\r\nA: 3 · B: 4');
    });
    it('keeps today\'s projection when a labeled line would be unstable', () => {
        for (const input of ['| a | b | c | d | e |\n|---|---|---|---|---|\n| `**x**` | 2 | 3 | 4 | 5 |', '| a | b | c | d | e |\n|---|---|---|---|---|\n| **a | b** | 3 | 4 | 5 |',
            '| ~~~ | b |\n|---|---|\n| 👋 | 1 |']) expect(format(input), input).toBe(legacy(input));
    });
});

describe('table failure and limits', () => {
    it('keeps whole malformed runs on today\'s projection', () => {
        for (const input of ['| A | B |\n|---|---|', '| A | B |\n|---|---|\n| x | y |\n| C | D |\n|---|---|\n| z | w |', '| A | B |\n|---|---|\n| x | y | z |\n| p | q |',
            '# T\n| A | B | C |\n|---|---|---|\n| `a|b` | c |']) expect(format(input), input).toBe(legacy(input));
        expect(format('# T\n| A | B | C |\n|---|---|---|\n| `a|b` | c |').startsWith('*T*\n')).toBe(true);
        expect(format('| A | B |\n|---|---|\n| x | y |\n\n| A | B |\n|---|---|\n| x | y |')).toBe(box(AB, '\n', '\n') + '\n' + box(AB));
    });
    it('returns the original input for later unclosed inline code', () => {
        const input = '# T\n| A | B |\n|---|---|\n| x | y |\n\nprose `open'; expect(format(input)).toBe(input);
    });
    it.each(['a\tb', 'a\rb', '\u202Ex', '\u2066x', 'x\uD800', '```x```', '`` ``` ``'])('keeps today\'s projection for unsafe cell %j', cell => {
        const input = `# T\n| A | B |\n|---|---|\n| ${cell} | y |`; expect(format(input)).toBe(legacy(input));
    });
    it('allows exactly 65,536 output units and returns the original one unit later', () => {
        const table = '| ' + 'h'.repeat(40) + ' | 👋 |\r\n|---|---|\r\n' + '| v | w |\r\n'.repeat(500);
        const rendered = format(table).length; expect(rendered).toBeGreaterThan(table.length);
        const exact = table + '\n' + 'z'.repeat(65_536 - rendered - 1);
        expect(exact.length).toBeLessThanOrEqual(65_536); expect(format(exact).length).toBe(65_536); expect(format(exact)).not.toBe(exact);
        const over = exact + 'z'; expect(format(over)).toBe(over);
    });
    it('keeps the input guards distinct from the output guard', () => {
        const at = '**a** ' + 'x'.repeat(65_530); expect(at.length).toBe(65_536); expect(format(at)).toBe('*a* ' + 'x'.repeat(65_530));
        const above = at + 'x'; expect(format(above)).toBe(above);
        expect(format('\0| A | B |\n|---|---|\n| x | y |')).toBe('\0| A | B |\n|---|---|\n| x | y |');
    });
    it('counts the separator line in the box preflight', () => {
        const table = '| A | B |\n|---|---|\n| x | y |'; const rendered = format(table); expect(rendered.length).toBe(4 + 4 + 5 * 10 + 3);
        const fill = 'z'.repeat(65_536 - rendered.length - 1); expect(format(fill + '\n' + table)).toBe(fill + '\n' + rendered);
        const over = 'z' + fill + '\n' + table; expect(format(over)).toBe(over);
        expect(format('| A | B |\n|---|---|\n| 👋 | 1 |')).not.toContain('---');
        const crlf = format('| A | B |\r\n|---|---|\r\n| x | y |\r\n'); expect(crlf.length).toBe(5 + 5 + 5 * 11 + 5); expect(crlf.startsWith('```\r\n---\r\n┌')).toBe(true);
        const crlfFill = 'z'.repeat(65_536 - crlf.length - 1); const exact = crlfFill + '\n| A | B |\r\n|---|---|\r\n| x | y |\r\n';
        expect(format(exact).length).toBe(65_536); expect(format('z' + exact)).toBe('z' + exact);
        expect(format('```\n┌─┐\n```')).toBe('```\n┌─┐\n```');
    });
    it('refuses a repeated long header without building oversized output', () => {
        const input = '| ' + 'h'.repeat(5_000) + ' | b |\n|---|---|\n' + '| v | w |\n'.repeat(20); expect(format(input)).toBe(input);
    });
    it('keeps missing cells implicit for 10,000 columns and 5,000 short rows', () => {
        const input = '|' + 'a|'.repeat(10_000) + '\n|' + '-|'.repeat(10_000) + '\n' + '|x\n'.repeat(5_000);
        expect(input.length).toBeLessThanOrEqual(65_536); expect(format(input)).toBe(input);
    });
    it('never throws and is deterministic on malformed, mixed and surrogate-heavy input', () => {
        const inputs = ['\uD800|\uDC00\n|---|---|\n|\uDBFF|\uDFFF|', '|\r\n|---|\r|\n|a|', '| ` | ` |\n|---|---|\n| [ | ( |', '|'.repeat(60_000),
            ('| \uD83D | b |\n|:-:|-:|\n| x\\| | `y` |\r\n').repeat(1_000), '| a | b |\n|---|---|\n' + '| [x](https://e.test) | **y** |\n'.repeat(1_500), '```\n| a |\n' + '~~~\n'.repeat(100)];
        for (const input of inputs) {
            let first = ''; expect(() => { first = format(input); }).not.toThrow(); expect(format(input)).toBe(first);
        }
    });
});
