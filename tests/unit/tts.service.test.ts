import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFile, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TtsService, type TtsSynthesisOptions } from '../../src/services/tts.service.ts';
import { resolveTtsConfig, type TtsConfig } from '../../src/services/tts-config.ts';

const mocks = vi.hoisted(() => ({ edge: vi.fn(), media: vi.fn(), fetch: vi.fn(), beforeRemove: vi.fn() }));
vi.mock('node:fs/promises', async importOriginal => {
    const original = await importOriginal<typeof import('node:fs/promises')>();
    return { ...original, rm: async (...args: Parameters<typeof original.rm>) => { await mocks.beforeRemove(args[0]); return original.rm(...args); } };
});
vi.mock('../../src/services/edge-tts.service.ts', () => ({ EdgeTtsService: class { write(...args: unknown[]) { return mocks.edge(...args); } } }));
vi.mock('../../src/services/outgoing-media.service.ts', () => ({ OutgoingMediaService: class { prepare(...args: unknown[]) { return mocks.media(...args); } } }));
const remote = { ttsEndpoint: 'https://api.fish.audio/v1/tts', ttsModel: 's2.1-pro-free', ttsEnv: 'WHATSAPP_NG_TEST_TTS_KEY', ttsVoice: 'fixture-existing-reference' };

describe('bounded speech preparation, consent and lifecycle', () => {
    let root: string;
    let media: string;
    const services: TtsService[] = [];
    const artifacts: Array<{ dispose(): Promise<void> }> = [];
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'wa-tts-service-')); media = join(root, 'media');
        mocks.beforeRemove.mockReset().mockResolvedValue(undefined);
        mocks.edge.mockReset().mockImplementation(async (_text, _config, path) => { await writeFile(path, 'ID3-fixture', { mode: 0o600, flag: 'wx' }); });
        mocks.media.mockReset().mockImplementation(async request => {
            const output = join(root, `owned-${randomUUID()}.ogg`);
            await copyFile(request.path, output);
            const artifact = { content: { audio: { url: output }, ptt: true, mimetype: 'audio/ogg; codecs=opus' },
                metadata: { type: 'audio', fileName: 'speech.ogg', mimetype: 'audio/ogg; codecs=opus', size: 11, voiceNote: true },
                dispose: () => rm(output, { force: true }) };
            artifacts.push(artifact); return artifact;
        });
        mocks.fetch.mockReset(); vi.stubGlobal('fetch', mocks.fetch); vi.stubEnv(remote.ttsEnv, 'fixture-key-not-for-config');
    });
    afterEach(async () => {
        await Promise.all(services.splice(0).map(service => service.close()));
        await Promise.all(artifacts.splice(0).map(artifact => artifact.dispose()));
        vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true });
    });
    const create = (timeout = 60_000) => {
        const service = new TtsService({ workspaceRoot: root, mediaRoot: media, synthesisTimeoutMs: timeout });
        services.push(service); return service;
    };
    const prepare = (service: TtsService, config: TtsConfig = {}, options: TtsSynthesisOptions = {}, text = 'Fixed public phrase') => {
        const pending = service.prepare(text, config, { approvedDestinationKey: resolveTtsConfig(config).destinationKey, ...options });
        void pending.catch(() => {}); return pending;
    };
    const hold = () => {
        let began!: () => void;
        const started = new Promise<void>(resolve => { began = resolve; });
        mocks.edge.mockImplementationOnce(async (_text, _config, path, signal) => {
            await writeFile(path, 'ID3-fixture', { mode: 0o600 }); began();
            await new Promise<void>((_resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true }); });
        });
        return started;
    };

    it('does no filesystem, worker or HTTP work merely by constructing or lacking destination consent', async () => {
        const service = create();
        expect(await readdir(root)).toEqual([]);
        await expect(service.prepare('Fixed public phrase', {})).rejects.toThrow('explicit consent');
        expect(mocks.edge).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
        expect(await readdir(root)).toEqual([]);
    });
    it('rejects an old destination approval rather than switching provider', async () => {
        const service = create();
        await expect(prepare(service, remote, { approvedDestinationKey: resolveTtsConfig({}).destinationKey })).rejects.toThrow('consent');
        expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.edge).not.toHaveBeenCalled();
    });
    it.each([0, 2001, 100_000])('rejects empty or over-budget text without submitting it (length %s)', async length => {
        await expect(prepare(create(), {}, {}, 'x'.repeat(length))).rejects.toThrow('1–2000');
        expect(mocks.edge).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
    });
    it('counts Unicode characters, owns a private snapshot and deletes only generated intermediates', async () => {
        const result = await prepare(create(), {}, {}, '🙂'.repeat(2000));
        expect(result.content).toMatchObject({ ptt: true, mimetype: 'audio/ogg; codecs=opus' });
        expect(result.speech).toEqual({ provider: 'edge', destination: 'speech.platform.bing.com' });
        const path = (result.content as { audio: { url: string } }).audio.url;
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        expect((await stat(media)).mode & 0o777).toBe(0o700);
        expect(await readdir(media)).toEqual([]);
        expect(await readFile(path, 'utf8')).toBe('ID3-fixture');
        await result.dispose(); await expect(stat(path)).rejects.toThrow();
    });
    it('does not use Edge after a remote error and removes its private intermediate directory', async () => {
        mocks.fetch.mockResolvedValueOnce(new Response('fixture-error-body', { status: 401 }));
        await expect(prepare(create(), remote)).rejects.toThrow('HTTP 401');
        expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(mocks.edge).not.toHaveBeenCalled();
        expect(await readdir(media)).toEqual([]);
    });
    it('cleans failed codec preparation without exposing underlying diagnostics', async () => {
        mocks.media.mockRejectedValueOnce(new Error('fixture-sensitive-codec-diagnostic'));
        await expect(prepare(create())).rejects.toThrow(/^Speech preparation failed$/);
        expect(await readdir(media)).toEqual([]);
    });
    it('caps the queue at one active plus five pending and immediately removes cancelled slots', async () => {
        const started = hold(); const service = create();
        const active = prepare(service); await started;
        const controllers = Array.from({ length: 5 }, () => new AbortController());
        const waiting = controllers.map(controller => prepare(service, {}, { signal: controller.signal }));
        await expect(prepare(service)).rejects.toThrow('queue is full');
        controllers[0].abort(); await expect(waiting[0]).rejects.toThrow('cancelled');
        const replacement = prepare(service);
        expect(mocks.edge).toHaveBeenCalledTimes(1);
        await service.close();
        const outcomes = await Promise.allSettled([active, ...waiting, replacement]);
        expect(outcomes.every(result => result.status === 'rejected')).toBe(true);
        expect(mocks.edge).toHaveBeenCalledTimes(1);
        expect(await readdir(media)).toEqual([]);
    });
    it('drops stale queued work before its slot starts', async () => {
        const started = hold(); const service = create();
        const active = prepare(service); await started;
        let current = true;
        const waiting = prepare(service, {}, { isCurrent: () => current });
        current = false;
        await expect(waiting).rejects.toThrow('cancelled');
        expect(mocks.edge).toHaveBeenCalledTimes(1);
        await service.close(); await expect(active).rejects.toThrow('cancelled');
    });
    it('aborts active work after its session scope changes', async () => {
        const started = hold(); const service = create(); let current = true;
        const pending = prepare(service, {}, { isCurrent: () => current }); await started;
        current = false; await expect(pending).rejects.toThrow('cancelled');
        expect(await readdir(media)).toEqual([]);
    });
    it('enforces the synthesis deadline with actual cancellation', async () => {
        vi.useFakeTimers();
        const started = hold(); const service = create(100);
        const pending = prepare(service); await started;
        await vi.advanceTimersByTimeAsync(101);
        await expect(pending).rejects.toThrow('timed out');
        expect(await readdir(media)).toEqual([]);
    });
    it('snapshots queued endpoint/model/voice and does not upload to a later mutated destination', async () => {
        let release!: () => void;
        mocks.edge.mockImplementationOnce(async (_text, _config, path) => {
            await new Promise<void>(resolve => { release = resolve; });
            await writeFile(path, 'ID3-fixture', { mode: 0o600 });
        });
        const service = create(); const active = prepare(service);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        const config = { ...remote }; const queued = prepare(service, config);
        config.ttsEndpoint = 'https://not-approved.example.test/tts'; config.ttsVoice = 'other-voice';
        mocks.fetch.mockResolvedValueOnce(new Response('ID3-fixture', { headers: { 'content-type': 'audio/mpeg' } }));
        release(); await active; await queued;
        const [url, options] = mocks.fetch.mock.calls[0];
        expect(url).toBe(remote.ttsEndpoint); expect(JSON.parse(options.body).reference_id).toBe(remote.ttsVoice);
    });
    it('close waits for active provider settlement before removing partial files', async () => {
        let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
        let stop!: () => void; let partial = '';
        mocks.edge.mockImplementationOnce(async (_text, _config, path, signal) => {
            partial = path; await writeFile(path, 'ID3-fixture', { mode: 0o600 }); began();
            await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => { stop = () => reject(new Error('fixture stopped')); }, { once: true }));
        });
        const service = create(); const pending = prepare(service); await started;
        let closed = false; const closing = service.close().then(() => { closed = true; });
        await Promise.resolve(); expect(closed).toBe(false); await expect(stat(partial)).resolves.toBeDefined();
        stop(); await closing; await expect(pending).rejects.toThrow('cancelled');
        expect(await readdir(media)).toEqual([]);
        await expect(prepare(service)).rejects.toThrow('closed');
    });
    it.each(['abort', 'scope', 'close'])('rejects %s during final intermediate cleanup and disposes the prepared snapshot', async mode => {
        let cleanupStarted!: () => void; const began = new Promise<void>(resolve => { cleanupStarted = resolve; });
        let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
        let paused = false;
        mocks.beforeRemove.mockImplementation(async path => {
            if (!paused && basename(String(path)).startsWith('tts-')) { paused = true; cleanupStarted(); await gate; }
        });
        const service = create(); const controller = new AbortController(); let current = true;
        const pending = prepare(service, {}, { signal: controller.signal, isCurrent: () => current });
        let closing: Promise<void> | undefined;
        try {
            await began;
            const path = (artifacts[0] as { content?: { audio: { url: string } } }).content!.audio.url;
            await expect(stat(path)).resolves.toBeDefined();
            if (mode === 'abort') controller.abort();
            else if (mode === 'scope') current = false;
            else closing = service.close();
            release();
            await expect(pending).rejects.toThrow('cancelled');
            await closing;
            await expect(stat(path)).rejects.toThrow();
            expect(await readdir(media)).toEqual([]);
        } finally { release(); }
    });
    it('rejects cancelled, stale or throwing-scope inputs before creating scratch storage', async () => {
        const controller = new AbortController(); controller.abort();
        const service = create();
        for (const options of [{ signal: controller.signal }, { isCurrent: () => false }, { isCurrent: () => { throw new Error('fixture'); } }]) {
            await expect(prepare(service, {}, options)).rejects.toThrow('cancelled');
        }
        expect(await readdir(root)).toEqual([]); expect(mocks.edge).not.toHaveBeenCalled();
    });
});
