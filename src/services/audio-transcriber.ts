export interface SttConfig {
    sttEndpoint?: string;
    sttModel?: string;
    /** Environment-variable name only, never an API key. */
    sttEnv?: string;
    /** Remote STT only; auto omits the protocol field for server-side detection. */
    sttLanguage?: string;
}

import type { LocalSttOptions } from './local-stt-options.js';

export interface AudioTranscriptionOptions {
    signal?: AbortSignal;
    isCurrent?: () => boolean;
    /** Resolved once by AudioService for local execution; ignored by remote STT. */
    local?: Readonly<LocalSttOptions>;
}

export interface AudioTranscriber {
    transcribe(inputPath: string, options?: AudioTranscriptionOptions): Promise<string>;
}
