import type { WAMessageKey } from 'baileys';
import type { WhatsAppSessionContext } from '../models/whatsapp.types.js';

interface IndicatorPorts {
    react(key: WAMessageKey, emoji: '⏳' | ''): Promise<{ success: boolean }>;
    isCurrent(context: WhatsAppSessionContext): boolean;
    log(message: string): void;
}
interface IndicatorRecord {
    key: WAMessageKey;
    context: WhatsAppSessionContext;
    admissionCurrent: () => boolean;
    state: 'active' | 'superseded' | 'settled';
    consumed: boolean;
    adding: boolean;
    removing: boolean;
}

/** Cosmetic, bounded work: never awaited by prompts, replies or explicit reactions. */
export class ProcessingIndicator {
    private readonly records = new Map<string, IndicatorRecord>();

    constructor(private readonly ports: IndicatorPorts) {}

    public start(key: WAMessageKey, context: WhatsAppSessionContext, admissionCurrent: () => boolean = () => true): void {
        for (const [id, record] of this.records) if (!this.current(record.context)) this.records.delete(id);
        const id = this.id(key);
        if (!this.current(context) || this.records.has(id)) return;
        if (this.records.size >= 500) { this.log('capacity reached'); return; }
        const record: IndicatorRecord = {
            key: { ...key }, context: { ...context }, admissionCurrent, state: 'active', consumed: false, adding: true, removing: false
        };
        this.records.set(id, record);
        void this.send(record, '⏳').then(() => {
            record.adding = false;
            this.cleanup(record);
        });
    }

    public markConsumed(key: WAMessageKey): void {
        const record = this.records.get(this.id(key));
        if (record) record.consumed = true;
    }

    public finishRun(): void {
        for (const record of this.records.values()) if (record.consumed) this.settle(record.key);
    }

    public settle(key: WAMessageKey): void {
        const record = this.records.get(this.id(key));
        if (!record) return;
        record.consumed = false;
        if (record.state !== 'superseded') record.state = 'settled';
        this.cleanup(record);
    }

    public settleAll(): void {
        for (const record of this.records.values()) this.settle(record.key);
    }

    public discardAll(): void { this.records.clear(); }

    public supersede(key: WAMessageKey): void {
        const record = this.records.get(this.id(key));
        if (record) record.state = 'superseded';
    }

    /** Caller verifies the reacting account; hourglass echoes are not new intent. */
    public observeOwnReaction(key: WAMessageKey, text: string): void {
        if (text !== '⏳') this.supersede(key);
    }

    private cleanup(record: IndicatorRecord): void {
        const id = this.id(record.key);
        if (this.records.get(id) !== record || record.adding || record.removing) return;
        if (record.state === 'superseded' && !record.consumed) { this.records.delete(id); return; }
        if (record.state !== 'settled') return;
        record.removing = true;
        void this.send(record, '').then(() => {
            if (this.records.get(id) === record) this.records.delete(id);
        });
    }

    private async send(record: IndicatorRecord, emoji: '⏳' | ''): Promise<void> {
        if (this.records.get(this.id(record.key)) !== record || record.state === 'superseded' || !this.current(record.context)) return;
        try {
            if (!record.admissionCurrent()) return;
            const result = await this.ports.react({ ...record.key }, emoji);
            if (!result.success) this.log(`${emoji ? 'add' : 'remove'} failed`);
        } catch { this.log(`${emoji ? 'add' : 'remove'} failed`); }
    }

    private current(context: WhatsAppSessionContext): boolean {
        try { return this.ports.isCurrent(context); } catch { return false; }
    }

    private log(message: string): void {
        try { this.ports.log(`[WhatsApp-NG] Processing reaction ${message}`); } catch { /* Cosmetic diagnostics cannot affect delivery. */ }
    }

    private id(key: WAMessageKey): string {
        return JSON.stringify([key.remoteJid, key.id, key.fromMe, key.participant]);
    }
}
