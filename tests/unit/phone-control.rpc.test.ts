import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initAuthCreds, BufferJSON } from 'baileys';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';

/** Real Pi command context/lifecycle; WhatsApp transport and fixture model streams are synthetic. */
describe('production phone-control Pi RPC gateway', () => {
    it.each(['direct', 'self-lid', 'stats', 'groups', 'self-auto', 'images', 'terminal', 'settings', 'reporting', 'models', 'server-voice', 'autoconnect', ...(['darwin', 'linux'].includes(process.platform) ? ['managed-manual', 'managed-auto'] : [])])('exercises production phone controls and lifecycle fences (%s)', async mode => {
        const root = await mkdtemp(join(tmpdir(), 'wa-phone-rpc-')); const home = join(root, 'home'); const workspace = join(root, 'workspace');
        const data = join(home, '.pi/agent/extensions/whatsapp-ng'); const metricsPath = join(root, 'metrics.json'); const networkPath = join(root, 'network.json');
        await mkdir(join(data, 'auth'), { recursive: true }); await mkdir(workspace);
        const managed = mode.startsWith('managed-'); const automatic = mode === 'autoconnect' || mode === 'managed-auto';
        const serverMetrics = join(root, 'speech.jsonl'); let endpoint = '';
        if (managed) {
            const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
            if (!address || typeof address === 'string') throw new Error('Missing synthetic speech port');
            endpoint = `http://127.0.0.1:${address.port}/v1`; await new Promise<void>(resolve => server.close(() => resolve()));
        }
        const selfChat = mode === 'self-lid' || mode === 'self-auto'; const modelFixture = ['stats', 'groups', 'self-auto', 'images', 'terminal', 'settings', 'reporting', 'models', 'server-voice'].includes(mode) || managed;
        const owner = selfChat ? '15550000009@s.whatsapp.net' : '15550000001@s.whatsapp.net';
        await writeFile(join(data, 'config.json'), JSON.stringify({ operatorJid: owner, allowList: [{ number: '+' + owner.split('@')[0] }],
            ...(automatic ? { autoConnect: true } : {}),
            ...(managed ? { sttEndpoint: endpoint, sttModel: 'fixture-api-model', sttEnv: 'FIXTURE_KEY' } : {}),
            ...(mode === 'self-lid' ? { voicePreferences: { enabled: true, mode: 'text', approvedDestinationKey: resolveTtsConfig({}).destinationKey,
                chats: { [owner]: { mode: 'mirror' }, '90000000009@s.whatsapp.net': { mode: 'text' } } } } : {}),
            ...(['groups', 'images', 'terminal', 'settings', 'reporting'].includes(mode) ? { allowedGroups: [{ number: '120363000001@g.us' }] } : {}), ...(['images', 'settings'].includes(mode) ? { finalAfterAttachments: false } : {}), status: 'disconnected' }), { mode: 0o600 });
        if (mode === 'settings') await writeFile(join(data, 'whatsapp-ng.log'), 'Historical fixture: preserve unchanged', { mode: 0o644 });
        // Fresh random test material, not copied from an account; no socket connects to WhatsApp.
        await writeFile(join(data, 'auth/creds.json'), JSON.stringify({ ...initAuthCreds(), registered: true,
            me: { id: '15550000009@s.whatsapp.net', name: 'Synthetic fixture' } }, BufferJSON.replacer), { mode: 0o600 });
        const guard = join(root, 'block-network.mjs');
        await writeFile(guard, `import fs from 'node:fs';import net from 'node:net';import tls from 'node:tls';\nlet count=0;const save=()=>fs.writeFileSync(${JSON.stringify(networkPath)},JSON.stringify({networkAttempts:count}));const block=()=>{count++;save();throw new Error('Network forbidden in isolated control test')};globalThis.fetch=block;net.Socket.prototype.connect=block;tls.connect=block;save();`);
        const repo = fileURLToPath(new URL('../..', import.meta.url));
        const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@mariozechner/pi-coding-agent')));
        const env = Object.fromEntries(['PATH', 'TMPDIR', 'LANG'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
        Object.assign(env, { HOME: home, PI_CODING_AGENT_DIR: join(root, 'agent'), PI_OFFLINE: '1', WHATSAPP_NG_LOCALE: 'en',
            WA_PHONE_RPC_METRICS: metricsPath, WA_PHONE_RPC_CONFIG: join(data, 'config.json'), WA_PHONE_RPC_SELF_LID: selfChat ? '1' : '0', WA_PHONE_RPC_STATS: mode === 'stats' ? '1' : '0',
            WA_PHONE_RPC_GROUPS: ['groups', 'settings'].includes(mode) ? '1' : '0', WA_PHONE_RPC_SELF_AUTO: mode === 'self-auto' ? '1' : '0', WA_PHONE_RPC_MODELS: mode === 'models' ? '1' : '0',
            WA_PHONE_RPC_OPTIONAL: ['images', 'terminal'].includes(mode) ? mode : '', WA_PHONE_RPC_REPORTING: mode === 'reporting' ? '1' : '0', WA_PHONE_RPC_SERVER_VOICE: mode === 'server-voice' ? '1' : '0',
            ...(managed ? { WA_PHONE_RPC_MANAGED: '1', WA_PHONE_RPC_MANAGED_ENDPOINT: endpoint, FIXTURE_KEY: 'synthetic-key', CRISPASR_STT_CMD: JSON.stringify({ executable: process.execPath,
                args: [join(repo, 'tests/fixtures/managed-speech-server.mjs'), new URL(endpoint).port, 'whisper', 'fixture-loaded-model', 'normal', serverMetrics], cwd: root,
                endpoint, backend: 'whisper', model: 'fixture-api-model', loadedModel: 'fixture-loaded-model', startupTimeoutMs: 5000 }) } : {}),
            NODE_OPTIONS: `--import=${guard} --import=${join(repo, 'tests/fixtures/phone-control-preload.mjs')}` });
        const child = spawn(process.execPath, ['--experimental-test-module-mocks', cli, '--mode', 'rpc', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--tools', 'read,send_wa_message,send_wa_media,send_reaction,list_wa_conversations,get_wa_conversation_history,check_wa_new_messages,request_wa_history,configure_wa_stt,configure_wa_tts'.split(',').filter(name => mode !== 'settings' || name !== 'send_reaction').join(',') + (mode === 'images' ? ',fixture_image' : mode === 'reporting' ? ',write,edit' : ''),
            '--provider', modelFixture ? 'fixture-phone' : 'openai', '--model', modelFixture ? 'model-01' : 'gpt-4o-mini',
            ...(modelFixture ? ['-e', join(repo, 'whatsapp-ng.ts'), '-e', join(repo, 'tests/fixtures/phone-control-rpc.extension.ts')]
                : ['-e', join(repo, 'tests/fixtures/phone-control-rpc.extension.ts'), '-e', join(repo, 'whatsapp-ng.ts')]),
            ...(automatic || managed ? [] : ['--whatsapp-ng-online']), ...(mode === 'self-lid' ? ['--whatsapp-ng-native-polls'] : [])],
            { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
        const waiters = new Map<string, (record: any) => void>(); const records: any[] = []; let buffer = ''; let stderr = ''; let serial = 0;
        child.stderr.on('data', value => { stderr = (stderr + value).slice(-4000); });
        child.stdout.setEncoding('utf8'); child.stdout.on('data', value => {
            buffer += value; let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
                try { const record = JSON.parse(line); records.push(record); if (record.type === 'response') waiters.get(record.id)?.(record); } catch { /* Other diagnostic records are not RPC responses. */ }
            }
        });
        const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
        const request = (type: string, extra = {}) => new Promise<any>((resolve, reject) => {
            const id = `control-${++serial}`; const timer = setTimeout(() => { waiters.delete(id); reject(new Error(`RPC ${type} timed out: ${stderr}`)); }, 25_000);
            waiters.set(id, result => { clearTimeout(timer); waiters.delete(id); result.success ? resolve(result.data) : reject(new Error('Synthetic RPC command failed')); });
            child.stdin.write(JSON.stringify({ id, type, ...extra }) + '\n');
        });
        const prompt = (message: string) => request('prompt', { message });
        const metrics = async () => JSON.parse(await readFile(metricsPath, 'utf8')); const answered = new Set<string>();
        const select = async (choice: string) => {
            let dialog: any;
            await expect.poll(() => {
                dialog = records.find(record => record.type === 'extension_ui_request' && record.method === 'select'
                    && record.options?.includes(choice) && !answered.has(record.id));
                return !!dialog;
            }, { timeout: 10_000 }).toBe(true);
            answered.add(dialog.id); child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: dialog.id, value: choice }) + '\n');
            return dialog;
        };
        const confirm = async () => {
            let dialog: any;
            await expect.poll(() => { dialog = records.find(record => record.type === 'extension_ui_request' && record.method === 'confirm' && !answered.has(record.id)); return !!dialog; }, { timeout: 10_000 }).toBe(true);
            answered.add(dialog.id); child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: dialog.id, confirmed: true }) + '\n');
        };
        try {
            const initial = await request('get_state');
            if (managed) {
                const events = async () => { try { return (await readFile(serverMetrics, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { event: string; pid: number }); } catch { return []; } };
                const connect = async () => { const menu = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await menu; };
                const ready = async (count: number) => {
                    await expect.poll(async () => (await events()).filter(event => event.event === 'model-probe').length, { timeout: 12_000 }).toBeGreaterThanOrEqual(count);
                    return (await events()).filter(event => event.event === 'spawn').at(-1)!.pid;
                };
                if (!automatic) { expect(await events()).toEqual([]); expect((await metrics()).socketStarts).toBe(0); await connect(); }
                const original = await ready(1); await prompt('fixture-clear-stt');
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).sttEndpoint, { timeout: 10_000 }).toBeUndefined();
                await expect.poll(() => { try { process.kill(original, 0); return true; } catch { return false; } }, { timeout: 9000 }).toBe(false);
                await expect.poll(async () => (await request('get_state')).isStreaming, { timeout: 10_000 }).toBe(false);
                await prompt('fixture-restore-stt'); const first = await ready(2);
                await expect.poll(async () => (await request('get_state')).isStreaming, { timeout: 10_000 }).toBe(false);
                await prompt('/phone-fixture managed-stop'); expect(() => process.kill(first, 0)).not.toThrow();
                await prompt('fixture-restore-stt');
                await expect.poll(async () => (await request('get_state')).isStreaming, { timeout: 10_000 }).toBe(false);
                expect((await events()).filter(event => event.event === 'spawn')).toHaveLength(2); expect(() => process.kill(first, 0)).not.toThrow();
                await prompt('/phone-fixture cancel-new'); await expect.poll(async () => (await metrics()).cancelled, { timeout: 10_000 }).toBe(1);
                await prompt('fixture-restore-stt'); await expect.poll(async () => (await request('get_state')).isStreaming, { timeout: 10_000 }).toBe(false);
                expect((await events()).filter(event => event.event === 'spawn')).toHaveLength(2); expect(() => process.kill(first, 0)).not.toThrow();
                await request('new_session'); await request('get_state'); expect(() => process.kill(first, 0)).toThrow();
                if (!automatic) await connect(); const second = await ready(3); expect(second).not.toBe(first);
                await prompt('/phone-fixture reload'); await request('get_state'); expect(() => process.kill(second, 0)).toThrow();
                if (!automatic) await connect(); const third = await ready(4); const connectsBeforeOff = (await metrics()).socketStarts;
                await prompt('/phone-fixture off');
                await expect.poll(() => { try { process.kill(third, 0); return true; } catch { return false; } }, { timeout: 9000 }).toBe(false);
                await request('new_session'); await prompt('/phone-fixture reload'); await request('get_state');
                expect((await events()).filter(event => event.event === 'spawn')).toHaveLength(4); expect((await metrics()).socketStarts).toBe(connectsBeforeOff);
                expect((await metrics()).modelStarts).toBe(4); expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'autoconnect') {
                expect((await metrics()).socketStarts).toBe(1);
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                const beforeBack = await readFile(join(data, 'config.json'), 'utf8');
                const backMenu = prompt('/whatsapp'); await select('Connection'); await select('Auto-connect on startup');
                expect((await select('Back')).title).toContain('Auto-connect on startup: On');
                expect((await select('Back')).title).toBe('Connection');
                expect((await select('Back')).title).toMatch(/^WhatsApp — /); await backMenu;
                expect(await readFile(join(data, 'config.json'), 'utf8')).toBe(beforeBack); expect((await metrics()).socketStarts).toBe(1);
                const preference = async (value: 'Enabled' | 'Disabled') => {
                    const menu = prompt('/whatsapp'); await select('Connection'); await select('Auto-connect on startup'); await select(value); await menu;
                    expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).autoConnect).toBe(value === 'Enabled');
                };
                await preference('Disabled'); expect((await metrics()).socketStarts).toBe(1);
                await request('new_session'); await request('get_state'); expect((await metrics()).socketStarts).toBe(1);
                await preference('Enabled'); expect((await metrics()).socketStarts).toBe(1);
                await prompt('/phone-fixture reload'); await request('get_state'); expect((await metrics()).socketStarts).toBe(2);
                await prompt('/phone-fixture off');
                await request('new_session'); await prompt('/phone-fixture reload'); await request('get_state'); expect((await metrics()).socketStarts).toBe(2);
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).autoConnect).toBe(true);
                const connect = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await connect;
                expect((await metrics()).socketStarts).toBe(3);
                await preference('Disabled'); await prompt('/phone-fixture reload'); await request('get_state'); expect((await metrics()).socketStarts).toBe(3);
                expect((await metrics()).modelStarts).toBe(0); expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'agent_start' || record.type === 'extension_error')).toEqual([]);
                const config = JSON.parse(await readFile(join(data, 'config.json'), 'utf8')); expect(config.operatorJid).toBe(owner); expect(config.autoConnect).toBe(false);
                expect(config.allowList).toEqual([{ number: '+' + owner.split('@')[0] }]); return;
            }
            if (mode === 'server-voice') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                const config = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                expect(config).toMatchObject({ ttsUseServerVoice: true, ttsModel: 'chatterbox', ttsProtocol: 'openai-compatible', voicePreferences: { enabled: false, mode: 'text' } });
                expect(config.ttsVoice).toBeUndefined(); expect(config.voicePreferences.approvedDestinationKey).toBeUndefined();
                const calls = records.filter(record => record.type === 'tool_execution_end' && record.toolName === 'configure_wa_tts');
                expect(calls).toHaveLength(1); expect(calls[0].isError).not.toBe(true);
                await request('new_session'); await request('get_state');
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).ttsUseServerVoice).toBe(true);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'models') {
                expect(initial.model).toMatchObject({ provider: 'fixture-phone', id: 'model-01' });
                await prompt('/phone-fixture models-search');
                expect((await metrics()).messages.at(-1)).toContain('1. fixture-phone/model-01');
                expect((await request('get_state')).model.id).toBe('model-01');
                await prompt('/phone-fixture models-next');
                expect((await metrics()).messages.at(-1)).toContain('1. fixture-phone/model-11');
                await prompt('/phone-fixture models-previous');
                expect((await metrics()).messages.at(-1)).toContain('1. fixture-phone/model-01');
                await prompt('/phone-fixture models-next'); await prompt('/phone-fixture models-select');
                expect((await request('get_state')).model).toMatchObject({ provider: 'fixture-phone', id: 'model-11' });
                expect((await metrics()).messages.at(-1)).toContain('Shared model selected: fixture-phone/model-11.');
                await prompt('/phone-fixture models-missing'); expect((await metrics()).messages.at(-1)).toContain('No authenticated models match');
                expect((await request('get_state')).model.id).toBe('model-11');
                expect((await metrics()).modelStarts).toBe(0); expect((await metrics()).providerRequests ?? 0).toBe(0);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'agent_start' || record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'reporting') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsConsumed, { timeout: 10_000 }).toBe(1);
                for (const option of ['Enable observed file paths', 'Enable interim assistant text', 'Enable live tool activity']) {
                    const settings = prompt('/whatsapp'); await select('Replies'); await select('Reply delivery'); await select(option); await confirm(); await settings;
                }
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).replyReporting).toEqual({ changedFiles: true, interimText: true, liveActivity: true });
                await prompt('/phone-fixture stats-release');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                expect((await metrics()).messages.filter((text: string) => /^(Activity:|Progress:|Observed successful)/.test(text))).toHaveLength(0);
                expect((await metrics()).messages.join('\n')).toContain('*RPC formatted final*\n*Done* Docs (https://example.test/a_b)');
                expect((await metrics()).messages.join('\n')).toContain('```\nconst code = "**literal**";\n```');
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2);
                await expect.poll(async () => (await metrics()).sends.filter((send: any) => send.kind === 'edit' && send.text === 'Activity: Finished.').length, { timeout: 5000 }).toBe(1);
                const direct = (await metrics()).sends;
                expect(direct.filter((send: any) => send.kind === 'text' && send.text?.startsWith('Activity:'))).toHaveLength(1);
                expect(direct.filter((send: any) => send.text?.startsWith('Progress:'))).toHaveLength(1);
                expect(direct.filter((send: any) => send.text?.startsWith('Observed successful'))).toHaveLength(1);
                expect(direct.filter((send: any) => send.kind === 'edit').map((send: any) => send.edit.id).every((id: string, _index: number, ids: string[]) => id === ids[0])).toBe(true);
                expect(direct.every((send: any) => send.jid === owner)).toBe(true);
                expect(JSON.stringify(direct)).not.toMatch(/PRIVATE-REASONING|PRIVATE-TOOL-CONTENT|Reply stats:/);
                const beforeTerminal = direct.length; await prompt('Local reporting work');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(3); expect((await metrics()).sends).toHaveLength(beforeTerminal);
                await prompt('/phone-fixture group-fresh');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(4);
                const groupEdits = (await metrics()).sends.filter((send: any) => send.kind === 'edit' && send.jid.endsWith('@g.us'));
                expect(groupEdits.length).toBeGreaterThan(0); expect(groupEdits[0].edit).toMatchObject({ remoteJid: '120363000001@g.us', fromMe: true, participant: '15550000009@s.whatsapp.net' });
                expect((await metrics()).sends.find((send: any) => send.jid.endsWith('@g.us') && send.text?.startsWith('Observed successful')).text).toContain('c1-progress.txt');
                await prompt('/phone-fixture off'); const afterOff = (await metrics()).sends.filter((send: any) => send.kind === 'edit').length;
                await new Promise(resolve => setTimeout(resolve, 2500)); expect((await metrics()).sends.filter((send: any) => send.kind === 'edit')).toHaveLength(afterOff);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0); expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'settings') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsConsumed, { timeout: 10_000 }).toBe(1);
                await prompt('/phone-fixture group-queue');
                const menu = prompt('/whatsapp'); await select('Connection'); await select('Turn WhatsApp off'); await confirm(); await menu;
                await prompt('/phone-fixture stats-release');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                await prompt('/phone-fixture tools');
                expect((await metrics()).activeTools).toEqual(expect.arrayContaining(['read', 'list_wa_conversations', 'request_wa_history']));
                expect((await metrics()).activeTools).not.toContain('send_wa_message');
                expect((await metrics()).providerRequests ?? 0).toBe(0);
                await request('new_session'); await prompt('/phone-fixture reload'); await request('get_state');
                await prompt('/phone-fixture tools'); expect((await metrics()).socketStarts).toBe(1);
                expect((await metrics()).activeTools).not.toContain('send_wa_message');
                const local = prompt('/whatsapp'); await select('Advanced'); await select('Privacy and logs'); await local;
                const offMenu = prompt('/whatsapp'); await select('Connection');
                let offDialog: any; await expect.poll(() => {
                    offDialog = records.find(record => record.type === 'extension_ui_request' && record.method === 'select' && record.title === 'Connection' && !answered.has(record.id)); return !!offDialog;
                }, { timeout: 10_000 }).toBe(true);
                try { expect(offDialog?.options).toContain('Connect WhatsApp'); expect(offDialog?.options).not.toContain('Turn WhatsApp off'); }
                finally { await select('Back'); await select('Back'); await offMenu; }
                const connect = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await connect;
                await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(2);
                await prompt('/phone-fixture tools'); expect((await metrics()).activeTools).toEqual(expect.arrayContaining(['read', 'send_wa_message', 'send_wa_media']));
                expect((await metrics()).activeTools).not.toContain('send_reaction');
                await prompt('/phone-fixture stats-release'); await prompt('/phone-fixture group-fresh');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2);
                expect((await metrics()).providerRequests).toBe(1);
                const { stat } = await import('node:fs/promises'); const log = join(data, 'whatsapp-ng.runtime.log');
                expect((await stat(log)).mode & 0o777).toBe(0o600);
                expect(await readFile(log, 'utf8')).not.toMatch(/Fixture stats task|Queued group mention|Fresh group reply|RPC stats final/);
                expect(await readFile(join(data, 'whatsapp-ng.log'), 'utf8')).toBe('Historical fixture: preserve unchanged');
                const config = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                expect(config.operatorJid).toBe(owner); expect(config.finalAfterAttachments).toBe(false);
                // A real phone Off invalidates a currently open root dialog; it must close cleanly, not rebind.
                const since = records.length; const navigation = prompt('/whatsapp');
                await expect.poll(() => records.slice(since).some(record => record.type === 'extension_ui_request' && record.method === 'select' && record.title?.startsWith('WhatsApp — ')), { timeout: 10_000 }).toBe(true);
                await prompt('/phone-fixture off'); await select('Connection');
                await expect.poll(() => records.slice(since).some(record => record.method === 'notify' && record.message === 'Settings changed while this menu was open. Reopen /whatsapp.')
                    || records.slice(since).some(record => record.method === 'select' && record.title === 'Connection' && !answered.has(record.id)), { timeout: 10_000 }).toBe(true);
                const staleConnection = records.slice(since).some(record => record.method === 'select' && record.title === 'Connection' && !answered.has(record.id));
                try { expect(staleConnection).toBe(false); }
                finally { if (staleConnection) { await select('Back'); await select('Back'); } await navigation; }
                expect(records.slice(since).some(record => record.method === 'notify' && record.message === 'Settings changed while this menu was open. Reopen /whatsapp.')).toBe(true);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'images' || mode === 'terminal') {
                await prompt('/phone-fixture status');
                if (mode === 'terminal') {
                    const beforeConsent = prompt('Local work before consent');
                    await expect.poll(async () => (await metrics()).statsConsumed, { timeout: 10_000 }).toBe(1);
                    const settings = prompt('/whatsapp'); await select('Replies'); await select('Optional outputs'); await select('Enable terminal forwarding to owner'); await confirm(); await settings;
                    await prompt('/phone-fixture stats-release'); await beforeConsent;
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                    expect((await metrics()).messages.filter((text: string) => text.startsWith('RPC stats final'))).toHaveLength(0);
                    await prompt('Local work after consent');
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2);
                    const forwarded = (await metrics()).sends.filter((send: any) => send.text?.startsWith('RPC stats final'));
                    expect(forwarded).toHaveLength(1); expect(forwarded[0].jid).toBe(owner);
                } else {
                    await prompt('Local image work while off');
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1); expect((await metrics()).imageSends).toBe(0);
                    const settings = prompt('/whatsapp'); await select('Replies'); await select('Optional outputs'); await select('Choose automatic image tools'); await select('Enable fixture_image'); await confirm(); await settings;
                    await prompt('Local image work after tool consent');
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2); expect((await metrics()).imageSends).toBe(0);
                }
                await prompt('/phone-fixture optional-group');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(3);
                const final = await metrics();
                const answers = final.sends.filter((send: any) => send.text?.startsWith('RPC stats final'));
                if (mode === 'images') expect(answers).toHaveLength(1);
                expect(answers.at(-1).jid).toBe('120363000001@g.us');
                if (mode === 'images') {
                    expect(final.imageSends).toBe(1); expect(final.imageSnapshotsPrivate).toBe(true);
                    expect(final.sends.find((send: any) => send.kind === 'image').jid).toBe('120363000001@g.us'); expect(answers).toHaveLength(1);
                } else {
                    expect(answers).toHaveLength(2);
                    const settings = prompt('/whatsapp'); await select('Replies'); await select('Optional outputs'); await select('Disable terminal forwarding'); await settings;
                    await prompt('Local work after disabling forwarding');
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(4);
                    expect((await metrics()).sends.filter((send: any) => send.text?.startsWith('RPC stats final'))).toHaveLength(2);
                }
                expect((await metrics()).providerRequests).toBe(mode === 'images' ? 6 : 4);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'self-auto') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                const final = await metrics(); expect(final.providerRequests).toBe(1); expect(final.outgoingEchoes).toBe(1);
                expect(final.messages.filter((text: string) => text.startsWith('RPC stats final'))).toHaveLength(1);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0); return;
            }
            if (mode === 'groups') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsConsumed, { timeout: 10_000 }).toBe(1);
                await prompt('/phone-fixture group-queue');
                const menu = prompt('/whatsapp'); await select('Groups'); await select('Group replies'); await select('Replies only'); await menu;
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).groupReplies).toEqual({ mode: 'replies', context: false });
                await prompt('/phone-fixture stats-release');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                expect((await metrics()).providerRequests).toBe(1);
                await prompt('/phone-fixture group-fresh');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2);
                expect((await metrics()).providerRequests).toBe(2);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0); return;
            }
            if (mode === 'stats') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsConsumed, { timeout: 10_000 }).toBe(1);
                const menu = prompt('/whatsapp');
                await select('Replies'); await select('Reply delivery'); await select('Enable final stats for allowed chats'); await menu;
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).replyStats).toBe(true);
                await prompt('/phone-fixture stats-release');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                expect((await metrics()).messages.filter((text: string) => text.startsWith('Reply stats:'))).toHaveLength(0);
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(2);
                const final = await metrics(); expect(final.messages.filter((text: string) => text.startsWith('RPC stats final'))).toHaveLength(2);
                expect(final.messages.filter((text: string) => text.startsWith('Reply stats:'))).toHaveLength(1);
                expect(final.modelStarts).toBe(2); expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]);
                return;
            }
            await prompt('/phone-fixture tools');
            expect(JSON.parse(await readFile(metricsPath, 'utf8')).activeTools).toContain('send_wa_message');
            if (mode === 'self-lid') {
                // A verified phone preference applies to own LID, not its bogus same-digits phone JID.
                await prompt('/phone-fixture status'); expect((await metrics()).messages.at(-1)).toContain('Voice: mirror');
                await prompt('/phone-fixture poll-next');
                const polled = JSON.parse(await readFile(metricsPath, 'utf8'));
                expect(polled.pollVotes).toBe(1);
                expect(polled.messages.filter((text: string) => text.startsWith('Authenticated models, page 2.'))).toHaveLength(1);
            }
            await prompt('/whatsapp --internal control-new 00000000-0000-0000-0000-000000000000');
            expect((await request('get_state')).sessionId).toBe(initial.sessionId);
            await prompt('/phone-fixture cancel-new');
            await expect.poll(async () => JSON.parse(await readFile(metricsPath, 'utf8')).cancelled, { timeout: 10_000 }).toBe(1);
            expect((await request('get_state')).sessionId).toBe(initial.sessionId);
            await prompt('/phone-fixture status'); await prompt('/phone-fixture new');
            await expect.poll(async () => JSON.parse(await readFile(metricsPath, 'utf8')).socketStarts, { timeout: 10_000 }).toBe(2);
            const next = await request('get_state'); expect(next.sessionId).not.toBe(initial.sessionId);
            await expect.poll(async () => JSON.parse(await readFile(metricsPath, 'utf8')).messages.some((text: string) => text.includes('fresh shared Pi session is ready')), { timeout: 10_000 }).toBe(true);
            await prompt('/phone-fixture off'); await prompt('/phone-fixture tools');
            expect(JSON.parse(await readFile(metricsPath, 'utf8')).activeTools).not.toContain('send_wa_message');
            await request('new_session'); await request('get_state'); await prompt('/phone-fixture tools');
            expect(JSON.parse(await readFile(metricsPath, 'utf8')).activeTools).not.toContain('send_wa_message');
            await prompt('/phone-fixture reload'); await request('get_state'); await prompt('/phone-fixture tools');
            const finalMetrics = JSON.parse(await readFile(metricsPath, 'utf8'));
            expect(finalMetrics.socketStarts).toBe(2); expect(finalMetrics.modelStarts).toBe(0);
            if (mode === 'direct') expect(finalMetrics.pollCreations).toBe(0);
            expect(finalMetrics.activeTools).toContain('read'); expect(finalMetrics.activeTools).toContain('list_wa_conversations'); expect(finalMetrics.activeTools).toContain('request_wa_history');
            expect(finalMetrics.activeTools).not.toContain('send_wa_message'); expect(finalMetrics.activeTools).not.toContain('send_wa_media'); expect(finalMetrics.activeTools).not.toContain('send_reaction');
            expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
            expect(records.filter(record => record.type === 'agent_start' || record.type === 'extension_error')).toEqual([]);
            expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).operatorJid).toBe(owner);
        } finally {
            if (process.env.WA_PHONE_RPC_EVIDENCE) {
                const metrics = await readFile(metricsPath, 'utf8').catch(() => '{}');
                await writeFile(process.env.WA_PHONE_RPC_EVIDENCE, JSON.stringify({ metrics: JSON.parse(metrics),
                    notices: records.filter(record => record.type === 'extension_ui_request' && record.method === 'notify').map(record => record.message), stderr }), { mode: 0o600 });
            }
            child.stdin.end(); const timer = setTimeout(() => child.kill('SIGTERM'), 10_000);
            await closed; clearTimeout(timer); await rm(root, { recursive: true, force: true });
        }
    }, 60_000);
});
