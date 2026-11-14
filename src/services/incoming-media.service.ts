import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStoragePaths } from './storage-path.js';
import type { LiteParse } from '@llamaindex/liteparse';
import { AudioService } from './audio.service.js';
import type { AudioTranscriptionOptions } from './audio-transcriber.js';
import type { IncomingResolution } from './incoming-message.resolver.js';
import { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import { t } from '../i18n.js';
import { InboundMediaTransfer, type InboundMediaType, type InboundOutcome } from './inbound-media-transfer.js';
import { formatMiB, MIB, PROCESSING_CEILING_BYTES, type MediaLimits } from './media-limits.js';

/** Per-message admission context for non-audio downloads; `limits` undefined means unavailable/malformed. */
export interface InboundMediaContext {
    limits: MediaLimits | undefined;
    isCurrent: () => boolean;
    signal?: AbortSignal;
    /** Automatic quoted-image analysis: bounded by min(inbound limit, 25 MiB). */
    quoted?: boolean;
}
type Stored = Extract<InboundOutcome, { status: 'stored' }>;

export interface ProcessedIncomingContent {
    text: string;
    imageBuffer?: Buffer;
    imageMimeType?: string;
}

const PDF_PREVIEW_LIMIT = 1200;
const DEFAULT_CONTEXT: InboundMediaContext = { limits: { inboundBytes: 25 * MIB, outboundBytes: 25 * MIB }, isCurrent: () => true };
const NOTICE_TEXT_MAX = 1000;

export class IncomingMediaService {
    constructor(
        private readonly audioService: AudioService,
        private readonly logger = new WhatsAppNgLogger(false),
        private readonly transfer = new InboundMediaTransfer(),
        private readonly mediaDir = createStoragePaths().mediaDir
    ) {}

    async process(resolved: IncomingResolution, pushName: string, options?: AudioTranscriptionOptions, media: InboundMediaContext = DEFAULT_CONTEXT): Promise<ProcessedIncomingContent> {
        if (resolved.kind === 'audio') {
            return this.processAudio(resolved.audioMessage, pushName, options);
        }

        if (resolved.kind === 'image') {
            return this.processImage(resolved.imageMessage, resolved.text, media);
        }

        if (resolved.kind === 'video') {
            return this.processVideo(resolved.videoMessage, resolved.text, media);
        }

        if (resolved.kind === 'document') {
            return this.processDocument(resolved.documentMessage, media);
        }

        return { text: resolved.text };
    }

    private async processAudio(audioMessage: any, _pushName: string, options?: AudioTranscriptionOptions): Promise<ProcessedIncomingContent> {
        this.logger.log('[WhatsApp-NG] Transcribing incoming audio');
        const transcription = options ? await this.audioService.transcribe(audioMessage, options) : await this.audioService.transcribe(audioMessage);
        return { text: t('incoming.media.audioTranscribed', { transcription }) };
    }

    private async processImage(imageMessage: any, fallbackText: string, media: InboundMediaContext): Promise<ProcessedIncomingContent> {
        this.logger.log('[WhatsApp-NG] Downloading incoming image');
        const withCaption = (notice: string) => ({ text: fallbackText && fallbackText !== t('incoming.media.image') ? `${fallbackText}\n${notice}` : notice });
        try {
            const rawMime = imageMessage.mimetype || 'image/jpeg';
            let imageMimeType = rawMime.toLowerCase().split(';')[0].trim();
            if (imageMimeType === 'image/jpg') imageMimeType = 'image/jpeg';
            const outcome = await this.receive(imageMessage, 'image', this.mediaDir, this.mediaFileName('image', imageMimeType), media);
            if (outcome.status !== 'stored') return withCaption(this.refusal(outcome, 'image', imageMessage, t('incoming.media.imageDownloadFailedText')));
            this.logger.log(`[WhatsApp-NG] Image downloaded: bytes=${outcome.bytes}`);
            if (outcome.bytes > PROCESSING_CEILING_BYTES) return { text: this.largeReceipt('image', imageMessage, imageMimeType, outcome.path, outcome, fallbackText) };
            // The transfer has released its streams; eligible small images keep the existing inline path.
            const imageBuffer = await readFile(outcome.path);
            return { text: fallbackText || t('incoming.media.image'), imageBuffer, imageMimeType };
        } catch (error) {
            this.logger.error(t('incoming.media.imageDownloadFailed'), error);
            return withCaption(t('incoming.media.imageDownloadFailedText'));
        }
    }

    private async processVideo(videoMessage: any, fallbackText: string, media: InboundMediaContext): Promise<ProcessedIncomingContent> {
        this.logger.log('[WhatsApp-NG] Downloading incoming video');
        const mimeType = (videoMessage.mimetype || 'video/mp4').toLowerCase().split(';')[0].trim();
        const outcome = await this.receive(videoMessage, 'video', this.mediaDir, this.mediaFileName('video', mimeType), media);
        if (outcome.status !== 'stored') return { text: this.refusal(outcome, 'video', videoMessage, '[Video (download failed)]') };
        this.logger.log(`[WhatsApp-NG] Video saved: bytes=${outcome.bytes}`);
        if (outcome.bytes > PROCESSING_CEILING_BYTES) return { text: this.largeReceipt('video', videoMessage, mimeType, outcome.path, outcome, fallbackText) };
        return { text: `${fallbackText || t('incoming.media.video')}\n[Video saved: ${outcome.path}]` };
    }

    private mediaFileName(kind: 'image' | 'video', mimeType: string): string {
        const extension = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').slice(0, 32) || (kind === 'image' ? 'jpg' : 'mp4');
        return `${kind}_${Date.now()}_${randomUUID()}.${extension}`;
    }

    private async processDocument(documentMessage: any, media: InboundMediaContext): Promise<ProcessedIncomingContent> {
        const fileName = documentMessage.fileName || 'unnamed_document';
        const mimeType = documentMessage.mimetype || 'application/octet-stream';
        const fileSize = documentMessage.fileLength ? Number(documentMessage.fileLength) : 0;

        this.logger.log('[WhatsApp-NG] Downloading incoming document');

        const savedFileName = `${Date.now()}_${randomUUID()}_${fileName.replace(/[^a-z0-9._-]/gi, '_')}`;
        // Documents keep the existing process-working-directory destination.
        const documentDir = join(process.cwd(), '.pi-data', 'whatsapp', 'documents');
        const relativePath = `./.pi-data/whatsapp/documents/${savedFileName}`;
        try {
            const outcome = await this.receive(documentMessage, 'document', documentDir, savedFileName, media);
            if (outcome.status !== 'stored') return { text: this.refusal(outcome, 'document', documentMessage, t('incoming.media.documentDownloadFailedText', { fileName })) };
            this.logger.log(`[WhatsApp-NG] Document saved: bytes=${outcome.bytes}`);
            if (outcome.bytes > PROCESSING_CEILING_BYTES) return { text: this.largeReceipt('document', documentMessage, mimeType, relativePath, outcome, documentMessage.caption) };

            let text = t('incoming.media.documentReceived', { fileName }) + '\n'
                + t('incoming.media.documentMimeType', { mimeType }) + '\n'
                + t('incoming.media.documentSize', { size: this.formatFileSize(fileSize) }) + '\n'
                + t('incoming.media.documentLocation', { relativePath });

            if (this.isPdfDocument(fileName, mimeType)) {
                const preview = await this.extractPdfPreview(await readFile(outcome.path));
                if (preview) {
                    text += `\n\n${t('incoming.media.documentPdfPreviewHeading')}\n${preview}`;
                } else {
                    text += `\n\n${t('incoming.media.documentPdfFallbackNotice')}`;
                }
            }

            if (documentMessage.caption) {
                text += `\n\n${t('incoming.media.documentDescription', { caption: documentMessage.caption })}`;
            }

            return { text };
        } catch (error) {
            this.logger.error(t('incoming.media.documentDownloadFailed'), error);
            return { text: t('incoming.media.documentDownloadFailedText', { fileName }) };
        }
    }

    private async receive(message: any, type: InboundMediaType, directory: string, fileName: string, media: InboundMediaContext): Promise<InboundOutcome | { status: 'unavailable' }> {
        if (!media.limits) return { status: 'unavailable' };
        const limitBytes = media.quoted ? Math.min(media.limits.inboundBytes, PROCESSING_CEILING_BYTES) : media.limits.inboundBytes;
        return this.transfer.run({ message, type, limitBytes, directory, fileName, isCurrent: media.isCurrent, signal: media.signal });
    }

    private bounded(text: unknown): string {
        const value = typeof text === 'string' ? text : '';
        return value.length > NOTICE_TEXT_MAX ? `${value.slice(0, NOTICE_TEXT_MAX)}…` : value;
    }

    private noticeName(message: any): string { return this.bounded(message?.fileName) || '-'; }

    private largeReceipt(type: InboundMediaType, message: any, mimeType: string, location: string, stored: Stored, caption?: string): string {
        const kind = t(`mediaLimits.kind.${type}`);
        let text = t('mediaLimits.received', { kind, fileName: this.noticeName(message), mimeType: this.bounded(mimeType), location,
            size: formatMiB(stored.bytes), bytes: stored.bytes });
        const label = this.bounded(caption);
        if (label && label !== t(`incoming.media.${type}`)) text += `\n${t('mediaLimits.caption', { caption: label })}`;
        return text;
    }

    /** Bounded, metadata-only notices; `failed` keeps the existing per-kind download-failed text. */
    private refusal(outcome: Exclude<InboundOutcome, Stored> | { status: 'unavailable' }, type: InboundMediaType, message: any, failedText: string): string {
        const kind = t(`mediaLimits.kind.${type}`);
        const fileName = this.noticeName(message);
        const reason = (value: string) => t(`mediaLimits.reason.${value}` as Parameters<typeof t>[0]);
        switch (outcome.status) {
            case 'unavailable': return t('mediaLimits.inboundUnavailable', { kind, fileName });
            case 'oversize': return t('mediaLimits.oversize', { kind, fileName, maxMiB: outcome.limitBytes / MIB });
            case 'busy': return t('mediaLimits.inboundBusy', { kind, fileName });
            case 'cleanupFailed':
                this.logger.warn(`[WhatsApp-NG] Incomplete ${type} could not be removed: ${outcome.leftover}`);
                return t('mediaLimits.cleanupFailed', { kind, fileName, reason: reason(outcome.reason), location: outcome.leftover });
            case 'interrupted': return outcome.reason === 'failed' ? failedText : t('mediaLimits.interrupted', { kind, fileName, reason: reason(outcome.reason) });
        }
    }

    private async extractPdfPreview(buffer: Buffer): Promise<string | null> {
        let parser: LiteParse | undefined;
        try {
            // Native PDF support is optional: its absence must not disable other messages.
            const { LiteParse } = await import('@llamaindex/liteparse');
            parser = new LiteParse({
                ocrEnabled: true,
                ocrFailureFatal: false,
                quiet: true,
                numWorkers: 1,
                poolSize: 1,
                parseTimeoutMs: 60_000
            });
            const result = await parser.parse(buffer);
            return this.formatPdfPreview(result.text);
        } catch (error) {
            this.logger.warn('[WhatsApp-NG] PDF parsing failed, falling back to storage-only behavior.', error);
            return null;
        } finally {
            parser?.close();
        }
    }

    private formatPdfPreview(text: string | undefined | null): string | null {
        const normalized = (text || '').replace(/\r\n/g, '\n').trim();
        if (!normalized) {
            return null;
        }

        if (normalized.length <= PDF_PREVIEW_LIMIT) {
            return normalized;
        }

        return `${normalized.slice(0, PDF_PREVIEW_LIMIT)}…`;
    }

    private isPdfDocument(fileName: string, mimeType: string): boolean {
        const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim();
        return normalizedMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    }

    private formatFileSize(fileSize: number): string {
        if (fileSize > 1024 * 1024) {
            return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
        }

        return `${(fileSize / 1024).toFixed(1)} KB`;
    }
}
