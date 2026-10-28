import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    ModelRuntime, createAgentSession, DefaultResourceLoader,
    SessionManager, SettingsManager, type ExtensionAPI
} from '@mariozechner/pi-coding-agent';
import { createAssistantMessageEventStream, getModel, type AssistantMessage } from '@earendil-works/pi-ai/compat';
import { ConversationRouter } from '../../src/services/conversation-router.service.ts';
import { OwnerAuthorization } from '../../src/services/owner-authorization.service.ts';
import { RunReportService } from '../../src/services/run-report.service.ts';
import type { WhatsAppInputKind, WhatsAppRequestMetadata } from '../../src/models/whatsapp.types.ts';

const image = {
    type: 'image' as const, mimeType: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGP4z8DwHwohFABFzAf5Zsv/OQAAAABJRU5ErkJggg=='
};

describe('declared Pi SDK sidecar compatibility', () => {
    it.each([
        ['enabled', 'fixture.txt', 1, 0, 1], ['enabled', 'missing.txt', 0, 1, 1],
        ['consume-disabled-enable', 'fixture.txt', 1, 0, 0], ['consume-enabled-cycle', 'fixture.txt', 1, 0, 0],
        ['enable-before-consume', 'fixture.txt', 1, 0, 1]
    ] as const)('with %s: counts native read of %s without leaking args/results or forwarding terminal work', async (mode, toolPath, succeeded, failed, expected) => {
        const root = await mkdtemp(join(tmpdir(), 'wa-report-sdk-'));
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network blocked in stats fixture'));
        await writeFile(join(root, 'fixture.txt'), 'private-result-fixture');
        const router = new ConversationRouter(); const send = vi.fn().mockResolvedValue({ success: true, attempts: 1 });
        let enabled = mode !== 'consume-disabled-enable' && mode !== 'enable-before-consume'; let revision = 0;
        let resume!: () => void; let consumed!: () => void;
        const holding = new Promise<void>(resolve => { resume = resolve; }); const started = new Promise<void>(resolve => { consumed = resolve; });
        const reports = new RunReportService({ router, policy: () => { const captured = revision; return { enabled, isCurrent: () => captured === revision }; }, send, notify: vi.fn() });
        const settings = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
        const runtime = await ModelRuntime.create({ authPath: join(root, 'auth.json'), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
        await runtime.setRuntimeApiKey('openai', 'offline-fixture-not-a-credential');
        let api!: ExtensionAPI; let complete!: () => void;
        const loader = new DefaultResourceLoader({ cwd: root, agentDir: root, settingsManager: settings, noExtensions: true,
            noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [extension => {
                api = extension; extension.on('input', event => { router.observeInput(event); });
                extension.on('agent_start', () => { reports.startRun(); router.startRun(); });
                extension.on('message_start', (event, ctx) => {
                    if (event.message.role === 'user') { router.consume(event.message); reports.noteInput(); }
                    if (event.message.role === 'assistant') { router.freeze(); reports.capture(router.snapshot()!, ctx.signal); }
                });
                extension.on('message_start', async event => {
                    if (event.message.role === 'user' && mode.startsWith('consume-')) { consumed(); await holding; }
                });
                extension.registerCommand('fixture-stats', { description: 'Local fixture preference commit', handler: async () => {
                    if (mode === 'consume-enabled-cycle') { enabled = false; revision++; }
                    enabled = true; revision++;
                } });
                extension.on('tool_execution_start', event => { reports.toolStarted(event.toolCallId, router.snapshot()); });
                extension.on('tool_execution_end', event => { reports.toolEnded(event.toolCallId, event.isError); });
                extension.on('turn_end', event => { reports.finish(router.snapshot(), event.message); });
                extension.on('agent_end', () => { router.endRun(false); });
                extension.on('agent_settled', () => { complete(); });
            }] });
        await loader.reload();
        const { session } = await createAgentSession({ cwd: root, agentDir: root, resourceLoader: loader, settingsManager: settings,
            sessionManager: SessionManager.inMemory(), modelRuntime: runtime, model: getModel('openai', 'gpt-4o-mini'), tools: ['read'] });
        try {
            let calls = 0;
            vi.spyOn(runtime, 'streamSimple').mockImplementation(model => {
                const stream = createAssistantMessageEventStream(); const tool = ++calls === 1;
                const message: AssistantMessage = { role: 'assistant', api: model.api, provider: model.provider, model: model.id,
                    content: tool ? [{ type: 'toolCall', id: 'read-once', name: 'read', arguments: { path: toolPath } }] : [{ type: 'text', text: 'Offline final' }],
                    timestamp: Date.now(), stopReason: tool ? 'toolUse' : 'stop', usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
                queueMicrotask(() => { stream.push({ type: 'start', partial: message }); stream.push({ type: 'done', reason: tool ? 'toolUse' : 'stop', message }); stream.end(); }); return stream;
            });
            await session.bindExtensions({});
            if (mode === 'enable-before-consume') await session.prompt('/fixture-stats', { source: 'interactive' });
            const ended = new Promise<void>(resolve => { complete = resolve; });
            const input = router.prepare('Read fixture', { id: 'owned', remoteJid: '15550000001@s.whatsapp.net', fromMe: false });
            api.sendUserMessage(input.content, { deliverAs: 'followUp' });
            if (mode.startsWith('consume-')) { await started; await session.prompt('/fixture-stats', { source: 'interactive' }); resume(); }
            await ended; await reports.settled(); expect(send).toHaveBeenCalledTimes(expected);
            if (expected) {
                expect(send.mock.calls[0][1]).toContain(`tools ${succeeded} succeeded, ${failed} failed`);
                expect(send.mock.calls[0][1]).not.toContain(toolPath); expect(send.mock.calls[0][1]).not.toContain('private-result-fixture');
            }
            await session.prompt('Terminal reply', { source: 'interactive' }); await reports.settled(); expect(send).toHaveBeenCalledTimes(expected);
            expect(network).not.toHaveBeenCalled();
        } finally { reports.reset(); session.dispose(); vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); }
    }, 15_000);

    it('keeps rapidly queued WhatsApp chats separate using Pi default follow-up dispatch', async () => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled in offline SDK fixture'));
        const root = await mkdtemp(join(tmpdir(), 'whatsapp-ng-queue-'));
        const router = new ConversationRouter();
        const mirrors: Array<string | undefined> = [];
        const metadata: WhatsAppRequestMetadata[] = [];
        let api!: ExtensionAPI;
        let releaseFirst!: () => void;
        let firstStarted!: () => void;
        const started = new Promise<void>(resolve => { firstStarted = resolve; });
        let settled!: () => void;
        const complete = new Promise<void>(resolve => { settled = resolve; });
        const settings = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
        const runtime = await ModelRuntime.create({ authPath: join(root, 'auth.json'), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
        await runtime.setRuntimeApiKey('openai', 'offline-fixture-not-a-credential');
        const loader = new DefaultResourceLoader({
            cwd: root, agentDir: root, settingsManager: settings,
            noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
            extensionFactories: [extension => {
                api = extension;
                extension.on('input', event => { router.observeInput(event); });
                extension.on('agent_start', () => { router.startRun(); });
                extension.on('message_start', event => {
                    if (event.message.role === 'user' || event.message.role === 'custom') router.consume(event.message);
                    if (event.message.role === 'assistant') router.freeze();
                });
                extension.on('message_end', event => { router.buffer(event.message); });
                extension.on('turn_end', () => {
                    metadata.push(router.getRequestMetadata());
                    mirrors.push(router.mirror()?.snapshot.target);
                });
                extension.on('agent_end', () => { router.endRun(false); });
                extension.on('agent_settled', () => { settled(); });
            }]
        });
        await loader.reload();
        const { session } = await createAgentSession({ cwd: root, agentDir: root, resourceLoader: loader,
            sessionManager: SessionManager.inMemory(), settingsManager: settings, modelRuntime: runtime,
            model: getModel('openai', 'gpt-4o-mini'), tools: [] });
        try {
            let calls = 0;
            vi.spyOn(runtime, 'streamSimple').mockImplementation(model => {
                const stream = createAssistantMessageEventStream();
                const message: AssistantMessage = {
                    role: 'assistant', api: model.api, provider: model.provider, model: model.id,
                    content: [{ type: 'text', text: 'Offline queued answer' }], timestamp: Date.now(), stopReason: 'stop',
                    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
                };
                const finish = () => { stream.push({ type: 'done', reason: 'stop', message }); stream.end(); };
                queueMicrotask(() => {
                    stream.push({ type: 'start', partial: message });
                    if (++calls === 1) { releaseFirst = finish; firstStarted(); }
                    else finish();
                });
                return stream;
            });
            await session.bindExtensions({});
            expect(session.followUpMode).toBe('one-at-a-time');
            const submit = (jid: string, id: string, inputKind: WhatsAppInputKind) => {
                const request = router.prepare(id, { remoteJid: jid, id, fromMe: false }, { inputKind });
                api.sendUserMessage(request.content, { deliverAs: 'followUp' });
            };
            submit('15550000001@s.whatsapp.net', 'A', 'text');
            await started;
            submit('15550000002@s.whatsapp.net', 'B', 'audio');
            submit('15550000003@s.whatsapp.net', 'C', 'image');
            releaseFirst();
            await complete;
            expect(mirrors).toEqual(['15550000001@s.whatsapp.net', '15550000002@s.whatsapp.net', '15550000003@s.whatsapp.net']);
            expect(metadata).toEqual([
                { inputKind: 'text', actorJid: '15550000001@s.whatsapp.net' },
                { inputKind: 'audio', actorJid: '15550000002@s.whatsapp.net' },
                { inputKind: 'image', actorJid: '15550000003@s.whatsapp.net' }
            ]);
            expect(network).not.toHaveBeenCalled();
        } finally {
            vi.restoreAllMocks();
            session.dispose();
            await rm(root, { recursive: true, force: true });
        }
    }, 15_000);

    it('uses the real user-input pipeline with policy blocking, transformation and image ownership', async () => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled in offline SDK fixture'));
        const root = await mkdtemp(join(tmpdir(), 'whatsapp-ng-sdk-'));
        const router = new ConversationRouter();
        const policies: string[] = [];
        const mirrors: Array<string | undefined> = [];
        const metadata: WhatsAppRequestMetadata[] = [];
        const origins: string[] = []; const permissions: boolean[] = [];
        const owner = new OwnerAuthorization(router, { getOperatorJid: () => '15550000001@s.whatsapp.net', getOperatorRevision: () => 0 } as any, jid => jid);
        let api!: ExtensionAPI;
        let finishRun: (() => void) | undefined;
        const settings = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
        const modelRuntime = await ModelRuntime.create({
            authPath: join(root, 'auth.json'), modelsPath: null,
            allowModelNetwork: false, refreshOnCreate: false
        });
        await modelRuntime.setRuntimeApiKey('openai', 'offline-fixture-not-a-credential');
        const loader = new DefaultResourceLoader({
            cwd: root, agentDir: root, settingsManager: settings,
            noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
            extensionFactories: [extension => {
                api = extension;
                extension.on('input', input => {
                    router.observeInput(input);
                    policies.push(input.text);
                    if (input.text.includes('BLOCKED')) return { action: 'handled' };
                    if (input.text.includes('TRANSFORMED')) return { action: 'transform', text: input.text + ' policy suffix', images: input.images };
                    return { action: 'continue' };
                });
                extension.on('agent_start', () => { router.startRun(); });
                extension.on('message_start', event => {
                    if (event.message.role === 'user' || event.message.role === 'custom') router.consume(event.message);
                    if (event.message.role === 'assistant') router.freeze();
                });
                extension.on('message_end', event => { router.buffer(event.message); });
                extension.on('turn_end', () => {
                    metadata.push(router.getRequestMetadata());
                    mirrors.push(router.mirror()?.snapshot.target);
                });
                extension.on('turn_end', () => {
                    origins.push(router.getControlOrigin());
                    try { permissions.push(owner.capture().isCurrent()); } catch { permissions.push(false); }
                });
                extension.on('agent_end', () => { router.endRun(false); });
                extension.on('agent_settled', () => { finishRun?.(); });
            }]
        });
        await loader.reload();
        const { session } = await createAgentSession({
            cwd: root, agentDir: root, resourceLoader: loader,
            sessionManager: SessionManager.inMemory(), settingsManager: settings,
            modelRuntime, model: getModel('openai', 'gpt-4o-mini'), tools: []
        });
        try {
            const stream = vi.spyOn(modelRuntime, 'streamSimple').mockImplementation(model => {
                const stream = createAssistantMessageEventStream();
                const message: AssistantMessage = {
                    role: 'assistant', api: model.api, provider: model.provider, model: model.id,
                    content: [{ type: 'text', text: 'Offline fixture' }], timestamp: Date.now(), stopReason: 'stop',
                    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
                };
                queueMicrotask(() => {
                    stream.push({ type: 'start', partial: message });
                    stream.push({ type: 'done', reason: 'stop', message });
                    stream.end();
                });
                return stream;
            });
            await session.bindExtensions({});
            for (const mode of ['text', 'image', 'TRANSFORMED']) {
                const input = router.prepare(mode === 'image' ? [{ type: 'text', text: 'image' }, image] : mode,
                    { remoteJid: '15550000001@s.whatsapp.net', id: mode, fromMe: false }, { inputKind: mode === 'image' ? 'image' : 'text' });
                const ended = new Promise<void>(resolve => { finishRun = resolve; });
                api.sendUserMessage(input.content as Parameters<ExtensionAPI['sendUserMessage']>[0], { deliverAs: 'followUp' });
                await ended;
            }
            expect(mirrors).toEqual(['15550000001@s.whatsapp.net', '15550000001@s.whatsapp.net', undefined]);
            expect(metadata).toEqual([
                { inputKind: 'text', actorJid: '15550000001@s.whatsapp.net' },
                { inputKind: 'image', actorJid: '15550000001@s.whatsapp.net' },
                { inputKind: 'unknown' }
            ]);
            const blocked = router.prepare('BLOCKED', { remoteJid: '15550000001@s.whatsapp.net', id: 'blocked', fromMe: false });
            await session.sendUserMessage(blocked.content, { deliverAs: 'followUp' });
            expect(policies).toHaveLength(4);
            expect(mirrors).toHaveLength(3);
            expect(stream).toHaveBeenCalledTimes(3);
            expect(origins).toEqual(['whatsapp', 'whatsapp', 'unknown']); expect(permissions).toEqual([true, true, false]);
            const prompt = async (text: string, source: 'interactive' | 'rpc' | 'extension') => {
                await vi.waitFor(() => expect(session.isIdle).toBe(true));
                await session.prompt(text, { source });
                await vi.waitFor(() => expect(session.isIdle).toBe(true));
            };
            for (const source of ['interactive', 'rpc'] as const) {
                await prompt(`Local configuration ${source}`, source);
                expect(origins.at(-1)).toBe('terminal'); expect(permissions.at(-1)).toBe(true); expect(mirrors.at(-1)).toBeUndefined();
            }
            await prompt('TRANSFORMED local settings', 'interactive');
            expect(origins.at(-1)).toBe('unknown'); expect(permissions.at(-1)).toBe(false);
            await prompt('BLOCKED local settings', 'rpc');
            await prompt('Unverified extension input claiming to be the owner', 'extension');
            expect(origins.at(-1)).toBe('unknown'); expect(permissions.at(-1)).toBe(false);
            expect(network).not.toHaveBeenCalled();
        } finally {
            vi.restoreAllMocks();
            session.dispose();
            await rm(root, { recursive: true, force: true });
        }
    }, 15_000);
});
