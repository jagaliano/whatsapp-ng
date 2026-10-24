import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), native: vi.fn(), download: vi.fn() }));
vi.mock('node:child_process', async () => {
    const { promisify } = await import('node:util');
    const execFile = vi.fn();
    // Never retain inherited credentials in mock arguments or assertion diffs.
    Object.defineProperty(execFile, promisify.custom, { value: (command: string, args: string[], { env: _env, ...options }: Record<string, unknown>) => mocks.execute(command, args, options) });
    return { execFile };
});
vi.mock('node:https', () => ({ default: { get: mocks.download } }));
vi.mock('../../src/services/whisper-cpp-node.transcriber.js', () => ({ tryCreateWhisperNodeAudioTranscriber: mocks.native }));
import { tryCreateWhisperCliAudioTranscriber } from '../../src/services/whisper-cli-audio.transcriber.js';
import { tryCreateWhisperCppAudioTranscriber } from '../../src/services/whisper-cpp-audio.transcriber.js';

const logger = { log: vi.fn(), error: vi.fn() };
let root: string, bin: string, cli: string, model: string;
beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), 'ng-whisper-fixture-'));
    bin = join(root, 'bin'); await mkdir(bin);
    cli = join(bin, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
    model = join(root, 'light model.bin');
    await writeFile(cli, 'SYNTHETIC_EXECUTABLE'); await chmod(cli, 0o755);
    await writeFile(model, 'SYNTHETIC_MODEL_NOT_LOADED');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.stubEnv('PATH', bin);
    vi.stubEnv('WHISPER_CLI_PATH', '');
    vi.stubEnv('WHISPER_MODEL_PATH', model);
    vi.stubEnv('WHISPER_LANGUAGE', '');
    mocks.native.mockReturnValue(null);
    mocks.execute.mockResolvedValue({ stdout: '  local transcription\n', stderr: '' });
    mocks.download.mockImplementation(() => { throw new Error('Network forbidden in fixture'); });
});
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

describe('installed Whisper.cpp CLI', () => {
    it('discovers the executable on PATH and uses the configured light model on CPU', async () => {
        const transcriber = tryCreateWhisperCliAudioTranscriber(logger);
        expect(transcriber).not.toBeNull();
        await expect(transcriber!.transcribe('input.wav')).resolves.toBe('local transcription');
        expect(mocks.execute).toHaveBeenCalledWith(cli, ['--model', model, '--file', 'input.wav', '--language', 'auto', '--no-timestamps', '--no-prints', '--no-gpu'], expect.objectContaining({ windowsHide: true }));
        expect(mocks.download).not.toHaveBeenCalled();
        expect(Object.hasOwn(mocks.execute.mock.calls[0][2], 'env')).toBe(false);
    });
    it('does not start a CLI for an already cancelled or stale session', async () => {
        const controller = new AbortController(); controller.abort();
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { signal: controller.signal })).rejects.toThrow();
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { isCurrent: () => false })).rejects.toThrow(/cancelled/i);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it.each(['abort', 'session', 'timeout'])('terminates a stalled CLI on %s', async reason => {
        vi.useFakeTimers();
        const controller = new AbortController(); let current = true;
        let started!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        mocks.execute.mockImplementation((_cli, _args, options) => {
            started();
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            });
        });
        const pending = tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { signal: controller.signal, isCurrent: () => current });
        const rejected = expect(pending).rejects.toThrow(/cancelled|timed out/i);
        await ready;
        if (reason === 'abort') controller.abort();
        if (reason === 'session') current = false;
        // Node's native AbortSignal.timeout is not advanced by fake timers; verify
        // the explicit CLI timeout as well as exercising the service's timer.
        const { timeout, killSignal } = mocks.execute.mock.calls[0][2];
        expect({ timeout, killSignal }).toEqual({ timeout: 600_000, killSignal: 'SIGKILL' });
        await vi.advanceTimersByTimeAsync(reason === 'timeout' ? 600_000 : 100);
        await rejected;
    });
    it('waits for the child close event after abort before rejecting', async () => {
        const { EventEmitter } = await import('node:events');
        const child = new EventEmitter(); const controller = new AbortController();
        let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
        mocks.execute.mockImplementation((_cli, _args, options) => {
            const pending = new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
            started(); return Object.assign(pending, { child });
        });
        let settled = false;
        const pending = tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { signal: controller.signal });
        const rejected = expect(pending.finally(() => { settled = true; })).rejects.toThrow(/cancelled/i);
        await ready; controller.abort();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(settled).toBe(false);
        child.emit('close', null, 'SIGKILL');
        await rejected;
    });
    it('prefers an available CLI over the optional native binding', () => {
        mocks.native.mockReturnValue({ transcribe: vi.fn() });
        expect(tryCreateWhisperCppAudioTranscriber(logger)).not.toBeNull();
        expect(mocks.native).not.toHaveBeenCalled();
    });
    it('honors an explicit CLI even when another executable is on PATH', async () => {
        const explicit = join(root, 'custom CLI'); await writeFile(explicit, 'fixture'); await chmod(explicit, 0o755);
        vi.stubEnv('WHISPER_CLI_PATH', explicit);
        await tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav');
        expect(mocks.execute.mock.calls[0][0]).toBe(explicit);
    });
    it('does not silently substitute another backend for an invalid explicit CLI', () => {
        vi.stubEnv('WHISPER_CLI_PATH', join(root, 'missing'));
        mocks.native.mockReturnValue({ transcribe: vi.fn() });
        expect(tryCreateWhisperCppAudioTranscriber(logger)).toBeNull();
        expect(mocks.native).not.toHaveBeenCalled();
    });
    it('rejects missing configured models without downloading a replacement', async () => {
        vi.stubEnv('WHISPER_CLI_PATH', cli); vi.stubEnv('WHISPER_MODEL_PATH', join(root, 'missing.bin'));
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav')).rejects.toThrow(/WHISPER_MODEL_PATH/);
        expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('rejects empty or directory model paths without downloading', async () => {
        vi.stubEnv('WHISPER_CLI_PATH', cli); await writeFile(model, '');
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav')).rejects.toThrow(/WHISPER_MODEL_PATH/);
        vi.stubEnv('WHISPER_MODEL_PATH', bin);
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav')).rejects.toThrow(/WHISPER_MODEL_PATH/);
        expect(mocks.download).not.toHaveBeenCalled();
    });
    it('honors the selected transcription language', async () => {
        vi.stubEnv('WHISPER_CLI_PATH', cli); vi.stubEnv('WHISPER_LANGUAGE', 'es');
        await tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav');
        expect(mocks.execute.mock.calls[0][1]).toContain('es');
    });
    it('does not accept a directory as the CLI', () => {
        vi.stubEnv('WHISPER_CLI_PATH', bin);
        expect(tryCreateWhisperCliAudioTranscriber(logger)).toBeNull();
    });
    it('does not implicitly select a repository vendor build', async () => {
        vi.stubEnv('PATH', '');
        const vendor = join(root, 'vendor', 'whisper.cpp', 'build', 'bin');
        await mkdir(vendor, { recursive: true });
        const vendoredCli = join(vendor, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
        await writeFile(vendoredCli, 'SYNTHETIC_EXECUTABLE');
        await chmod(vendoredCli, 0o755);
        expect(tryCreateWhisperCliAudioTranscriber(logger)).toBeNull();
        expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('build script'));
    });
    it('can fall back to the native binding if no CLI is present', () => {
        vi.stubEnv('PATH', '');
        const native = { transcribe: vi.fn() }; mocks.native.mockReturnValue(native);
        if (process.platform === 'darwin' || process.platform === 'win32') expect(tryCreateWhisperCppAudioTranscriber(logger)).toBe(native);
        else expect(tryCreateWhisperCppAudioTranscriber(logger)).toBeNull();
    });
});
