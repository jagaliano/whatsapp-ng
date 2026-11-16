import { join, resolve } from 'node:path';
import { createStoragePaths } from './storage-path.js';

export type LocalSttEnvironment = Readonly<Record<string, string | undefined>>;
export type LocalSttLanguageSource = 'CRISPASR_LANGUAGE' | 'WHISPER_LANGUAGE' | 'saved' | 'default';
export type LocalSttModelSource = 'CRISPASR_MODEL_PATH' | 'WHISPER_MODEL_PATH' | 'default';

export interface LocalSttLanguageResolution {
    language: string;
    source: LocalSttLanguageSource;
}

export interface LocalSttOptions extends LocalSttLanguageResolution {
    modelPath: string;
    modelSource: LocalSttModelSource;
}

export function resolveLocalSttLanguage(env: LocalSttEnvironment, saved?: string): LocalSttLanguageResolution {
    const crispasr = env.CRISPASR_LANGUAGE?.trim();
    if (crispasr) return { language: crispasr, source: 'CRISPASR_LANGUAGE' };
    const whisper = env.WHISPER_LANGUAGE?.trim();
    if (whisper) return { language: whisper, source: 'WHISPER_LANGUAGE' };
    if (isSttLanguageSyntax(saved)) return { language: saved, source: 'saved' };
    return { language: 'auto', source: 'default' };
}

/** Resolve every execution-time local option from one environment snapshot. */
export function resolveLocalSttOptions(env: LocalSttEnvironment, saved?: string): Readonly<LocalSttOptions> {
    const language = resolveLocalSttLanguage(env, saved);
    const crispasrModel = env.CRISPASR_MODEL_PATH?.trim();
    const whisperModel = crispasrModel ? undefined : env.WHISPER_MODEL_PATH?.trim();
    const modelSource: LocalSttModelSource = crispasrModel ? 'CRISPASR_MODEL_PATH' : whisperModel ? 'WHISPER_MODEL_PATH' : 'default';
    const modelPath = modelSource === 'default'
        ? join(createStoragePaths().root, 'whisper', 'models', 'ggml-base.bin')
        : resolve((modelSource === 'CRISPASR_MODEL_PATH' ? crispasrModel : whisperModel)!);
    return Object.freeze({ ...language, modelPath, modelSource });
}

/** Remote and local STT share syntax, not backend language support guarantees. */
export function isSttLanguageSyntax(value: unknown): value is string {
    return typeof value === 'string' && (value === 'auto' || /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(value));
}
