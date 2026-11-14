import { describe, expect, it } from 'vitest';
import { TransferSlots } from '../../src/services/transfer-slots.ts';

describe('TransferSlots', () => {
    it('admits one large transfer per direction and refuses the next as busy', () => {
        const slots = new TransferSlots(1);
        const inbound = slots.tryAcquire('inbound');
        expect(inbound).toBeTypeOf('function');
        expect(slots.tryAcquire('inbound')).toBeUndefined();
        const outbound = slots.tryAcquire('outbound');
        expect(outbound).toBeTypeOf('function');
        inbound?.(); inbound?.();
        expect(slots.held('inbound')).toBe(0);
        expect(slots.tryAcquire('inbound')).toBeTypeOf('function');
        expect(slots.tryAcquire('inbound')).toBeUndefined();
        outbound?.();
        expect(slots.held('outbound')).toBe(0);
    });
    it('releases after a throwing holder', async () => {
        const slots = new TransferSlots(1);
        const release = slots.tryAcquire('outbound')!;
        await expect((async () => { try { throw new Error('x'); } finally { release(); } })()).rejects.toThrow('x');
        expect(slots.tryAcquire('outbound')).toBeTypeOf('function');
    });
});
