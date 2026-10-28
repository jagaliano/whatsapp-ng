import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cleanMessage, proto } from 'baileys';
import { CommandMenuService } from '../../src/services/command-menu.service.ts';

const owner = '15550000001@s.whatsapp.net'; const self = '15550000009@s.whatsapp.net'; const group = '120363000000@g.us';
function encrypted(secret: Buffer, voter = owner, selections = ['1. First'], creator = self) {
    const root = createHmac('sha256', Buffer.alloc(32)).update(secret).digest();
    const key = createHmac('sha256', root).update(Buffer.concat([Buffer.from(`poll-1${creator}${voter}Poll Vote`), Buffer.from([1])])).digest();
    const encIv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, encIv);
    cipher.setAAD(Buffer.from(`poll-1\0${voter}`));
    const content = proto.Message.PollVoteMessage.encode({ selectedOptions: selections.map(option => createHash('sha256').update(option).digest()) }).finish();
    return { encIv, encPayload: Buffer.concat([cipher.update(content), cipher.final(), cipher.getAuthTag()]) };
}
function fixture(chat = owner) {
    let current = true; const menus = new CommandMenuService<string>(jid => jid);
    const binding = { chat, actor: owner, scope: 'account:session', current: () => current };
    const menu = menus.create(binding, 'Choose', [{ label: 'First', value: 'one' }, { label: 'Second', value: 'two' }]);
    menus.activate(menu.id, 'text-1'); menus.activate(menu.id, 'poll-1', true);
    const input = { chat, actor: owner, scope: binding.scope, selfJid: self,
        creationKey: { id: 'poll-1', remoteJid: chat, fromMe: true },
        voterKey: { id: 'vote-1', remoteJid: chat, fromMe: false, ...(chat === group ? { participant: owner } : {}) },
        vote: encrypted(menu.poll.messageSecret) };
    return { menus, menu, input, revoke: () => { current = false; } };
}
describe('pinned Baileys encrypted command-poll contract', () => {
    it.each(['implicit-chat', 'lid-authors', 'mixed-authors'])('handles a real-cleaner own-direction self-chat vote: %s', variant => {
        const lid = '90000000009@lid'; const canonical = (jid: string) => jid === lid ? self : jid;
        const menus = new CommandMenuService<string>(canonical);
        const menu = menus.create({ chat: lid, actor: self, scope: 'self-session', current: () => true }, 'Choose', [{ label: 'First', value: 'one' }]);
        menus.activate(menu.id, 'text-1'); menus.activate(menu.id, 'poll-1', true);
        const voter = variant === 'implicit-chat' ? self : lid;
        const creator = variant === 'lid-authors' ? lid : self;
        const message = { key: { id: 'vote-1', remoteJid: lid, remoteJidAlt: self, fromMe: true },
            message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'poll-1', fromMe: true,
                ...(variant === 'implicit-chat' ? {} : { remoteJid: lid }) }, vote: encrypted(menu.poll.messageSecret, voter, ['1. First'], creator) } } };
        cleanMessage(message, self, lid);
        if (variant === 'implicit-chat') expect(message.message.pollUpdateMessage.pollCreationMessageKey.remoteJid).toBeUndefined();
        expect(menus.selectPoll({ chat: lid, actor: self, scope: 'self-session', selfJid: self, selfLid: lid,
            creationKey: message.message.pollUpdateMessage.pollCreationMessageKey, voterKey: message.key, vote: message.message.pollUpdateMessage.vote }).value).toBe('one');
        expect(menu.poll.messageSecret.every(byte => byte === 0)).toBe(true);
    });
    it('uses verified raw LID voter identity for crypto without granting alias-based ownership', () => {
        const lid = '90000000001@lid'; const canonical = (jid: string) => jid === lid ? owner : jid;
        const menus = new CommandMenuService<string>(canonical);
        const menu = menus.create({ chat: lid, actor: owner, scope: 'peer-session', current: () => true }, 'Choose', [{ label: 'First', value: 'one' }]);
        menus.activate(menu.id, 'text-1'); menus.activate(menu.id, 'poll-1', true);
        expect(menus.selectPoll({ chat: lid, actor: owner, scope: 'peer-session', selfJid: self,
            creationKey: { id: 'poll-1', remoteJid: lid, fromMe: true },
            voterKey: { id: 'vote-1', remoteJid: lid, remoteJidAlt: owner, fromMe: false },
            vote: encrypted(menu.poll.messageSecret, lid) }).value).toBe('one');
    });
    it('rejects an explicitly foreign creation chat and leaves the numbered fallback usable', () => {
        const h = fixture();
        expect(h.menus.selectPoll({ ...h.input, creationKey: { ...h.input.creationKey, remoteJid: '15550000002@s.whatsapp.net' } }).value).toBeUndefined();
        expect(h.menus.select({ chat: owner, actor: owner, scope: h.input.scope, text: '1' }).value).toBe('one');
    });
    it('does not try an unverified voter alias or let self metadata grant another participant ownership', () => {
        const h = fixture(); const other = '90000000002@lid';
        expect(h.menus.selectPoll({ ...h.input, voterKey: { ...h.input.voterKey, remoteJidAlt: other },
            vote: encrypted(h.menu.poll.messageSecret, other) }).value).toBeUndefined();
        expect(h.menus.selectPoll({ ...h.input, actor: other, selfLid: other }).value).toBeUndefined();
        expect(h.menus.selectPoll(h.input).value).toBe('one');
    });
    it('decrypts a group vote with distinct verified raw author namespaces', () => {
        const peerLid = '90000000001@lid'; const ownLid = '90000000009@lid';
        const menus = new CommandMenuService<string>(jid => jid === peerLid ? owner : jid);
        const menu = menus.create({ chat: group, actor: owner, scope: 'group-session', current: () => true }, 'Choose', [{ label: 'First', value: 'one' }]);
        menus.activate(menu.id, 'text-1'); menus.activate(menu.id, 'poll-1', true);
        expect(menus.selectPoll({ chat: group, actor: owner, scope: 'group-session', selfJid: self, selfLid: ownLid,
            creationKey: { id: 'poll-1', fromMe: true, remoteJid: group },
            voterKey: { id: 'vote-1', fromMe: false, remoteJid: group, participant: peerLid, participantAlt: owner },
            vote: encrypted(menu.poll.messageSecret, peerLid, ['1. First'], ownLid) }).value).toBe('one');
    });
    it.each([owner, group])('decrypts and consumes one owner vote in %s', chat => {
        const h = fixture(chat); expect(h.menus.selectPoll(h.input).value).toBe('one');
        expect(h.menu.poll.messageSecret.every(byte => byte === 0)).toBe(true); expect(h.menus.selectPoll(h.input).value).toBeUndefined();
    });
    it('requires the actual voter to match the verified actor, including group participants', () => {
        const h = fixture(group); const other = '15550000002@s.whatsapp.net';
        const forged = { ...h.input, voterKey: { ...h.input.voterKey, participant: other }, vote: encrypted(h.menu.poll.messageSecret, other) };
        expect(h.menus.selectPoll(forged).value).toBeUndefined(); expect(h.menus.selectPoll(h.input).value).toBe('one');
    });
    it.each(['scope', 'chat', 'creation', 'direction', 'revoked', 'tampered', 'multiselect', 'withdrawn', 'unknown option'])('ignores %s without consuming another valid vote', variant => {
        const h = fixture(); const input = structuredClone(h.input);
        if (variant === 'scope') input.scope = 'other-account';
        if (variant === 'chat') input.chat = '15550000002@s.whatsapp.net';
        if (variant === 'creation') input.creationKey.id = 'unknown-poll';
        if (variant === 'direction') input.creationKey.fromMe = false;
        if (variant === 'revoked') h.revoke();
        if (variant === 'tampered') input.vote.encPayload[0] ^= 1;
        if (variant === 'multiselect') input.vote = encrypted(h.menu.poll.messageSecret, owner, ['1. First', '2. Second']);
        if (variant === 'withdrawn') input.vote = encrypted(h.menu.poll.messageSecret, owner, []);
        if (variant === 'unknown option') input.vote = encrypted(h.menu.poll.messageSecret, owner, ['not a menu option']);
        expect(h.menus.selectPoll(input).value).toBeUndefined();
        if (variant !== 'revoked') expect(h.menus.selectPoll(h.input).value).toBe('one');
    });
    it('rejects oversized encrypted material before parsing', () => {
        const h = fixture(); expect(h.menus.selectPoll({ ...h.input, vote: { encPayload: Buffer.alloc(2049), encIv: Buffer.alloc(12) } }).value).toBeUndefined();
    });
});
