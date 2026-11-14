import { describe, expect, it } from 'vitest';
import { MIB, parseMediaLimitInput, validateMediaLimits } from '../../src/services/media-limits.ts';

describe('media limits', () => {
    it('defaults absent object and fields to 25 MiB independently', () => {
        expect(validateMediaLimits(undefined)).toEqual({ inboundBytes: 25 * MIB, outboundBytes: 25 * MIB });
        expect(validateMediaLimits({})).toEqual({ inboundBytes: 25 * MIB, outboundBytes: 25 * MIB });
        expect(validateMediaLimits({ inboundMiB: 512 })).toEqual({ inboundBytes: 512 * MIB, outboundBytes: 25 * MIB });
        expect(validateMediaLimits({ inboundMiB: 1, outboundMiB: 100 })).toEqual({ inboundBytes: MIB, outboundBytes: 100 * MIB });
    });
    it.each([null, [], 'x', 5, { inboundMiB: 0 }, { inboundMiB: 513 }, { outboundMiB: 1.5 }, { inboundMiB: '25' },
        { inboundMiB: null }, { outboundMiB: [] }, { extra: 1 }])('rejects malformed %j', raw => {
        expect(() => validateMediaLimits(raw)).toThrow('Invalid saved media limits');
    });
    it.each([['1', 1], ['25', 25], ['512', 512]])('accepts %s', (text, value) => expect(parseMediaLimitInput(text)).toBe(value));
    it.each(['0', '513', '1.5', '+5', '25MiB', ' 25', '025', '', '-1', '1e2', '1000'])('rejects input %j', text => {
        expect(parseMediaLimitInput(text)).toBeUndefined();
    });
});
