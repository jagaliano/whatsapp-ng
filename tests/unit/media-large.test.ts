import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIB } from '../../src/services/media-limits.ts';
import { hashFile, hashStream, syntheticPlaintext } from '../fixtures/large-media.ts';
import { measureInbound, measureOutbound, SC002_BUDGET } from '../fixtures/sc002.ts';

/**
 * Opt-in 512 MiB suite (T032). Run with WHATSAPP_NG_LARGE_MEDIA=1; needs ~2 GiB free temp disk.
 * Tier 2: real Baileys decrypt/encrypt with network mocked. Not covered: undici body and
 * https.request/socket buffering. Neither tier proves WhatsApp acceptance or recipient delivery.
 */
const MAX = 512 * MIB;
describe.skipIf(!process.env.WHATSAPP_NG_LARGE_MEDIA)('512 MiB transfers (opt-in)', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-large-')); });
    afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await rm(dir, { recursive: true, force: true }); });

    it('receives exactly 512 MiB byte-identically within the 16 MiB aggregate budget', async () => {
        const result = await measureInbound(MAX, MAX, dir);
        expect(result.outcome).toMatchObject({ status: 'stored', bytes: MAX });
        expect(result.peak).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.bigConcat).toBe(false);
        expect(result.output?.destroyed).toBe(true);
        expect((await hashFile(join(dir, 'out.bin'))).hash).toBe(await hashStream(syntheticPlaintext(11, MAX)));
        console.info(`[512 MiB inbound] measured=${result.measuredPeak} B + estimated=${result.inboundEstimate} B = ${result.peak} B backpressure=${result.peakBackpressure} B`);
    }, 900_000);

    it('refuses 512 MiB + 1 byte inbound', async () => {
        const result = await measureInbound(MAX + 1, MAX, dir);
        expect(result.outcome.status).toBe('oversize');
    }, 900_000);

    it('prepares and encrypts exactly 512 MiB byte-identically within the 16 MiB aggregate budget', async () => {
        const result = await measureOutbound(MAX, dir);
        expect(result.encryptPeakMeasured + result.encryptEstimate).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.uploadPeakMeasured).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.hash).toBe(await hashStream(syntheticPlaintext(23, MAX)));
        console.info(`[512 MiB outbound] snapshot=${result.snapshotStage} B; encrypt measured=${result.encryptPeakMeasured} B + estimated=${result.encryptEstimate} B; upload measured=${result.uploadPeakMeasured} B`);
    }, 900_000);
});
