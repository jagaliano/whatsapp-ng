import { describe, expect, it } from 'vitest';
import { speechDefaults, validateSpeechSettings, loadSpeechSettings, storedSpeechFields, chatReplyPolicy, setChatReplyPreferences, finalSpeechPolicy, describeSpeechDestination, settingsJid } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig, updateTtsConfig } from '../../src/services/tts-config.ts';
import { JidResolver } from '../../src/services/jid-resolver.service.ts';

const A = '15550000001@s.whatsapp.net'; const LID = '90000001@lid'; const G = '120363000000001@g.us';
const remote = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
const voiced = () => ({ ...speechDefaults(), config: { ...remote }, enabled: true, mode: 'voice' as const, approvedDestinationKey: resolveTtsConfig(remote).destinationKey });

describe('persisted speech policy', () => {
    it('keeps legacy configurations text-only without deriving consent from STT or remote fields', () => {
        for (const value of [{}, { ...remote, sttEndpoint: 'https://stt.example.test', sttEnv: 'FIXTURE_STT_KEY' }]) {
            const settings = loadSpeechSettings(value);
            expect(chatReplyPolicy(settings, A, jid => jid).mode).toBe('text'); expect(settings.enabled).toBe(false); expect(settings.approvedDestinationKey).toBeUndefined();
        }
    });
    it('requires the precise current destination and explicit enablement', () => {
        const settings = voiced(); expect(chatReplyPolicy(settings, A, jid => jid).mode).toBe('voice');
        expect(chatReplyPolicy({ ...settings, approvedDestinationKey: undefined }, A, jid => jid).mode).toBe('text');
        expect(chatReplyPolicy({ ...settings, enabled: false }, A, jid => jid).mode).toBe('text');
    });
    it.each(['ttsEndpoint', 'ttsEnv', 'ttsProtocol'] as const)('revokes old consent when %s changes', field => {
        const settings = voiced();
        const changes = { ttsEndpoint: 'https://other.example.test/speech', ttsEnv: 'OTHER_FIXTURE_KEY', ttsProtocol: 'fish' as const };
        const config = field === 'ttsProtocol' ? { ...remote, ttsProtocol: 'fish' as const, ttsModel: 's2.1-pro-free' } : { ...remote, [field]: changes[field] };
        const next = validateSpeechSettings({ ...settings, config }); expect(next.approvedDestinationKey).toBeUndefined();
        expect(chatReplyPolicy(next, A, jid => jid).mode).toBe('text');
    });
    it('requires fresh Edge approval after the synthesis endpoint changes', () => {
        const oldApproval = JSON.stringify(['edge', 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1', '']);
        const settings = validateSpeechSettings({ ...speechDefaults(), enabled: true, mode: 'voice', approvedDestinationKey: oldApproval });
        expect(settings.approvedDestinationKey).toBeUndefined(); expect(chatReplyPolicy(settings, A, jid => jid).mode).toBe('text');
        expect(describeSpeechDestination(settings.config).host).toBe('speech.platform.bing.com');
    });
    it('retains approval for a voice/model change within the same destination', () => {
        const next = validateSpeechSettings({ ...voiced(), config: { ...remote, ttsModel: 'another-model', ttsVoice: 'another-voice' } });
        expect(next.approvedDestinationKey).toBe(voiced().approvedDestinationKey);
    });
    it('empty backend updates select Edge while retaining modes/chat settings and separate Edge preferences', () => {
        const settings = { ...voiced(), config: { ...remote, edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX', edgeSpeed: 1.1 }, chats: { [A]: { mode: 'both' as const } } };
        const next = validateSpeechSettings({ ...settings, config: updateTtsConfig(settings.config, {}) });
        expect(next.config).toEqual({ edgeVoice: 'es-MX-DaliaNeural', edgeLocale: 'es-MX', edgeSpeed: 1.1 });
        expect(next.mode).toBe('voice'); expect(next.chats[A].mode).toBe('both'); expect(next.approvedDestinationKey).toBeUndefined();
    });
    it('rejects invalid inactive Edge settings rather than storing a broken later default', () => {
        expect(() => validateSpeechSettings({ ...voiced(), config: { ...remote, edgeVoice: 'invalid' } })).toThrow();
    });
    it('keeps groups text-only until that group is explicitly opted in', () => {
        const settings = voiced(); expect(chatReplyPolicy(settings, G, jid => jid).mode).toBe('text');
        const opted = setChatReplyPreferences(settings, G, { mode: 'both', groupSpeech: true }, jid => jid);
        expect(chatReplyPolicy(opted, G, jid => jid)).toMatchObject({ mode: 'both', groupOptIn: true });
        expect(chatReplyPolicy(opted, '120363000000002@g.us', jid => jid).mode).toBe('text');
    });
    it('preserves pause under verified PN/LID mapping and resolves conflicting modes to text', () => {
        const resolver = new JidResolver(); resolver.bind(A, LID);
        const settings = { ...voiced(), chats: { [A]: { mode: 'voice' as const }, [LID]: { mode: 'both' as const, automaticReplies: false } } };
        expect(chatReplyPolicy(settings, A, jid => resolver.canonical(jid))).toMatchObject({ mode: 'text', automaticReplies: false });
        const changed = setChatReplyPreferences(settings, LID, { mode: 'mirror', automaticReplies: true }, jid => resolver.canonical(jid));
        expect(Object.keys(changed.chats)).toEqual([A]); expect(chatReplyPolicy(changed, LID, jid => resolver.canonical(jid)).mode).toBe('mirror');
    });
    it.each([{ mode: 'mirror' as const }, { mode: undefined }])('keeps alias pauses during a mode-only/inheritance edit: %j', patch => {
        const resolver = new JidResolver(); resolver.bind(A, LID); const canonical = (jid: string) => resolver.canonical(jid);
        const settings = { ...voiced(), chats: { [A]: { mode: 'voice' as const }, [LID]: { mode: 'both' as const, automaticReplies: false } } };
        const next = setChatReplyPreferences(settings, LID, patch, canonical);
        expect(Object.keys(next.chats)).toEqual([A]); expect(chatReplyPolicy(next, A, canonical).automaticReplies).toBe(false);
        expect(finalSpeechPolicy(next, A, canonical, () => true).isCurrent!()).toBe(false);
    });
    it('preserves an unambiguous alias mode when only automatic replies change', () => {
        const resolver = new JidResolver(); resolver.bind(A, LID); const canonical = (jid: string) => resolver.canonical(jid);
        const settings = { ...voiced(), chats: { [A]: { mode: 'both' as const }, [LID]: { automaticReplies: false } } };
        const next = setChatReplyPreferences(settings, A, { automaticReplies: true }, canonical);
        expect(chatReplyPolicy(next, LID, canonical)).toMatchObject({ automaticReplies: true, mode: 'both' });
    });
    it('does not remove a conflicting-mode text fence when explicitly unpausing aliases', () => {
        const resolver = new JidResolver(); resolver.bind(A, LID); const canonical = (jid: string) => resolver.canonical(jid);
        const settings = { ...voiced(), chats: { [A]: { mode: 'voice' as const }, [LID]: { mode: 'both' as const, automaticReplies: false } } };
        const next = setChatReplyPreferences(settings, A, { automaticReplies: true }, canonical);
        expect(chatReplyPolicy(next, LID, canonical)).toMatchObject({ automaticReplies: true, mode: 'text' });
    });
    it('does not invent group opt-in when consolidating ambiguous group aliases', () => {
        const other = '120363000000002@g.us'; const canonical = (jid: string) => jid === other ? G : jid;
        const settings = { ...voiced(), chats: { [G]: { mode: 'voice' as const, groupSpeech: true }, [other]: { groupSpeech: true, automaticReplies: false } } };
        const next = setChatReplyPreferences(settings, G, { automaticReplies: true }, canonical);
        expect(chatReplyPolicy(next, G, canonical)).toMatchObject({ automaticReplies: true, mode: 'text', groupOptIn: false });
    });
    it('makes a paused chat invalidate finalization without changing global voice preferences', () => {
        const settings = setChatReplyPreferences(voiced(), A, { automaticReplies: false }, jid => jid);
        expect(finalSpeechPolicy(settings, A, jid => jid, () => true).isCurrent!()).toBe(false);
        expect(settings.mode).toBe('voice');
    });
    it.each([null, [], { enabled: 'yes' }, { mode: 'invalid' }, { chats: { ['__proto__']: {} } }])('rejects malformed saved preferences: %j', prefs => {
        expect(() => loadSpeechSettings({ voicePreferences: prefs })).toThrow();
    });
    it('round-trips a bounded defensive preference structure with no credentials', () => {
        const settings = voiced(); const fields = storedSpeechFields(settings); const loaded = loadSpeechSettings(fields);
        expect(loaded).toEqual(settings); loaded.config.ttsVoice = 'changed'; expect(settings.config.ttsVoice).toBe('fixture-voice');
        expect(JSON.stringify(fields)).toContain('FIXTURE_TTS_KEY'); expect(JSON.stringify(fields)).not.toContain('Authorization');
    });
    it('reports the actual custom destination, without calling it the real Fish service', () => {
        const destination = describeSpeechDestination({ ...remote, ttsProtocol: 'fish', ttsModel: 's2.1-pro-free' });
        expect(destination.host).toBe('speech.example.test'); expect(destination.service).toContain('speech.example.test');
    });
    it.each(['https://example.test', 'someone', '__proto__', '1@g.us/secret'])('rejects unsafe preference keys %s', key => { expect(() => settingsJid(key)).toThrow(); });
});
