import type { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeTtsService } from '../../src/services/edge-tts.service.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';

const mocks = vi.hoisted(() => ({ construct: vi.fn() }));
vi.mock('node:worker_threads', async () => { const { EventEmitter } = await import('node:events'); return { Worker: class extends EventEmitter {
    stdout = { resume: vi.fn() };
    stderr = { resume: vi.fn() };
    terminate = vi.fn().mockResolvedValue(0);
    constructor(url: URL, options: unknown) { super(); mocks.construct(url, options, this); }
} }; });

describe('owned Edge worker lifetime', () => {
    beforeEach(() => { mocks.construct.mockClear(); });
    afterEach(() => { vi.restoreAllMocks(); });
    const start = (signal = new AbortController().signal) => new EdgeTtsService().write('Fixed public phrase', resolveTtsConfig({}), '/fixture/speech.partial', signal);
    const worker = () => mocks.construct.mock.calls.at(-1)![2] as EventEmitter & { terminate: ReturnType<typeof vi.fn> };

    it('passes text in memory, no inherited environment/preload arguments, and discards child diagnostics', async () => {
        const pending = start();
        const [url, options, child] = mocks.construct.mock.calls[0];
        expect(url.pathname.endsWith('/edge-tts.worker.mjs')).toBe(true);
        expect(options).toMatchObject({ env: {}, execArgv: [], stdout: true, stderr: true, workerData: {
            text: 'Fixed public phrase', voice: 'en-US-AndrewMultilingualNeural', locale: 'en-US', speed: 1, maxBytes: 8 * 1024 * 1024
        } });
        expect(child.stdout.resume).toHaveBeenCalled(); expect(child.stderr.resume).toHaveBeenCalled();
        child.emit('message', { ok: true }); await pending;
        expect(child.terminate).toHaveBeenCalledTimes(1);
    });
    it('does not treat worker exit or a partial file as successful protocol completion', async () => {
        const pending = start(); worker().emit('exit', 0);
        await expect(pending).rejects.toThrow(/^Edge speech synthesis failed$/);
    });
    it('redacts worker errors and rejects explicit client failures', async () => {
        const pending = start(); worker().emit('error', new Error('fixture-sensitive-diagnostic'));
        await expect(pending).rejects.toThrow(/^Edge speech synthesis failed$/);
        const second = start(); worker().emit('message', { ok: false });
        await expect(second).rejects.toThrow(/^Edge speech synthesis failed$/);
    });
    it('waits for actual worker termination before reporting cancellation', async () => {
        const controller = new AbortController();
        const pending = start(controller.signal);
        let stopped!: () => void;
        worker().terminate.mockReturnValueOnce(new Promise<void>(resolve => { stopped = resolve; }));
        let settled = false; void pending.then(() => { settled = true; }, () => { settled = true; });
        controller.abort('fixture-sensitive-reason');
        await Promise.resolve(); expect(settled).toBe(false);
        expect(worker().terminate).toHaveBeenCalledTimes(1);
        stopped(); await expect(pending).rejects.toThrow(/^Speech synthesis cancelled$/);
    });
    it('also waits for termination after success and ignores competing exit events', async () => {
        const pending = start();
        let stopped!: () => void;
        worker().terminate.mockReturnValueOnce(new Promise<void>(resolve => { stopped = resolve; }));
        let settled = false; void pending.then(() => { settled = true; });
        worker().emit('message', { ok: true }); worker().emit('exit', 1);
        await Promise.resolve(); expect(settled).toBe(false);
        stopped(); await pending;
        expect(worker().terminate).toHaveBeenCalledTimes(1);
    });
    it('does not create a worker for an already-cancelled request', async () => {
        const controller = new AbortController(); controller.abort();
        await expect(start(controller.signal)).rejects.toThrow('cancelled');
        expect(mocks.construct).not.toHaveBeenCalled();
    });
});
