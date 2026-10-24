import { deflateSync } from 'node:zlib';

function pdf(objects: Buffer[]): Buffer {
    const parts = [Buffer.from('%PDF-1.4\n')];
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(parts.reduce((size, part) => size + part.length, 0));
        parts.push(Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n'));
    }
    const xref = parts.reduce((size, part) => size + part.length, 0);
    parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
        + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
        + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    return Buffer.concat(parts);
}

function stream(dictionary: string, bytes: Buffer): Buffer {
    return Buffer.concat([
        Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`),
        bytes, Buffer.from('\nendstream')
    ]);
}

export function textPdf(text = 'Synthetic PDF preview'): Buffer {
    const literal = text.replace(/[\\()]/g, '\\$&');
    return pdf([
        Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
        Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
        Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'),
        Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
        stream('', Buffer.from(`BT /F1 20 Tf 40 700 Td (${literal}) Tj ET`))
    ]);
}

/** Raster-only HELLO WORLD: no embedded text layer, font file or private document. */
function scannedRaster() {
    const glyphs: Record<string, string[]> = {
        H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
        E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
        R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110']
    };
    const text = 'HELLO WORLD';
    const scale = 6;
    const width = text.length * 6 * scale + 40;
    const height = 7 * scale + 40;
    const pixels = Buffer.alloc(width * height, 255);
    for (const [index, letter] of [...text].entries()) {
        const glyph = glyphs[letter];
        if (!glyph) continue;
        for (const [row, line] of glyph.entries()) {
            for (const [column, pixel] of [...line].entries()) {
                if (pixel !== '1') continue;
                for (let y = 0; y < scale; y++) {
                    const start = (20 + row * scale + y) * width + 20 + index * 6 * scale + column * scale;
                    pixels.fill(0, start, start + scale);
                }
            }
        }
    }
    return { width, height, pixels };
}

/** PGM image containing the same raster-only text used by scannedPdf. */
export function scannedImage(): Buffer {
    const { width, height, pixels } = scannedRaster();
    return Buffer.concat([Buffer.from(`P5\n${width} ${height}\n255\n`), pixels]);
}

export function scannedPdf(): Buffer {
    const { width, height, pixels } = scannedRaster();
    return pdf([
        Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
        Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
        Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width + 40} ${height + 40}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
        stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(pixels)),
        stream('', Buffer.from(`q ${width} 0 0 ${height} 20 20 cm /Im0 Do Q`))
    ]);
}
