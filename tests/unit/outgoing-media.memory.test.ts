import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIB } from '../../src/services/media-limits.ts';
import { hashStream, syntheticPlaintext } from '../fixtures/large-media.ts';
import { measureOutbound, SC002_BUDGET } from '../fixtures/sc002.ts';

describe('SC-002 outbound transfer-phase accounting (Tier 2: real Baileys encryption, upload mocked)', () => {
    let dir: string;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-out-mem-')); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(dir, { recursive: true, force: true }); });

    it('stays within 16 MiB aggregate for a 64 MiB document and preserves bytes through encryption', async () => {
        const size = 64 * MIB + 3;
        const result = await measureOutbound(size, dir);
        expect(result.largestAlloc).toBeLessThanOrEqual(64 * 1024);
        expect(result.encryptPeakMeasured + result.encryptEstimate).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.uploadPeakMeasured).toBeLessThanOrEqual(SC002_BUDGET);
        expect(result.hash).toBe(await hashStream(syntheticPlaintext(23, size)));
        console.info(`[SC-002 outbound] snapshot-stage app allocations=${result.snapshotStage} B; encrypt-stage measured queues peak=${result.encryptPeakMeasured} B (+ estimated ${result.encryptEstimate} B, ${result.samples} samples); mock-upload measured peak=${result.uploadPeakMeasured} B; uncovered: https.request/socket buffering`);
    }, 180_000);
});
