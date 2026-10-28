import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showVoiceSettings, showOwnerSettings, VOICE_PREVIEW_PHRASE } from '../../src/ui/voice-settings.view.ts';
import { speechDefaults, validateSpeechSettings, chatReplyPolicy, type SpeechSettings } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { resetI18n } from '../../src/i18n.ts';

const A = '15550000001@s.whatsapp.net'; const G = '120363000000001@g.us';
const chat = { jid: A, recipientJid: A, label: `Fixture (${A})` }; const group = { jid: G, recipientJid: G, label: `Group (${G})` };
const remote = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
const labels = { backend: 'Speech backend / connection', mode: 'Default reply mode (chat overrides remain)', chats: 'Chats: modes, automatic replies and introduction', preview: 'Fixed-phrase preview (review & send)', introduce: 'Introduce the AI assistant (review & send)' };
function setup(selects: string[], inputs: Array<string | undefined> = [], confirms: Array<boolean | (() => boolean)> = [], initial = speechDefaults()) {
    let settings = structuredClone(initial); let revision = 0; let owner = ''; let current = true;
    const session = { getSpeechSettings: () => structuredClone(settings), getSpeechRevision: () => revision,
        setSpeechSettings: vi.fn(async (next: SpeechSettings, expected: number, guard: () => boolean) => { if (expected !== revision || !guard()) throw new Error('fixture stale'); settings = validateSpeechSettings(next); revision++; }),
        getOperatorJid: () => owner, setOperatorJid: vi.fn(async (jid: string, guard: () => boolean) => { if (!guard()) throw new Error('fixture stale'); owner = jid; revision++; }) };
    const actions = { current: () => current, canonical: (jid: string) => jid, chats: () => [chat, group],
        preview: vi.fn().mockResolvedValue({ success: true, attempts: 1 }), disclose: vi.fn().mockResolvedValue({ success: true, attempts: 1 }) };
    const ctx = { cwd: '/fixture/workspace', isIdle: () => true, ui: {
        select: vi.fn(async () => selects.shift() ?? 'Back'), input: vi.fn(async () => inputs.shift()),
        confirm: vi.fn(async () => { const answer = confirms.shift(); return typeof answer === 'function' ? answer() : answer ?? false; }), notify: vi.fn()
    } };
    return { session, actions, ctx, settings: () => settings, expire: () => { current = false; } };
}
beforeEach(() => { resetI18n(); vi.unstubAllEnvs(); });

describe('terminal Voice/Owner settings', () => {
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
        const h = setup([labels.backend, 'Remote speech service', 'Back'], ['https://new.example.test/speech', '', '', 'new-voice'], [], initial);
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
        const h = setup(['Text-only everywhere / revoke speech consent', 'Back'], [], [], initial);
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(chatReplyPolicy(h.settings(), A, jid => jid).mode).toBe('text'); expect(h.settings().approvedDestinationKey).toBeUndefined();
    });
    it('rejects an expired settings dialog instead of applying it to a replacement session', async () => {
        const h = setup([labels.mode, 'Voice'], [], []); h.ctx.ui.confirm.mockImplementationOnce(async () => { h.expire(); return true; });
        await showVoiceSettings(h.ctx as any, h.session as any, h.actions); expect(h.settings()).toEqual(speechDefaults());
    });
    it.each(['90000000001', '15550000001', '+000000', '+1234567890123456'])('rejects ambiguous or invalid manual phone owner input %s without changing authority', async value => {
        const h = setup(['Enter a person number / JID'], [value], [true]);
        await showOwnerSettings(h.ctx as any, h.session as any, h.actions);
        expect(h.session.setOperatorJid).not.toHaveBeenCalled(); expect(h.ctx.ui.confirm).not.toHaveBeenCalled();
        expect(h.ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('+E164'), 'error');
    });
    it.each([['+15550000001', A], ['90000000001@lid', '90000000001@lid'], [A, A]])('keeps explicit manual person identity %s typed', async (input, expected) => {
        const h = setup(['Enter a person number / JID'], [input], [true]); await showOwnerSettings(h.ctx as any, h.session as any, h.actions);
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
        const cancelled = setup(['Enter a person number / JID'], ['+15550000001'], [false]); await showOwnerSettings(cancelled.ctx as any, cancelled.session as any, cancelled.actions);
        expect(cancelled.session.setOperatorJid).not.toHaveBeenCalled();
    });
});
