// Real Baileys helpers/auth; only the socket is replaced in an explicitly isolated RPC fixture.
import { EventEmitter } from 'node:events';
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { cleanMessage, generateWAMessageContent, proto } from '../../node_modules/baileys/lib/index.js';
export * from '../../node_modules/baileys/lib/index.js';

const metricsPath = process.env.WA_PHONE_RPC_METRICS;
const configPath = process.env.WA_PHONE_RPC_CONFIG;
if (!metricsPath || !configPath || process.env.PI_OFFLINE !== '1') throw new Error('Isolated fixture environment required');
const self = '15550000009@s.whatsapp.net'; const lid = '90000000009@lid';
const selfChat = process.env.WA_PHONE_RPC_SELF_LID === '1';
const owner = selfChat ? self : '15550000001@s.whatsapp.net'; const chat = selfChat ? lid : owner;
const metrics = { socketStarts: 0, controlSends: 0, modelStarts: 0, cancelled: 0, messages: [], activeTools: [], pollVotes: 0, pollCreations: 0, outgoingEchoes: 0, sends: [], imageSends: 0, imageSnapshotsPrivate: true };
const save = () => writeFileSync(metricsPath, JSON.stringify(metrics), { mode: 0o600 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let serial = 0; let latestPoll;
const wait = async predicate => { for (let i = 0; i < 1000; i++) { if (predicate()) return; await delay(10); } throw new Error('Synthetic transport did not reach expected checkpoint'); };
const key = () => ({ id: `fixture-${++serial}`, remoteJid: chat, fromMe: selfChat, ...(selfChat ? { remoteJidAlt: self } : {}) });
globalThis.__waPhoneRpcFixture = { metrics, save, deliver: async (text, responseCount = 1) => {
    await wait(() => socket?.opened && (() => { try { return JSON.parse(readFileSync(configPath, 'utf8')).status === 'connected'; } catch { return false; } })());
    const before = metrics.controlSends;
    socket.ev.emit('messages.upsert', { type: 'notify', messages: [{ key: key(),
        message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
    await wait(() => metrics.controlSends >= before + responseCount);
}, deliverGroup: async (text, reply = false) => {
    // Socket construction/open precedes auth/archive readiness, especially after reload.
    await wait(() => socket?.opened && (() => { try { return JSON.parse(readFileSync(configPath, 'utf8')).status === 'connected'; } catch { return false; } })());
    socket.ev.emit('messages.upsert', { type: 'notify', messages: [{ key: { id: `fixture-group-${++serial}`, remoteJid: '120363000001@g.us', participant: owner, fromMe: false },
        message: { extendedTextMessage: { text, contextInfo: reply ? { stanzaId: 'synthetic-group-self', participant: self } : { mentionedJid: [self] } } }, messageTimestamp: Math.floor(Date.now() / 1000) }] });
}, voteNext: async () => {
    if (!selfChat || !latestPoll) throw new Error('Explicit synthetic self-poll required');
    const poll = latestPoll; const label = poll.labels.find(value => value.endsWith('Next page'));
    if (!label) throw new Error('Synthetic next-page option missing');
    const root = createHmac('sha256', Buffer.alloc(32)).update(poll.secret).digest();
    const encryptionKey = createHmac('sha256', root).update(Buffer.concat([Buffer.from(`${poll.id}${lid}${lid}Poll Vote`), Buffer.from([1])])).digest();
    const encIv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey, encIv);
    cipher.setAAD(Buffer.from(`${poll.id}\0${lid}`));
    const payload = proto.Message.PollVoteMessage.encode({ selectedOptions: [createHash('sha256').update(label).digest()] }).finish();
    const message = { key: key(), messageTimestamp: Math.floor(Date.now() / 1000), message: { pollUpdateMessage: {
        pollCreationMessageKey: { id: poll.id, fromMe: true },
        vote: { encIv, encPayload: Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]) }
    } } };
    cleanMessage(message, self, lid);
    const before = metrics.controlSends; metrics.pollVotes++; save();
    socket.ev.emit('messages.upsert', { type: 'notify', messages: [message] });
    await wait(() => metrics.controlSends >= before + 2);
} };
save();
export function makeWASocket() {
    const ev = new EventEmitter(); metrics.socketStarts++; save();
    const current = { ev, user: { id: self, ...(selfChat ? { lid } : {}) }, opened: false,
        signalRepository: { lidMapping: { getPNForLID: async () => null } },
        sendMessage: async (jid, content, options) => {
            const image = process.env.WA_PHONE_RPC_OPTIONAL === 'images' && content.image;
            if (image) { metrics.imageSends++; metrics.imageSnapshotsPrivate &&= (statSync(content.image.url).mode & 0o777) === 0o600 && readFileSync(content.image.url).length > 0; }
            const message = image ? { imageMessage: { mimetype: content.mimetype, caption: 'Synthetic image' } } : await generateWAMessageContent(content, { userJid: self });
            metrics.sends.push({ jid, kind: content.edit ? 'edit' : image ? 'image' : 'text', ...(content.edit ? { edit: { ...content.edit } } : {}), ...(typeof content.text === 'string' ? { text: content.text } : {}) });
            if (content.poll) { metrics.pollCreations++; latestPoll = { id: options.messageId, labels: content.poll.values, secret: message.messageContextInfo.messageSecret }; }
            metrics.controlSends++; if (typeof content.text === 'string') metrics.messages.push(content.text); save();
            if (process.env.WA_PHONE_RPC_SELF_AUTO === '1') {
                metrics.outgoingEchoes++; save();
                ev.emit('messages.upsert', { type: 'notify', messages: [{ key: { id: options.messageId, remoteJid: chat, remoteJidAlt: self, fromMe: true }, message, messageTimestamp: Math.floor(Date.now() / 1000) }] });
            }
            return { key: { id: options.messageId, remoteJid: jid, fromMe: true }, ...(jid.endsWith('@g.us') ? { participant: self } : {}), message };
        }, readMessages: async () => {}, sendPresenceUpdate: async () => {},
        groupMetadata: async () => ({ id: '120363000000@g.us', participants: [] }), groupFetchAllParticipating: async () => ({}),
        end: () => { current.opened = false; }, logout: async () => { throw new Error('Fixture forbids credential logout'); }
    };
    socket = current;
    const open = () => { if (!ev.listenerCount('connection.update')) { setTimeout(open, 10).unref(); return; } current.opened = true; ev.emit('connection.update', { connection: 'open' }); };
    setTimeout(open, 20).unref();
    return current;
}
export default makeWASocket;
