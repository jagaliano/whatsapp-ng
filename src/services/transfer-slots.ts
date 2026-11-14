import type { MediaDirection } from './media-limits.js';

/** Fixed per-direction admission for large transfers; extra work is refused, never queued. */
export class TransferSlots {
    private readonly counts: Record<MediaDirection, number> = { inbound: 0, outbound: 0 };

    constructor(private readonly capacity = 1) {}

    /** Returns an idempotent release, or undefined when the direction is busy. */
    public tryAcquire(direction: MediaDirection): (() => void) | undefined {
        if (this.counts[direction] >= this.capacity) return undefined;
        this.counts[direction]++;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.counts[direction]--;
        };
    }

    public held(direction: MediaDirection): number { return this.counts[direction]; }
}

/** Process-wide large-transfer admission shared by inbound and explicit outbound work. */
export const sharedTransferSlots = new TransferSlots(1);
