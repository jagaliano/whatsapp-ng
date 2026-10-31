import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationRouter, type RoutingSnapshot } from '../../src/services/conversation-router.service.ts';
import { FinalOutputCoordinator, isSpeakableReply, type FinalOutputPolicy } from '../../src/services/final-output.service.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { MessageSender } from '../../src/services/message.sender.ts';
import type { MessageRequest, MessageResult } from '../../src/models/whatsapp.types.ts';

const A = '15550000001@s.whatsapp.net';
const B = '15550000002@s.whatsapp.net';
const config = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
const success = (): MessageResult => ({ success: true, attempts: 1, messageId: 'fixture-sent' });
const failed = (): MessageResult => ({ success: false, attempts: 0 });
const unknown = (): MessageResult => ({ success: false, delivery: 'unknown', attempts: 1, messageId: 'fixture-unknown' });
const policy = (mode: FinalOutputPolicy['mode']): FinalOutputPolicy => ({ mode, tts: { ...config }, approvedDestinationKey: resolveTtsConfig(config).destinationKey, isCurrent: () => true });
const active: FinalOutputCoordinator[] = [];
afterEach(() => { for (const output of active.splice(0)) output.cancelAll(); vi.useRealTimers(); });

function setup(mode: FinalOutputPolicy['mode'] = 'text', kind: any = 'text', target = A, runSignal?: AbortSignal) {
    const context = { accountScope: 'fixture-account', generation: 1 };
    let connected = true;
    let policyCurrent = true;
    let selected = { ...policy(mode), isCurrent: () => policyCurrent };
    const router = new ConversationRouter(jid => jid, () => JSON.stringify(context));
    const artifact = { content: { audio: { url: '/fixture/private/speech.ogg' }, ptt: true, mimetype: 'audio/ogg; codecs=opus' },
        metadata: { type: 'audio' as const, fileName: 'speech.ogg', mimetype: 'audio/ogg; codecs=opus', size: 42, voiceNote: true },
        speech: { provider: 'openai-compatible' as const, destination: 'speech.example.test' }, dispose: vi.fn().mockResolvedValue(undefined) };
    const prepare = vi.fn().mockResolvedValue(artifact);
    const accepted = vi.fn().mockResolvedValue(undefined);
    const text = vi.fn().mockResolvedValue(success());
    const voice = vi.fn(async (_snapshot: RoutingSnapshot, request: MessageRequest) => { const result = success(); await request.onSettled?.(result); return result; });
    const output = new FinalOutputCoordinator({ router, context: () => context,
        contextCurrent: captured => captured.accountScope === context.accountScope && captured.generation === context.generation,
        connected: () => connected, policy: () => selected, prepareSpeech: prepare,
        sendText: async (snapshot, answer, signal, isCurrent) => {
            const token = router.beginSend(snapshot, snapshot.target!, 'final-text');
            try { const result = await text(snapshot, answer, signal, isCurrent); router.finishSend(token, result); return result; }
            catch (error) { router.finishSend(token, unknown()); throw error; }
        },
        sendVoice: async (snapshot, request) => {
            const token = router.beginSend(snapshot, request.recipientJid, 'final-voice');
            try { const result = await voice(snapshot, request); router.finishSend(token, result); return result; }
            catch (error) { router.finishSend(token, unknown()); throw error; }
        }, accepted });
    active.push(output);
    const capture = (inputKind = kind, jid = target) => {
        const submitted = router.prepare('Fixture request', { remoteJid: jid, id: String(Math.random()), fromMe: false, ...(jid.endsWith('@g.us') ? { participant: A } : {}) }, { inputKind });
        router.observeInput({ source: 'extension', text: submitted.content });
        router.consume({ role: 'user', content: submitted.content }); router.freeze();
        const snapshot = router.snapshot()!; output.capture(snapshot, '/fixture/workspace', runSignal); return snapshot;
    };
    const snapshot = capture();
    return { router, output, snapshot, capture, context, artifact, prepare, accepted, text, voice,
        selected: () => selected, select: (p: FinalOutputPolicy) => { selected = p as typeof selected; }, revoke: () => { policyCurrent = false; }, disconnect: () => { connected = false; } };
}

describe('four-mode final-output coordinator', () => {
    it.each([
        ['voice', 'text', true], ['both', 'text', true], ['mirror', 'audio', true],
        ['mirror', 'text', false], ['mirror', 'unknown', false], ['text', 'audio', false]
    ] as const)('protects captured %s/%s automatic speech without preparing or sending', (mode, kind, expected) => {
        const h = setup(mode, kind);
        expect(h.output.protectsAutomaticSpeech(h.snapshot)).toBe(expected);
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        expect(h.router.canFinalize(h.snapshot)).toBe(true);
    });
    it('protects only captured approved speech, never an unapproved destination or missing policy owner', () => {
        const h = setup('voice'); h.select({ ...policy('voice'), approvedDestinationKey: 'unapproved' });
        expect(h.output.protectsAutomaticSpeech(h.capture())).toBe(false);
        h.select({ ...policy('voice'), isCurrent: undefined });
        expect(h.output.protectsAutomaticSpeech(h.capture())).toBe(false);
    });
    it('shares the separate group opt-in boundary with automatic delivery', () => {
        const h = setup('voice', 'audio', '120363000001@g.us');
        expect(h.output.protectsAutomaticSpeech(h.snapshot)).toBe(false);
        h.select({ ...policy('voice'), groupOptIn: true });
        expect(h.output.protectsAutomaticSpeech(h.capture())).toBe(true);
    });
    it('retains captured spoken protection after policy revocation without authorizing final delivery', async () => {
        const h = setup('voice'); h.revoke();
        expect(h.output.protectsAutomaticSpeech(h.snapshot)).toBe(true);
        expect((await h.output.deliver(h.snapshot, 'Answer')).cancelled).toBe(true);
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
    });
    it('does not reread a changed mode or protect a terminal, uncaptured or replaced frame', () => {
        const h = setup('voice'); h.select(policy('text'));
        expect(h.output.protectsAutomaticSpeech(h.snapshot)).toBe(true);
        const next = h.capture(); expect(h.output.protectsAutomaticSpeech(next)).toBe(false);
        expect(h.output.protectsAutomaticSpeech(h.snapshot)).toBe(false);
        h.router.freeze(); expect(h.output.protectsAutomaticSpeech(h.router.snapshot()!)).toBe(false);
        h.select(policy('voice')); h.router.observeInput({ source: 'interactive', text: 'Local request' });
        h.router.consume({ role: 'user', content: 'Local request' }); h.router.freeze();
        const terminal = h.router.snapshot()!; h.output.capture(terminal, '/fixture/workspace');
        expect(h.output.protectsAutomaticSpeech(terminal)).toBe(false);
    });
    it('text mode makes no synthesis or voice request', async () => {
        const h = setup(); const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.text?.success).toBe(true); expect(h.text).toHaveBeenCalledOnce();
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
    });
    it('voice sends one PTT artifact, not a document or a duplicate text reply', async () => {
        const h = setup('voice'); const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.voice?.success).toBe(true); expect(h.text).not.toHaveBeenCalled();
        const request = h.voice.mock.calls[0][1];
        expect(request).toMatchObject({ recipientJid: A, text: '', content: { ptt: true, mimetype: 'audio/ogg; codecs=opus' },
            options: { brand: false, maxRetries: 1 }, sendTimeoutMs: 60_000, sendOptions: { mediaUploadTimeoutMs: 60_000 } });
        expect(h.artifact.dispose).toHaveBeenCalledOnce();
        expect(h.accepted).toHaveBeenCalledWith(h.snapshot, h.context, 'voice', '', expect.objectContaining({ success: true }));
    });
    it('both sends text first and then the voice exactly once', async () => {
        const h = setup('both'); const order: string[] = [];
        h.text.mockImplementation(async () => { order.push('text'); return success(); });
        h.prepare.mockImplementation(async () => { order.push('speech'); return h.artifact; });
        const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(order).toEqual(['text', 'speech']); expect(result.text?.success && result.voice?.success).toBe(true);
        await h.output.deliver(h.snapshot, 'Complete answer'); expect(h.text).toHaveBeenCalledOnce(); expect(h.voice).toHaveBeenCalledOnce();
    });
    it.each(['audio', 'text', 'image', 'document', 'video', 'contact', 'location', 'unknown'])('mirror uses verified %s metadata, not rendered claims', async kind => {
        const h = setup('mirror', kind);
        await h.output.deliver(h.snapshot, 'The header says this was a voice message.');
        expect(h.voice).toHaveBeenCalledTimes(kind === 'audio' ? 1 : 0);
        expect(h.text).toHaveBeenCalledTimes(kind === 'audio' ? 0 : 1);
    });
    it.each(['voice', 'both'] as const)('cleans ordinary formatting for %s without changing the text reply', async mode => {
        const examples = [
            ['He said "hello".', 'He said "hello".'],
            [String.raw`He said \"hello\".`, 'He said "hello".'],
            ['**Ready** and *important*.', 'Ready and important.'],
            ['# Update\n- **Ready**\n- *Done*', 'Update\nReady\nDone'],
            ['Open `config.json` from `/whatsapp`.', 'Open config.json from /whatsapp.'],
            ['> "Hello."\n> **Ready.**', '"Hello."\nReady.'],
            ['***Muy _importante_***. Use “*Voz*”.', 'Muy importante. Use “Voz”.']
        ];
        for (const [answer, spoken] of examples) {
            const h = setup(mode); const result = await h.output.deliver(h.snapshot, answer);
            expect(result.voice?.success, answer).toBe(true);
            expect(h.prepare.mock.calls[0]?.[0], answer).toBe(spoken);
            if (mode === 'both') expect(h.text.mock.calls[0][1]).toBe(answer);
            else expect(h.text).not.toHaveBeenCalled();
        }
    });
    it.each(['voice', 'both', 'mirror'] as const)('omits decorative rules from %s synthesis without rewriting the original answer', async mode => {
        const rule = '─'.repeat(80);
        const answer = ['Resumen de prueba:', rule, 'Desde 2022: ~10 equipos. 25 dic. 2024: sin evidencia.', rule, 'Conclusión: faltan datos.'].join('\n\n');
        const spoken = ['Resumen de prueba:', 'Desde 2022: ~10 equipos. 25 dic. 2024: sin evidencia.', 'Conclusión: faltan datos.'].join('\n\n');
        const h = setup(mode, 'audio');
        expect((await h.output.deliver(h.snapshot, answer)).voice?.success).toBe(true);
        expect(h.prepare).toHaveBeenCalledOnce();
        expect(h.prepare.mock.calls[0][0]).toBe(spoken);
        expect(h.voice).toHaveBeenCalledOnce();
        if (mode === 'both') expect(h.text.mock.calls[0][1]).toBe(answer);
        else expect(h.text).not.toHaveBeenCalled();
    });
    it('keeps real inline code, commands, tables and fenced code as complete text', async () => {
        for (const answer of ['Run `git status`.', 'Use `const n = 42`.', '```ts\nconst n = 42;\n```', '~~~sh\ngit status\n~~~',
            'git status', '| Key | Value |\n| --- | --- |\n| n | 42 |']) {
            const h = setup('voice'); const result = await h.output.deliver(h.snapshot, answer);
            expect(result.text?.success, answer).toBe(true); expect(h.text.mock.calls[0][1]).toBe(answer);
            expect(h.prepare, answer).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        }
    });
    it.each(['voice', 'both', 'mirror'] as const)('keeps command-like inline snippets as complete text in %s mode', async mode => {
        for (const command of ['docker compose up -d', 'yarn install', 'pnpm test', 'ls -la', 'cd whatsapp-ng-release', 'make build', 'chmod +x run.sh', 'pi install npm:whatsapp-ng']) {
            const answer = 'Run `' + command + '` in the project folder.'; const h = setup(mode, 'audio');
            const result = await h.output.deliver(h.snapshot, answer);
            expect(result.text?.success, answer).toBe(true); expect(h.text.mock.calls[0][1]).toBe(answer);
            expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        }
    });
    it.each(['voice', 'mirror'] as const)('preserves Markdown link addresses as text in %s mode', async mode => {
        const answer = 'Read [the guide](https://example.test/setup).'; const h = setup(mode, 'audio');
        const result = await h.output.deliver(h.snapshot, answer);
        expect(result.text?.success).toBe(true); expect(result.fallback).toBe(true);
        expect(h.text).toHaveBeenCalledOnce(); expect(h.text.mock.calls[0][1]).toBe(answer);
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        expect(h.accepted).toHaveBeenCalledWith(h.snapshot, h.context, 'text', answer, expect.objectContaining({ success: true }));
    });
    it('speaks link labels in both mode only after the full text is accepted', async () => {
        const answer = 'Read [the guide](https://example.test/setup).'; const h = setup('both'); const order: string[] = [];
        h.text.mockImplementationOnce(async () => { order.push('text'); return success(); });
        h.prepare.mockImplementationOnce(async spoken => { order.push('speech'); expect(spoken).toBe('Read the guide.'); return h.artifact; });
        const result = await h.output.deliver(h.snapshot, answer);
        expect(result.text?.success && result.voice?.success).toBe(true); expect(order).toEqual(['text', 'speech']);
        expect(h.text.mock.calls[0][1]).toBe(answer); expect(h.text).toHaveBeenCalledOnce(); expect(h.voice).toHaveBeenCalledOnce();
    });
    it.each(['failed', 'unknown', 'throw'] as const)('does not omit a link address after a %s text send in both mode', async outcome => {
        const answer = 'Read [the guide](https://example.test/setup).'; const h = setup('both');
        if (outcome === 'throw') h.text.mockRejectedValueOnce(new Error('Synthetic pre-provider stop'));
        else h.text.mockResolvedValueOnce(outcome === 'unknown' ? unknown() : failed());
        const result = await h.output.deliver(h.snapshot, answer);
        expect(result.text?.success).toBe(false); expect(h.text).toHaveBeenCalledOnce();
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        if (outcome !== 'failed') expect(result.uncertain).toBe(true);
    });
    it('retains cancellation authority after a failed link-bearing text send', async () => {
        const h = setup('both'); h.text.mockImplementationOnce(async () => { h.revoke(); return failed(); });
        const result = await h.output.deliver(h.snapshot, 'Read [the guide](https://example.test/setup).');
        expect(result.cancelled).toBe(true); expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        expect(h.text).toHaveBeenCalledOnce();
    });
    it('keeps ordinary approximation prose eligible for voice', async () => {
        const answer = 'It takes ~5 minutes, or ~2 s for a cached reply.'; const h = setup('voice');
        expect((await h.output.deliver(h.snapshot, answer)).voice?.success).toBe(true);
        expect(h.prepare.mock.calls[0][0]).toBe(answer); expect(h.text).not.toHaveBeenCalled();
    });
    it('counts Unicode code points rather than splitting supplementary characters at the speech limit', async () => {
        const spoken = '👋'.repeat(1000) + 'é'.repeat(1000); const answer = '**' + spoken + '**'; const h = setup('both');
        expect((await h.output.deliver(h.snapshot, answer)).voice?.success).toBe(true);
        expect(h.prepare.mock.calls[0][0]).toBe(spoken); expect(h.text.mock.calls[0][1]).toBe(answer);
        const long = setup('voice'); const over = answer + 'é'; await long.output.deliver(long.snapshot, over);
        expect(long.prepare).not.toHaveBeenCalled(); expect(long.text.mock.calls[0][1]).toBe(over);
    });
    it('measures the spoken copy without truncating the visible answer', async () => {
        const answer = '**' + 'a'.repeat(2000) + '**'; const h = setup('both');
        expect((await h.output.deliver(h.snapshot, answer)).voice?.success).toBe(true);
        expect(h.text.mock.calls[0][1]).toBe(answer); expect(h.prepare.mock.calls[0][0]).toBe('a'.repeat(2000));
        const empty = setup('voice'); await empty.output.deliver(empty.snapshot, '***');
        expect(empty.prepare).not.toHaveBeenCalled(); expect(empty.text.mock.calls[0][1]).toBe('***');
    });
    it.each(['voice', 'both'] as const)('missing consent in %s mode retains full text without any synthesis', async mode => {
        const h = setup(mode); h.select({ ...policy(mode), approvedDestinationKey: undefined }); h.output.capture(h.snapshot, '/fixture');
        const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.text?.success).toBe(true); expect(h.text).toHaveBeenCalledOnce(); expect(h.prepare).not.toHaveBeenCalled();
    });
    it('requires a trusted consent-revision callback before uploading text', async () => {
        const h = setup('voice'); h.select({ ...policy('voice'), isCurrent: undefined }); h.output.capture(h.snapshot, '/fixture');
        await h.output.deliver(h.snapshot, 'Complete answer'); expect(h.prepare).not.toHaveBeenCalled(); expect(h.text).toHaveBeenCalledOnce();
    });
    it.each(['voice', 'both'] as const)('synthesis failure in %s mode sends full text once without another provider', async mode => {
        const h = setup(mode); h.prepare.mockRejectedValueOnce(new Error('fixture-sensitive-provider-body'));
        const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.fallback).toBe(true); expect(h.text).toHaveBeenCalledOnce(); expect(h.text.mock.calls[0][1]).toBe('Complete answer');
        expect(h.prepare).toHaveBeenCalledOnce(); expect(h.voice).not.toHaveBeenCalled();
    });
    it('definite voice pre-send failure falls back to full text once', async () => {
        const h = setup('voice'); h.voice.mockImplementationOnce(async (_snapshot, request) => { const result = failed(); await request.onSettled?.(result); return result; });
        const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.fallback).toBe(true); expect(h.text).toHaveBeenCalledOnce(); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it('both never retries text after voice failure, even if the initial text definitely failed', async () => {
        const h = setup('both'); h.text.mockResolvedValueOnce(failed());
        h.voice.mockImplementationOnce(async (_snapshot, request) => { const result = failed(); await request.onSettled?.(result); return result; });
        await h.output.deliver(h.snapshot, 'Complete answer'); expect(h.text).toHaveBeenCalledOnce(); expect(h.voice).toHaveBeenCalledOnce();
    });
    it('an uncertain initial text result in both mode stops before synthesis', async () => {
        const h = setup('both'); h.text.mockResolvedValueOnce(unknown());
        expect((await h.output.deliver(h.snapshot, 'Answer')).uncertain).toBe(true); expect(h.prepare).not.toHaveBeenCalled();
    });
    it.each(['voice', 'both'] as const)('unknown voice delivery in %s mode never retries or invents a text fallback', async mode => {
        const h = setup(mode); let request!: MessageRequest;
        h.voice.mockImplementationOnce(async (_snapshot, value) => { request = value; return unknown(); });
        const result = await h.output.deliver(h.snapshot, 'Complete answer');
        expect(result.uncertain).toBe(true); expect(h.text).toHaveBeenCalledTimes(mode === 'both' ? 1 : 0);
        expect(h.artifact.dispose).not.toHaveBeenCalled();
        await h.output.deliver(h.snapshot, 'Complete answer'); expect(h.voice).toHaveBeenCalledOnce();
        await request.onSettled?.(success()); await request.onSettled?.(success()); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it('treats a voice-send exception as uncertain, not a definite pre-send failure', async () => {
        const h = setup('voice');
        h.voice.mockImplementationOnce(async (_snapshot, request) => { await request.onSettled?.(unknown()); throw new Error('fixture transport exception'); });
        const result = await h.output.deliver(h.snapshot, 'Answer'); expect(result.uncertain).toBe(true);
        expect(h.text).not.toHaveBeenCalled(); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it('cancelling an upload preserves uncertainty and sender-owned cleanup', async () => {
        const h = setup('voice'); let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; }); let request!: MessageRequest;
        h.voice.mockImplementationOnce(async (_snapshot, value) => { request = value; began(); return new Promise(resolve => value.signal!.addEventListener('abort', () => resolve(unknown()), { once: true })); });
        const pending = h.output.deliver(h.snapshot, 'Answer'); await started; h.output.cancelAll();
        expect((await pending).uncertain).toBe(true); expect(h.text).not.toHaveBeenCalled(); expect(h.artifact.dispose).not.toHaveBeenCalled();
        await request.onSettled?.(failed()); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it('does not write a late voice acceptance into a replacement account, but still disposes it', async () => {
        const h = setup('voice'); let request!: MessageRequest;
        h.voice.mockImplementationOnce(async (_snapshot, value) => { request = value; return unknown(); });
        await h.output.deliver(h.snapshot, 'Answer'); h.context.generation++;
        await request.onSettled?.(success()); expect(h.accepted).not.toHaveBeenCalled(); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it.each(['voice', 'both'] as const)('long/code-marked answers in %s retain complete text without cloud requests', async mode => {
        for (const answer of ['x'.repeat(2001), 'Explanation\n```ts\nconst a = 1;\n```', '{"answer":42}']) {
            const h = setup(mode); await h.output.deliver(h.snapshot, answer);
            expect(h.text.mock.calls[0][1]).toBe(answer); expect(h.prepare).not.toHaveBeenCalled(); expect(h.voice).not.toHaveBeenCalled();
        }
    });
    it('group speech is opt-in independently of private-chat preferences', async () => {
        const h = setup('voice', 'audio', '120363000000001@g.us'); await h.output.deliver(h.snapshot, 'Answer'); expect(h.prepare).not.toHaveBeenCalled();
        const opted = setup('voice', 'audio', '120363000000001@g.us'); opted.select({ ...policy('voice'), groupOptIn: true }); opted.output.capture(opted.snapshot, '/fixture');
        await opted.output.deliver(opted.snapshot, 'Answer'); expect(opted.voice).toHaveBeenCalledOnce();
    });
    it('snapshots the mode/backend and does not inherit mutable settings during the turn', async () => {
        const h = setup('voice'); h.selected().tts!.ttsEndpoint = 'https://not-selected.example.test/speech'; h.select(policy('text'));
        await h.output.deliver(h.snapshot, 'Answer'); expect(h.prepare.mock.calls[0][1].ttsEndpoint).toBe(config.ttsEndpoint); expect(h.voice).toHaveBeenCalledOnce();
    });
    it.each(['reset', 'account', 'disconnect', 'consent', 'cancel'] as const)('rejects prepared audio after %s and never falls back into a stale chat', async change => {
        const h = setup('voice'); let release!: (artifact: typeof h.artifact) => void;
        h.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.output.deliver(h.snapshot, 'Answer');
        if (change === 'reset') h.router.reset();
        else if (change === 'account') h.context.generation++;
        else if (change === 'disconnect') h.disconnect();
        else if (change === 'consent') h.revoke();
        else h.output.cancelAll();
        release(h.artifact); expect((await pending).cancelled).toBe(true); expect(h.voice).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled(); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it.each([['voice', 'consent'], ['voice', 'covered'], ['text', 'consent'], ['text', 'covered']] as const)('fences %s transmission after %s changes during actual sender preflight, without a timer tick', async (mode, change) => {
        const h = setup(mode); let paused!: () => void; let resume!: () => void;
        const entered = new Promise<void>(resolve => { paused = resolve; }); const gate = new Promise<void>(resolve => { resume = resolve; });
        const sendMessage = vi.fn(); const socket = { sendMessage }; let signal!: AbortSignal;
        const service = { getSessionContext: () => h.context, isSessionContextCurrent: () => true, getStatus: () => 'connected', isVerbose: () => false,
            getSocket: () => socket, prepareArchive: async () => {}, prepareGroupSession: async () => {},
            registerOutgoing: vi.fn(), cacheSentMessage: vi.fn(), recordSendOutcome: vi.fn(),
            flushArchive: async () => { paused(); await gate; expect(signal.aborted).toBe(false); } };
        const sender = new MessageSender(service as any);
        h.voice.mockImplementationOnce(async (_snapshot, request) => { signal = request.signal!; return sender.send(request); });
        h.text.mockImplementationOnce(async (_snapshot, answer, parentSignal, isCurrent) => { signal = parentSignal; return sender.send({ recipientJid: A, text: answer, signal, isCurrent, sessionContext: { ...h.context }, options: { maxRetries: 1 } }); });
        const pending = h.output.deliver(h.snapshot, 'Complete answer'); await entered;
        if (change === 'consent') h.revoke();
        else { const token = h.router.beginSend(h.snapshot, A, 'explicit-text'); h.router.finishSend(token, success()); }
        resume(); const result = await pending;
        expect(result.cancelled).toBe(true); expect(sendMessage).not.toHaveBeenCalled(); expect(h.accepted).not.toHaveBeenCalled();
        if (mode === 'voice') { expect(h.text).not.toHaveBeenCalled(); expect(h.artifact.dispose).toHaveBeenCalledOnce(); }
    });
    it('links the captured Pi run signal synchronously, not only via session lifecycle or polling', async () => {
        const parent = new AbortController(); const h = setup('voice', 'audio', A, parent.signal); let signal!: AbortSignal;
        h.prepare.mockImplementationOnce((_text, _config, options) => new Promise((_resolve, reject) => {
            signal = options.signal; signal.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true });
        }));
        const pending = h.output.deliver(h.snapshot, 'Answer'); parent.abort(); expect(signal.aborted).toBe(true);
        expect((await pending).cancelled).toBe(true); expect(h.voice).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled();
    });
    it('does not start a provider for an already aborted Pi run', async () => {
        const parent = new AbortController(); parent.abort(); const h = setup('voice', 'audio', A, parent.signal);
        expect((await h.output.deliver(h.snapshot, 'Answer')).cancelled).toBe(true); expect(h.prepare).not.toHaveBeenCalled();
    });
    it('checks destination coverage again after synthesis instead of duplicating an explicit answer', async () => {
        const h = setup('voice'); let release!: (artifact: typeof h.artifact) => void;
        h.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.output.deliver(h.snapshot, 'Answer');
        const explicit = h.router.beginSend(h.snapshot, A, 'explicit-text'); h.router.finishSend(explicit, success());
        release(h.artifact); await pending; expect(h.voice).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled(); expect(h.artifact.dispose).toHaveBeenCalledOnce();
    });
    it('holds an epoch response lease throughout synthesis, before a transport send exists', async () => {
        const h = setup('voice'); let release!: (artifact: typeof h.artifact) => void;
        h.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.output.deliver(h.snapshot, 'Answer');
        h.router.freeze(); h.router.buffer({ role: 'assistant', content: 'Repeated final callback' }); expect(h.router.mirror()).toBeUndefined();
        release(h.artifact); await pending; expect(h.voice).toHaveBeenCalledOnce();
    });
    it('does not cancel its own in-flight text or voice ledger entries', async () => {
        vi.useFakeTimers(); const h = setup('both');
        h.text.mockImplementationOnce(async () => { await vi.advanceTimersByTimeAsync(150); return success(); });
        h.voice.mockImplementationOnce(async (_snapshot, request) => { await vi.advanceTimersByTimeAsync(150); expect(request.signal?.aborted).toBe(false); const result = success(); await request.onSettled?.(result); return result; });
        const result = await h.output.deliver(h.snapshot, 'Answer'); expect(result.voice?.success).toBe(true); expect(result.cancelled).not.toBe(true);
    });
    it('A audio and B text stay independently owned while A synthesis is pending', async () => {
        const h = setup('mirror', 'audio'); let release!: (artifact: typeof h.artifact) => void;
        h.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const pending = h.output.deliver(h.snapshot, 'Answer A'); const other = h.capture('text', B);
        await h.output.deliver(other, 'Answer B'); release(h.artifact); await pending;
        expect(h.text.mock.calls[0][0].target).toBe(B); expect(h.voice.mock.calls[0][1].recipientJid).toBe(A);
    });
    it('never produces speech for an unowned snapshot or without a captured response policy', async () => {
        const h = setup('voice'); h.router.reset(); h.router.freeze(); const unowned = h.router.snapshot()!;
        h.output.capture(unowned, '/fixture'); expect((await h.output.deliver(unowned, 'Terminal')).skipped).toBe(true);
        expect(h.prepare).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled();
    });
    it('history failure does not replay text or prevent the second format', async () => {
        const h = setup('both'); h.accepted.mockRejectedValueOnce(new Error('fixture history failure'));
        const result = await h.output.deliver(h.snapshot, 'Answer'); expect(result.voice?.success).toBe(true); expect(h.text).toHaveBeenCalledOnce();
    });
    it('recognizes conservative code-heavy fallback without modifying plain multilingual text', () => {
        expect(isSpeakableReply('Hola. El resultado es 42.')).toBe(true);
        expect(isSpeakableReply('const a = 1;\nconst b = 2;\nreturn a + b;')).toBe(false);
        expect(isSpeakableReply('Example `const a = 1`')).toBe(false);
    });
});
