import { describe, expect, it, vi } from 'vitest';
import { ProcessingIndicator } from '../../src/services/processing-indicator.service.ts';
import type { WAMessageKey } from 'baileys';

const key = { remoteJid: '90000000001@lid', id: 'request', fromMe: false };
const context = { accountScope: 'synthetic', generation: 1 };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => {
    let resolve!: (result: { success: boolean }) => void;
    const promise = new Promise<{ success: boolean }>(done => { resolve = done; });
    return { promise, resolve };
};
function fixture() {
    const react = vi.fn<(key: WAMessageKey, emoji: '⏳' | '') => Promise<{ success: boolean }>>().mockResolvedValue({ success: true });
    const isCurrent = vi.fn().mockReturnValue(true); const log = vi.fn();
    return { indicator: new ProcessingIndicator({ react, isCurrent, log }), react, isCurrent, log };
}

describe('ProcessingIndicator', () => {
    it('copies the complete transport key/context and deduplicates active starts', async () => {
        const { indicator, react } = fixture();
        const group = { ...key, remoteJid: '120363000001@g.us', participant: '90000000002@lid' };
        const original = { ...group }; const captured = { ...context };
        indicator.start(group, captured); indicator.start(group, captured);
        group.participant = '15550000002@s.whatsapp.net'; captured.generation++;
        expect(react).toHaveBeenCalledExactlyOnceWith(original, '⏳');
        indicator.markConsumed(original); indicator.finishRun(); await flush();
        expect(react).toHaveBeenLastCalledWith(original, '');
    });
    it('removes only consumed messages once and leaves queued messages active', async () => {
        const { indicator, react } = fixture(); const queued = { ...key, id: 'queued' };
        indicator.start(key, context); indicator.start(queued, context);
        indicator.markConsumed(key); indicator.finishRun(); indicator.finishRun(); await flush();
        expect(react.mock.calls).toEqual([[key, '⏳'], [queued, '⏳'], [key, '']]);
        indicator.markConsumed(queued); indicator.finishRun(); await flush();
        expect(react).toHaveBeenLastCalledWith(queued, '');
    });
    it.each(['settle', 'settleAll'] as const)('%s is idempotent and waits for add settlement only in background', async method => {
        const { indicator, react } = fixture(); const add = deferred(); react.mockReturnValueOnce(add.promise);
        indicator.start(key, context); indicator[method](key); indicator[method](key);
        expect(react).toHaveBeenCalledOnce(); add.resolve({ success: true }); await flush();
        expect(react).toHaveBeenCalledTimes(2); expect(react).toHaveBeenLastCalledWith(key, '');
    });
    it('discards pending cleanup without egress even if the context stays current', async () => {
        const { indicator, react } = fixture(); const add = deferred(); react.mockReturnValueOnce(add.promise);
        indicator.start(key, context); indicator.settleAll(); indicator.discardAll();
        add.resolve({ success: true }); await flush(); expect(react).toHaveBeenCalledOnce();
    });
    it('fences stale adds and deferred removals', async () => {
        const { indicator, react, isCurrent } = fixture(); isCurrent.mockReturnValue(false);
        indicator.start(key, context); expect(react).not.toHaveBeenCalled(); isCurrent.mockReturnValue(true);
        const add = deferred(); react.mockReturnValueOnce(add.promise);
        indicator.start(key, context); indicator.settleAll(); isCurrent.mockReturnValue(false);
        add.resolve({ success: true }); await flush(); expect(react).toHaveBeenCalledOnce();
    });
    it.each(['👍', ''] as const)('supersedes immediately for explicit %s with an add still pending', async emoji => {
        const { indicator, react } = fixture(); const add = deferred(); react.mockReturnValueOnce(add.promise);
        indicator.start(key, context); indicator.settle(key); indicator.supersede(key);
        // Explicit sends are independent: no wait or re-send by the indicator.
        indicator.observeOwnReaction(key, emoji); add.resolve({ success: true }); await flush();
        indicator.finishRun(); indicator.settleAll(); await flush(); expect(react).toHaveBeenCalledOnce();
    });
    it('ignores own hourglass echo, but own reaction/removal suppresses cleanup', async () => {
        const { indicator, react } = fixture();
        indicator.start(key, context); indicator.observeOwnReaction(key, '⏳'); indicator.settle(key); await flush();
        expect(react).toHaveBeenCalledTimes(2);
        for (const text of ['👍', '']) {
            const other = { ...key, id: text || 'removed' };
            indicator.start(other, context); indicator.markConsumed(other); indicator.observeOwnReaction(other, text);
            indicator.finishRun(); await flush(); expect(react).not.toHaveBeenCalledWith(other, '');
        }
    });
    it.each(['reject', 'false', 'throw'] as const)('contains %s send failures, logs metadata and never retries', async failure => {
        const { indicator, react, log } = fixture();
        if (failure === 'reject') react.mockRejectedValue(new Error('PRIVATE PAYLOAD'));
        else if (failure === 'false') react.mockResolvedValue({ success: false });
        else react.mockImplementation(() => { throw new Error('PRIVATE PAYLOAD'); });
        expect(() => indicator.start(key, context)).not.toThrow(); await flush();
        expect(react).toHaveBeenCalledOnce(); expect(log).toHaveBeenCalledExactlyOnceWith('[WhatsApp-NG] Processing reaction add failed');
        indicator.settleAll(); await flush(); expect(react).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenLastCalledWith('[WhatsApp-NG] Processing reaction remove failed');
    });
    it('suppresses deferred cleanup after admission is revoked', async () => {
        const { indicator, react } = fixture(); const add = deferred(); react.mockReturnValueOnce(add.promise);
        let admitted = true; indicator.start(key, context, () => admitted); indicator.settle(key);
        admitted = false; add.resolve({ success: true }); await flush(); expect(react).toHaveBeenCalledOnce();
    });
    it('contains currentness and logger exceptions', async () => {
        const { indicator, react, isCurrent, log } = fixture();
        isCurrent.mockImplementation(() => { throw new Error('no context'); });
        expect(() => indicator.start(key, context)).not.toThrow(); expect(react).not.toHaveBeenCalled();
        isCurrent.mockReturnValue(true); log.mockImplementation(() => { throw new Error('no log'); });
        react.mockRejectedValue(new Error('private')); indicator.start(key, context); await flush();
    });
    it('enforces 500 records even after consumption and while deferred cleanup hangs', async () => {
        const { indicator, react, log } = fixture(); const add = deferred(); react.mockReturnValue(add.promise);
        for (let i = 0; i < 500; i++) {
            const item = { ...key, id: String(i) }; indicator.start(item, context); indicator.markConsumed(item);
        }
        indicator.finishRun(); indicator.start({ ...key, id: 'overflow' }, context);
        expect(react).toHaveBeenCalledTimes(500); expect(log).toHaveBeenCalledExactlyOnceWith('[WhatsApp-NG] Processing reaction capacity reached');
        add.resolve({ success: true }); await flush();
        expect(react).toHaveBeenCalledTimes(1000);
        indicator.start({ ...key, id: 'reusable' }, context); expect(react).toHaveBeenCalledTimes(1001);
    });
    it('does not let a discarded add remove a newer record with the same key', async () => {
        const { indicator, react } = fixture(); const old = deferred(); react.mockReturnValueOnce(old.promise);
        indicator.start(key, context); indicator.settleAll(); indicator.discardAll(); indicator.start(key, context);
        old.resolve({ success: true }); await flush(); expect(react.mock.calls).toEqual([[key, '⏳'], [key, '⏳']]);
        indicator.settle(key); await flush(); expect(react).toHaveBeenLastCalledWith(key, '');
    });
});
