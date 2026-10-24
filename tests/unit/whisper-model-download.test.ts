import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough, Readable } from 'node:stream';

const mocks = vi.hoisted(() => ({ root: '', get: vi.fn(), execute: vi.fn() }));
vi.mock('node:https', () => ({ default: { get: mocks.get } }));
vi.mock('node:child_process', async () => {
    const { promisify } = await import('node:util');
    const execFile = vi.fn();
    // Never retain inherited credentials in mock arguments or assertion diffs.
    Object.defineProperty(execFile, promisify.custom, { value: (command: string, args: string[], { env: _env, ...options }: Record<string, unknown>) => mocks.execute(command, args, options) });
    return { execFile };
});
vi.mock('../../src/services/storage-path.js', () => ({ createStoragePaths: () => ({ root: mocks.root }) }));
import { tryCreateWhisperCliAudioTranscriber } from '../../src/services/whisper-cli-audio.transcriber.js';

const logger = { log: vi.fn(), error: vi.fn() };
let root: string;
const target = () => join(root, 'whisper', 'models', 'ggml-base.bin');
beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), 'ng-model-download-')); mocks.root = root;
    const cli = join(root, 'synthetic-cli'); await writeFile(cli, 'NOT_EXECUTED'); await chmod(cli, 0o700);
    vi.stubEnv('WHISPER_CLI_PATH', cli); vi.stubEnv('WHISPER_MODEL_PATH', '');
    mocks.execute.mockResolvedValue({ stdout: 'fixture text' });
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

function respond(body: Readable, statusCode = 200, location?: string) {
    return (_url: string, options: { signal: AbortSignal }, callback: (response: unknown) => void) => {
        const request = new EventEmitter();
        const abort = () => request.emit('error', new Error('aborted'));
        options.signal.addEventListener('abort', abort, { once: true });
        body.once('close', () => options.signal.removeEventListener('abort', abort));
        queueMicrotask(() => callback(Object.assign(body, { statusCode, headers: { location } })));
        return request;
    };
}

describe('bounded atomic local model preparation', () => {
    it('publishes only a complete private model and reuses it without another download', async () => {
        mocks.get.mockImplementation(respond(Readable.from([Buffer.from('synthetic-model')])));
        const transcriber = tryCreateWhisperCliAudioTranscriber(logger)!;
        await expect(transcriber.transcribe('input.wav')).resolves.toBe('fixture text');
        expect(await readFile(target(), 'utf8')).toBe('synthetic-model');
        expect((await stat(target())).mode & 0o777).toBe(0o600);
        expect(await readdir(join(root, 'whisper/models'))).toEqual(['ggml-base.bin']);
        await transcriber.transcribe('another.wav');
        expect(mocks.get).toHaveBeenCalledOnce();
    });

    it('aborts a stalled response body without publishing a partial model', async () => {
        const body = new PassThrough();
        let connected!: () => void; const ready = new Promise<void>(resolve => { connected = resolve; });
        const response = respond(body);
        mocks.get.mockImplementation((...args) => { connected(); return response(...args as Parameters<typeof response>); });
        const controller = new AbortController();
        const pending = tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { signal: controller.signal });
        const rejected = expect(pending).rejects.toThrow(/cancelled/);
        await ready; body.write('partial');
        await expect(stat(target())).rejects.toThrow();
        controller.abort(); await rejected;
        expect(body.destroyed).toBe(true);
        expect(await readdir(join(root, 'whisper/models'))).toEqual([]);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it('aborts while waiting for response headers', async () => {
        let connected!: () => void; const ready = new Promise<void>(resolve => { connected = resolve; });
        mocks.get.mockImplementation((_url, options) => {
            const request = new EventEmitter();
            options.signal.addEventListener('abort', () => request.emit('error', new Error('aborted')), { once: true });
            connected(); return request;
        });
        const controller = new AbortController();
        const pending = tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav', { signal: controller.signal });
        const rejected = expect(pending).rejects.toThrow(/cancelled/);
        await ready; controller.abort(); await rejected;
        expect(await readdir(join(root, 'whisper/models'))).toEqual([]);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each(['empty', 'http redirect', 'redirect loop'])('does not cache an invalid download: %s', async kind => {
        mocks.get.mockImplementation((...args) => respond(Readable.from([]), kind === 'empty' ? 200 : 302,
            kind === 'http redirect' ? 'http://fixture.invalid/model' : 'https://fixture.invalid/model')(...args as Parameters<ReturnType<typeof respond>>));
        await expect(tryCreateWhisperCliAudioTranscriber(logger)!.transcribe('input.wav')).rejects.toThrow(/empty|redirect rejected/);
        expect(await readdir(join(root, 'whisper/models'))).toEqual([]);
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.get.mock.calls.length).toBeLessThanOrEqual(6);
    });

    it('keeps concurrent model downloads separate until atomic publication', async () => {
        mocks.get.mockImplementation((...args) => respond(Readable.from([Buffer.from('synthetic-model')]))(...args as Parameters<ReturnType<typeof respond>>));
        const transcriber = tryCreateWhisperCliAudioTranscriber(logger)!;
        await expect(Promise.all([transcriber.transcribe('one.wav'), transcriber.transcribe('two.wav')])).resolves.toEqual(['fixture text', 'fixture text']);
        expect(await readFile(target(), 'utf8')).toBe('synthetic-model');
        expect(await readdir(join(root, 'whisper/models'))).toEqual(['ggml-base.bin']);
    });
});
