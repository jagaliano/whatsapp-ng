import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({ create: vi.fn(), transcribe: vi.fn(), download: vi.fn(), free: vi.fn() }));
vi.mock('node:module', () => ({ createRequire: () => () => ({ createWhisperContext: mocks.create, transcribeAsync: mocks.transcribe }) }));
vi.mock('node:https', () => ({ default: { get: mocks.download } }));
let root: string, model: string;
const logger = { log: vi.fn(), error: vi.fn() };
beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), 'ng-native-whisper-')); model = join(root, 'light.bin');
    await writeFile(model, 'SYNTHETIC_MODEL_NOT_LOADED');
    vi.stubEnv('WHISPER_MODEL_PATH', model); vi.stubEnv('WHISPER_LANGUAGE', '');
    mocks.create.mockReturnValue({ free: mocks.free });
    mocks.transcribe.mockResolvedValue({ segments: [[0, 1, ' local text ']] });
    mocks.download.mockImplementation(() => { throw new Error('Network forbidden'); });
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
describe('optional native Whisper model configuration', () => {
    it('uses the configured model on CPU without downloading and defaults to automatic language', async () => {
        const { tryCreateWhisperNodeAudioTranscriber } = await import('../../src/services/whisper-cpp-node.transcriber.js');
        await expect(tryCreateWhisperNodeAudioTranscriber(logger)!.transcribe('fixture.wav')).resolves.toBe('local text');
        expect(mocks.create).toHaveBeenCalledWith({ model, use_gpu: false, no_prints: true });
        expect(mocks.transcribe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ language: 'auto' }));
        expect(mocks.download).not.toHaveBeenCalled();
    });
    it('honors an explicit language', async () => {
        vi.stubEnv('WHISPER_LANGUAGE', 'es');
        const { tryCreateWhisperNodeAudioTranscriber } = await import('../../src/services/whisper-cpp-node.transcriber.js');
        await tryCreateWhisperNodeAudioTranscriber(logger)!.transcribe('fixture.wav');
        expect(mocks.transcribe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ language: 'es' }));
    });
    it('rejects an invalid model override without downloading or initializing a context', async () => {
        vi.stubEnv('WHISPER_MODEL_PATH', join(root, 'absent.bin'));
        const { tryCreateWhisperNodeAudioTranscriber } = await import('../../src/services/whisper-cpp-node.transcriber.js');
        await expect(tryCreateWhisperNodeAudioTranscriber(logger)!.transcribe('fixture.wav')).rejects.toThrow(/WHISPER_MODEL_PATH/);
        expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
    });
});
