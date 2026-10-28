export interface SttConfig {
    sttEndpoint?: string;
    sttModel?: string;
    /** Environment-variable name only, never an API key. */
    sttEnv?: string;
    /** Remote STT only; auto omits the protocol field for server-side detection. */
    sttLanguage?: string;
}

export interface AudioTranscriptionOptions {
    signal?: AbortSignal;
    isCurrent?: () => boolean;
}

export interface AudioTranscriber {
    transcribe(inputPath: string, options?: AudioTranscriptionOptions): Promise<string>;
}
