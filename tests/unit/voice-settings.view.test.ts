import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showVoiceSettings, showOwnerSettings, VOICE_PREVIEW_PHRASE } from '../../src/ui/voice-settings.view.ts';
import { speechDefaults, validateSpeechSettings, chatReplyPolicy, type SpeechSettings } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { resetI18n } from '../../src/i18n.ts';
import { withSettingsRequest } from '../../src/ui/whatsapp-settings.view.ts';

const A = '15550000001@s.whatsapp.net'; const G = '120363000000001@g.us';
const chat = { jid: A, recipientJid: A, label: `Fixture (${A})` }; const group = { jid: G, recipientJid: G, label: `Group (${G})` };
const remote = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
const labels = { backend: 'Speech service (Edge or remote)', mode: 'Default reply mode (per-chat modes kept)', chats: 'Chat settings: mode, automatic replies, introduction', preview: 'Send fixed-phrase voice preview (review first)', introduce: 'Send AI-assistant introduction (review first)' };
function setup(selects: string[], inputs: Array<string | undefined> = [], confirms: Array<boolean | (() => boolean)> = [], initial = speechDefaults()) {
    let settings = structuredClone(initial); let revision = 0; let owner = ''; let current = true;
    const session = { getSpeechSettings: () => structuredClone(settings), getSpeechRevision: () => revision,
        setSpeechSettings: vi.fn(async (next: SpeechSettings, expected: number, guard: () => boolean) => { if (expected !== revision || !guard()) throw new Error('fixture stale'); settings = validateSpeechSettings(next); revision++; }),
        getOperatorJid: () => owner, setOperatorJid: vi.fn(async (jid: string, guard: () => boolean) => { if (!guard()) throw new Error('fixture stale'); owner = jid; revision++; }) };
    const actions = { current: () => current, canonical: (jid: string) => jid, chats: () => [chat, group],
        preview: vi.fn().mockResolvedValue({ success: true, attempts: 1 }), disclose: vi.fn().mockResolvedValue({ success: true, attempts: 1 }) };
    const ctx = { cwd: '/fixture/workspace', isIdle: () => true, ui: {
        select: vi.fn(async (title: string, _options: string[]) => {
            const choice = selects.shift() ?? 'Back';
            if (title.startsWith('Voice: ') && [labels.backend, labels.mode, labels.preview].includes(choice)) { selects.unshift(choice); return 'Advanced speech settings'; }
            return choice === 'Back' ? _options.at(-1) : choice;
        }), input: vi.fn(async () => inputs.shift()),
        confirm: vi.fn(async (_title: string, _message: string) => { const answer = confirms.shift(); return typeof answer === 'function' ? answer() : answer ?? false; }), notify: vi.fn()
    } };
    return { session, actions, ctx, settings: () => settings, expire: () => { current = false; }, change: () => { revision++; } };
}
beforeEach(() => { resetI18n(); vi.unstubAllEnvs(); });

describe('terminal Voice/Owner settings', () => {
    it('returns invalid-settings Back to the parent rather than closing settings', async () => {
        const h = setup(['Back']); h.session.getSpeechSettings = () => { throw new Error('Invalid fixture settings'); };
        expect(await showVoiceSettings(h.ctx as any, h.session as any, h.actions)).toBe('back'); expect(h.session.setSpeechSettings).not.toHaveBeenCalled();
    });
    it('asks to reopen when the request expires during a save, not to choose in a closed menu', async () => {
        const h = setup(['Set up replies for a chat', chat.label, 'Voice'], [], [true]);
        h.session.setSpeechSettings.mockImplementationOnce(async () => { h.expire(); throw new Error('Fixture expired save'); });
        await withSettingsRequest(h.ctx as any, () => h.actions.current, async (scoped, current) => {
            await showVoiceSettings(scoped, h.session as any, { ...h.actions, current });
        });
        expect(h.ctx.ui.notify).toHaveBeenCalledExactlyOnceWith('Settings changed while this menu was open. Reopen /whatsapp.', 'info');
        expect(h.settings()).toEqual(speechDefaults()); expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it.each([[false, false], [false, true], [true, false], [true, true]])('handles enabled=%s approved=%s without implicit consent', async (enabled, approved) => {
        const initial = { ...speechDefaults(), enabled, ...(approved ? { approvedDestinationKey: resolveTtsConfig({}).destinationKey } : {}) };
        const h = setup(['Set up replies for a chat', chat.label, 'Voice', 'Back'], [], [true], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.ctx.ui.confirm).toHaveBeenCalledTimes(enabled && approved ? 0 : 1); expect(h.session.setSpeechSettings).toHaveBeenCalledOnce();
        expect(h.settings().enabled).toBe(true); expect(h.settings().chats[A].mode).toBe('voice'); expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it('does not save a stale setup snapshot after the chat picker changes revisions', async () => {
        const h = setup(['Mirror audio input', 'Back'], [], [true]);
        h.ctx.ui.select.mockImplementationOnce(async () => 'Set up replies for a chat').mockImplementationOnce(async () => { h.change(); return chat.label; });
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings()).toEqual(speechDefaults()); expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('nothing saved'), 'warning');
        expect(h.ctx.ui.notify).not.toHaveBeenCalledWith(expect.any(String), 'error');
    });
    it('saves neither group opt-in nor enablement when destination consent is declined', async () => {
        const h = setup(['Set up replies for a chat', group.label, 'Voice', 'Back'], [], [true, false]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.session.setSpeechSettings).not.toHaveBeenCalled(); expect(h.settings()).toEqual(speechDefaults());
    });
    it('returns from remote protocol Back to the backend picker without saving', async () => {
        const h = setup(['Advanced speech settings', labels.backend, 'Remote speech service (HTTP API)', 'Back', 'Back', 'Back', 'Back']);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.ctx.ui.select.mock.calls[4][0]).toBe(labels.backend); expect(h.session.setSpeechSettings).not.toHaveBeenCalled();
    });
    it('lets a remote provider switch from built-in to named voice without re-entering the backend', async () => {
        const initial = { ...speechDefaults(), config: { ...remote, ttsVoice: undefined, ttsProtocol: 'openai-compatible' as const, ttsUseServerVoice: true } };
        const h = setup(['Advanced speech settings', 'Remote voice or reference ID', 'Use a named voice / reference ID', 'Back', 'Back'], ['new-voice'], [], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings().config).toMatchObject({ ttsUseServerVoice: false, ttsVoice: 'new-voice' }); expect(h.ctx.ui.confirm).not.toHaveBeenCalled();
    });
    it('does not offer a server-default voice for Fish', async () => {
        const h = setup(['Advanced speech settings', labels.backend, 'Remote speech service (HTTP API)', 'Fish', 'Use a named voice / reference ID', 'Back', 'Back'],
            ['https://api.fish.audio/v1/tts', 's1', 'FIXTURE_TTS_KEY', 'fixture-reference']);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        const voices = h.ctx.ui.select.mock.calls.find(([title]) => title === 'Remote voice or reference ID')?.[1];
        expect(voices).not.toContain('Use server default voice'); expect(h.settings().config).toMatchObject({ ttsProtocol: 'fish', ttsVoice: 'fixture-reference' });
    });
    it('starts with chat setup and keeps backend controls under Advanced', async () => {
        const h = setup(['Back']); await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.ctx.ui.select.mock.calls[0][1]).toEqual(['Set up replies for a chat', labels.chats, 'Advanced speech settings', 'Turn speech off everywhere (revoke consent)', 'Back to main menu']);
    });
    it('sets up Mirror directly for one chat with explicit shared enablement and no send', async () => {
        const h = setup(['Set up replies for a chat', chat.label, 'Mirror audio input', 'Back'], [], [true]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings()).toMatchObject({ enabled: true, mode: 'text', chats: { [A]: { mode: 'mirror' } } });
        expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain('other chat overrides');
        expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Mirror audio input'), 'info');
        expect(h.actions.preview).not.toHaveBeenCalled(); expect(h.actions.disclose).not.toHaveBeenCalled();
    });
    it('warns before re-enabling approved shared speech and preserves a chat pause', async () => {
        const initial = { ...speechDefaults(), approvedDestinationKey: resolveTtsConfig({}).destinationKey, chats: { [A]: { automaticReplies: false } } };
        const h = setup(['Set up replies for a chat', chat.label, 'Voice', 'Back'], [], [true], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.ctx.ui.confirm).toHaveBeenCalledOnce(); expect(h.settings().chats[A]).toMatchObject({ automaticReplies: false, mode: 'voice' });
        expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('paused'), 'info');
    });
    it('shows only the active provider voice editor in Advanced', async () => {
        const h = setup(['Advanced speech settings', 'Back', 'Back']); await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        const choices = h.ctx.ui.select.mock.calls.find(([title]) => title === 'Advanced speech settings')?.[1];
        expect(choices).toContain('Edge voice'); expect(choices).not.toContain('Remote voice or reference ID');
    });
    it('configures a compatible built-in server voice atomically without a placeholder', async () => {
        const h = setup(['Advanced speech settings', labels.backend, 'Remote speech service (HTTP API)', 'OpenAI-compatible', 'Use server default voice', 'Back', 'Back'],
            ['http://127.0.0.1:8098/v1/audio/speech', 'chatterbox', 'FIXTURE_TTS_KEY']);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings().config).toMatchObject({ ttsProtocol: 'openai-compatible', ttsUseServerVoice: true, ttsModel: 'chatterbox' });
        expect(h.settings().config.ttsVoice).toBeUndefined(); expect(h.settings().enabled).toBe(false);
        expect(h.session.setSpeechSettings).toHaveBeenCalledOnce(); expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it('requires informed destination consent to enable a spoken default, without synthesizing', async () => {
        const h = setup([labels.mode, 'Voice', 'Back'], [], [true]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings()).toMatchObject({ enabled: true, mode: 'voice', approvedDestinationKey: resolveTtsConfig({}).destinationKey });
        expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain('speech.platform.bing.com'); expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain('not local inference');
        expect(h.actions.preview).not.toHaveBeenCalled(); expect(h.actions.disclose).not.toHaveBeenCalled();
    });
    it('cancelling consent does not alter modes or approve a destination', async () => {
        const h = setup([labels.mode, 'Voice', 'Back'], [], [false]); await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.session.setSpeechSettings).not.toHaveBeenCalled(); expect(h.settings()).toEqual(speechDefaults());
    });
    it('configures a new remote destination atomically and clears the old approval without invoking speech', async () => {
        const initial = { ...speechDefaults(), config: remote, enabled: true, mode: 'voice' as const, approvedDestinationKey: resolveTtsConfig(remote).destinationKey };
        const h = setup([labels.backend, 'Remote speech service (HTTP API)', 'OpenAI-compatible', 'Use a named voice / reference ID', 'Back'], ['https://new.example.test/speech', '', '', 'new-voice'], [], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.settings().config).toMatchObject({ ...remote, ttsEndpoint: 'https://new.example.test/speech', ttsVoice: 'new-voice' });
        expect(h.settings().approvedDestinationKey).toBeUndefined(); expect(chatReplyPolicy(h.settings(), A, jid => jid).mode).toBe('text'); expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it('Edge reset preserves separate Edge settings and chat preferences, not the old remote approval', async () => {
        const initial = { ...speechDefaults(), config: { ...remote, edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX' }, chats: { [A]: { mode: 'mirror' as const } }, approvedDestinationKey: resolveTtsConfig(remote).destinationKey };
        const h = setup([labels.backend, 'Microsoft / Edge (online, unofficial)', 'Back'], [], [], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.settings().config).toEqual({ edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX' });
        expect(h.settings().chats).toEqual(initial.chats); expect(h.settings().approvedDestinationKey).toBeUndefined();
    });
    it('pauses a selected chat visibly without sending a notice or changing allow lists', async () => {
        const h = setup([labels.chats, chat.label, 'Pause automatic replies', 'Back', 'Back']);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.settings().chats[A].automaticReplies).toBe(false);
        expect(h.actions.disclose).not.toHaveBeenCalled(); expect(h.ctx.ui.select.mock.calls.some(([title]) => title.includes('automatic replies paused'))).toBe(true);
    });
    it('requires separate group opt-in and destination consent for a group spoken mode', async () => {
        // Group confirmation precedes provider consent.
        const chosen = setup([labels.chats, group.label, "This chat's output mode", 'Voice + text', 'Back', 'Back'], [], [true, true]);
        await showVoiceSettings(chosen.ctx as any, chosen.session as any, chosen.actions);
        expect(chosen.settings().chats[G]).toMatchObject({ mode: 'both', groupSpeech: true });
        expect(chosen.ctx.ui.confirm).toHaveBeenCalledTimes(2); expect(chosen.actions.preview).not.toHaveBeenCalled();
    });
    it('does not opt a group in when the group-specific confirmation is cancelled', async () => {
        const h = setup([labels.chats, group.label, "This chat's output mode", 'Voice', 'Back', 'Back'], [], [false]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.session.setSpeechSettings).not.toHaveBeenCalled();
    });
    it('sends a preview only after showing the exact recipient/destination/public phrase, without granting ongoing consent', async () => {
        const h = setup([labels.preview, chat.label, 'Back'], [], [true]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.actions.preview).toHaveBeenCalledExactlyOnceWith(chat, {}, resolveTtsConfig({}).destinationKey, 0, '/fixture/workspace');
        expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain(A); expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain(VOICE_PREVIEW_PHRASE);
        expect(h.ctx.ui.confirm.mock.calls[0][1]).toContain('does not enable speech'); expect(h.settings()).toEqual(speechDefaults());
    });
    it('never previews or sends a disclosure on a cancelled review', async () => {
        const h = setup([labels.preview, chat.label, labels.chats, chat.label, labels.introduce, 'Back', 'Back'], [], [false, false]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.actions.preview).not.toHaveBeenCalled(); expect(h.actions.disclose).not.toHaveBeenCalled();
    });
    it('sends only the reviewed automation disclosure to the explicitly selected allowed chat', async () => {
        const h = setup([labels.chats, chat.label, labels.introduce, 'Back', 'Back'], [], [true]);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.actions.disclose).toHaveBeenCalledExactlyOnceWith(chat, 'This chat is connected to an AI assistant, not the human account owner. Replies may be automated.', 0);
        expect(h.actions.preview).not.toHaveBeenCalled();
    });
    it('reports an uncertain preview once without retrying or inventing a text send', async () => {
        const h = setup([labels.preview, chat.label, 'Back'], [], [true]); h.actions.preview.mockResolvedValueOnce({ success: false, delivery: 'unknown', attempts: 1 });
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.actions.preview).toHaveBeenCalledOnce(); expect(h.actions.disclose).not.toHaveBeenCalled();
        expect(h.ctx.ui.notify).toHaveBeenCalledWith('WhatsApp reply delivery is uncertain. Do not resend automatically.', 'warning');
    });
    it('text-only everywhere revokes permission and disables existing chat spoken overrides', async () => {
        const initial = { ...speechDefaults(), config: remote, enabled: true, mode: 'voice' as const, approvedDestinationKey: resolveTtsConfig(remote).destinationKey, chats: { [A]: { mode: 'both' as const } } };
        const h = setup(['Turn speech off everywhere (revoke consent)', 'Back'], [], [], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(chatReplyPolicy(h.settings(), A, jid => jid).mode).toBe('text'); expect(h.settings().approvedDestinationKey).toBeUndefined();
    });
    it('rejects an expired settings dialog instead of applying it to a replacement session', async () => {
        const h = setup([labels.mode, 'Voice'], [], []); h.ctx.ui.confirm.mockImplementationOnce(async () => { h.expire(); return true; });
        await withSettingsRequest(h.ctx as any, () => h.actions.current, async (scoped, current) => {
            await showVoiceSettings(scoped, h.session as any, { ...h.actions, current });
        }); expect(h.settings()).toEqual(speechDefaults());
    });
    it.each(['90000000001', '15550000001', '+000000', '+1234567890123456'])('rejects ambiguous or invalid manual phone owner input %s without changing authority', async value => {
        const h = setup(['Enter phone number or person JID'], [value], [true]);
        await showOwnerSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.session.setOperatorJid).not.toHaveBeenCalled(); expect(h.ctx.ui.confirm).not.toHaveBeenCalled();
        expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('+E164'), 'error');
    });
    it.each([['+15550000001', A], ['90000000001@lid', '90000000001@lid'], [A, A]])('keeps explicit manual person identity %s typed', async (input, expected) => {
        const h = setup(['Enter phone number or person JID'], [input], [true]); await showOwnerSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.session.setOperatorJid).toHaveBeenCalledExactlyOnceWith(expected, h.actions.current);
    });
    it('preserves a selected LID in both the voice picker and owner picker without guessing a phone alias', async () => {
        const lid = '90000000001@lid'; const lidChat = { jid: lid, recipientJid: lid, label: `Fixture LID (${lid})` };
        const h = setup([labels.chats, lidChat.label, "This chat's output mode", 'Voice', 'Back', 'Back'], [], [true]); h.actions.chats = () => [lidChat];
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.settings().chats[lid].mode).toBe('voice'); expect(h.settings().chats['90000000001@s.whatsapp.net']).toBeUndefined();
        const owner = setup([lidChat.label], [], [true]); owner.actions.chats = () => [lidChat];
        await showOwnerSettings(owner.ctx as any, owner.session as any, owner.actions); expect(owner.session.setOperatorJid).toHaveBeenCalledWith(lid, owner.actions.current);
    });
    it('selects or clears the phone owner only after explicit review', async () => {
        const h = setup([chat.label], [], [true]); await showOwnerSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.session.setOperatorJid).toHaveBeenCalledWith(A, h.actions.current);
        const cancelled = setup(['Enter phone number or person JID'], ['+15550000001'], [false]); await showOwnerSettings(cancelled.ctx as any, cancelled.session as any, cancelled.actions);
        expect(cancelled.session.setOperatorJid).not.toHaveBeenCalled();
    });
});
