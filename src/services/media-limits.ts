/** Per-direction non-audio transfer limits; audio and processing budgets are fixed elsewhere. */
export const MIB = 1_048_576;
export const DEFAULT_MEDIA_LIMIT_MIB = 25;
export const MAX_MEDIA_LIMIT_MIB = 512;
export const PROCESSING_CEILING_BYTES = 25 * MIB;
export const AUDIO_TRANSFER_MAX_BYTES = 25 * MIB;

export type MediaDirection = 'inbound' | 'outbound';
export interface MediaLimits { inboundBytes: number; outboundBytes: number }

const validMiB = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_MEDIA_LIMIT_MIB;

/** Absent object/fields use 25 MiB; any present non-conforming value is malformed and throws. */
export function validateMediaLimits(raw: unknown): MediaLimits {
    if (raw === undefined) return { inboundBytes: DEFAULT_MEDIA_LIMIT_MIB * MIB, outboundBytes: DEFAULT_MEDIA_LIMIT_MIB * MIB };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid saved media limits');
    const record = raw as Record<string, unknown>;
    if (Object.keys(record).some(key => key !== 'inboundMiB' && key !== 'outboundMiB')) throw new Error('Invalid saved media limits');
    const pick = (value: unknown): number => {
        if (value === undefined) return DEFAULT_MEDIA_LIMIT_MIB;
        if (!validMiB(value)) throw new Error('Invalid saved media limits');
        return value;
    };
    return { inboundBytes: pick(record.inboundMiB) * MIB, outboundBytes: pick(record.outboundMiB) * MIB };
}

/** Whole MiB from 1 through 512, digits only, no sign, suffix, padding or leading zero. */
export function parseMediaLimitInput(text: string): number | undefined {
    if (!/^[1-9][0-9]{0,2}$/.test(text)) return undefined;
    const value = Number(text);
    return value <= MAX_MEDIA_LIMIT_MIB ? value : undefined;
}

export function formatMiB(bytes: number): string {
    return `${(bytes / MIB).toFixed(1)} MiB`;
}
