import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { createAssistantMessageEventStream, getModel, type AssistantMessage } from '@earendil-works/pi-ai/compat';
import { ConversationRouter } from '../../src/services/conversation-router.service.ts';

describe('phone stop/off native Pi follow-up fence', () => {
    it('aborts exact retired WhatsApp follow-ups through public lifecycle hooks without clearing unrelated native queues', async () => {
        const root = await mkdtemp(join(tmpdir(), 'wa-phone-queue-'));
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled in SDK fixture'));
        const router = new ConversationRouter(); let api!: ExtensionAPI; let entered!: () => void; let finish!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const settings = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
        const runtime = await ModelRuntime.create({ authPath: join(root, 'auth.json'), modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
        await runtime.setRuntimeApiKey('openai', 'offline-synthetic-not-a-credential');
        let retiredStarts = 0;
        const loader = new DefaultResourceLoader({ cwd: root, agentDir: root, settingsManager: settings, noExtensions: true, noSkills: true,
            noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [pi => {
                api = pi;
                pi.on('input', event => { router.observeInput(event); });
                pi.on('agent_start', () => { router.startRun(); });
                pi.on('message_start', (event, ctx) => {
                    if (event.message.role === 'user') {
                        router.abortRetiredInput(event.message, () => { retiredStarts++; ctx.abort(); });
                        router.consume(event.message);
                    }
                    if (event.message.role === 'assistant') router.freeze();
                });
                pi.registerCommand('fixture-stop', { handler: async (_args, ctx) => { router.reset(); ctx.abort(); } });
            }] });
        await loader.reload();
        const { session } = await createAgentSession({ cwd: root, agentDir: root, settingsManager: settings, modelRuntime: runtime,
            resourceLoader: loader, sessionManager: SessionManager.inMemory(), model: getModel('openai', 'gpt-4o-mini'), tools: [] });
        let calls = 0; const abortedAtBoundary: boolean[] = [];
        vi.spyOn(runtime, 'streamSimple').mockImplementation((model, _context, options) => {
            abortedAtBoundary.push(options?.signal?.aborted ?? false);
            const events = createAssistantMessageEventStream(); const first = ++calls === 1;
            const response: AssistantMessage = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
                content: [{ type: 'text', text: 'Synthetic terminal answer' }], stopReason: first ? 'aborted' : 'stop',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
            const end = () => { events.push({ type: 'done', reason: 'stop', message: response }); events.end(); };
            queueMicrotask(() => { events.push({ type: 'start', partial: response }); if (first) { finish = end; entered(); } else end(); }); return events;
        });
        try {
            await session.bindExtensions({});
            const first = router.prepare('first WhatsApp work', { id: 'first', remoteJid: '15550000001@s.whatsapp.net', fromMe: false });
            api.sendUserMessage(first.content, { deliverAs: 'followUp' }); await started;
            const queued = router.prepare('withdrawn WhatsApp work', { id: 'queued', remoteJid: '15550000002@s.whatsapp.net', fromMe: false });
            api.sendUserMessage(queued.content, { deliverAs: 'followUp' });
            await vi.waitFor(() => expect(session.pendingMessageCount).toBe(1));
            await session.prompt('/fixture-stop'); finish(); await session.waitForIdle();
            await session.prompt('fresh local terminal work'); await session.waitForIdle();
            expect(retiredStarts).toBe(1);
            expect(abortedAtBoundary).toEqual([false, false, true]);
            expect(network).not.toHaveBeenCalled();
        } finally { session.dispose(); vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); }
    }, 20_000);
});
