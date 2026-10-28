import { SessionManager } from '../../src/services/session.manager.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let dataDir: string;

    beforeEach(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'whatsapp-ng-session-'));
        sessionManager = new SessionManager(dataDir);
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        await rm(dataDir, { recursive: true, force: true });
    });

    it('guards phone reply-policy changes at atomic commit and leaves disk/memory unchanged on revocation', async () => {
        await sessionManager.setFinalAfterAttachments(true);
        const before = await readFile(join(dataDir, 'config.json'), 'utf8'); let checks = 0;
        await expect(sessionManager.setFinalAfterAttachments(false, () => ++checks < 3)).rejects.toThrow('expired');
        expect(sessionManager.getFinalAfterAttachments()).toBe(true);
        expect(await readFile(join(dataDir, 'config.json'), 'utf8')).toBe(before);
        const restored = new SessionManager(dataDir); await restored.ensureInitialized(); expect(restored.getFinalAfterAttachments()).toBe(true);
    });

    it('refuses a phone reply-policy write over unreadable existing configuration', async () => {
        const path = join(dataDir, 'config.json'); await writeFile(path, 'broken-original');
        await expect(sessionManager.setFinalAfterAttachments(false)).rejects.toThrow('unreadable');
        expect(await readFile(path, 'utf8')).toBe('broken-original'); expect(sessionManager.getFinalAfterAttachments()).toBe(true);
    });

    it('never revives captured output after allowed chat removal and re-addition', async () => {
        await sessionManager.ensureInitialized(); const canonical = (jid: string) => jid;
        const phone = '+15550000001'; const jid = '15550000001@s.whatsapp.net'; const group = '120363000001@g.us';
        await sessionManager.addNumber(phone); await sessionManager.addAllowedGroup(group);
        const before = sessionManager.getReplyAdmissionKey(jid, canonical); const other = sessionManager.getReplyAdmissionKey('15550000002@s.whatsapp.net', canonical);
        await sessionManager.removeNumber(phone); await sessionManager.addNumber(phone);
        expect(sessionManager.getReplyAdmissionKey(jid, canonical)).not.toBe(before); expect(sessionManager.getReplyAdmissionKey('15550000002@s.whatsapp.net', canonical)).toBe(other);
        const groupBefore = sessionManager.getReplyAdmissionKey(group, canonical); await sessionManager.removeAllowedGroup(group); await sessionManager.addAllowedGroup(group);
        expect(sessionManager.getReplyAdmissionKey(group, canonical)).not.toBe(groupBefore);
    });
    it('round-trips default-off reporting flags defensively without changing existing stats or voice', async () => {
        expect(sessionManager.getReplyReporting()).toEqual({ changedFiles: false, interimText: false, liveActivity: false });
        await sessionManager.setReplyStats(true); await sessionManager.setReplyReporting({ changedFiles: true, interimText: false, liveActivity: true }, 0);
        const copy = sessionManager.getReplyReporting(); copy.liveActivity = false; expect(sessionManager.getReplyReporting().liveActivity).toBe(true);
        const restored = new SessionManager(dataDir); await restored.ensureInitialized(); expect(restored.getReplyReporting()).toEqual({ changedFiles: true, interimText: false, liveActivity: true }); expect(restored.getReplyStats()).toBe(true);
        await expect(sessionManager.setReplyReporting(copy, 0)).rejects.toThrow('expired');
        await restored.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).replyReporting.liveActivity).toBe(true);
    });
    it('preserves malformed reporting flags and rejects revoked atomic writes', async () => {
        const invalid = { liveActivity: 'yes' }; await writeFile(join(dataDir, 'config.json'), JSON.stringify({ replyReporting: invalid }));
        await sessionManager.ensureInitialized(); expect(() => sessionManager.getReplyReporting()).toThrow('report');
        await sessionManager.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).replyReporting).toEqual(invalid);
        const before = await readFile(join(dataDir, 'config.json'), 'utf8'); let checks = 0;
        await expect(sessionManager.setReplyReporting({ changedFiles: true, interimText: false, liveActivity: false }, 0, () => ++checks < 3)).rejects.toThrow('expired');
        expect(await readFile(join(dataDir, 'config.json'), 'utf8')).toBe(before); expect(sessionManager.getReplyReportingRevision()).toBe(0);
    });
    it('defaults final stats off and round-trips explicit settings without altering other preferences', async () => {
        expect(sessionManager.getReplyStats()).toBe(false);
        await sessionManager.setFinalAfterAttachments(false); const original = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'));
        await sessionManager.setReplyStats(true); expect(sessionManager.getReplyStats()).toBe(true); expect(sessionManager.getReplyStatsRevision()).toBe(1);
        const saved = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')); expect(saved).toEqual({ ...original, replyStats: true });
        const restored = new SessionManager(dataDir); await restored.ensureInitialized(); expect(restored.getReplyStats()).toBe(true);
        await restored.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).replyStats).toBe(true);
        await restored.setReplyStats(false); expect(restored.getReplyStatsRevision()).toBe(1);
    });
    it('guards final stats at atomic commit and does not overwrite unreadable or invalid legacy state', async () => {
        await writeFile(join(dataDir, 'config.json'), JSON.stringify({ replyStats: 'invalid-preserve', finalAfterAttachments: false }));
        await sessionManager.ensureInitialized(); expect(sessionManager.getReplyStats()).toBe(false);
        await sessionManager.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).replyStats).toBe('invalid-preserve');
        const before = await readFile(join(dataDir, 'config.json'), 'utf8'); let checks = 0;
        await expect(sessionManager.setReplyStats(true, () => ++checks < 3)).rejects.toThrow('expired');
        expect(await readFile(join(dataDir, 'config.json'), 'utf8')).toBe(before); expect(sessionManager.getReplyStatsRevision()).toBe(0);
        await expect(sessionManager.setReplyStats('true' as any)).rejects.toThrow('boolean');
    });
    it('defaults groups to mentions-or-replies without context and atomically preserves other settings', async () => {
        expect(sessionManager.getGroupReplies()).toEqual({ mode: 'mentions-or-replies', context: false });
        await sessionManager.setReplyStats(true);
        const speech = sessionManager.getSpeechSettings(); speech.chats['120363000001@g.us'] = { automaticReplies: false };
        await sessionManager.setSpeechSettings(speech, 0);
        await sessionManager.setGroupReplies({ mode: 'mentions', context: true }, 0);
        const snapshot = sessionManager.getGroupReplies(); snapshot.context = false;
        expect(sessionManager.getGroupReplies()).toEqual({ mode: 'mentions', context: true });
        const restored = new SessionManager(dataDir); await restored.ensureInitialized();
        expect(restored.getGroupReplies()).toEqual({ mode: 'mentions', context: true }); expect(restored.getReplyStats()).toBe(true);
        expect(restored.getSpeechSettings().chats['120363000001@g.us'].automaticReplies).toBe(false);
        await expect(sessionManager.setGroupReplies({ mode: 'all', context: false }, 0)).rejects.toThrow('expired');
        await expect(sessionManager.setGroupReplies({ mode: 'all', context: false }, 1, () => false)).rejects.toThrow('expired');
        expect(sessionManager.getGroupRepliesRevision()).toBe(1);
    });
    it('does not silently adopt invalid group preferences or erase them on unrelated saves', async () => {
        const invalid = { mode: 'unknown', context: true };
        await writeFile(join(dataDir, 'config.json'), JSON.stringify({ groupReplies: invalid }));
        await sessionManager.ensureInitialized(); expect(() => sessionManager.getGroupReplies()).toThrow('group');
        await sessionManager.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).groupReplies).toEqual(invalid);
        await expect(sessionManager.setGroupReplies({ mode: 'all', context: 'yes' } as any, 0)).rejects.toThrow('group');
    });
    it('round-trips optional outputs defensively, preserving group/stats preferences and revoking owner consent', async () => {
        const owner = '15550000001@s.whatsapp.net';
        expect(sessionManager.getOptionalOutputs()).toEqual({ imageTools: [] });
        await sessionManager.setOperatorJid(owner); await sessionManager.setReplyStats(true);
        await sessionManager.setGroupReplies({ mode: 'replies', context: false }, 0);
        await sessionManager.setOptionalOutputs({ imageTools: ['screenshot'], terminal: { ownerJid: owner, accountScope: 'fixture' } }, sessionManager.getOptionalOutputsRevision());
        sessionManager.getOptionalOutputs().imageTools.push('read'); expect(sessionManager.getOptionalOutputs().imageTools).toEqual(['screenshot']);
        const restored = new SessionManager(dataDir); await restored.ensureInitialized(); expect(restored.getOptionalOutputs()).toEqual(sessionManager.getOptionalOutputs());
        expect(restored.getReplyStats()).toBe(true); expect(restored.getGroupReplies().mode).toBe('replies');
        await restored.setOperatorJid('15550000002@s.whatsapp.net'); await restored.setOperatorJid(owner);
        expect(restored.getOptionalOutputs()).toEqual({ imageTools: ['screenshot'] });
    });
    it('preserves invalid optional settings and rejects stale/revoked commits', async () => {
        const invalid = { imageTools: ['*'] }; await writeFile(join(dataDir, 'config.json'), JSON.stringify({ optionalOutputs: invalid }));
        await sessionManager.ensureInitialized(); expect(() => sessionManager.getOptionalOutputs()).toThrow();
        await sessionManager.setStatus('disconnected'); expect(JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8')).optionalOutputs).toEqual(invalid);
        const before = await readFile(join(dataDir, 'config.json'), 'utf8'); let checks = 0;
        await expect(sessionManager.setOptionalOutputs({ imageTools: [] }, 0, () => ++checks < 3)).rejects.toThrow('expired');
        expect(await readFile(join(dataDir, 'config.json'), 'utf8')).toBe(before);
        await sessionManager.setOptionalOutputs({ imageTools: [] }, 0);
        await expect(sessionManager.setOptionalOutputs({ imageTools: ['read'] }, 0)).rejects.toThrow('expired');
    });
    it('should initialize with logged-out status', () => {
        expect(sessionManager.getStatus()).toBe('logged-out');
    });

    it('should set and get status', async () => {
        await sessionManager.setStatus('connected');
        expect(sessionManager.getStatus()).toBe('connected');
    });

    it('should clear session directory and recreate auth folder', async () => {
        const authDir = sessionManager.getAuthStateDir();
        sessionManager.setStatus('connected');
        
        await sessionManager.deleteAuthState();
        
        expect(sessionManager.getStatus()).toBe('logged-out');
        
        let exists = true;
        try {
            await access(authDir);
        } catch {
            exists = false;
        }
        expect(exists).toBe(true);
    });

    it('should remember auth state once credentials exist on disk', async () => {
        await mkdir(sessionManager.getAuthStateDir(), { recursive: true });
        await writeFile(join(sessionManager.getAuthStateDir(), 'creds.json'), '{}');
        await sessionManager.markAuthStateAvailable();
        expect(await sessionManager.isRegistered()).toBe(true);
    });

    it('should not trust stale config when credentials are missing from disk', async () => {
        await sessionManager.markAuthStateAvailable();

        expect(await sessionManager.isRegistered()).toBe(false);
    });

    it('should not save stale missing auth state when credentials exist on disk', async () => {
        await mkdir(sessionManager.getAuthStateDir(), { recursive: true });
        await writeFile(join(sessionManager.getAuthStateDir(), 'creds.json'), '{}');

        await sessionManager.setStatus('disconnected');

        const config = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf-8'));
        expect(config.hasAuthState).toBe(true);
        expect(await sessionManager.isRegistered()).toBe(true);
    });

    it('should recover and rewrite a config file with trailing data', async () => {
        const configPath = join(dataDir, 'config.json');
        await writeFile(configPath, [
            '{',
            '  "allowList": [{ "number": "+1234567890", "name": "Ana" }, { "number": "120363012345@g.us", "name": "Team" }],',
            '  "allowedGroups": [],',
            '  "ignoredNumbers": [],',
            '  "status": "connected",',
            '  "hasAuthState": false,',
            '  "openaiKey": "",',
            '  "visionModel": "gpt-4o"',
            '} trailing-data'
        ].join('\n'));

        await sessionManager.ensureInitialized();

        expect(sessionManager.getAllowList()).toEqual([{ number: '+1234567890', name: 'Ana' }]);
        expect(sessionManager.getAllowedGroups()).toEqual([{ number: '120363012345@g.us', name: 'Team' }]);
        expect(sessionManager.getStatus()).toBe('disconnected');
        const rewrittenConfig = await readFile(configPath, 'utf-8');
        expect(() => JSON.parse(rewrittenConfig)).not.toThrow();
    });

    it('round-trips STT endpoint/model/env names without persisting the environment value', async () => {
        const stt = {
            sttEndpoint: 'https://speech.example.test/openai/v1',
            sttModel: 'fixture-model',
            sttEnv: 'WHATSAPP_NG_TEST_STT_KEY', sttLanguage: 'pt'
        };
        vi.stubEnv(stt.sttEnv, 'fixture-secret-value-not-for-config');
        await writeFile(join(dataDir, 'config.json'), JSON.stringify(stt));
        await sessionManager.ensureInitialized();
        expect(sessionManager.getSttConfig()).toEqual(stt);
        await sessionManager.setSttConfig(stt);
        await sessionManager.setStatus('disconnected');
        const saved = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'));
        expect(saved).toMatchObject(stt);
        expect(JSON.stringify(saved)).not.toContain('fixture-secret-value-not-for-config');
        const reopened = new SessionManager(dataDir);
        await reopened.ensureInitialized();
        expect(reopened.getSttConfig()).toEqual(stt);
    });

    it('rejects saved LAN HTTP speech without opt-in while preserving stored preferences for repair', async () => {
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', '1'); await sessionManager.ensureInitialized();
        const settings = sessionManager.getSpeechSettings(); settings.config = { ttsEndpoint: 'http://192.168.1.20/speech', ttsModel: 'fixture', ttsEnv: 'FIXTURE_KEY', ttsVoice: 'fixture' };
        await sessionManager.setSpeechSettings(settings, sessionManager.getSpeechRevision()); const path = join(dataDir, 'config.json'); const before = await readFile(path, 'utf8');
        vi.stubEnv('WHATSAPP_NG_ALLOW_PLAIN_HTTP', ''); const reopened = new SessionManager(dataDir); await reopened.ensureInitialized();
        expect(() => reopened.getSpeechSettings()).toThrow(/Invalid saved voice settings/);
        expect(() => reopened.getReplyAdmissionKey('15550000001@s.whatsapp.net', jid => jid)).toThrow(/Invalid saved voice settings/);
        expect(await readFile(path, 'utf8')).toBe(before);
    });
    it('returns an isolated STT config snapshot and can explicitly disable remote mode', async () => {
        await sessionManager.ensureInitialized();
        await sessionManager.setSttConfig({ sttEndpoint: 'https://speech.example.test/v1', sttModel: 'fixture', sttEnv: 'STT_KEY' });
        const snapshot = sessionManager.getSttConfig();
        snapshot.sttEnv = 'DIFFERENT_KEY';
        expect(sessionManager.getSttConfig().sttEnv).toBe('STT_KEY');
        await sessionManager.setSttConfig({});
        const reopened = new SessionManager(dataDir);
        await reopened.ensureInitialized();
        expect(reopened.getSttConfig().sttEndpoint).toBeUndefined();
    });

    it('defaults to explaining attachments and round-trips the explicit legacy setting', async () => {
        expect(sessionManager.getFinalAfterAttachments()).toBe(true);
        await writeFile(join(dataDir, 'config.json'), JSON.stringify({
            allowList: [{ number: '+15550000001', name: 'Fixture' }],
            sttEndpoint: 'https://speech.example.test/v1', sttModel: 'fixture-model', sttEnv: 'FIXTURE_STT_KEY',
            operatorJid: '15550000001@s.whatsapp.net'
        }));
        await sessionManager.setFinalAfterAttachments(false);
        const reopened = new SessionManager(dataDir);
        await reopened.ensureInitialized();
        expect(reopened.getFinalAfterAttachments()).toBe(false);
        expect(reopened.getAllowList()).toEqual([{ number: '+15550000001', name: 'Fixture' }]);
        expect(reopened.getSttConfig()).toEqual({ sttEndpoint: 'https://speech.example.test/v1', sttModel: 'fixture-model', sttEnv: 'FIXTURE_STT_KEY' });
        await reopened.setFinalAfterAttachments(true);
        const again = new SessionManager(dataDir);
        await again.ensureInitialized();
        expect(again.getFinalAfterAttachments()).toBe(true);
    });

    it('rejects non-boolean reply policy updates without changing the selected mode', async () => {
        await sessionManager.setFinalAfterAttachments(false);
        await expect(sessionManager.setFinalAfterAttachments('false' as any)).rejects.toThrow('must be a boolean');
        expect(sessionManager.getFinalAfterAttachments()).toBe(false);
    });

    it('should clean up stale config temp files during initialization', async () => {
        const staleTempPath = join(dataDir, 'config.json.123.456.tmp');
        const unrelatedTempPath = join(dataDir, 'other.json.123.456.tmp');
        await writeFile(staleTempPath, 'stale');
        await writeFile(unrelatedTempPath, 'keep');

        await sessionManager.ensureInitialized();

        await expect(access(staleTempPath)).rejects.toThrow();
        await expect(access(unrelatedTempPath)).resolves.toBeUndefined();
    });

    it('should manage allowed groups separately from allowed numbers', async () => {
        const groupJid = '120363012345@g.us';
        await sessionManager.addAllowedGroup(groupJid, 'Team');

        expect(sessionManager.isAllowedGroup(groupJid)).toBe(true);
        expect(sessionManager.isConversationAllowed(groupJid)).toBe(true);
        expect(sessionManager.isAllowed(groupJid)).toBe(false);
        expect(sessionManager.getAllowList()).toEqual([]);
        expect(sessionManager.getAllowedGroups()).toEqual([{ number: groupJid, name: 'Team' }]);

        await sessionManager.removeAllowedGroup(groupJid);
        expect(sessionManager.isAllowedGroup(groupJid)).toBe(false);
    });

    it('should store and retrieve contact names', async () => {
        const num = '+1234567890';
        const name = 'John Doe';
        
        await sessionManager.addNumber(num, name);
        const allowList = sessionManager.getAllowList();
        
        expect(allowList).toHaveLength(1);
        expect(allowList[0].number).toBe(num);
        expect(allowList[0].name).toBe(name);
    });

    it('should add and remove an alias for an existing allowed number', async () => {
        const num = '+1234567890';
        const alias = 'My Contact';

        await sessionManager.addNumber(num);
        await sessionManager.setAllowedContactAlias(num, alias);

        let allowList = sessionManager.getAllowList();
        expect(allowList[0].name).toBe(alias);

        await sessionManager.removeAllowedContactAlias(num);
        allowList = sessionManager.getAllowList();
        expect(allowList[0].name).toBeUndefined();
    });

    it('should add and remove an alias for an existing allowed group', async () => {
        const groupJid = '120363012345@g.us';
        const alias = 'Team Chat';

        await sessionManager.addAllowedGroup(groupJid);
        await sessionManager.setAllowedGroupAlias(groupJid, alias);

        let allowedGroups = sessionManager.getAllowedGroups();
        expect(allowedGroups[0].name).toBe(alias);

        await sessionManager.removeAllowedGroupAlias(groupJid);
        allowedGroups = sessionManager.getAllowedGroups();
        expect(allowedGroups[0].name).toBeUndefined();
    });

    it('should ignore legacy passive reaction mode when loading groups', async () => {
        const configPath = join(dataDir, 'config.json');
        await writeFile(configPath, JSON.stringify({
            allowList: [],
            allowedGroups: [{ number: '120363012345@g.us', name: 'Team', reactionMode: 'passive' }],
            ignoredNumbers: [],
            status: 'connected',
            hasAuthState: false,
            openaiKey: '',
            visionModel: 'gpt-4o'
        }, null, 2));

        await sessionManager.ensureInitialized();

        expect(sessionManager.getAllowedGroups()).toEqual([{ number: '120363012345@g.us', name: 'Team' }]);
    });

    it('should not reload config and overwrite in-memory allow-lists after initialization', async () => {
        const configPath = join(dataDir, 'config.json');
        await writeFile(configPath, JSON.stringify({
            allowList: [{ number: '+1111111111', name: 'Loaded' }],
            allowedGroups: [{ number: '120363012345@g.us', name: 'Loaded Group' }],
            ignoredNumbers: [],
            status: 'logged-out',
            hasAuthState: false,
            openaiKey: '',
            visionModel: 'gpt-4o'
        }, null, 2));

        await sessionManager.ensureInitialized();
        await sessionManager.addNumber('+2222222222', 'Live Contact');
        await sessionManager.addAllowedGroup('120363999999@g.us', 'Live Group');

        await writeFile(configPath, JSON.stringify({
            allowList: [{ number: '+1111111111', name: 'Stale' }],
            allowedGroups: [{ number: '120363012345@g.us', name: 'Stale Group' }],
            ignoredNumbers: [],
            status: 'logged-out',
            hasAuthState: false,
            openaiKey: '',
            visionModel: 'gpt-4o'
        }, null, 2));

        await sessionManager.ensureInitialized();

        expect(sessionManager.getAllowList()).toEqual([
            { number: '+1111111111', name: 'Loaded' },
            { number: '+2222222222', name: 'Live Contact' }
        ]);
        expect(sessionManager.getAllowedGroups()).toEqual([
            { number: '120363012345@g.us', name: 'Loaded Group' },
            { number: '120363999999@g.us', name: 'Live Group' }
        ]);
    });
});
