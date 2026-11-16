import type { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import { tryCreateWhisperCliAudioTranscriber } from './whisper-cli-audio.transcriber.js';
import { tryCreateWhisperNodeAudioTranscriber } from './whisper-cpp-node.transcriber.js';
import type { AudioTranscriber } from './audio-transcriber.js';
import type { LocalSttEnvironment } from './local-stt-options.js';

export type { AudioTranscriber };

type AudioLogger = Pick<WhatsAppNgLogger, 'log' | 'error'>;

export function tryCreateWhisperCppAudioTranscriber(logger: AudioLogger, env: LocalSttEnvironment = { ...process.env }): AudioTranscriber | null {
    // An installed CLI does not depend on this Node version's optional native addon.
    const cli = tryCreateWhisperCliAudioTranscriber(logger, env);
    if (cli || env.CRISPASR_CLI_PATH?.trim() || env.WHISPER_CLI_PATH?.trim()) return cli;
    if (process.platform === 'win32' || process.platform === 'darwin') return tryCreateWhisperNodeAudioTranscriber(logger);
    return null;
}

export function freeWhisperCppContext() {
    // The CLI process owns its model/context. The native binding manages its own context.
}
