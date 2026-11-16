import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import https from 'node:https';
import type { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import type { AudioTranscriber, AudioTranscriptionOptions } from './audio-transcriber.js';
import type { LocalSttOptions } from './local-stt-options.js';

type WhisperModule = {
    createWhisperContext: (options: { model: string; use_gpu?: boolean; no_prints?: boolean }) => {
        free?: () => void;
    };
    transcribeAsync: (context: { free?: () => void }, options: Record<string, unknown>) => Promise<{
        segments?: Array<[string, string, string] | { text?: string }>;
    }>;
};

type AudioLogger = Pick<WhatsAppNgLogger, 'log' | 'error'>;

type WhisperContext = ReturnType<WhisperModule['createWhisperContext']>;
type WhisperResult = Awaited<ReturnType<WhisperModule['transcribeAsync']>>;

const DEFAULT_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';

let whisperModule: WhisperModule | undefined;
let cachedContext: WhisperContext | undefined;
let cachedModelPath: string | undefined;

function loadWhisperModule(): WhisperModule {
    if (whisperModule) {
        return whisperModule;
    }

    const require = createRequire(import.meta.url);
    try {
        whisperModule = require('whisper-cpp-node') as WhisperModule;
        return whisperModule;
    } catch {
        throw new Error('whisper-cpp-node not installed. Run npm install.');
    }
}

async function downloadFile(url: string, targetPath: string): Promise<void> {
    await mkdir(dirname(targetPath), { recursive: true });
    await unlink(targetPath).catch(() => undefined);

    await new Promise<void>((resolve, reject) => {
        const file = createWriteStream(targetPath);
        const cleanup = () => void unlink(targetPath).catch(() => undefined);
        const request = https.get(url, (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const nextUrl = new URL(response.headers.location, url).toString();
                response.resume();
                file.close(cleanup);
                downloadFile(nextUrl, targetPath).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                file.close(cleanup);
                reject(new Error(`Model download failed: HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.once('finish', () => {
                file.close((error) => {
                    if (error) {
                        cleanup();
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        });

        request.on('error', (error) => {
            file.close(cleanup);
            reject(error);
        });

        file.on('error', (error) => {
            request.destroy(error);
            cleanup();
            reject(error);
        });
    });
}

async function ensureWhisperModel(logger: AudioLogger, local: Readonly<LocalSttOptions>): Promise<string> {
    try {
        const stats = await stat(local.modelPath);
        if (stats.isFile() && stats.size > 0) return local.modelPath;
    } catch {
        // Validate an explicit override or download only the default below.
    }

    if (local.modelSource !== 'default') {
        throw new Error(`${local.modelSource} must point to an existing nonempty Whisper.cpp model file; no replacement downloaded`);
    }
    logger.log(`[WhatsApp-NG] Whisper.cpp model download: ${local.modelPath}`);
    await downloadFile(DEFAULT_MODEL_URL, local.modelPath);
    return local.modelPath;
}

async function createContext(modelPath: string, logger: AudioLogger): Promise<WhisperContext> {
    const { createWhisperContext } = loadWhisperModule();
    logger.log('[WhatsApp-NG] Whisper.cpp context init');
    return createWhisperContext({
        model: modelPath,
        use_gpu: false,
        no_prints: true
    });
}

async function ensureContext(logger: AudioLogger, local: Readonly<LocalSttOptions>): Promise<WhisperContext> {
    const modelPath = await ensureWhisperModel(logger, local);
    if (!cachedContext || cachedModelPath !== modelPath) {
        cachedContext?.free?.();
        cachedContext = await createContext(modelPath, logger);
        cachedModelPath = modelPath;
    }

    return cachedContext;
}

function extractText(result: WhisperResult): string {
    const segments = (result?.segments ?? []) as Array<[string, string, string] | { text?: string }>;
    return segments
        .map((segment) => Array.isArray(segment) ? segment[2] : segment.text)
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
}

export function tryCreateWhisperNodeAudioTranscriber(logger: AudioLogger): AudioTranscriber | null {
    try {
        loadWhisperModule();
    } catch {
        return null;
    }

    return {
        async transcribe(inputPath: string, options: AudioTranscriptionOptions = {}): Promise<string> {
            if (!options.local) throw new Error('Local transcription options snapshot required');
            const context = await ensureContext(logger, options.local);
            const { transcribeAsync } = loadWhisperModule();
            logger.log('[WhatsApp-NG] Whisper.cpp transcribe');
            const result = await transcribeAsync(context, {
                fname_inp: inputPath,
                language: options.local.language,
                no_timestamps: true,
                no_context: false,
                detect_language: false
            });

            return extractText(result);
        }
    };
}

export function freeWhisperCppContext() {
    cachedContext?.free?.();
    cachedContext = undefined;
    cachedModelPath = undefined;
}
