import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initI18n, resetI18n, t } from '../../src/i18n.ts';
import { initAuthCreds, BufferJSON } from 'baileys';
import { resolveTtsConfig } from '../../src/services/tts-config.ts';

afterEach(() => { vi.unstubAllEnvs(); resetI18n(); });

/** Real Pi command context/lifecycle; WhatsApp transport and fixture model streams are synthetic. */
describe('production phone-control Pi RPC gateway', () => {
    it.each(['phone-polish:en', 'phone-polish:pt-BR', 'phone-polish:es', 'phone-polish:fr', 'menu-polish:en', 'menu-polish:pt-BR', 'menu-polish:es', 'menu-polish:fr', 'direct', 'owner-guidance', 'menu-ui', 'self-lid', 'stats', 'groups', 'self-auto', 'images', 'terminal', 'settings', 'reporting', 'models', 'server-voice', 'spoken-guard', 'autoconnect', 'classify', 'classify-terminal', 'reload', 'reload-auto', 'reload-retry', 'reload-invalid', 'reload-fail', 'reload-off', 'reload-account', 'reload-account-auto', 'reload-offrace', 'reload-busy', ...(['darwin', 'linux'].includes(process.platform) ? ['managed-manual', 'managed-auto'] : [])])('exercises production phone controls and lifecycle fences (%s)', async scenario => {
        const [mode, locale = 'en'] = scenario.split(':');
        vi.stubEnv('WHATSAPP_NG_LOCALE', locale); initI18n(undefined);
        const root = await mkdtemp(join(tmpdir(), 'wa-phone-rpc-')); const home = join(root, 'home'); const workspace = join(root, 'workspace');
        const data = join(home, '.pi/agent/extensions/whatsapp-ng'); const metricsPath = join(root, 'metrics.json'); const networkPath = join(root, 'network.json');
        await mkdir(join(data, 'auth'), { recursive: true }); await mkdir(workspace);
        const managed = mode.startsWith('managed-'); const reload = mode.startsWith('reload'); const automatic = mode === 'autoconnect' || mode === 'managed-auto' || (reload && !['reload', 'reload-off', 'reload-account', 'reload-offrace'].includes(mode));
        const serverMetrics = join(root, 'speech.jsonl'); let endpoint = '';
        if (managed) {
            const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
            if (!address || typeof address === 'string') throw new Error('Missing synthetic speech port');
            endpoint = `http://127.0.0.1:${address.port}/v1`; await new Promise<void>(resolve => server.close(() => resolve()));
        }
        const classify = mode === 'classify' || mode === 'classify-terminal';
        const selfChat = mode === 'self-lid' || mode === 'self-auto'; const modelFixture = classify || mode === 'reload-busy' || ['stats', 'groups', 'self-auto', 'images', 'terminal', 'settings', 'reporting', 'models', 'server-voice', 'spoken-guard'].includes(mode) || managed;
        const owner = selfChat ? '15550000009@s.whatsapp.net' : '15550000001@s.whatsapp.net';
        await writeFile(join(data, 'config.json'), JSON.stringify({ operatorJid: mode === 'owner-guidance' ? '' : owner, allowList: [{ number: '+' + owner.split('@')[0] }],
            ...(automatic ? { autoConnect: true } : {}),
            ...(classify ? { optionalOutputs: { imageTools: [], terminal: { ownerJid: owner, accountScope: JSON.stringify([join(data, 'auth'), '15550000009@s.whatsapp.net']) },
                ...(mode === 'classify' ? { autonomous: { kind: 'owner', jid: owner, ownerJid: owner, accountScope: JSON.stringify([join(data, 'auth'), '15550000009@s.whatsapp.net']) } } : {}) } } : {}),
            ...(mode === 'spoken-guard' ? { voicePreferences: { enabled: true, mode: 'voice', approvedDestinationKey: resolveTtsConfig({}).destinationKey, chats: {} } } : {}),
            ...(managed ? { sttEndpoint: endpoint, sttModel: 'fixture-api-model', sttEnv: 'FIXTURE_KEY' } : {}),
            ...(mode === 'self-lid' ? { voicePreferences: { enabled: true, mode: 'text', approvedDestinationKey: resolveTtsConfig({}).destinationKey,
                chats: { [owner]: { mode: 'mirror' }, '90000000009@s.whatsapp.net': { mode: 'text' } } } } : {}),
            ...(['groups', 'images', 'terminal', 'settings', 'reporting', 'reload-busy'].includes(mode) ? { allowedGroups: [{ number: '120363000001@g.us' }] } : {}), ...(['images', 'settings'].includes(mode) ? { finalAfterAttachments: false } : {}), status: 'disconnected' }), { mode: 0o600 });
        if (mode === 'settings') await writeFile(join(data, 'whatsapp-ng.log'), 'Historical fixture: preserve unchanged', { mode: 0o644 });
        // Fresh random test material, not copied from an account; no socket connects to WhatsApp.
        await writeFile(join(data, 'auth/creds.json'), JSON.stringify({ ...initAuthCreds(), registered: true,
            me: { id: '15550000009@s.whatsapp.net', name: 'Synthetic fixture' } }, BufferJSON.replacer), { mode: 0o600 });
        const guard = join(root, 'block-network.mjs');
        await writeFile(guard, `import fs from 'node:fs';import net from 'node:net';import tls from 'node:tls';\nlet count=0;const save=()=>fs.writeFileSync(${JSON.stringify(networkPath)},JSON.stringify({networkAttempts:count}));const block=()=>{count++;save();throw new Error('Network forbidden in isolated control test')};globalThis.fetch=block;net.Socket.prototype.connect=block;tls.connect=block;save();`);
        const repo = fileURLToPath(new URL('../..', import.meta.url));
        const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@mariozechner/pi-coding-agent')));
        const env = Object.fromEntries(['PATH', 'TMPDIR', 'LANG'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
        Object.assign(env, { HOME: home, PI_CODING_AGENT_DIR: join(root, 'agent'), PI_OFFLINE: '1', WHATSAPP_NG_LOCALE: locale,
            WA_PHONE_RPC_POLISH: mode === 'phone-polish' ? '1' : '0', WA_PHONE_RPC_RELOAD_RACE: mode === 'reload-offrace' ? 'off' : mode === 'reload-busy' ? 'busy' : '', WA_PHONE_RPC_ACCOUNT_STARTS: mode.startsWith('reload-account') ? '2' : '', WA_PHONE_RPC_SLOW_STARTS: ['reload-off', 'reload-offrace'].includes(mode) ? '2' : '', WA_PHONE_RPC_FAIL_STARTS: mode === 'reload-fail' ? '2,3' : ['reload-retry', 'reload-invalid'].includes(mode) ? '2' : '', WA_PHONE_RPC_METRICS: metricsPath, WA_PHONE_RPC_CONFIG: join(data, 'config.json'), WA_PHONE_RPC_SELF_LID: selfChat ? '1' : '0', WA_PHONE_RPC_STATS: mode === 'stats' ? '1' : '0',
            WA_PHONE_RPC_GROUPS: ['groups', 'settings'].includes(mode) ? '1' : '0', WA_PHONE_RPC_SELF_AUTO: mode === 'self-auto' ? '1' : '0', WA_PHONE_RPC_CLASSIFY: classify ? '1' : '0', WA_PHONE_RPC_MODELS: mode === 'models' ? '1' : '0',
            WA_PHONE_RPC_OPTIONAL: ['images', 'terminal'].includes(mode) ? mode : '', WA_PHONE_RPC_REPORTING: mode === 'reporting' ? '1' : '0', WA_PHONE_RPC_SERVER_VOICE: mode === 'server-voice' ? '1' : '0', WA_PHONE_RPC_SPOKEN_GUARD: mode === 'spoken-guard' ? '1' : '0',
            ...(managed ? { WA_PHONE_RPC_MANAGED: '1', WA_PHONE_RPC_MANAGED_ENDPOINT: endpoint, FIXTURE_KEY: 'synthetic-key', CRISPASR_STT_CMD: JSON.stringify({ executable: process.execPath,
                args: [join(repo, 'tests/fixtures/managed-speech-server.mjs'), new URL(endpoint).port, 'whisper', 'fixture-loaded-model', 'normal', serverMetrics], cwd: root,
                endpoint, backend: 'whisper', model: 'fixture-api-model', loadedModel: 'fixture-loaded-model', startupTimeoutMs: 5000 }) } : {}),
            NODE_OPTIONS: `--import=${guard} --import=${join(repo, 'tests/fixtures/phone-control-preload.mjs')}` });
        const child = spawn(process.execPath, ['--experimental-test-module-mocks', cli, '--mode', 'rpc', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--tools', 'read,send_wa_message,send_wa_media,send_reaction,list_wa_conversations,get_wa_conversation_history,check_wa_new_messages,request_wa_history,configure_wa_stt,configure_wa_tts'.split(',').filter(name => mode !== 'settings' || name !== 'send_reaction').join(',') + (mode === 'images' ? ',fixture_image' : mode === 'reporting' ? ',write,edit' : ''),
            '--provider', modelFixture ? 'fixture-phone' : 'openai', '--model', modelFixture ? 'model-01' : 'gpt-4o-mini',
            ...(modelFixture ? ['-e', join(repo, 'whatsapp-ng.ts'), '-e', join(repo, 'tests/fixtures/phone-control-rpc.extension.ts')]
                : ['-e', join(repo, 'tests/fixtures/phone-control-rpc.extension.ts'), '-e', join(repo, 'whatsapp-ng.ts')]),
            ...(automatic || managed || reload || mode === 'menu-polish' ? [] : ['--whatsapp-ng-online']), ...(mode === 'self-lid' ? ['--whatsapp-ng-native-polls'] : [])],
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
                    && (choice === 'Back' ? /^(Back to |Close settings)/.test(record.options?.at(-1) ?? '') : record.options?.includes(choice)) && !answered.has(record.id));
                return !!dialog;
            }, { timeout: 10_000 }).toBe(true);
            answered.add(dialog.id); child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: dialog.id, value: choice === 'Back' ? dialog.options.at(-1) : choice }) + '\n');
            return dialog;
        };
        const confirm = async () => {
            let dialog: any;
            await expect.poll(() => { dialog = records.find(record => record.type === 'extension_ui_request' && record.method === 'confirm' && !answered.has(record.id)); return !!dialog; }, { timeout: 10_000 }).toBe(true);
            answered.add(dialog.id); child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: dialog.id, confirmed: true }) + '\n');
        };
        try {
            const initial = await request('get_state');
            if (mode === 'phone-polish') {
                const phone = (text: string) => prompt('/phone-fixture polish ' + text);
                await phone('/help');
                const help = (await metrics()).messages.at(-1);
                for (const key of ['phone.help.info', 'phone.help.shared', 'phone.help.chat', 'phone.help.process'] as const) expect(help).toContain(t(key));
                expect(help).toContain('/voice [text|voice|both|mirror]');
                await phone('/status');
                const status = (await metrics()).messages.at(-1);
                expect(status.indexOf(t('phone.status.shared'))).toBeLessThan(status.indexOf(t('phone.status.chat')));
                await phone('/voice'); const voice = (await metrics()).messages.at(-1);
                expect(voice).toContain('1. ' + t('phone.mode.text') + ' ' + t('phone.current'));
                expect(voice).toContain(t('phone.menu.instruction'));
                const before = await readFile(join(data, 'config.json'), 'utf8');
                await phone('/new'); await phone('1');
                expect((await metrics()).messages.at(-1)).toBe(t('phone.cancelled'));
                expect(await readFile(join(data, 'config.json'), 'utf8')).toBe(before);
                await phone('/replies');
                const replies = (await metrics()).messages.at(-1);
                expect(replies).toContain(t('phone.replies.disclosure', { stats: t('phone.status.off'), files: t('phone.status.off'), interim: t('phone.status.off'), activity: t('phone.status.off') }));
                await phone('2');
                expect(JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).finalAfterAttachments).toBe(false);
                expect((await metrics()).messages.at(-1)).toBe(t('phone.attachment.saved', { policy: t('phone.status.captionOnly') }));
                const final = await metrics();
                expect(final.socketStarts).toBe(1); expect(final.modelStarts).toBe(0); expect(final.pollCreations).toBe(0);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
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
            if (reload) {
                // specs/045-phone-reload T019: real Pi reload through the production entry; synthetic socket only.
                const ready = () => metrics().then(value => value.messages.filter((text: string) => text === t('phone.reload.ready')).length);
                const notices = () => records.filter(record => record.type === 'extension_ui_request' && record.method === 'notify').map(record => String(record.message));
                const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                if (!automatic) { const menu = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await menu; }
                await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(1);
                const config = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                await prompt('/whatsapp --internal control-reload 00000000-0000-0000-0000-000000000000');
                expect((await metrics()).socketStarts).toBe(1);
                if (mode === 'reload-invalid') {
                    // (c) Ordinary terminal reload: no handoff, saved auto-connect keeps its retry.
                    await prompt('/phone-fixture reload'); await request('get_state');
                    await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(3);
                    await settle(500); expect(await ready()).toBe(0); return;
                }
                if (mode !== 'reload-busy') {
                    await prompt('/phone-fixture phone-reload');
                    await expect.poll(async () => (await metrics()).messages.includes(t('phone.reload.started')), { timeout: 10_000 }).toBe(true);
                }
                if (mode === 'reload-busy') {
                    // G-M2 (R1): gateway deferred by Pi while agent_settled emits; a group /think holds the router lock.
                    const before = (await metrics()).socketStarts;
                    await prompt('/phone-fixture race-start');
                    await expect.poll(async () => (await metrics()).messages.includes(t('phone.reload.started')), { timeout: 15_000 }).toBe(true);
                    await expect.poll(async () => (await metrics()).messages.filter((text: string) => text === t('phone.busy')).length, { timeout: 15_000 }).toBe(1);
                    await settle(4000);
                    expect((await metrics()).socketStarts).toBe(before); expect(await ready()).toBe(0);
                    expect((await request('get_state')).sessionId).toBe(initial.sessionId);
                    expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
                }
                if (mode === 'reload-offrace') {
                    // G-M1 (R2): Off then Connect completes while the reconnect poll is held; the poll then resumes.
                    await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(2);
                    await prompt('/phone-fixture hold-polls');
                    const off = prompt('/whatsapp'); await select('Connection'); await select('Turn WhatsApp off'); await confirm(); await off;
                    const on = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await on;
                    await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                    expect((await metrics()).socketStarts).toBe(3);
                    await prompt('/phone-fixture release-polls');
                    await expect.poll(() => notices().some(text => text.includes('did not reconnect')), { timeout: 10_000 }).toBe(true);
                    await settle(1500);
                    const messages = (await metrics()).messages;
                    expect(messages).not.toContain(t('phone.reload.ready')); expect(messages).not.toContain(t('phone.reload.failed'));
                    expect((await metrics()).socketStarts).toBe(3);
                    expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
                }
                if (mode.startsWith('reload-account')) {
                    // R3/B1: the post-reload socket belongs to a different synthetic account.
                    const creds = await readFile(join(data, 'auth/creds.json'), 'utf8');
                    const status = async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status;
                    await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(2);
                    if (mode === 'reload-account') {
                        // Cleanup: the reload's own socket is retired; nothing else is started or retried.
                        await expect.poll(() => notices().some(text => text.includes('different WhatsApp account; it was disconnected')), { timeout: 15_000 }).toBe(true);
                        await expect.poll(status, { timeout: 10_000 }).toBe('disconnected');
                    } else {
                        // Refusal: the saved auto-connect socket is not the reload's; it is never retired.
                        await expect.poll(() => notices().some(text => text.includes('different WhatsApp account') || text.includes('did not reconnect')), { timeout: 15_000 }).toBe(true);
                        expect(notices().some(text => text.includes('it was disconnected'))).toBe(false);
                        await expect.poll(status, { timeout: 10_000 }).toBe('connected');
                    }
                    await settle(4000);
                    expect((await metrics()).socketStarts).toBe(2); expect(await ready()).toBe(0);
                    expect((await metrics()).messages).not.toContain(t('phone.reload.failed'));
                    expect(await readFile(join(data, 'auth/creds.json'), 'utf8')).toBe(creds);
                    const after = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                    expect(after.autoConnect).toBe(config.autoConnect); expect(after.operatorJid).toBe(config.operatorJid); expect(after.allowList).toEqual(config.allowList);
                    expect((await request('get_state')).sessionId).toBe(initial.sessionId);
                    expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
                }
                if (mode === 'reload-off') {
                    // T1/R2: explicit Off then Connect while the reload's own reconnect socket is still opening.
                    await expect.poll(async () => (await metrics()).socketStarts, { timeout: 10_000 }).toBe(2);
                    const off = prompt('/whatsapp'); await select('Connection'); await select('Turn WhatsApp off'); await confirm(); await off;
                    const on = prompt('/whatsapp'); await select('Connection'); await select('Connect WhatsApp'); await on;
                    await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                    await settle(7000);
                    expect((await metrics()).socketStarts).toBe(3); expect(await ready()).toBe(0);
                    expect((await metrics()).messages).not.toContain(t('phone.reload.failed'));
                    expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
                }
                if (mode === 'reload-fail') {
                    // (d) Valid handoff, reconnect fails: no further automatic attempt; terminal recovery.
                    await expect.poll(() => notices().some(text => text.includes('Reconnect WhatsApp from the terminal')), { timeout: 10_000 }).toBe(true);
                    await settle(4000); expect((await metrics()).socketStarts).toBe(3); expect(await ready()).toBe(0); return;
                }
                await expect.poll(ready, { timeout: 15_000 }).toBe(1);
                // reload: auto-connect off, one resume start. reload-auto: (b) resume joins the auto-connect socket.
                // reload-retry: (a) failed first attempt; pending retry cancelled, one start from resume.
                const expected = mode === 'reload-retry' ? 3 : 2;
                expect((await metrics()).socketStarts).toBe(expected); await settle(4000);
                expect((await metrics()).socketStarts).toBe(expected); expect(await ready()).toBe(1);
                expect((await request('get_state')).sessionId).toBe(initial.sessionId);
                const after = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                expect(after.autoConnect).toBe(config.autoConnect); expect(after.operatorJid).toBe(config.operatorJid); expect(after.allowList).toEqual(config.allowList);
                // Ordinary terminal reload must not revive the consumed request.
                await prompt('/phone-fixture reload'); await request('get_state'); await settle(1500);
                expect(await ready()).toBe(1); if (mode === 'reload') expect((await metrics()).socketStarts).toBe(expected);
                expect((await metrics()).modelStarts).toBe(0); expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'menu-polish') {
                const before = await readFile(join(data, 'config.json'), 'utf8');
                const menu = prompt('/whatsapp');
                for (const key of ['menu.category.connection', 'menu.category.chatsOwner', 'menu.category.replies', 'voice.menu', 'menu.category.groups', 'menu.category.advanced'] as const) {
                    const root = await select(t(key)); expect(root.title).toContain(t('menu.state.enabled'));
                    const panel = await select(t('menu.back.main')); expect(panel.title).toContain(t('menu.hint.esc'));
                }
                await select(t('menu.close')); await menu;
                const auto = prompt('/whatsapp'); await select(t('menu.category.connection')); await select(t('menu.connection.autoConnect'));
                expect((await select(t('menu.back.connection'))).title).toContain(t('menu.autoConnect.title', { state: t('menu.off') }));
                await select(t('menu.back.main')); await select(t('menu.close')); await auto;
                const cancelled = prompt('/whatsapp'); await select(t('menu.category.chatsOwner')); await select(t('voice.owner')); await select(t('voice.enterOwner'));
                let input: any;
                await expect.poll(() => { input = records.find(r => r.type === 'extension_ui_request' && r.method === 'input' && !answered.has(r.id)); return !!input; }, { timeout: 10_000 }).toBe(true);
                expect(input.title).toContain(t('menu.hint.esc')); answered.add(input.id);
                child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: input.id }) + '\n'); await cancelled;
                expect(await readFile(join(data, 'config.json'), 'utf8')).toBe(before);
                expect((await metrics()).socketStarts).toBe(0); expect((await metrics()).modelStarts).toBe(0);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(r => r.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'autoconnect') {
                expect((await metrics()).socketStarts).toBe(1);
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                const beforeBack = await readFile(join(data, 'config.json'), 'utf8');
                const backMenu = prompt('/whatsapp'); await select('Connection'); await select('Auto-connect on startup');
                expect((await select('Back')).title).toContain('Auto-connect on startup: On');
                expect((await select('Back')).title).toBe('Connection\nEsc closes settings');
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
            if (mode === 'menu-ui') {
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                await prompt('/phone-fixture voice-mirror');
                expect((await metrics()).messages.at(-1)).toContain('Speech is disabled');
                expect((await metrics()).messages.at(-1)).toContain('Set up replies for a chat');
                const before = await readFile(join(data, 'config.json'), 'utf8');
                const cancelled = prompt('/whatsapp'); await select('Voice'); await select('Advanced speech settings');
                await select('Speech service (Edge or remote)'); await select('Remote speech service (HTTP API)'); await select('OpenAI-compatible');
                let input: any;
                await expect.poll(() => { input = records.find(record => record.type === 'extension_ui_request' && record.method === 'input' && !answered.has(record.id)); return !!input; }, { timeout: 10_000 }).toBe(true);
                answered.add(input.id); child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: input.id }) + '\n');
                await cancelled; expect(await readFile(join(data, 'config.json'), 'utf8')).toBe(before);
                const setup = prompt('/whatsapp'); await select('Voice'); await select('Set up replies for a chat');
                await select(`(${owner})`); await select('Mirror audio input'); await confirm();
                expect((await select('Back')).title).toMatch(/^Voice:/); expect((await select('Back')).title).toMatch(/^WhatsApp — /); await setup;
                const config = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                expect(config.voicePreferences).toMatchObject({ enabled: true, mode: 'text', chats: { [owner]: { mode: 'mirror' } } });
                await prompt('/phone-fixture voice-mirror'); expect((await metrics()).messages.at(-1)).toContain(t('phone.voice.saved', { mode: t('phone.mode.mirror') }));
                const back = prompt('/whatsapp'); await select('Replies'); await select('Optional outputs');
                await select('Choose automatic image tools'); expect((await select('Back')).title).toContain('actual image result blocks');
                expect((await select('Back')).title).toContain('Optional outputs'); expect((await select('Back')).title).toBe('Replies\nEsc closes settings');
                expect((await select('Back')).title).toMatch(/^WhatsApp — /); await back;
                expect((await metrics()).messages).toHaveLength(2); expect((await metrics()).modelStarts).toBe(0);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'agent_start' || record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'owner-guidance') {
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                const before = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                await prompt('/phone-fixture voice-mirror');
                expect((await metrics()).messages.at(-1)).toContain('/whatsapp > Chats / Owner > Owner');
                const menu = prompt('/whatsapp'); await select('Chats / Owner'); await select('Owner');
                expect((await select('Back')).title).toBe('Phone settings owner: not configured\nEsc closes settings');
                expect((await select('Back')).title).toBe('Chats / Owner\nEsc closes settings'); expect((await select('Back')).title).toMatch(/^WhatsApp — /); await menu;
                const after = JSON.parse(await readFile(join(data, 'config.json'), 'utf8'));
                expect(after.operatorJid).toBe(before.operatorJid); expect(after.operatorJid).toBe('');
                expect(after.voicePreferences).toEqual(before.voicePreferences);
                expect((await metrics()).modelStarts).toBe(0);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'agent_start' || record.type === 'extension_error')).toEqual([]); return;
            }
            if (mode === 'spoken-guard') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                const calls = records.filter(record => record.type === 'tool_execution_end' && record.toolName === 'send_wa_message');
                expect(calls).toHaveLength(1); expect(calls[0].isError).toBe(true);
                expect(JSON.parse(calls[0].result.content[0].text)).toMatchObject({ success: false, attempts: 0, error: expect.stringContaining('normal final answer') });
                const sent = await metrics(); expect(sent.messages).toHaveLength(1);
                expect(sent.messages[0]).toContain('RPC guard final'); expect(sent.messages[0]).not.toContain('Wrong explicit text');
                expect(sent.providerRequests).toBe(2); expect(sent.modelStarts).toBe(1);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0);
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]); return;
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
                    offDialog = records.find(record => record.type === 'extension_ui_request' && record.method === 'select' && record.title === 'Connection\nEsc closes settings' && !answered.has(record.id)); return !!offDialog;
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
            if (classify) {
                // Admission must start after the synthetic account is connected, not during asynchronous startup.
                await expect.poll(async () => JSON.parse(await readFile(join(data, 'config.json'), 'utf8')).status, { timeout: 10_000 }).toBe('connected');
                // Same real host scenarios with/without autonomous consent; terminal forwarding is enabled in both.
                const finalCounts: number[] = [];
                const settled = async (count: number) => {
                    await expect.poll(async () => (await metrics()).statsSettled, { timeout: 15_000 }).toBe(count);
                    finalCounts.push((await metrics()).sends.filter((send: any) => send.text?.startsWith('RPC stats final')).length);
                };
                await prompt('/phone-fixture custom-wake'); await settled(1);
                await prompt('/phone-fixture user-wake'); await settled(2);
                await prompt('/phone-fixture cron-wake'); await settled(3);
                await prompt('Synthetic terminal task'); await settled(4);
                await prompt('/phone-fixture mixed'); await settled(5);
                // Observe the remaining T012 host cases before any dependent production changes.
                for (const [index, action] of ['terminal-steer', 'terminal-followup'].entries()) {
                    await prompt('/phone-fixture terminal-hold');
                    const before = (await metrics()).observations.length;
                    const running = prompt('Synthetic held terminal task');
                    await expect.poll(async () => (await metrics()).observations.slice(before).some((item: any) => item.event === 'message_start' && item.role === 'user'), { timeout: 10_000 }).toBe(true);
                    await prompt('/phone-fixture ' + action); await running; await settled(6 + index);
                }
                const final = await metrics(); const runs: any[][] = [[]];
                for (const item of final.observations ?? []) { runs.at(-1)!.push(item); if (item.event === 'agent_end') runs.push([]); }
                runs.pop();
                const summary = runs.map(run => ({ started: run.find(item => item.event === 'before_agent_start')?.messageType,
                    inputs: run.filter(item => item.event === 'input').map(item => item.source + (item.whatsappRequest ? ':whatsapp' : '')),
                    consumed: run.filter(item => item.event === 'message_start').map(item => item.role + (item.whatsappRequest ? ':whatsapp' : '') + (item.customType ? ':' + item.customType : '')) }));
                await writeFile(join(root, 'classification.json'), JSON.stringify(summary));
                if (process.env.WA_PHONE_RPC_CLASSIFY_OUT) await writeFile(process.env.WA_PHONE_RPC_CLASSIFY_OUT + (mode === 'classify-terminal' ? '.terminal' : ''), JSON.stringify({ summary, finalCounts,
                    finals: final.sends.filter((send: any) => send.text?.startsWith('RPC stats final')).map((send: any) => send.jid) }, null, 2), { mode: 0o600 });
                expect(summary).toEqual([
                    { started: 'custom', inputs: [], consumed: ['custom:fixture-background'] },
                    { started: 'user', inputs: ['extension'], consumed: ['user'] },
                    { started: 'user', inputs: ['extension'], consumed: ['user'] },
                    { started: 'user', inputs: ['rpc'], consumed: ['user'] },
                    { started: 'user', inputs: ['extension:whatsapp'], consumed: ['user:whatsapp', 'custom:fixture-background'] },
                    { started: 'user', inputs: ['rpc'], consumed: ['user', 'custom:fixture-background'] },
                    { started: 'user', inputs: ['rpc'], consumed: ['user', 'custom:fixture-background'] }
                ]);
                // Autonomous consent adds custom, extension-user and cron-style live-session wake-ups only.
                const autonomous = mode === 'classify' ? 1 : 0;
                expect(finalCounts).toEqual([autonomous, autonomous * 2, autonomous * 3, autonomous * 3 + 1,
                    autonomous * 3 + 2, autonomous * 3 + 2, autonomous * 3 + 3]);
                expect(final.sends.filter((send: any) => send.text?.startsWith('RPC stats final')).map((send: any) => send.jid)).toEqual(Array(autonomous * 3 + 3).fill(owner));
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]);
                expect(JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts).toBe(0); return;
            }
            if (mode === 'self-auto') {
                await prompt('/phone-fixture stats-start');
                await expect.poll(async () => (await metrics()).statsSettled, { timeout: 10_000 }).toBe(1);
                const final = await metrics(); expect(final.providerRequests).toBe(1); expect(final.outgoingEchoes).toBe(1);
                expect(final.messages.filter((text: string) => text.startsWith('RPC stats final'))).toHaveLength(1);
                const reactions = final.sends.filter((send: any) => send.kind === 'reaction');
                expect(reactions.map((send: any) => send.emoji)).toEqual(['⏳', '']);
                expect(reactions.every((send: any) => send.jid === '90000000009@lid' && send.target.remoteJid === send.jid && send.target.fromMe === true)).toBe(true);
                expect(reactions[1].target).toEqual(reactions[0].target);
                expect(final.outgoingReactionEchoes).toBe(2);
                expect(final.sends.find((send: any) => send.text?.startsWith('RPC stats final')).jid).toBe('90000000009@lid');
                expect(records.filter(record => record.type === 'extension_error')).toEqual([]);
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
                await prompt('/phone-fixture status'); expect((await metrics()).messages.at(-1)).toContain(t('phone.status.voice', { value: t('phone.mode.mirror') }));
                await prompt('/phone-fixture poll-next');
                const polled = JSON.parse(await readFile(metricsPath, 'utf8'));
                expect(polled.pollVotes).toBe(1);
                expect(polled.messages.filter((text: string) => text.startsWith(t('phone.model.title', { page: 2 }) + '\n'))).toHaveLength(1);
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
