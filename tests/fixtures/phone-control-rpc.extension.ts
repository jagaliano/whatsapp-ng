/** Isolated synthetic transport/provider controls; production owns settings, auth and lifecycle. */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { createAssistantMessageEventStream, type Api, type AssistantMessage, type Model, type SimpleStreamOptions } from '@earendil-works/pi-ai';
interface Fixture { metrics: { modelStarts: number; cancelled: number; activeTools: string[]; statsConsumed?: number; statsSettled?: number; providerRequests?: number }; save(): void; deliver(text: string, responses?: number): Promise<void>; deliverGroup(text: string, reply?: boolean): Promise<void>; voteNext(): Promise<void> }
export default function (pi: ExtensionAPI) {
    const stats = process.env.WA_PHONE_RPC_STATS === '1'; const groups = process.env.WA_PHONE_RPC_GROUPS === '1';
    const optional = process.env.WA_PHONE_RPC_OPTIONAL; const images = optional === 'images'; const terminal = optional === 'terminal';
    const reporting = process.env.WA_PHONE_RPC_REPORTING === '1';
    const search = process.env.WA_PHONE_RPC_MODELS === '1';
    const selfAuto = process.env.WA_PHONE_RPC_SELF_AUTO === '1'; const modelFixture = stats || groups || selfAuto || images || terminal || reporting || search;
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGP4z8DwHwohFABFzAf5Zsv/OQAAAABJRU5ErkJggg==';
    if (images) pi.registerTool({ name: 'fixture_image', label: 'Synthetic image', description: 'Isolated fixture image result only', parameters: Type.Object({}),
        execute: async () => ({ content: [{ type: 'image', mimeType: 'image/png', data: png }, { type: 'image', mimeType: 'image/png', data: png }], details: {} }) });
    if (process.env.WA_PHONE_RPC_SELF_LID === '1' || modelFixture) pi.registerProvider('fixture-phone', {
        baseUrl: 'https://fixture.invalid', apiKey: 'SYNTHETIC-NOT-A-KEY', api: 'openai-completions',
        models: Array.from({ length: 11 }, (_, index) => ({ id: `model-${String(index + 1).padStart(2, '0')}`, name: `Fixture ${index + 1}`,
            reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 256 })),
        ...(modelFixture ? { streamSimple: (model: Model<Api>, _context: unknown, options?: SimpleStreamOptions) => {
            const stream = createAssistantMessageEventStream();
            if (!options?.signal?.aborted) { const state = fixture(); state.metrics.providerRequests = (state.metrics.providerRequests ?? 0) + 1; state.save(); }
            const messages = (_context as { messages?: Array<{ role: string }> }).messages ?? [];
            const tool = (images || reporting) && messages.at(-1)?.role === 'user';
            const message: AssistantMessage = { role: 'assistant', api: model.api, provider: model.provider, model: model.id,
                timestamp: Date.now(), content: tool ? reporting
                    ? [{ type: 'thinking', thinking: 'PRIVATE-REASONING' }, { type: 'text', text: '**Checking** the fixture file.' }, { type: 'toolCall', id: `fixture-write-${fixture().metrics.providerRequests}`, name: 'write', arguments: { path: 'c1-progress.txt', content: 'PRIVATE-TOOL-CONTENT' } }]
                    : [{ type: 'toolCall', id: `fixture-image-${fixture().metrics.providerRequests}`, name: 'fixture_image', arguments: {} }]
                    : [{ type: 'text', text: reporting ? '# RPC formatted final\n**Done** [Docs](https://example.test/a_b)\n```ts\nconst code = "**literal**";\n```' : 'RPC stats final' }], stopReason: tool ? 'toolUse' : 'stop',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
            const publish = () => {
                if (options?.signal?.aborted) stream.push({ type: 'error', reason: 'aborted', error: { ...message, stopReason: 'aborted', errorMessage: 'Synthetic cancellation' } });
                else { stream.push({ type: 'start', partial: message }); stream.push({ type: 'done', reason: tool ? 'toolUse' : 'stop', message }); }
                stream.end();
            };
            if (reporting && !tool) setTimeout(publish, 2200); else queueMicrotask(publish);
            return stream;
        } } : {})
    });
    const fixture = () => {
        const state = (globalThis as typeof globalThis & { __waPhoneRpcFixture?: Fixture }).__waPhoneRpcFixture;
        if (!state || !process.env.WA_PHONE_RPC_METRICS || process.env.PI_OFFLINE !== '1') throw new Error('Explicit isolated fixture required');
        return state;
    };
    let cancelNext = false;
    pi.on('before_agent_start', () => { const state = fixture(); state.metrics.modelStarts++; state.save(); if (!modelFixture) throw new Error('Phone controls must not reach the model'); });
    let releaseStats!: () => void; const statsGate = new Promise<void>(resolve => { releaseStats = resolve; });
    pi.on('message_start', async event => {
        if ((stats || groups || terminal || reporting) && event.message.role === 'user') {
            const state = fixture(); state.metrics.statsConsumed = (state.metrics.statsConsumed ?? 0) + 1; state.save(); await statsGate;
        }
    });
    pi.on('agent_settled', async () => {
        if (modelFixture) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const state = fixture(); state.metrics.statsSettled = (state.metrics.statsSettled ?? 0) + 1; state.save();
        }
    });
    pi.on('session_before_switch', () => {
        if (cancelNext) { cancelNext = false; const state = fixture(); state.metrics.cancelled++; state.save(); return { cancel: true }; }
    });
    pi.registerCommand('phone-fixture', { description: 'Isolated synthetic test only', handler: async (args, ctx) => {
        const state = fixture(); const menuResponses = process.env.WA_PHONE_RPC_SELF_LID === '1' ? 2 : 1;
        if (args === 'cancel-new') { cancelNext = true; await state.deliver('/new', menuResponses); await state.deliver('2', 0); }
        else if (args === 'new') { await state.deliver('/new', menuResponses); await state.deliver('2', 0); }
        else if (args === 'off') { await state.deliver('/off', menuResponses); await state.deliver('2'); }
        else if (args === 'status') await state.deliver('/status');
        else if (args === 'poll-next') { await state.deliver('/model', 2); await state.voteNext(); }
        else if (search && args === 'models-search') await state.deliver('/model fxtr-phn/mdl');
        else if (search && args === 'models-next') await state.deliver('11');
        else if (search && args === 'models-previous') await state.deliver('2');
        else if (search && args === 'models-select') await state.deliver('1');
        else if (search && args === 'models-missing') await state.deliver('/model no-such-model');
        else if (args === 'reload') await ctx.reload();
        else if (args === 'tools') { state.metrics.activeTools = pi.getActiveTools(); state.save(); }
        else if (modelFixture && args === 'stats-start') await state.deliver(selfAuto ? 'Explain π' : 'Fixture stats task', 0);
        else if ((stats || groups || terminal || reporting) && args === 'stats-release') releaseStats();
        else if ((images || terminal) && args === 'optional-group') await state.deliverGroup('Optional group reply', true);
        else if ((groups || reporting) && args === 'group-fresh') await state.deliverGroup('Fresh group reply', true);
        else if (groups && args === 'group-queue') {
            await state.deliverGroup('Queued group mention');
            for (let i = 0; i < 500 && !ctx.hasPendingMessages(); i++) await new Promise(resolve => setTimeout(resolve, 10));
            if (!ctx.hasPendingMessages()) throw new Error('Group input was not queued');
        }
        else throw new Error('Unknown fixture action');
    } });
}
