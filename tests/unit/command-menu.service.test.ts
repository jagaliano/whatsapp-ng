import { describe, expect, it, vi } from 'vitest';
import { CommandMenuService } from '../../src/services/command-menu.service.ts';

const owner = '15550000001@s.whatsapp.net';
const other = '15550000002@s.whatsapp.net';
const group = '120363000000@g.us';
function fixture(chat = owner) {
    let now = 1_000; let current = true;
    const menus = new CommandMenuService<string>(jid => jid, () => now);
    const binding = { chat, actor: owner, scope: 'account:1:session:1', current: () => current };
    const open = () => { const menu = menus.create(binding, 'Choose', [{ label: 'First', value: 'one' }, { label: 'Second', value: 'two' }]); menus.activate(menu.id, 'menu-1'); return menu; };
    return { menus, binding, open, expire: () => { now += 300_001; }, revoke: () => { current = false; } };
}
describe('bounded owner command menus', () => {
    it('freezes options and consumes an exact numeric selection once', () => {
        const h = fixture(); const menu = h.open(); expect(menu.text).toContain('1. First');
        expect(h.menus.select({ ...h.binding, text: '2' }).value).toBe('two');
        expect(h.menus.select({ ...h.binding, text: '2' }).value).toBeUndefined();
    });
    it.each(['wrong actor', 'wrong account', 'expired', 'revoked'])('rejects %s', kind => {
        const h = fixture(); h.open(); if (kind === 'expired') h.expire(); if (kind === 'revoked') h.revoke();
        expect(h.menus.select({ ...h.binding, actor: kind === 'wrong actor' ? other : owner,
            scope: kind === 'wrong account' ? 'other-account' : h.binding.scope, text: '1' }).value).toBeUndefined();
    });
    it('requires the exact menu quote for numeric group replies', () => {
        const h = fixture(group); h.open(); expect(h.menus.select({ ...h.binding, text: '1' }).value).toBeUndefined();
        h.open(); expect(h.menus.select({ ...h.binding, text: '1', quotedId: 'foreign' }).value).toBeUndefined();
        h.open(); expect(h.menus.select({ ...h.binding, text: '1', quotedId: 'menu-1' }).value).toBe('one');
    });
    it('does not let a foreign group actor consume the owner menu', () => {
        const h = fixture(group); h.open();
        expect(h.menus.select({ ...h.binding, actor: other, text: '1', quotedId: 'menu-1' }).value).toBeUndefined();
        expect(h.menus.select({ ...h.binding, text: '1', quotedId: 'menu-1' }).value).toBe('one');
    });
    it('normal text cancels the actor menu and remains an ordinary prompt', () => {
        const h = fixture(); h.open(); expect(h.menus.select({ ...h.binding, text: 'ordinary task' }).handled).toBe(false);
        expect(h.menus.select({ ...h.binding, text: '1' }).value).toBeUndefined();
    });
    it('refuses late activation after a replacement menu or reset', () => {
        const h = fixture(); const first = h.open(); h.open(); expect(h.menus.activate(first.id, 'late')).toBe(false);
        const second = h.open(); h.menus.reset(); expect(h.menus.activate(second.id, 'late')).toBe(false);
    });
    it('bounds retained entries and erases poll secret on consumption/reset/expiry', () => {
        const h = fixture(); const menu = h.open(); const secret = menu.poll.messageSecret; expect(secret.some(byte => byte !== 0)).toBe(true);
        h.menus.select({ ...h.binding, text: '1' }); expect(secret.every(byte => byte === 0)).toBe(true);
        const next = h.open(); h.menus.reset(); expect(next.poll.messageSecret.every(byte => byte === 0)).toBe(true);
        for (let i = 0; i < 100; i++) h.menus.create({ ...h.binding, chat: `${i}@s.whatsapp.net` }, 'Choose', [{ label: 'One', value: 'one' }]);
        expect(h.menus.size).toBeLessThanOrEqual(50); h.expire(); expect(h.menus.size).toBe(0);
    });
    it('freezes a defensive copy of labels and values', () => {
        const h = fixture(); const options = [{ label: 'First', value: 'one' }]; const menu = h.menus.create(h.binding, 'Choose', options);
        options[0].value = 'changed'; h.menus.activate(menu.id, 'menu-1');
        expect(h.menus.select({ ...h.binding, text: '1' }).value).toBe('one');
    });
    it('erases the extension-owned poll secret at expiry even without another interaction', () => {
        vi.useFakeTimers();
        try {
            const h = fixture(); const menu = h.open(); vi.advanceTimersByTime(300_001);
            expect(menu.poll.messageSecret.every(byte => byte === 0)).toBe(true);
        } finally { vi.useRealTimers(); }
    });
    it('does not use a recurring poller or background execution authority', () => {
        const timer = vi.spyOn(globalThis, 'setInterval'); fixture().open(); expect(timer).not.toHaveBeenCalled(); timer.mockRestore();
    });
});
