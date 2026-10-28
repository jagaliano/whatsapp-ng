/** Conservative assistant Markdown → WhatsApp text; never parses/fetches HTML or rewrites code bodies. */
export function formatWhatsAppText(text: string): string {
    if (text.length > 64 * 1024 || text.includes('\0')) return text;
    const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const output: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]; const body = line.replace(/\r?\n$/, ''); const end = line.slice(body.length);
        const fence = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(body);
        if (fence) {
            const marker = fence[1][0]; const width = fence[1].length; let closing = i + 1;
            for (; closing < lines.length; closing++) {
                const candidate = lines[closing].replace(/\r?\n$/, '');
                const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(candidate);
                if (match && match[1][0] === marker && match[1].length >= width) break;
            }
            // Unmatched fences protect the remainder, including literal Markdown.
            if (closing === lines.length) { output.push(...lines.slice(i)); break; }
            // A longer backtick fence may deliberately contain triple backticks.
            if (width !== 3 || !/^[ \t]*[a-zA-Z0-9_+.-]*[ \t]*$/.test(fence[2]) || lines.slice(i + 1, closing).some(code => code.includes('```'))) output.push(...lines.slice(i, closing + 1));
            else {
                output.push('```' + end, ...lines.slice(i + 1, closing));
                const last = lines[closing]; output.push('```' + (/\r\n$/.test(last) ? '\r\n' : last.endsWith('\n') ? '\n' : ''));
            }
            i = closing; continue;
        }
        // A cross-line/unfinished inline span is safer left wholly literal.
        if (unclosedCode(body)) return text;
        const heading = body.length <= 1024 ? /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(body) : null;
        const rendered = inline(heading?.[1] ?? body);
        output.push((heading && !rendered.includes('*') ? `*${rendered}*` : rendered) + end);
    }
    return output.join('');
}
function inline(text: string, depth = 0): string {
    if (depth >= 4) return text;
    const result: string[] = [];
    for (let i = 0; i < text.length;) {
        const rest = text.slice(i);
        if (text[i] === '\\' && i + 1 < text.length) { result.push(text.slice(i, i + 2)); i += 2; continue; }
        if (text[i] === '`') {
            const end = codeEnd(text, i);
            if (end < 0) { result.push(rest); break; }
            result.push(text.slice(i, end)); i = end; continue;
        }
        const url = /^https?:\/\/[^\s<>]+/i.exec(rest);
        if (url) { result.push(url[0]); i += url[0].length; continue; }
        if (text[i] === '[' && text[i - 1] !== '!') {
            const labelEnd = delimiter(text, '](', i + 1, Math.min(text.length, i + 513));
            if (labelEnd > i && labelEnd - i <= 512) {
                const end = text.indexOf(')', labelEnd + 2);
                if (end < 0) { result.push(rest); break; }
                const destination = text.slice(labelEnd + 2, end);
                // Nested parentheses/markup are deliberately left literal, not guessed.
                if (/^https?:\/\/[^\s()<>]+$/i.test(destination) && !text.slice(i + 1, labelEnd).includes('[')) {
                    result.push(inline(text.slice(i + 1, labelEnd), depth + 1) + ` (${destination})`); i = end + 1; continue;
                }
                result.push(text.slice(i, end + 1)); i = end + 1; continue;
            }
        }
        const unsupportedRun = /^([*_~])\1{2,}/.exec(rest);
        if (unsupportedRun) { result.push(unsupportedRun[0]); i += unsupportedRun[0].length; continue; }
        const marker = ['**', '__', '~~'].find(value => rest.startsWith(value));
        if (marker && (i === 0 || !/[\p{L}\p{N}_]/u.test(text[i - 1]))) {
            const end = delimiter(text, marker, i + 2); const content = end >= 0 ? text.slice(i + 2, end) : '';
            if (content && text[end - 1] !== '\\' && text[end + 2] !== marker[0] && !/^\s|\s$/.test(content) && (end + 2 === text.length || !/[\p{L}\p{N}_]/u.test(text[end + 2]))) {
                const native = marker === '~~' ? '~' : '*'; result.push(native + inline(content, depth + 1) + native); i = end + 2; continue;
            }
        }
        result.push(text[i]); i++;
    }
    return result.join('');
}
/** Exact-length backtick runs are opaque, including delimiter-looking content. */
function codeEnd(text: string, start: number): number {
    let opening = start; while (text[opening] === '`') opening++;
    for (let at = opening; at < text.length;) {
        at = text.indexOf('`', at); if (at < 0) return -1;
        let end = at; while (text[end] === '`') end++;
        if (end - at === opening - start) return end;
        at = end;
    }
    return -1;
}
function unclosedCode(text: string): boolean {
    for (let at = 0; at < text.length;) {
        if (text[at] === '\\') { at += 2; continue; }
        if (text[at] !== '`') { at++; continue; }
        const end = codeEnd(text, at); if (end < 0) return true; at = end;
    }
    return false;
}
function delimiter(text: string, marker: string, start: number, limit = text.length): number {
    for (let at = start; at < limit;) {
        if (text[at] === '\\') { at += 2; continue; }
        if (text[at] === '`') { const end = codeEnd(text, at); if (end < 0 || end > limit) return -1; at = end; continue; }
        const url = /^https?:\/\/[^\s<>]+/i.exec(text.slice(at));
        if (url) { at += url[0].length; continue; }
        if (text.startsWith(marker, at)) return at;
        at++;
    }
    return -1;
}
