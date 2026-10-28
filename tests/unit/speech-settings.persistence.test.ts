import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '../../src/services/session.manager.ts';
import { speechDefaults, setChatReplyPreferences } from '../../src/services/speech-settings.ts';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';
import { JidResolver } from '../../src/services/jid-resolver.service.ts';

const io = vi.hoisted(() => ({ failRename: false, beforeTempChmod: undefined as undefined | (() => Promise<void>) }));
vi.mock('fs/promises', async importOriginal => {
    const actual = await importOriginal<typeof import('fs/promises')>();
    return { ...actual,
        rename: async (...args: Parameters<typeof actual.rename>) => { if (io.failRename) throw Object.assign(new Error('fixture rename denied'), { code: 'EACCES' }); return actual.rename(...args); },
        chmod: async (...args: Parameters<typeof actual.chmod>) => {
            if (String(args[0]).endsWith('.tmp') && io.beforeTempChmod) { const hook = io.beforeTempChmod; io.beforeTempChmod = undefined; await hook(); }
            return actual.chmod(...args);
        }
    };
});
const A = '15550000001@s.whatsapp.net';
const config = { ttsEndpoint: 'https://speech.example.test/v1/audio/speech', ttsModel: 'fixture-model', ttsEnv: 'FIXTURE_TTS_KEY', ttsVoice: 'fixture-voice' };
const voiced = () => ({ ...speechDefaults(), config: { ...config }, enabled: true, mode: 'both' as const, approvedDestinationKey: resolveTtsConfig(config).destinationKey });

describe('speech settings persistence', () => {
    let dir: string; let session: SessionManager;
    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'wa-speech-settings-')); session = new SessionManager(dir); io.failRename = false; io.beforeTempChmod = undefined; });
    afterEach(async () => { vi.unstubAllEnvs(); io.failRename = false; io.beforeTempChmod = undefined; await rm(dir, { recursive: true, force: true }); });
    const file = () => join(dir, 'config.json');

    const stt = { sttEndpoint: 'https://stt.example.test/v1', sttModel: 'original-stt', sttEnv: 'FIXTURE_STT_KEY' };
    it('rejects revoked STT changes without publishing them to memory or disk', async () => {
        await session.setSttConfig(stt); const original = await readFile(file(), 'utf8');
        await expect(session.setSttConfig({ ...stt, sttModel: 'unauthorized' }, () => false)).rejects.toThrow('expired');
        expect(session.getSttConfig()).toEqual(stt); expect(await readFile(file(), 'utf8')).toBe(original);
    });
    it('rechecks STT authority after the last preparation await before atomic commit', async () => {
        await session.setSttConfig(stt); const original = await readFile(file(), 'utf8');
        let entered!: () => void; let release!: () => void; let current = true;
        const paused = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
        io.beforeTempChmod = async () => { entered(); await gate; };
        const pending = session.setSttConfig({}, () => current);
        const assertion = expect(pending).rejects.toThrow('expired'); await paused;
        const beforeCommit = session.getSttConfig(); current = false; release(); await assertion;
        expect(beforeCommit).toEqual(stt); expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSttConfig()).toEqual(stt);
    });
    it('does not leak a queued revoked STT update into ordinary saves', async () => {
        await session.setSttConfig(stt);
        let entered!: () => void; let release!: () => void; let current = true;
        const paused = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
        io.beforeTempChmod = async () => { entered(); await gate; };
        const status = session.setStatus('disconnected'); await paused;
        const pending = session.setSttConfig({ ...stt, sttEndpoint: 'https://unapproved.example.test/v1' }, () => current);
        const assertion = expect(pending).rejects.toThrow('expired'); current = false; release(); await status; await assertion;
        expect(session.getSttConfig()).toEqual(stt); expect(JSON.parse(await readFile(file(), 'utf8'))).toMatchObject({ ...stt, status: 'disconnected' });
    });
    it('does not report a failed STT atomic rename as success or mutate live settings', async () => {
        await session.setSttConfig(stt); const original = await readFile(file(), 'utf8'); io.failRename = true;
        await expect(session.setSttConfig({})).rejects.toThrow();
        expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSttConfig()).toEqual(stt);
    });
    it('never overwrites unreadable configuration through an STT update', async () => {
        const original = 'NOT-VALID-JSON'; await writeFile(file(), original);
        await expect(session.setSttConfig(stt)).rejects.toThrow('unreadable');
        expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSttConfig().sttEndpoint).toBeUndefined();
    });

    it('defaults to text without adding an implicit destination approval', async () => {
        await session.ensureInitialized(); expect(session.getSpeechSettings()).toEqual(speechDefaults());
    });
    it('round-trips preferences alongside existing operator, contacts, STT and vision settings', async () => {
        const original = { allowList: [{ number: '+15550000001', name: 'Fixture' }], allowedGroups: [{ number: '120363000000001@g.us' }],
            ignoredNumbers: [], status: 'logged-out', openaiKey: 'fixture-legacy-value', visionModel: 'fixture-vision', operatorJid: A,
            sttEndpoint: 'https://stt.example.test/v1', sttModel: 'fixture-stt', sttEnv: 'FIXTURE_STT_KEY', finalAfterAttachments: false };
        await writeFile(file(), JSON.stringify(original)); await session.ensureInitialized();
        vi.stubEnv('FIXTURE_TTS_KEY', 'synthetic-value-never-save-this');
        await session.setSpeechSettings(voiced(), session.getSpeechRevision());
        const saved = JSON.parse(await readFile(file(), 'utf8'));
        expect(saved).toMatchObject(original); expect(saved).toMatchObject(config);
        expect(JSON.stringify(saved)).not.toContain('synthetic-value-never-save-this');
        expect((await stat(file())).mode & 0o777).toBe(0o600);
        const reopened = new SessionManager(dir); await reopened.ensureInitialized();
        expect(reopened.getSpeechSettings()).toEqual(voiced()); expect(reopened.getOperatorJid()).toBe(A); expect(reopened.getFinalAfterAttachments()).toBe(false);
        const snapshot = reopened.getSpeechSettings(); snapshot.config.ttsModel = 'mutated'; snapshot.chats[A] = { automaticReplies: false };
        expect(reopened.getSpeechSettings().config.ttsModel).toBe('fixture-model'); expect(reopened.getSpeechSettings().chats[A]).toBeUndefined();
    });
    it('preserves speech fields during ordinary state saves and rejects stale revisions', async () => {
        await session.ensureInitialized(); const revision = session.getSpeechRevision();
        await session.setSpeechSettings(voiced(), revision); await session.setStatus('disconnected');
        await expect(session.setSpeechSettings(speechDefaults(), revision)).rejects.toThrow('expired');
        const saved = JSON.parse(await readFile(file(), 'utf8')); expect(saved.voicePreferences.enabled).toBe(true); expect(saved.ttsModel).toBe('fixture-model');
    });
    it('rejects invalid configuration atomically before mutating memory or disk', async () => {
        await session.ensureInitialized(); await session.setSpeechSettings(voiced(), 0); const original = await readFile(file(), 'utf8');
        await expect(session.setSpeechSettings({ ...voiced(), config: { ttsModel: 'partial' } }, session.getSpeechRevision())).rejects.toThrow();
        expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSpeechSettings()).toEqual(voiced());
    });
    it('does not report a failed atomic rename as saved or change live consent', async () => {
        await session.ensureInitialized(); await session.setSpeechSettings(voiced(), 0); const original = await readFile(file(), 'utf8');
        io.failRename = true;
        await expect(session.setSpeechSettings(speechDefaults(), session.getSpeechRevision())).rejects.toThrow();
        expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSpeechSettings()).toEqual(voiced());
    });
    it('rechecks request authority after the last preparation await and before committing', async () => {
        await session.ensureInitialized(); await session.setSpeechSettings(voiced(), 0); const original = await readFile(file(), 'utf8');
        let entered!: () => void; let release!: () => void; let current = true;
        const paused = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
        io.beforeTempChmod = async () => { entered(); await gate; };
        const pending = session.setSpeechSettings(speechDefaults(), session.getSpeechRevision(), () => current);
        const assertion = expect(pending).rejects.toThrow('expired'); await paused; current = false; release(); await assertion;
        expect(await readFile(file(), 'utf8')).toBe(original); expect(session.getSpeechSettings()).toEqual(voiced());
    });
    it('serializes ordinary state writes behind an atomic settings update without losing either', async () => {
        await session.ensureInitialized(); await session.setSpeechSettings(voiced(), 0);
        let entered!: () => void; let release!: () => void;
        const paused = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
        io.beforeTempChmod = async () => { entered(); await gate; };
        const next = voiced(); next.config.ttsModel = 'updated'; const pending = session.setSpeechSettings(next, session.getSpeechRevision());
        await paused; const status = session.setStatus('disconnected'); release(); await Promise.all([pending, status]);
        const saved = JSON.parse(await readFile(file(), 'utf8')); expect(saved.status).toBe('disconnected'); expect(saved.ttsModel).toBe('updated'); expect(saved.voicePreferences.approvedDestinationKey).toBe(next.approvedDestinationKey);
    });
    it('keeps invalid saved speech bytes through unrelated saves and requires explicit repair', async () => {
        const invalid = { ttsModel: 'partial', voicePreferences: { enabled: true, mode: 'voice', chats: {} }, allowList: [{ number: '+15550000001' }] };
        await writeFile(file(), JSON.stringify(invalid)); await session.ensureInitialized(); expect(() => session.getSpeechSettings()).toThrow('Invalid saved');
        await session.setStatus('disconnected'); expect(JSON.parse(await readFile(file(), 'utf8'))).toMatchObject(invalid);
        await session.setSpeechSettings(speechDefaults(), session.getSpeechRevision()); expect(session.getSpeechSettings()).toEqual(speechDefaults());
        expect(JSON.parse(await readFile(file(), 'utf8')).allowList).toEqual(invalid.allowList);
    });
    it('never overwrites an unreadable/corrupt unrelated configuration with voice defaults', async () => {
        const original = 'NOT-VALID-JSON'; await writeFile(file(), original); await session.ensureInitialized();
        await expect(session.setSpeechSettings(speechDefaults(), 0)).rejects.toThrow('unreadable');
        await expect(session.setOperatorJid(A)).rejects.toThrow('unreadable');
        expect(await readFile(file(), 'utf8')).toBe(original);
    });
    it('expires pre-pause admissions even after re-enable/reset, without expiring another chat', async () => {
        await session.ensureInitialized(); const resolver = new JidResolver(); const canonical = (jid: string) => resolver.canonical(jid);
        const original = session.getReplyAdmissionKey(A, canonical); const other = session.getReplyAdmissionKey('15550000002@s.whatsapp.net', canonical);
        let next = setChatReplyPreferences(session.getSpeechSettings(), A, { automaticReplies: false }, canonical);
        await session.setSpeechSettings(next, session.getSpeechRevision());
        next = setChatReplyPreferences(session.getSpeechSettings(), A, { automaticReplies: true }, canonical);
        await session.setSpeechSettings(next, session.getSpeechRevision()); expect(session.getReplyAdmissionKey(A, canonical)).not.toBe(original);
        await session.setSpeechSettings(speechDefaults(), session.getSpeechRevision()); expect(session.getReplyAdmissionKey(A, canonical)).not.toBe(original);
        expect(session.getReplyAdmissionKey('15550000002@s.whatsapp.net', canonical)).toBe(other);
    });
    it('normalizes explicit personal owners and never accepts a group as owner', async () => {
        await session.setOperatorJid('+15550000001'); expect(session.getOperatorJid()).toBe(A);
        const revision = session.getOperatorRevision(); await expect(session.setOperatorJid('120363000000001@g.us')).rejects.toThrow('person');
        expect(session.getOperatorRevision()).toBe(revision); await session.setOperatorJid(''); expect(session.getOperatorJid()).toBe('');
    });
});
