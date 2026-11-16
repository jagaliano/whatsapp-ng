import { delimiter, dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { accessSync, constants, createWriteStream, statSync } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { WhatsAppNgLogger } from './whatsapp-ng.logger.js';
import type { AudioTranscriber, AudioTranscriptionOptions } from './audio-transcriber.js';
import type { LocalSttEnvironment, LocalSttOptions } from './local-stt-options.js';

const execFileAsync = promisify(execFile);
const TRANSCRIPTION_TIMEOUT_MS = 10 * 60_000;
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
type AudioLogger = Pick<WhatsAppNgLogger, 'log' | 'error'>;

function selectCli(env: LocalSttEnvironment) {
    const names = ['whisper-cli', 'crispasr'].map(name => process.platform === 'win32' ? `${name}.exe` : name);
    const crispasr = env.CRISPASR_CLI_PATH?.trim();
    const whisper = env.WHISPER_CLI_PATH?.trim();
    const configured = crispasr || whisper;
    const source = crispasr ? 'CRISPASR_CLI_PATH' : whisper ? 'WHISPER_CLI_PATH' : 'PATH';
    const directories = (env.PATH ?? '').split(delimiter).filter(Boolean);
    const candidates = configured ? [resolve(configured)] : names.flatMap(name => directories.map(path => resolve(path, name)));
    const cliPath = candidates.find(path => {
        try {
            if (!statSync(path).isFile()) return false;
            accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
            return true;
        } catch { return false; }
    }) ?? null;
    if (!cliPath) return null;
    const libPath = dirname(cliPath);
    const childEnv = Object.freeze({ ...env, LD_LIBRARY_PATH: libPath + (env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : '') });
    return { cliPath, source, childEnv };
}
async function download(url: string, target: string, signal: AbortSignal, redirects = 0): Promise<void> {
    signal.throwIfAborted();
    if (new URL(url).protocol !== 'https:' || redirects > 5) throw new Error('Whisper.cpp model download redirect rejected');
    const response = await new Promise<IncomingMessage>((resolveResponse, reject) => {
        https.get(url, { signal }, resolveResponse).once('error', reject);
    });
    if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.destroy();
        return download(new URL(response.headers.location, url).toString(), target, signal, redirects + 1);
    }
    if (response.statusCode !== 200) {
        response.destroy();
        throw new Error(`Model download failed: HTTP ${response.statusCode}`);
    }
    await pipeline(response, createWriteStream(target, { flags: 'wx', mode: 0o600 }), { signal });
}
async function ensureModel(logger: AudioLogger, signal: AbortSignal, local: Readonly<LocalSttOptions>) {
    const target = local.modelPath;
    try { const info = await stat(target); if (info.isFile() && info.size > 0) return target; } catch { /* validate override or download default below */ }
    if (local.modelSource !== 'default') throw new Error(`${local.modelSource} must point to an existing nonempty Whisper.cpp model file; no replacement downloaded`);
    signal.throwIfAborted();
    logger.log(`[WhatsApp-NG] Whisper.cpp model download: ${target}`);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
        await download(MODEL_URL, temporary, signal);
        signal.throwIfAborted();
        if (!(await stat(temporary)).size) throw new Error('Whisper.cpp model download was empty');
        await rename(temporary, target);
        return target;
    } finally { await unlink(temporary).catch(() => undefined); }
}
export function tryCreateWhisperCliAudioTranscriber(logger: AudioLogger, env: LocalSttEnvironment = { ...process.env }): AudioTranscriber | null {
    const selection = selectCli(env);
    if (!selection) { logger.log('[WhatsApp-NG] Local speech CLI unavailable. Install whisper-cli/crispasr on PATH or set CRISPASR_CLI_PATH/WHISPER_CLI_PATH.'); return null; }
    const { cliPath, childEnv } = selection;
    return { async transcribe(inputPath, options: AudioTranscriptionOptions = {}) {
        if (!options.local) throw new Error('Local transcription options snapshot required');
        const local = options.local;
        const controller = new AbortController();
        const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
        let timedOut = false;
        const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, TRANSCRIPTION_TIMEOUT_MS);
        const cancelStale = () => {
            try { if (options.isCurrent && !options.isCurrent()) controller.abort(); }
            catch { controller.abort(); }
        };
        const checkCurrent = () => { cancelStale(); signal.throwIfAborted(); };
        const monitor = options.isCurrent ? setInterval(cancelStale, 100) : undefined;
        try {
            checkCurrent();
            const model = await ensureModel(logger, signal, local);
            checkCurrent();
            const execution = execFileAsync(cliPath, ['--model', model, '--file', inputPath, '--language', local.language, '--no-timestamps', '--no-prints', '--no-gpu'], {
                windowsHide: true, env: childEnv, signal, timeout: TRANSCRIPTION_TIMEOUT_MS, killSignal: 'SIGKILL'
            });
            // Abort can reject execFile before the child exits. Do not let AudioService
            // remove its scratch files until the actual process has closed.
            const closed = execution.child ? new Promise<void>(resolveClose => execution.child.once('close', () => resolveClose())) : undefined;
            try { return (await execution).stdout.trim(); }
            finally { await closed; }
        } catch (error) {
            if (signal.aborted) throw new Error(timedOut ? 'Local Whisper.cpp timed out' : 'Local Whisper.cpp cancelled');
            throw error;
        } finally {
            clearTimeout(deadline);
            if (monitor) clearInterval(monitor);
        }
    } };
}
