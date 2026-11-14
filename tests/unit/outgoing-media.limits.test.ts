import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { OutgoingMediaService } from '../../src/services/outgoing-media.service.ts';
import { MIB } from '../../src/services/media-limits.ts';
import { TTS_MAX_AUDIO_BYTES } from '../../src/services/tts-config.ts';
import { t } from '../../src/i18n.ts';

/** Sparse file of exact size; content beyond the header is zeros. */
async function sparse(path: string, size: number, header = Buffer.from('%PDF-1.4\n')): Promise<void> {
    const file = await open(path, 'wx', 0o600);
    try { await file.write(header, 0, header.length, 0); await file.truncate(size); } finally { await file.close(); }
}
type Copy = (...args: unknown[]) => Promise<number>;
/** Records the owned snapshot directory so cleanup is asserted on that exact path. */
function trackSnapshot(service: OutgoingMediaService, replacement?: Copy): { dir: () => string } {
    let dir = '';
    const target = service as unknown as { copySnapshot: Copy };
    const original = target.copySnapshot.bind(service);
    vi.spyOn(target, 'copySnapshot').mockImplementation(async (...args: unknown[]) => { dir = dirname(args[1] as string); return (replacement ?? original)(...args); });
    return { dir: () => dir };
}

describe('OutgoingMediaService configurable limits', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-out-limits-')); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });

    it.each([1, 25, 512])('accepts exactly %i MiB documents and refuses one byte more', async mib => {
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: mib * MIB });
        await sparse(join(root, 'ok.pdf'), mib * MIB);
        const prepared = await service.prepare({ path: join(root, 'ok.pdf'), type: 'document' });
        expect(prepared.metadata.size).toBe(mib * MIB);
        await prepared.dispose();
        await sparse(join(root, 'over.pdf'), mib * MIB + 1);
        await expect(service.prepare({ path: join(root, 'over.pdf'), type: 'document' })).rejects.toThrow(`${mib} MiB`);
    }, 120_000);

    it('keeps explicit audio at 25 MiB even when the outbound limit is 512 MiB', async () => {
        const header = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]);
        await sparse(join(root, 'big.ogg'), 25 * MIB + 1, header);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB });
        await expect(service.prepare({ path: join(root, 'big.ogg'), type: 'audio' })).rejects.toThrow('25 MiB');
    });

    it('keeps the generated-speech 8 MiB budget when supplied', async () => {
        const header = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]);
        await sparse(join(root, 'tts.ogg'), TTS_MAX_AUDIO_BYTES + 1, header);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: TTS_MAX_AUDIO_BYTES });
        await expect(service.prepare({ path: join(root, 'tts.ogg'), type: 'audio', voiceNote: true })).rejects.toThrow('8 MiB');
    });

    it('bounds snapshot copying by its own preparation deadline and removes the snapshot', async () => {
        await sparse(join(root, 'slow.pdf'), 2 * MIB);
        let now = 1_000;
        vi.spyOn(Date, 'now').mockImplementation(() => (now += 50));
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB, prepareTimeoutMs: 200 });
        const snapshot = trackSnapshot(service);
        await expect(service.prepare({ path: join(root, 'slow.pdf'), type: 'document' })).rejects.toThrow('took too long');
        expect(snapshot.dir()).toContain('whatsapp-outgoing-');
        await expect(access(snapshot.dir())).rejects.toThrow();
        expect((await readFile(join(root, 'slow.pdf'))).length).toBe(2 * MIB);
    });

    it('removes the snapshot and preserves the original on disk failure', async () => {
        await writeFile(join(root, 'doc.pdf'), '%PDF-1.4\nfixture');
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB });
        const snapshot = trackSnapshot(service, async () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }); });
        await expect(service.prepare({ path: join(root, 'doc.pdf'), type: 'document' })).rejects.toThrow('no space');
        expect(snapshot.dir()).toContain('whatsapp-outgoing-');
        await expect(access(snapshot.dir())).rejects.toThrow();
        expect(await readFile(join(root, 'doc.pdf'), 'utf8')).toBe('%PDF-1.4\nfixture');
    });

    it('keeps credential-path and format restrictions under a raised limit', async () => {
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB });
        await writeFile(join(root, '.env'), 'X=1');
        await expect(service.prepare({ path: join(root, '.env'), type: 'document' })).rejects.toThrow();
        await writeFile(join(root, 'not-image.png'), 'plain text');
        await expect(service.prepare({ path: join(root, 'not-image.png'), type: 'image' })).rejects.toThrow();
    });
});

describe('outbound large-transfer admission inside preparation (review fix)', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-out-admit-')); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
    it('refuses busy before creating any snapshot, using the opened file size', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const slots = new TransferSlots(1); const held = slots.tryAcquire('outbound')!;
        await sparse(join(root, 'big.pdf'), 30 * MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB, slots });
        const copy = vi.spyOn(service as unknown as { copySnapshot: () => Promise<number> }, 'copySnapshot');
        await expect(service.prepare({ path: join(root, 'big.pdf'), type: 'document' })).rejects.toThrow('Another large file transfer');
        expect(copy).not.toHaveBeenCalled();
        held();
        const prepared = await service.prepare({ path: join(root, 'big.pdf'), type: 'document' });
        expect(slots.held('outbound')).toBe(1);
        await prepared.dispose();
        expect(slots.held('outbound')).toBe(0);
    });
    it('caps an unadmitted (small at open) file at 25 MiB even if it grows during copying', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const slots = new TransferSlots(1);
        await sparse(join(root, 'grow.pdf'), MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB, slots });
        const target = service as unknown as { copySnapshot: (input: unknown, path: string, limit: number, signal?: AbortSignal) => Promise<number> };
        const original = target.copySnapshot.bind(service); let seenLimit = 0;
        vi.spyOn(target, 'copySnapshot').mockImplementation(async (input, path, limit, signal) => { seenLimit = limit; return original(input, path, limit, signal); });
        await (await service.prepare({ path: join(root, 'grow.pdf'), type: 'document' })).dispose();
        expect(seenLimit).toBe(25 * MIB);
        expect(slots.held('outbound')).toBe(0);
    });
    it('releases the slot when preparation fails after admission', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const slots = new TransferSlots(1);
        await sparse(join(root, 'big.pdf'), 30 * MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB, slots });
        vi.spyOn(service as unknown as { copySnapshot: () => Promise<number> }, 'copySnapshot').mockRejectedValue(new Error('disk'));
        await expect(service.prepare({ path: join(root, 'big.pdf'), type: 'document' })).rejects.toThrow('disk');
        expect(slots.held('outbound')).toBe(0);
    });
});

describe('25 MiB cap for sends admitted as small (review P2)', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-out-cap-')); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
    const capText = () => t('mediaLimits.unadmittedCap');

    it('reports the admission cap, not the configured limit, when conversion of a small video exceeds 25 MiB', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(52)]);
        await sparse(join(root, 'small.mp4'), 20 * MIB, mp4);
        await sparse(join(root, 'converted.mp4'), 30 * MIB, mp4);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 100 * MIB, slots: new TransferSlots(1) });
        vi.spyOn(service as unknown as { prepareAudioVideo: () => Promise<unknown> }, 'prepareAudioVideo')
            .mockResolvedValue({ path: join(root, 'converted.mp4'), mimetype: 'video/mp4', converted: true, command: 'fixture-ffmpeg' });
        const error = await service.prepare({ path: join(root, 'small.mp4'), type: 'video' }).catch((caught: Error) => caught);
        expect((error as Error).message).toBe(capText());
        expect((error as Error).message).not.toContain('100');
    });

    it('reports the admission cap when a small source grows past 25 MiB during copying', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const { truncate } = await import('node:fs/promises');
        const source = join(root, 'grow.pdf');
        await sparse(source, MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 512 * MIB, slots: new TransferSlots(1) });
        const target = service as unknown as { copySnapshot: (...args: unknown[]) => Promise<number> };
        const original = target.copySnapshot.bind(service);
        vi.spyOn(target, 'copySnapshot').mockImplementation(async (...args: unknown[]) => { await truncate(source, 26 * MIB); return original(...args); });
        const error = await service.prepare({ path: source, type: 'document' }).catch((caught: Error) => caught);
        expect((error as Error).message).toBe(capText());
    });

    it('uses the configured-limit message, not the cap, when the configured limit is exactly 25 MiB and a file grows', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const { truncate } = await import('node:fs/promises');
        const source = join(root, 'grow25.pdf');
        await sparse(source, MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 25 * MIB, slots: new TransferSlots(1) });
        const target = service as unknown as { copySnapshot: (...args: unknown[]) => Promise<number> };
        const original = target.copySnapshot.bind(service);
        vi.spyOn(target, 'copySnapshot').mockImplementation(async (...args: unknown[]) => { await truncate(source, 26 * MIB); return original(...args); });
        const error = await service.prepare({ path: source, type: 'document' }).catch((caught: Error) => caught);
        expect((error as Error).message).toBe(t('media.tooLarge', { maxMiB: 25 }));
        expect((error as Error).message).not.toBe(capText());
    });

    it('uses the configured-limit message, not the cap, when an admitted large send grows past the configured limit', async () => {
        const { TransferSlots } = await import('../../src/services/transfer-slots.ts');
        const { truncate } = await import('node:fs/promises');
        const slots = new TransferSlots(1);
        const source = join(root, 'growbig.pdf');
        await sparse(source, 30 * MIB);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 40 * MIB, slots });
        const target = service as unknown as { copySnapshot: (...args: unknown[]) => Promise<number> };
        const original = target.copySnapshot.bind(service);
        vi.spyOn(target, 'copySnapshot').mockImplementation(async (...args: unknown[]) => { await truncate(source, 41 * MIB); return original(...args); });
        const error = await service.prepare({ path: source, type: 'document' }).catch((caught: Error) => caught);
        expect((error as Error).message).toBe(t('media.tooLarge', { maxMiB: 40 }));
        expect(slots.held('outbound')).toBe(0);
    });

    it('keeps the configured-limit refusal (with its value) for files above the configured limit', async () => {
        await sparse(join(root, 'big.pdf'), 30 * MIB + 1);
        const service = new OutgoingMediaService({ workspaceRoot: root, maxBytes: 30 * MIB });
        await expect(service.prepare({ path: join(root, 'big.pdf'), type: 'document' })).rejects.toThrow(t('media.tooLarge', { maxMiB: 30 }));
    });
});
