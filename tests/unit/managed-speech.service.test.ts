import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { ManagedSpeechService, parseManagedSpeechCommand } from '../../src/services/managed-speech.service.js';

const fixture = fileURLToPath(new URL('../fixtures/managed-speech-server.mjs', import.meta.url));
const services: ManagedSpeechService[] = []; const roots: string[] = []; const children: ChildProcess[] = [];
const config = (endpoint: string) => ({ sttEndpoint: endpoint, sttModel: 'fixture-api-model', sttEnv: 'FIXTURE_KEY' });
async function port(): Promise<number> {
    const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing fixture port');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); return address.port;
}
async function setup(mode = 'normal') {
    const root = await mkdtemp(join(tmpdir(), 'wa-managed-speech-')); roots.push(root);
    const endpoint = `http://127.0.0.1:${await port()}/v1`; const metrics = join(root, 'metrics.jsonl');
    const descriptor = { executable: process.execPath, args: [fixture, new URL(endpoint).port, 'whisper', 'fixture-loaded-model', mode, metrics], cwd: root,
        endpoint, backend: 'whisper', model: 'fixture-api-model', loadedModel: 'fixture-loaded-model', env: ['WA_EXPLICIT_TEST'], startupTimeoutMs: 5000 };
    const env = { PATH: process.env.PATH, HOME: root, FIXTURE_KEY: 'synthetic-key', WA_EXPLICIT_TEST: 'yes', WA_FORBIDDEN_TEST: 'synthetic-not-inherited', CRISPASR_STT_CMD: JSON.stringify(descriptor) };
    const notices: string[] = []; const service = new ManagedSpeechService({ root, env, notify: text => notices.push(text) }); services.push(service);
    const selection = { connected: true, scope: 'synthetic-account:1', stt: config(endpoint) };
    const events = async () => { try { return (await readFile(metrics, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; pid: number; explicitEnv: boolean; leakedEnv: boolean }); } catch { return []; } };
    return { root, endpoint, descriptor, env, notices, service, selection, events };
}
afterEach(async () => {
    await Promise.all(services.splice(0).map(service => service.disconnect()));
    for (const child of children.splice(0)) { child.kill('SIGKILL'); await new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode) resolve(); else child.once('close', () => resolve()); }); }
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('trusted managed speech descriptors', () => {
    it('preserves opt-out and refuses shell commands, secret arguments and malformed bindings', () => {
        expect(parseManagedSpeechCommand(undefined, 'stt')).toBeUndefined(); expect(parseManagedSpeechCommand('  ', 'tts')).toBeUndefined();
        for (const input of ['crispasr --server', '{}', '[]', JSON.stringify({ executable: '/bin/sh', args: ['-c', 'echo unsafe'] })]) expect(() => parseManagedSpeechCommand(input, 'stt')).toThrow();
    });
    it.each(['stt', 'tts'] as const)('reports malformed %s configuration once for connected numeric-loopback selections only', async role => {
        const h = await setup(); const notices: string[] = [];
        const service = new ManagedSpeechService({ root: h.root, env: { HOME: h.root, [`CRISPASR_${role.toUpperCase()}_CMD`]: '{SYNTHETIC-INVALID-DESCRIPTOR' }, notify: message => notices.push(message) }); services.push(service);
        const selected = (endpoint: string) => role === 'stt' ? config(endpoint) : {
            ttsEndpoint: endpoint + '/audio/speech', ttsProtocol: 'openai-compatible' as const, ttsModel: 'fixture-api-model', ttsEnv: 'FIXTURE_KEY', ttsUseServerVoice: true };
        const state = { connected: true, scope: 'fixture:1', stt: {}, [role]: selected(h.endpoint) };
        service.update({ ...state, connected: false }); expect(notices).toEqual([]);
        for (const endpoint of ['https://speech.example.test/v1', 'http://localhost:8880/v1']) {
            const external = selected(endpoint); service.update({ ...state, [role]: external });
            expect(await service.gate(role, external)).toEqual({}); expect(notices).toEqual([]);
        }
        service.update(state); service.update(state);
        await expect(service.gate(role, selected(h.endpoint))).rejects.toThrow('(configuration)');
        const other = selected('http://127.0.0.2:8880/v1'); service.update({ ...state, [role]: other });
        await expect(service.gate(role, other)).rejects.toThrow('(configuration)');
        expect(notices).toHaveLength(1); expect(notices[0]).toContain(`Managed ${role.toUpperCase()} unavailable (configuration)`);
        expect(notices[0]).not.toContain('SYNTHETIC-INVALID-DESCRIPTOR'); expect(await h.events()).toEqual([]);
        service.retry(); service.update(state); expect(notices).toHaveLength(2); expect(await h.events()).toEqual([]);
    });
    it('validates role, loopback, explicit model and shell-free arguments', async () => {
        const h = await setup(); expect(parseManagedSpeechCommand(JSON.stringify(h.descriptor), 'stt')?.backend).toBe('whisper');
        for (const patch of [{ endpoint: 'http://example.test/v1' }, { endpoint: 'http://localhost:8096/v1' }, { endpoint: h.endpoint + '?key=secret' },
            { args: ['--api-keys', 'synthetic-value'] }, { executable: 'relative' }, { cwd: 'relative' }, { loadedModel: '' }, { unknown: true }]) {
            expect(() => parseManagedSpeechCommand(JSON.stringify({ ...h.descriptor, ...patch }), 'stt')).toThrow();
        }
        expect(() => parseManagedSpeechCommand(JSON.stringify(h.descriptor), 'tts')).toThrow();
    });
});

describe.skipIf(!['darwin', 'linux'].includes(process.platform))('owned managed speech lifecycle', () => {
    it('does not spawn on discovery, disconnected startup or unrelated hosted selections', async () => {
        const h = await setup(); h.service.update({ ...h.selection, connected: false });
        h.service.update({ ...h.selection, stt: config('https://speech.example.test/v1') });
        await new Promise(resolve => setTimeout(resolve, 150)); expect(await h.events()).toEqual([]);
        expect(await h.service.gate('stt', config('https://speech.example.test/v1'))).toEqual({});
    });
    it('starts once on connection, proves ownership/model and limits inherited environment', async () => {
        const h = await setup(); h.service.update(h.selection); h.service.update(h.selection);
        const [first, second] = await Promise.all([h.service.gate('stt', h.selection.stt), h.service.gate('stt', h.selection.stt)]);
        expect(first.isCurrent?.()).toBe(true); expect(second.isCurrent?.()).toBe(true); expect(h.service.getStatus('stt')).toBe('ready');
        const events = await h.events(); expect(events.filter(event => event.event === 'spawn')).toHaveLength(1);
        expect(events[0]).toMatchObject({ explicitEnv: true, leakedEnv: false });
        const leases = join(h.root, 'managed-speech'); const files = await readdir(leases); expect(files).toHaveLength(1);
        expect((await stat(leases)).mode & 0o777).toBe(0o700); expect((await stat(join(leases, files[0]))).mode & 0o777).toBe(0o600);
        await h.service.disconnect(); expect(first.signal?.aborted).toBe(true); expect(first.isCurrent?.()).toBe(false); expect(h.service.getStatus('stt')).toBe('stopped'); expect(await readdir(leases)).toEqual([]);
    });
    it.each(['wrong-backend', 'wrong-model', 'exit'])('fails closed and never retries %s per request', async mode => {
        const h = await setup(mode); h.service.update(h.selection);
        await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow();
        h.service.update(h.selection); await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow();
        expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1); expect(h.service.getStatus('stt')).toBe('failed');
        expect(h.notices.join()).not.toContain('synthetic-key');
    });
    it('handles a missing executable without retaining its lease or attempting a provider fallback', async () => {
        const h = await setup(); const service = new ManagedSpeechService({ root: h.root, env: { ...h.env,
            CRISPASR_STT_CMD: JSON.stringify({ ...h.descriptor, executable: join(h.root, 'missing-executable') }) } }); services.push(service);
        service.update(h.selection); await expect(service.gate('stt', h.selection.stt)).rejects.toThrow(); await service.disconnect();
        expect(service.getStatus('stt')).toBe('failed'); expect(await h.events()).toEqual([]); expect(await readdir(join(h.root, 'managed-speech'))).toEqual([]);
    });

    it('never launches over or terminates an existing listener', async () => {
        const h = await setup(); const external = createServer(socket => socket.end()); await new Promise<void>(resolve => external.listen(Number(new URL(h.endpoint).port), '127.0.0.1', resolve));
        try { h.service.update(h.selection); await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow(); expect(await h.events()).toEqual([]); expect(external.listening).toBe(true); }
        finally { await new Promise<void>(resolve => external.close(() => resolve())); }
    });
    it('refuses a retained endpoint lease without touching it', async () => {
        const h = await setup(); h.service.update(h.selection); await h.service.gate('stt', h.selection.stt);
        const competitor = new ManagedSpeechService({ root: h.root, env: h.env }); services.push(competitor); competitor.update(h.selection);
        await expect(competitor.gate('stt', h.selection.stt)).rejects.toThrow();
        expect(h.service.getStatus('stt')).toBe('ready'); expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });
    it('bounds model startup and retains failure across chat-editable setting toggles', async () => {
        const h = await setup('loading'); const service = new ManagedSpeechService({ root: h.root, env: { ...h.env, CRISPASR_STT_CMD: JSON.stringify({ ...h.descriptor, startupTimeoutMs: 300 }) } }); services.push(service);
        service.update(h.selection); await expect(service.gate('stt', h.selection.stt)).rejects.toThrow();
        service.update({ ...h.selection, stt: config('https://speech.example.test/v1') }); service.update(h.selection);
        await expect(service.gate('stt', h.selection.stt)).rejects.toThrow(); expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });
    it('retires startup and request authority on configuration/scope changes without launching another endpoint', async () => {
        const h = await setup(); h.service.update(h.selection); const admission = await h.service.gate('stt', h.selection.stt);
        h.service.update({ ...h.selection, stt: config('https://speech.example.test/v1') });
        expect(admission.signal?.aborted).toBe(true); expect(admission.isCurrent?.()).toBe(false);
        await expect(h.service.gate('stt', { ...h.selection.stt, sttModel: 'other-model' })).rejects.toThrow();
        await h.service.disconnect(); expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });
    it('rejects a stale waiting caller promptly without issuing an inference or restarting shared startup', async () => {
        const h = await setup('loading'); let current = true; h.service.update(h.selection);
        const pending = h.service.gate('stt', h.selection.stt, { isCurrent: () => current }).then(() => 'ready', () => 'cancelled');
        current = false;
        await expect(Promise.race([pending, new Promise(resolve => setTimeout(() => resolve('still-waiting'), 350))])).resolves.toBe('cancelled');
    });
    it('retires a pending startup before disconnect returns', async () => {
        const h = await setup('loading'); h.service.update(h.selection); const pending = h.service.gate('stt', h.selection.stt);
        const rejection = expect(pending).rejects.toThrow(); await new Promise(resolve => setTimeout(resolve, 120)); await h.service.disconnect(); await rejection;
        for (const event of (await h.events()).filter(event => event.event === 'spawn')) expect(() => process.kill(event.pid, 0)).toThrow();
    });
    it('retains an unknown endpoint lock and fails before launching', async () => {
        const h = await setup(); const directory = join(h.root, 'managed-speech'); await mkdir(directory);
        const path = join(directory, createHash('sha256').update(new URL(h.endpoint).origin).digest('hex') + '.lock');
        await writeFile(path, 'unknown-original'); h.service.update(h.selection); await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow();
        await h.service.disconnect(); expect(await readFile(path, 'utf8')).toBe('unknown-original'); expect(await h.events()).toEqual([]);
    });
    it('fails closed on unsupported managed platforms while leaving hosted selections alone', async () => {
        const h = await setup(); const service = new ManagedSpeechService({ root: h.root, env: h.env, platform: 'win32' }); services.push(service); service.update(h.selection);
        await expect(service.gate('stt', h.selection.stt)).rejects.toThrow(); expect(await h.events()).toEqual([]);
        expect(await service.gate('stt', config('https://speech.example.test/v1'))).toEqual({});
    });
    it('rechecks backend/model readiness for every request rather than trusting a retained ready flag', async () => {
        const h = await setup('mutable'); h.service.update(h.selection); const admission = await h.service.gate('stt', h.selection.stt);
        await writeFile(join(h.root, 'metrics.jsonl.model'), 'wrong-after-ready'); await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow();
        expect(admission.signal?.aborted).toBe(true); expect(h.service.getStatus('stt')).toBe('failed'); expect(h.notices.some(text => text.includes('(model)'))).toBe(true);
    });
    it('keeps independent TTS ready when STT selection is retired', async () => {
        const a = await setup(); const b = await setup(); const endpoint = b.endpoint + '/audio/speech';
        const service = new ManagedSpeechService({ root: a.root, env: { ...a.env, CRISPASR_TTS_CMD: JSON.stringify({ ...b.descriptor, endpoint }) } }); services.push(service);
        const tts = { ttsEndpoint: endpoint, ttsProtocol: 'openai-compatible' as const, ttsModel: 'fixture-api-model', ttsEnv: 'FIXTURE_KEY', ttsVoice: 'fixture-voice' };
        service.update({ ...a.selection, tts }); const [sttAdmission, ttsAdmission] = await Promise.all([service.gate('stt', a.selection.stt), service.gate('tts', tts)]);
        service.update({ ...a.selection, stt: config('https://speech.example.test/v1'), tts }); expect(sttAdmission.signal?.aborted).toBe(true); expect(ttsAdmission.isCurrent?.()).toBe(true);
        await service.gate('tts', tts); expect((await b.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });

    it('admits server-default TTS without a named voice and preserves the owned server on voice-only changes', async () => {
        const h = await setup(); const endpoint = h.endpoint + '/audio/speech';
        const service = new ManagedSpeechService({ root: h.root, env: { ...h.env, CRISPASR_STT_CMD: undefined,
            CRISPASR_TTS_CMD: JSON.stringify({ ...h.descriptor, endpoint, backend: 'chatterbox',
                    args: [fixture, new URL(endpoint).port, 'chatterbox', ...h.descriptor.args.slice(3)] }) } }); services.push(service);
        const tts = { ttsEndpoint: endpoint, ttsProtocol: 'openai-compatible' as const, ttsModel: 'fixture-api-model', ttsEnv: 'FIXTURE_KEY', ttsUseServerVoice: true };
        const state = { ...h.selection, stt: {}, tts }; service.update(state);
        const admission = await service.gate('tts', tts); expect(admission.isCurrent?.()).toBe(true); expect(service.getStatus('tts')).toBe('ready');
        const named = { ...tts, ttsUseServerVoice: false, ttsVoice: 'fixture-voice' };
        service.update({ ...state, tts: named }); await service.gate('tts', named);
        expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1); expect(admission.signal?.aborted).toBe(false);
        await service.disconnect(); expect(admission.signal?.aborted).toBe(true);
    });
    it('does not borrow a replacement credential-selection lifetime for an older request', async () => {
        const h = await setup(); const service = new ManagedSpeechService({ root: h.root, env: { ...h.env, SECOND_KEY: 'synthetic-key' } }); services.push(service);
        service.update(h.selection); const old = await service.gate('stt', h.selection.stt);
        const next = { ...h.selection, stt: { ...h.selection.stt, sttEnv: 'SECOND_KEY' } }; service.update(next);
        await expect(service.gate('stt', h.selection.stt)).rejects.toThrow(); await service.gate('stt', next.stt); expect(old.signal?.aborted).toBe(true);
    }, 10_000);

    it('observes a failed readiness check even if its caller aborts before the wait is attached', async () => {
        const h = await setup(); h.service.update(h.selection); await h.service.gate('stt', h.selection.stt); const controller = new AbortController();
        const subject = h.service as unknown as { check(): Promise<void> }; const original = subject.check; let checked = false;
        subject.check = () => { checked = true; controller.abort(); return Promise.reject(new Error('Synthetic readiness failure')); };
        try {
            await expect(h.service.gate('stt', h.selection.stt, { signal: controller.signal })).rejects.toThrow(); expect(checked).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 20));
        } finally { subject.check = original; }
    });

    it('cancels a waiting caller without cancelling shared startup', async () => {
        const h = await setup(); h.service.update(h.selection); const abort = new AbortController(); const pending = h.service.gate('stt', h.selection.stt, { signal: abort.signal }); abort.abort();
        await expect(pending).rejects.toThrow(); await h.service.gate('stt', h.selection.stt); expect(h.service.getStatus('stt')).toBe('ready');
    });
    it('force-stops only its owned foreground server after the TERM grace period', async () => {
        const h = await setup('ignore-term'); h.service.update(h.selection); await h.service.gate('stt', h.selection.stt);
        const pid = (await h.events())[0].pid; await h.service.disconnect(); expect(() => process.kill(pid, 0)).toThrow();
    });
    it('does not replay a cached connected selection from explicit retry', async () => {
        const h = await setup(); h.service.update(h.selection); await h.service.gate('stt', h.selection.stt);
        const update = vi.spyOn(h.service, 'update'); h.service.retry(); expect(update).not.toHaveBeenCalled(); update.mockRestore();
    });
    it.each(['warm-models', 'health-slow-once'])('waits for transient startup metadata (%s) inside its startup budget', async mode => {
        const h = await setup(mode); h.service.update(h.selection); await h.service.gate('stt', h.selection.stt); expect(h.service.getStatus('stt')).toBe('ready');
        expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });
    it('refuses a transient metadata admission without killing a healthy server or another request', async () => {
        const h = await setup(); h.service.update(h.selection); const existing = await h.service.gate('stt', h.selection.stt);
        await writeFile(join(h.root, 'metrics.jsonl.probe'), 'health-unready'); await expect(h.service.gate('stt', h.selection.stt)).rejects.toThrow();
        expect(existing.signal?.aborted).toBe(false); await h.service.gate('stt', h.selection.stt); expect(h.service.getStatus('stt')).toBe('ready');
        expect((await h.events()).filter(event => event.event === 'spawn')).toHaveLength(1);
    });
    it('settles timed-out retirement without poisoning later teardown or launching from uncertain ownership', async () => {
        vi.useFakeTimers();
        try {
            const service = new ManagedSpeechService({ root: '/unused-synthetic-root', env: {} });
            const entry = (exited: Promise<void>) => ({ role: 'stt', controller: new AbortController(), reject: () => {}, checks: new Map(), retired: false,
                worker: { exitCode: null, signalCode: null, connected: true, send: vi.fn() }, exited });
            const subject = service as unknown as { entries: Map<string, ReturnType<typeof entry>> };
            subject.entries.set('stt', entry(new Promise(() => {})));
            const first = service.disconnect().then(() => true, () => false); await vi.advanceTimersByTimeAsync(10_001); expect(await first).toBe(true);
            expect(service.getStatus('stt')).toBe('failed');
            const next = entry(Promise.resolve()); subject.entries.set('stt', next); await service.disconnect(); expect(next.worker.send).toHaveBeenCalledOnce();
        } finally { vi.useRealTimers(); }
    });

    it('refuses a queued replacement after predecessor retirement becomes unconfirmed', async () => {
        const h = await setup(); vi.useFakeTimers();
        try {
            const subject = h.service as unknown as { entries: Map<string, unknown> };
            subject.entries.set('stt', { role: 'stt', controller: new AbortController(), reject: () => {}, checks: new Map(), retired: false,
                worker: { exitCode: null, signalCode: null, connected: true, send: vi.fn() }, exited: new Promise(() => {}) });
            h.service.update(h.selection); const admission = h.service.gate('stt', h.selection.stt).then(() => false, () => true);
            await vi.advanceTimersByTimeAsync(10_001); expect(await admission).toBe(true); expect(h.service.getStatus('stt')).toBe('failed'); expect(await h.events()).toEqual([]);
        } finally { vi.useRealTimers(); }
    });

    it('supports independent TTS without an STT command', async () => {
        const h = await setup(); const ttsEndpoint = h.endpoint + '/audio/speech';
        const service = new ManagedSpeechService({ root: h.root, env: { ...h.env, CRISPASR_STT_CMD: undefined, CRISPASR_TTS_CMD: JSON.stringify({ ...h.descriptor, endpoint: ttsEndpoint }) } }); services.push(service);
        const tts = { ttsEndpoint, ttsProtocol: 'openai-compatible' as const, ttsModel: 'fixture-api-model', ttsEnv: 'FIXTURE_KEY', ttsVoice: 'fixture-voice' };
        service.update({ ...h.selection, stt: {}, tts }); await service.gate('tts', tts); expect(service.getStatus('tts')).toBe('ready'); expect(service.getStatus('stt')).toBe('disabled');
    });
    it.each(['SIGKILL', 'SIGHUP'] as const)('cleans the owned child on parent %s (terminal group for HUP)', async signal => {
        const h = await setup(); const module = fileURLToPath(new URL('../../src/services/managed-speech.service.ts', import.meta.url));
        const host = join(h.root, 'host.mjs'); const ready = join(h.root, 'ready');
        const loader = import.meta.resolve('tsx');
        await writeFile(host, `import {writeFile} from 'node:fs/promises';import {ManagedSpeechService} from ${JSON.stringify(module)};const s=new ManagedSpeechService({root:${JSON.stringify(h.root)},env:${JSON.stringify(h.env)}});s.update(${JSON.stringify(h.selection)});await s.gate('stt',${JSON.stringify(h.selection.stt)});await writeFile(${JSON.stringify(ready)},'ready');setInterval(()=>{},1000);`);
        const child = spawn(process.execPath, ['--import', loader, host], { env: { PATH: process.env.PATH, HOME: h.root }, stdio: 'ignore', detached: true }); children.push(child);
        await expect.poll(async () => { try { return await readFile(ready, 'utf8'); } catch { return ''; } }, { timeout: 12_000 }).toBe('ready');
        const pid = (await h.events())[0].pid;
        try {
            if (!child.pid) throw new Error('Missing synthetic host PID');
            if (signal === 'SIGHUP') process.kill(-child.pid, signal); else child.kill(signal);
            await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }, { timeout: 9000 }).toBe(false);
            await expect.poll(async () => readdir(join(h.root, 'managed-speech')), { timeout: 3000 }).toEqual([]);
        } finally {
            // Baseline HUP intentionally exposes an orphan; clean only this test-created server.
            try { process.kill(pid, 'SIGKILL'); } catch { /* Already exited. */ }
        }
    }, 20_000);
});
