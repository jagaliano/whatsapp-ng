import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIB } from '../../src/services/media-limits.ts';
import { hashFile, hashStream, syntheticPlaintext } from '../fixtures/large-media.ts';
import { measureInbound, SC002_BUDGET } from '../fixtures/sc002.ts';

describe('SC-002 inbound transfer-phase accounting (Tier 2: real Baileys decrypt, network mocked)', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-inbound-mem-')); });
    afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await rm(dir, { recursive: true, force: true }); });

    it('stays within 16 MiB aggregate for 64 MiB, stores identical bytes and releases streams before returning', async () => {
        const size = 64 * MIB + 5;
        const result = await measureInbound(size, 512 * MIB, dir);
        expect(result.outcome).toMatchObject({ status: 'stored', bytes: size });
        expect(result.peak).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.peakBackpressure).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.largestChunk).toBeLessThan(MIB);
        expect(result.bigConcat).toBe(false);
        expect(result.output?.destroyed).toBe(true);
        expect(result.web?.destroyed).toBe(true);
        expect((await hashFile(join(dir, 'out.bin'))).hash).toBe(await hashStream(syntheticPlaintext(11, size)));
        console.info(`[SC-002 inbound] measured peak=${result.measuredPeak} B + estimated ${result.inboundEstimate} B = ${result.peak} B, peak pulled−written=${result.peakBackpressure} B; uncovered: undici body buffering`);
    }, 120_000);

    it('stops pulling soon after the limit and destroys the decrypt stream on refusal', async () => {
        const result = await measureInbound(8 * MIB, 2 * MIB, dir);
        expect(result.outcome.status).toBe('oversize');
        expect(result.output?.destroyed).toBe(true);
        expect(result.stats.pulled).toBeLessThan(2 * MIB + SC002_BUDGET);
    }, 60_000);
});
