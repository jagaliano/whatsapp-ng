/** Conservative Markdown pipe-table rendering for WhatsApp text messages (feature 046). Pure and synchronous. */

/** Existing display-projection rules reused without modification. */
export interface LegacyTextRules {
    projectLine(body: string): string;
    unclosedCode(text: string): boolean;
    codeEnd(text: string, start: number): number;
    delimiter(text: string, marker: string, start: number, limit?: number): number;
    isFenceOpener(body: string): boolean;
}

export interface SourceLine { readonly body: string; readonly end: string }
type Alignment = 'left' | 'right' | 'center';
interface Cell { readonly display: string; readonly width: number | 'unsupported' }
interface TableCandidate {
    readonly header: readonly Cell[];
    readonly alignments: readonly Alignment[];
    /** Present cells only; missing trailing cells are implicit empty values and are never materialized. */
    readonly body: readonly (readonly Cell[])[];
}
/** box/labeled carry the accepted segment; legacy means per-line projection; refuse means return the original input. */
export type TableOutcome = { kind: 'box' | 'labeled'; text: string } | { kind: 'legacy' } | { kind: 'refuse' };

export const OUTPUT_LIMIT = 65_536;

export class OutputBudget {
    private total = 0;
    constructor(private readonly limit = OUTPUT_LIMIT) {}
    get used(): number { return this.total; }
    get remaining(): number { return this.limit - this.total; }
    fits(length: number): boolean { return this.total + length <= this.limit; }
    add(segment: string): boolean {
        if (!this.fits(segment.length)) return false;
        this.total += segment.length; return true;
    }
}

const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
/** Cc controls, Bidi_Control, unpaired surrogates and three consecutive U+0060 make a cell unsafe. */
export function isUnsafeCell(cell: string): boolean {
    return /[\p{Cc}\p{Bidi_Control}]/u.test(cell) || cell.includes('\u0060\u0060\u0060') || loneSurrogate.test(cell);
}

const BOX_WIDTH = 28;
const SEPARATOR = ' · ';
/** T044: fixed first line inside the box block; iPhone and WhatsApp Web misalign a first line of box characters. */
const BOX_LEAD = '---';

export class MarkdownTableProjector {
    constructor(private readonly rules: LegacyTextRules) {}

    isRowCandidate(body: string): boolean {
        const indent = /^ {0,3}/.exec(body)![0].length; const rest = body.slice(indent);
        if (!rest.trim() || rest[0] === '\t' || rest[0] === ' ' || !this.hasUnescapedPipe(rest)) return false;
        return !/^(?:>|#|`{3,}|~{3,}|[-+*][ \t]|[0-9]{1,9}[.)][ \t])/.test(rest);
    }

    /** Cells of a row candidate, or undefined when the row is not a delimiter row. */
    delimiterCells(body: string): string[] | undefined {
        const cells = this.split(body);
        return cells.length >= 2 && cells.every(cell => /^:?-+:?$/.test(cell)) ? cells : undefined;
    }

    split(body: string): string[] {
        let row = body.replace(/^[ \t]+|[ \t]+$/g, '');
        if (row.startsWith('|')) row = row.slice(1);
        if (row.endsWith('|') && this.backslashesBefore(row, row.length - 1) % 2 === 0) row = row.slice(0, -1);
        const cells: string[] = []; let current = '';
        for (let at = 0; at < row.length; at++) {
            if (row[at] !== '|') { current += row[at]; continue; }
            if (this.backslashesBefore(row, at) % 2 === 0) { cells.push(current); current = ''; } else current = current.slice(0, -1) + '|';
        }
        cells.push(current);
        return cells.map(cell => cell.replace(/^[ \t]+|[ \t]+$/g, ''));
    }

    /** Evaluates a complete run (header, delimiter, body rows) against the remaining output budget. */
    render(run: readonly SourceLine[], remaining: number): TableOutcome {
        const candidate = this.parse(run);
        if (!candidate) return { kind: 'legacy' };
        const columns = candidate.header.length;
        const widths = this.columnWidths(candidate);
        if (widths && columns >= 2 && columns <= 4) {
            const rowWidth = widths.reduce((sum, width) => sum + width + 2, 0) + columns + 1;
            if (rowWidth <= BOX_WIDTH) {
                const size = this.boxSize(candidate, rowWidth, run[0].end, run[run.length - 1].end);
                if (size > remaining) return { kind: 'refuse' };
                return { kind: 'box', text: this.box(candidate, widths, run[0].end, run[run.length - 1].end) };
            }
        }
        const size = this.labeledSize(candidate, run);
        if (size > remaining) return { kind: 'refuse' };
        const lines = candidate.body.map(row => this.labeledLine(candidate.header, row));
        // Each line joins >= 2 pairs, so it contains ' · ' and can never be a delimiter row.
        if (lines.some(line => this.rules.projectLine(line) !== line || this.rules.unclosedCode(line) || this.rules.isFenceOpener(line))) return { kind: 'legacy' };
        return { kind: 'labeled', text: lines.map((line, index) => line + run[index + 2].end).join('') };
    }

    private parse(run: readonly SourceLine[]): TableCandidate | undefined {
        if (run.length < 3) return undefined;
        const headerRaw = this.split(run[0].body); const delimiter = this.delimiterCells(run[1].body);
        if (!delimiter || delimiter.length !== headerRaw.length) return undefined;
        const header = this.cells(headerRaw); if (!header) return undefined;
        const body: Cell[][] = [];
        for (const line of run.slice(2)) {
            if (this.delimiterCells(line.body)) return undefined;
            const raw = this.split(line.body); if (raw.length > header.length) return undefined;
            const cells = this.cells(raw); if (!cells) return undefined;
            body.push(cells);
        }
        const alignments = delimiter.map((cell): Alignment => cell.startsWith(':') && cell.endsWith(':') && cell.length > 1 ? 'center' : cell.endsWith(':') ? 'right' : 'left');
        return { header, alignments, body };
    }

    private cells(raw: readonly string[]): Cell[] | undefined {
        const cells: Cell[] = [];
        for (const value of raw) {
            if (this.rules.unclosedCode(value) || isUnsafeCell(value)) return undefined;
            const display = this.project(value);
            if (display === undefined || isUnsafeCell(display)) return undefined;
            cells.push({ display, width: displayWidth(display) });
        }
        return cells;
    }

    /** Mirrors legacy inline recognition, but removes code/strong delimiters instead of re-emitting them. */
    /** Undefined means an opaque construct has no safe boundary; the candidate then keeps legacy projection. */
    private project(text: string, depth = 0): string | undefined {
        if (depth >= 4) return text;
        const result: string[] = [];
        for (let i = 0; i < text.length;) {
            const rest = text.slice(i);
            if (text[i] === '\\' && i + 1 < text.length) { result.push(text.slice(i, i + 2)); i += 2; continue; }
            if (text[i] === '`') {
                const end = this.rules.codeEnd(text, i);
                if (end < 0) { result.push(rest); break; }
                let run = i; while (text[run] === '`') run++;
                result.push(text.slice(run, end - (run - i))); i = end; continue;
            }
            const url = /^https?:\/\/[^\s<>]+/i.exec(rest);
            if (url) { result.push(url[0]); i += url[0].length; continue; }
            // FR-013: images, HTML comments and tags stay literal. Each opener jumps forward to its closer
            // (single indexOf/scan from the current position), or copies the rest of the cell when unclosed.
            if (text[i] === '!' && text[i + 1] === '[') {
                const label = imageLabelEnd(text, i + 2, this.rules);
                if (label === -2) return undefined;
                if (label < 0) { result.push(rest); break; }
                // Undeterminable destination boundary: refuse the cell so the candidate keeps legacy projection.
                const end = destinationEnd(text, label + 2); if (end < 0) return undefined;
                // Titles and HTML can hide a false boundary; refuse quoted/tagged images rather than parse them.
                if (/["'<]/.test(text.slice(i, end))) return undefined;
                result.push(text.slice(i, end)); i = end; continue;
            }
            if (rest.startsWith('<!--')) {
                const end = text.indexOf('-->', i + 4);
                if (end < 0) { result.push(rest); break; }
                result.push(text.slice(i, end + 3)); i = end + 3; continue;
            }
            if (text[i] === '<' && /^<\/?[A-Za-z]/.test(rest)) {
                const end = htmlTagEnd(text, i);
                if (end < 0) { result.push(rest); break; }
                result.push(text.slice(i, end)); i = end; continue;
            }
            if (text[i] === '[' && text[i - 1] !== '!') {
                const labelEnd = this.rules.delimiter(text, '](', i + 1, Math.min(text.length, i + 513));
                if (labelEnd > i && labelEnd - i <= 512) {
                    const end = text.indexOf(')', labelEnd + 2);
                    if (end < 0) { result.push(rest); break; }
                    const destination = text.slice(labelEnd + 2, end);
                    if (/^https?:\/\/[^\s()<>]+$/i.test(destination) && !text.slice(i + 1, labelEnd).includes('[')) {
                        const label = this.project(text.slice(i + 1, labelEnd), depth + 1); if (label === undefined) return undefined;
                        result.push(label + ` (${destination})`); i = end + 1; continue;
                    }
                    result.push(text.slice(i, end + 1)); i = end + 1; continue;
                }
            }
            const unsupportedRun = /^([*_~])\1{2,}/.exec(rest);
            if (unsupportedRun) { result.push(unsupportedRun[0]); i += unsupportedRun[0].length; continue; }
            const marker = ['**', '__'].find(value => rest.startsWith(value));
            if (marker && (i === 0 || !/[\p{L}\p{N}_]/u.test(text[i - 1]))) {
                const end = this.rules.delimiter(text, marker, i + 2); const content = end >= 0 ? text.slice(i + 2, end) : '';
                if (content && text[end - 1] !== '\\' && text[end + 2] !== marker[0] && !/^\s|\s$/.test(content) && (end + 2 === text.length || !/[\p{L}\p{N}_]/u.test(text[end + 2]))) {
                    const inner = this.project(content, depth + 1); if (inner === undefined) return undefined;
                    result.push(inner); i = end + 2; continue;
                }
            }
            if (rest.startsWith('~~')) { result.push('~~'); i += 2; continue; }
            result.push(text[i]); i++;
        }
        return result.join('');
    }

    private columnWidths(candidate: TableCandidate): number[] | undefined {
        const widths: number[] = [];
        for (const [index, cell] of candidate.header.entries()) { if (cell.width === 'unsupported') return undefined; widths[index] = cell.width; }
        for (const row of candidate.body) for (const [index, cell] of row.entries()) {
            if (cell.width === 'unsupported') return undefined;
            widths[index] = Math.max(widths[index], cell.width);
        }
        return widths;
    }

    private boxSize(candidate: TableCandidate, rowWidth: number, end: string, last: string): number {
        const extra = (row: readonly Cell[]): number => row.reduce((sum, cell) => sum + cell.display.length - (cell.width as number), 0);
        const contentRows = [candidate.header, ...candidate.body];
        return 3 + end.length + BOX_LEAD.length + end.length + 3 * (rowWidth + end.length) + contentRows.reduce((sum, row) => sum + rowWidth + extra(row) + end.length, 0) + 3 + last.length;
    }

    private box(candidate: TableCandidate, widths: readonly number[], end: string, last: string): string {
        const border = (left: string, middle: string, right: string): string => left + widths.map(width => '─'.repeat(width + 2)).join(middle) + right;
        const row = (cells: readonly Cell[]): string => '│' + widths.map((width, index) => ` ${this.align(cells[index], width, candidate.alignments[index])} `).join('│') + '│';
        const lines = [border('┌', '┬', '┐'), row(candidate.header), border('├', '┼', '┤'), ...candidate.body.map(row), border('└', '┴', '┘')];
        return '```' + end + BOX_LEAD + end + lines.map(line => line + end).join('') + '```' + last;
    }

    private align(cell: Cell | undefined, width: number, alignment: Alignment): string {
        const text = cell?.display ?? ''; const spare = width - ((cell?.width as number | undefined) ?? 0);
        if (alignment === 'right') return ' '.repeat(spare) + text;
        if (alignment === 'center') { const left = Math.floor(spare / 2); return ' '.repeat(left) + text + ' '.repeat(spare - left); }
        return text + ' '.repeat(spare);
    }

    /** Arithmetic size of all labeled lines, computed before any joined line exists. */
    private labeledSize(candidate: TableCandidate, run: readonly SourceLine[]): number {
        const header = candidate.header.map(cell => cell.display);
        const empty = (label: string): number => label ? label.length + 1 : 0;
        const base = header.reduce((sum, label) => sum + empty(label), 0) + SEPARATOR.length * (header.length - 1);
        return candidate.body.reduce((sum, row, index) => sum + base + run[index + 2].end.length
            + row.reduce((delta, cell, column) => delta + (cell.display ? (header[column] ? 1 : 0) + cell.display.length : 0), 0), 0);
    }

    private labeledLine(header: readonly Cell[], row: readonly Cell[]): string {
        return header.map((label, column) => {
            const value = row[column]?.display ?? '';
            if (!label.display) return value;
            return value ? `${label.display}: ${value}` : `${label.display}:`;
        }).join(SEPARATOR);
    }

    private hasUnescapedPipe(text: string): boolean {
        for (let at = text.indexOf('|'); at >= 0; at = text.indexOf('|', at + 1)) if (this.backslashesBefore(text, at) % 2 === 0) return true;
        return false;
    }

    private backslashesBefore(text: string, at: number): number {
        let count = 0; while (at - count - 1 >= 0 && text[at - count - 1] === '\\') count++;
        return count;
    }
}

/**
 * Index of the ']' that closes an image label and is followed by '(' (skips backslash escapes and code spans, counts nested
 * brackets). -1: no closing bracket, so the rest is literal. -2: ambiguous (unclosed code, or an unnested ']' not followed
 * by '('), so the candidate keeps legacy projection. One forward scan.
 */
function imageLabelEnd(text: string, start: number, rules: LegacyTextRules): number {
    let depth = 0;
    for (let at = start; at < text.length; at++) {
        const char = text[at];
        if (char === '\\') { at++; continue; }
        if (char === '`') { const end = rules.codeEnd(text, at); if (end < 0) return -2; at = end - 1; continue; }
        if (char === '[') depth++;
        else if (char === ']') {
            if (depth > 0) { depth--; continue; }
            return text[at + 1] === '(' ? at : -2;
        }
    }
    return -1;
}

/** Index after the ')' closing an image destination, counting balanced parentheses and skipping backslash escapes; -1 if unclosed. One linear scan. */
function destinationEnd(text: string, start: number): number {
    let depth = 0;
    for (let at = start; at < text.length; at++) {
        const char = text[at];
        if (char === '\\') { at++; continue; }
        if (char === '(') depth++;
        else if (char === ')') { if (depth === 0) return at + 1; depth--; }
    }
    return -1;
}

/** End index after a tag's closing '>' (quotes respected), or -1 when the tag never closes. One linear scan. */
function htmlTagEnd(text: string, start: number): number {
    let quote = '';
    for (let at = start + 1; at < text.length; at++) {
        const char = text[at];
        if (quote) { if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === '>') return at + 1;
    }
    return -1;
}

function isSupportedBase(code: number): boolean {
    return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0x24f && code !== 0xad) || (code >= 0x370 && code <= 0x3ff)
        || (code >= 0x400 && code <= 0x4ff) || (code >= 0x2010 && code <= 0x2027) || (code >= 0x2030 && code <= 0x205e && code !== 0x203c && code !== 0x2049)
        || (code >= 0x20a0 && code <= 0x20c0);
}

/** Fixed conservative width: supported bases count 1, attached U+0300–036F marks 0; anything else is unsupported. */
function displayWidth(text: string): number | 'unsupported' {
    let width = 0; let attached = false;
    for (const char of text) {
        const code = char.codePointAt(0)!;
        if (/\p{M}/u.test(char)) {
            if (!attached || code < 0x300 || code > 0x36f) return 'unsupported';
            continue;
        }
        if (!isSupportedBase(code)) return 'unsupported';
        width++; attached = true;
    }
    return width;
}
