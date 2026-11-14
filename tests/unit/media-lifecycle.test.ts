import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { InboundMediaTransfer } from '../../src/services/inbound-media-transfer.ts';
import { IncomingMediaService } from '../../src/services/incoming-media.service.ts';
import { SessionManager } from '../../src/services/session.manager.ts';
import { TransferSlots } from '../../src/services/transfer-slots.ts';
import { MIB } from '../../src/services/media-limits.ts';

/** Slow, progressing stream controlled by the test. */
function controlled() {
    const stream = new Readable({ read() {} });
    return { stream, push: (n: number) => stream.push(Buffer.alloc(n)), end: () => stream.push(null) };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

describe('media lifecycle interruptions', () => {
    let root: string; let mediaDir: string; let documents: string;
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'wa-lifecycle-'));
        mediaDir = join(root, 'media'); documents = join(root, '.pi-data', 'whatsapp', 'documents');
    });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    const service = (download: () => Readable) => new IncomingMediaService({ transcribe: async () => '' } as never, undefined,
        new InboundMediaTransfer({ slots: new TransferSlots(1), download: async () => download() }), mediaDir);
    const withCwd = async <T>(run: () => Promise<T>): Promise<T> => {
        const original = process.cwd; process.cwd = () => root;
        try { return await run(); } finally { process.cwd = original; }
    };

    it.each(['explicit Off', 'session replacement', 'chat revocation'])('%s during a download stops it, removes the partial and hands nothing off', async () => {
        let current = true;
        const source = controlled();
        const result = withCwd(() => service(() => source.stream).process({ kind: 'document', text: '', documentMessage: { fileName: 'plan.dwg' } }, 'Ana', undefined,
            { limits: { inboundBytes: 512 * MIB, outboundBytes: 25 * MIB }, isCurrent: () => current }));
        source.push(MIB); await tick();
        current = false; // the caller's isCurrent combines Off, session context and chat admission
        source.push(MIB);
        expect((await result).text).toBe('[Document not received: plan.dwg; transfer interrupted (cancelled)]');
        expect(await readdir(documents)).toEqual([]);
        expect(source.stream.destroyed).toBe(true);
    });

    it('a lowered limit does not affect an admitted transfer, and deletes no completed receipts', async () => {
        const session = new SessionManager(join(root, 'state')); await session.ensureInitialized();
        await session.setMediaLimit('inbound', 100, 0);
        const captured = session.getMediaLimits();
        const source = controlled();
        const pending = withCwd(() => service(() => source.stream).process({ kind: 'document', text: '', documentMessage: { fileName: 'big.bin' } }, 'Ana', undefined,
            { limits: captured, isCurrent: () => true }));
        source.push(10 * MIB); await tick();
        await session.setMediaLimit('inbound', 1, 1);
        source.push(30 * MIB); source.end();
        expect((await pending).text).toContain('[Document received: big.bin]');
        const files = await readdir(documents);
        expect(files).toHaveLength(1);
        // A later transfer uses the new limit; the earlier receipt remains.
        const next = await withCwd(() => service(() => Readable.from([Buffer.alloc(2 * MIB)])).process({ kind: 'document', text: '', documentMessage: { fileName: 'next.bin' } },
            'Ana', undefined, { limits: session.getMediaLimits(), isCurrent: () => true }));
        expect(next.text).toContain('exceeds the inbound limit of 1 MiB');
        expect(await readdir(documents)).toEqual(files);
    });

    it('authority lost after publication keeps the completed file on disk for the caller to leave unreported', async () => {
        let checks = 0;
        const outcome = await new InboundMediaTransfer({ slots: new TransferSlots(1), download: async () => Readable.from([Buffer.alloc(10)]) })
            .run({ message: {}, type: 'document', limitBytes: MIB, directory: documents, fileName: 'kept.bin', isCurrent: () => ++checks <= 2 });
        expect(outcome.status).toBe('stored');
        // Caller-side handoff check now fails (third check); nothing deletes the published file.
        expect(checks).toBe(2);
        expect(await readdir(documents)).toEqual(['kept.bin']);
    });
});
