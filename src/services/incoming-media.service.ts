import { downloadContentFromMessage } from 'baileys';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStoragePaths } from './storage-path.js';
import type { LiteParse } from '@llamaindex/liteparse';
import { AudioService } from './audio.service.js';
import type { AudioTranscriptionOptions } from './audio-transcriber.js';
import type { IncomingResolution } from './incoming-message.resolver.js';
import { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import { t } from '../i18n.js';

export interface ProcessedIncomingContent {
    text: string;
    imageBuffer?: Buffer;
    imageMimeType?: string;
}

const PDF_PREVIEW_LIMIT = 1200;
const INCOMING_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export class IncomingMediaService {
    private readonly mediaDir = createStoragePaths().mediaDir;

    constructor(
        private readonly audioService: AudioService,
        private readonly logger = new WhatsAppNgLogger(false)
    ) {}

    async process(resolved: IncomingResolution, pushName: string, options?: AudioTranscriptionOptions): Promise<ProcessedIncomingContent> {
        if (resolved.kind === 'audio') {
            return this.processAudio(resolved.audioMessage, pushName, options);
        }

        if (resolved.kind === 'image') {
            return this.processImage(resolved.imageMessage, resolved.text, pushName);
        }

        if (resolved.kind === 'video') {
            return this.processVideo(resolved.videoMessage, resolved.text, pushName);
        }

        if (resolved.kind === 'document') {
            return this.processDocument(resolved.documentMessage, pushName);
        }

        return { text: resolved.text };
    }

    private async processAudio(audioMessage: any, pushName: string, options?: AudioTranscriptionOptions): Promise<ProcessedIncomingContent> {
        this.logger.log(t('incoming.media.audioTranscribing', { pushName }));
        const transcription = options ? await this.audioService.transcribe(audioMessage, options) : await this.audioService.transcribe(audioMessage);
        return { text: t('incoming.media.audioTranscribed', { transcription }) };
    }

    private async processImage(imageMessage: any, fallbackText: string, pushName: string): Promise<ProcessedIncomingContent> {
        this.logger.log(t('incoming.media.imageDownloading', { pushName }));

        try {
            const imageBuffer = await this.downloadMessage(imageMessage, 'image');
            const rawMime = imageMessage.mimetype || 'image/jpeg';
            let imageMimeType = rawMime.toLowerCase().split(';')[0].trim();
            if (imageMimeType === 'image/jpg') imageMimeType = 'image/jpeg';

            this.logger.log(t('incoming.media.imageDownloaded', { imageMimeType, rawMime, size: imageBuffer.length }));
            await this.saveMediaFile('image', imageMimeType, imageBuffer);

            return {
                text: fallbackText || t('incoming.media.image'),
                imageBuffer,
                imageMimeType
            };
        } catch (error) {
            this.logger.error(t('incoming.media.imageDownloadFailed'), error);
            return { text: t('incoming.media.imageDownloadFailedText') };
        }
    }

    private async processVideo(videoMessage: any, fallbackText: string, pushName: string): Promise<ProcessedIncomingContent> {
        this.logger.log(`[WhatsApp-NG] Downloading video from ${pushName}...`);

        try {
            const buffer = await this.downloadMessage(videoMessage, 'video');
            const mimeType = (videoMessage.mimetype || 'video/mp4').toLowerCase().split(';')[0].trim();
            const absolutePath = await this.saveMediaFile('video', mimeType, buffer);
            this.logger.log(`[WhatsApp-NG] Video saved to ${absolutePath} (${buffer.length} bytes)`);

            return { text: `${fallbackText || t('incoming.media.video')}\n[Video saved: ${absolutePath}]` };
        } catch (error) {
            this.logger.error('[WhatsApp-NG] Failed to download video:', error);
            return { text: '[Video (download failed)]' };
        }
    }

    private async saveMediaFile(kind: 'image' | 'video', mimeType: string, buffer: Buffer): Promise<string> {
        const extension = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').slice(0, 32) || (kind === 'image' ? 'jpg' : 'mp4');
        const fileName = `${kind}_${Date.now()}_${randomUUID()}.${extension}`;
        const absolutePath = join(this.mediaDir, fileName);

        await mkdir(this.mediaDir, { recursive: true, mode: 0o700 });
        await writeFile(absolutePath, buffer, { mode: 0o600, flag: 'wx' });
        return absolutePath;
    }

    private async processDocument(documentMessage: any, pushName: string): Promise<ProcessedIncomingContent> {
        const fileName = documentMessage.fileName || 'unnamed_document';
        const mimeType = documentMessage.mimetype || 'application/octet-stream';
        const fileSize = documentMessage.fileLength ? Number(documentMessage.fileLength) : 0;

        this.logger.log(t('incoming.media.documentDownloading', { pushName, fileName }));

        try {
            const buffer = await this.downloadMessage(documentMessage, 'document');
            const relativePath = await this.saveDocument(fileName, buffer);

            this.logger.log(t('incoming.media.documentSaved', { relativePath, size: buffer.length }));

            let text = t('incoming.media.documentReceived', { fileName }) + '\n'
                + t('incoming.media.documentMimeType', { mimeType }) + '\n'
                + t('incoming.media.documentSize', { size: this.formatFileSize(fileSize) }) + '\n'
                + t('incoming.media.documentLocation', { relativePath });

            if (this.isPdfDocument(fileName, mimeType)) {
                const preview = await this.extractPdfPreview(buffer);
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

    private async downloadMessage(message: any, type: 'image' | 'video' | 'document'): Promise<Buffer> {
        if (Number(message.fileLength) > INCOMING_MEDIA_MAX_BYTES) throw new Error('Incoming media exceeds the 25 MiB limit');
        const stream = await downloadContentFromMessage(message, type);
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream) {
            size += chunk.length;
            if (size > INCOMING_MEDIA_MAX_BYTES) throw new Error('Incoming media exceeds the 25 MiB limit');
            chunks.push(chunk);
        }
        return Buffer.concat(chunks, size);
    }

    private async saveDocument(fileName: string, buffer: Buffer): Promise<string> {
        const sanitized = fileName.replace(/[^a-z0-9._-]/gi, '_');
        const savedFileName = `${Date.now()}_${randomUUID()}_${sanitized}`;
        const documentDir = join(process.cwd(), '.pi-data', 'whatsapp', 'documents');
        const absolutePath = join(documentDir, savedFileName);

        await mkdir(documentDir, { recursive: true, mode: 0o700 });
        await writeFile(absolutePath, buffer, { mode: 0o600, flag: 'wx' });

        return `./.pi-data/whatsapp/documents/${savedFileName}`;
    }

    private formatFileSize(fileSize: number): string {
        if (fileSize > 1024 * 1024) {
            return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
        }

        return `${(fileSize / 1024).toFixed(1)} KB`;
    }
}
