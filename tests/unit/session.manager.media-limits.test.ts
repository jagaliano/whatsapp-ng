import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '../../src/services/session.manager.ts';
import { MIB } from '../../src/services/media-limits.ts';

describe('SessionManager media limits', () => {
    let dataDir: string;
    let path: string;
    beforeEach(async () => { dataDir = await mkdtemp(join(tmpdir(), 'whatsapp-ng-limits-')); path = join(dataDir, 'config.json'); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(dataDir, { recursive: true, force: true }); });
    const load = async () => { const manager = new SessionManager(dataDir); await manager.ensureInitialized(); return manager; };
    const saved = async () => JSON.parse(await readFile(path, 'utf8'));

    it('defaults both directions to 25 MiB when absent', async () => {
        const manager = await load();
        expect(manager.getMediaLimits()).toEqual({ inboundBytes: 25 * MIB, outboundBytes: 25 * MIB });
        expect(manager.getMediaLimitsRevision()).toBe(0);
    });

    it('persists each direction independently across reload and unrelated saves', async () => {
        const manager = await load();
        await manager.setMediaLimit('inbound', 512, 0);
        expect((await saved()).mediaLimits).toEqual({ inboundMiB: 512 });
        await manager.setMediaLimit('outbound', 100, 1);
        expect((await saved()).mediaLimits).toEqual({ inboundMiB: 512, outboundMiB: 100 });
        await manager.setFinalAfterAttachments(false);
        await manager.setReplyStats(true);
        await manager.setGroupReplies(manager.getGroupReplies(), manager.getGroupRepliesRevision());
        await manager.setOptionalOutputs(manager.getOptionalOutputs(), manager.getOptionalOutputsRevision());
        await manager.setReplyReporting(manager.getReplyReporting(), manager.getReplyReportingRevision());
        await manager.setStatus('disconnected');
        await manager.setSpeechSettings(manager.getSpeechSettings(), manager.getSpeechRevision());
        const reloaded = await load();
        expect(reloaded.getMediaLimits()).toEqual({ inboundBytes: 512 * MIB, outboundBytes: 100 * MIB });
        expect((await saved()).mediaLimits).toEqual({ inboundMiB: 512, outboundMiB: 100 });
    });

    it('rejects invalid, stale and expired changes without touching memory or disk', async () => {
        const manager = await load();
        await manager.setMediaLimit('inbound', 50, 0);
        const before = await readFile(path, 'utf8');
        for (const value of [0, 513, 1.5, Number.NaN]) await expect(manager.setMediaLimit('inbound', value, 1)).rejects.toThrow();
        await expect(manager.setMediaLimit('inbound', 60, 0)).rejects.toThrow('expired');
        await expect(manager.setMediaLimit('outbound', 60, 1, () => false)).rejects.toThrow('expired');
        expect(await readFile(path, 'utf8')).toBe(before);
        expect(manager.getMediaLimits().inboundBytes).toBe(50 * MIB);
        expect(manager.getMediaLimitsRevision()).toBe(1);
    });

    it('does not update memory when the write fails', async () => {
        const manager = await load();
        await manager.setFinalAfterAttachments(true);
        const before = await readFile(path, 'utf8');
        await expect(manager.setMediaLimit('inbound', 200, 0, (() => { let calls = 0; return () => ++calls < 2; })())).rejects.toThrow();
        expect(await readFile(path, 'utf8')).toBe(before);
        expect(manager.getMediaLimits().inboundBytes).toBe(25 * MIB);
        expect(manager.getMediaLimitsRevision()).toBe(0);
    });

    it('treats malformed saved limits as unavailable and preserves them on unrelated saves', async () => {
        await writeFile(path, JSON.stringify({ mediaLimits: { inboundMiB: 9999 } }));
        const manager = await load();
        expect(() => manager.getMediaLimits()).toThrow('Invalid saved media limits');
        await manager.setFinalAfterAttachments(false);
        expect((await saved()).mediaLimits).toEqual({ inboundMiB: 9999 });
    });

    it('treats unreadable configuration as unavailable and refuses changes', async () => {
        await writeFile(path, 'not json at all');
        const manager = await load();
        expect(() => manager.getMediaLimits()).toThrow();
        await expect(manager.setMediaLimit('inbound', 30, 0)).rejects.toThrow('unreadable');
        expect(await readFile(path, 'utf8')).toBe('not json at all');
    });
});
