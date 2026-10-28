import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Worker } from 'node:worker_threads';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDGE_TTS_ENDPOINT, resolveTtsConfig } from '../../src/services/tts-config.ts';

// Real Node workers and the actual installed msedge-tts client; only its socket
// module is synthetic. This never connects to Microsoft or reads credentials.
describe('pinned Edge protocol and packaged worker contract', () => {
    let root: string;
    const workers: Worker[] = [];
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'wa-edge-protocol-')); });
    afterEach(async () => { await Promise.all(workers.splice(0).map(worker => worker.terminate())); await rm(root, { recursive: true, force: true }); });
    const run = async (scenario: string) => {
        const output = join(root, 'speech.partial');
        const worker = new Worker(new URL('../fixtures/tts-edge-protocol-worker.mjs', import.meta.url), {
            env: {}, execArgv: [], stdout: true, stderr: true,
            workerData: { scenario, output, expectedEndpoint: EDGE_TTS_ENDPOINT, maxBytes: 8 * 1024 * 1024, text: '<test> & "quote" \'sample\'',
                voice: 'en-US-AndrewMultilingualNeural', locale: 'en-US', speed: 1,
                packageJson: fileURLToPath(new URL('../../package.json', import.meta.url)),
                productionWorker: new URL('../../src/services/edge-tts.worker.mjs', import.meta.url).href }
        });
        workers.push(worker);
        let diagnostics = ''; let inspection: Record<string, boolean> | undefined;
        worker.stdout?.on('data', chunk => { diagnostics += chunk; }); worker.stderr?.on('data', chunk => { diagnostics += chunk; });
        const result = await new Promise<{ ok: boolean }>((resolve, reject) => {
            worker.on('message', message => {
                if (message.inspection) inspection = message;
                if (typeof message.ok === 'boolean') resolve(message);
            });
            worker.once('error', () => reject(new Error('Synthetic Edge worker failed')));
            worker.once('exit', code => { if (code !== 0) reject(new Error('Synthetic Edge worker exited')); });
        });
        await worker.terminate();
        return { result, inspection, diagnostics, output };
    };
    it('requires turn.end, escapes SSML and disables subtitles, with no inherited secrets', async () => {
        const { result, inspection, diagnostics, output } = await run('complete');
        expect(result.ok).toBe(true);
        expect(inspection).toMatchObject({ escaped: true, noMetadata: true, environmentEmpty: true, destinationMatches: true, signingV2: true, compatibilityHeaders: true });
        expect(EDGE_TTS_ENDPOINT).toBe('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1');
        expect(JSON.parse(resolveTtsConfig({}).destinationKey)).toEqual(['edge', EDGE_TTS_ENDPOINT, '']);
        expect(await readFile(output, 'utf8')).toBe('ID3-fixture-audio');
        expect((await stat(output)).mode & 0o777).toBe(0o600);
        expect(diagnostics).not.toContain('fixture-sensitive');
        expect(diagnostics).not.toContain('<test>');
    });
    it.each(['close', 'error', 'empty', 'oversize'])('rejects %s even when audio bytes or a stream end are present', async scenario => {
        const { result, diagnostics } = await run(scenario);
        expect(result.ok).toBe(false);
        expect(diagnostics).not.toContain('fixture-sensitive');
        expect(diagnostics).not.toContain('<test>');
    });
});
