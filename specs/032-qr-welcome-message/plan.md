# Implementation Plan: QR Connect Welcome Message

**Branch**: `032-qr-welcome-message` | **Date**: 2026-05-16 | **Spec**: `specs/032-qr-welcome-message/spec.md`

## Summary

When the operator scans the QR code and WhatsApp connects for the first time in a session, `WhatsAppService` sends a friendly self-message to the operator's own number and prints "WhatsApp connected" to the console. The distinction between a QR-driven connection and an auto-reconnect is tracked with one new in-memory boolean flag. No new dependencies, no schema changes, no new persistence.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `@whiskeysockets/baileys`, `pino`, `qrcode-terminal`  
**Storage**: No persistent storage changes  
**Testing**: Vitest  
**Target Platform**: Desktop Node.js CLI / Pi Code Agent extension  
**Performance Goals**: Welcome message dispatched within 1 s of connection-open event  
**Constraints**: No new dependencies; must not affect auto-reconnect paths; send failure must not abort the session  
**Scale/Scope**: Single-user runtime; no new config keys or persistence layer

## Constitution Check

- [x] **I. OOP**: New flag and new private method are encapsulated inside the existing `WhatsAppService` class.
- [x] **II. Clean Code**: `qrWasShown` is an explicit, self-describing flag; `sendQrWelcome` has a single purpose.
- [x] **III. SOLID**: `WhatsAppService` retains ownership of its connection lifecycle; no responsibility leaks into `SessionManager`.
- [x] **IV. TypeScript**: Flag is a typed `boolean`; self-JID extraction re-uses existing typed helpers; no `any` additions.
- [x] **V. Simplicity**: One new field, one new private method, a 4-line call-site in `handleConnectionOpen`, two new i18n keys. Smallest possible surface.

## Project Structure

### Documentation (this feature)

```text
specs/032-qr-welcome-message/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Changes

```text
src/
├── i18n.ts                               ← two new message keys (all locales)
└── services/
    └── whatsapp.service.ts               ← new flag + sendQrWelcome + call in handleConnectionOpen

tests/unit/
└── whatsapp.service.qr-welcome.test.ts   ← new test file
```

**Structure Decision**: Single project layout (Option 1). No new modules — changes are confined to two existing files plus one new test file.

## Phase 1: Implementation

### 1.1 — `src/i18n.ts` — two new keys

Add in every locale block (after `service.whatsapp.connected`):

| Key | English value | PT-BR value | ES value | FR value |
|-----|--------------|-------------|----------|----------|
| `service.whatsapp.qrConnected` | `"WhatsApp connected"` | `"WhatsApp conectado"` | `"WhatsApp conectado"` | `"WhatsApp connecté"` |
| `service.whatsapp.qrWelcomeMessage` | `"👋 Hello! I'm your Pi agent, now connected to WhatsApp and ready to assist you. Send me a message to get started!"` | `"👋 Olá! Sou seu agente Pi, agora conectado ao WhatsApp e pronto para ajudar. Envie uma mensagem para começar!"` | `"👋 ¡Hola! Soy tu agente Pi, ahora conectado a WhatsApp y listo para ayudarte. ¡Envíame un mensaje para empezar!"` | `"👋 Bonjour ! Je suis votre agent Pi, maintenant connecté à WhatsApp et prêt à vous aider. Envoyez-moi un message pour commencer !"` |

### 1.2 — `src/services/whatsapp.service.ts`

#### A. New field

Add after the existing `private lastRemoteJid` field (line ~114):

```typescript
private qrWasShown = false;
```

#### B. `handlePairingQr()` — set the flag

Add one line at the end of the method body:

```typescript
this.qrWasShown = true;
```

#### C. `handleConnectionOpen()` — send welcome and print confirmation

Add the following block **after** `this.onStatusUpdate?.(t('service.whatsapp.connected'))`:

```typescript
if (this.qrWasShown) {
    this.qrWasShown = false;
    console.log(t('service.whatsapp.qrConnected'));
    void this.sendQrWelcome();
}
```

#### D. New private method `sendQrWelcome()`

```typescript
private async sendQrWelcome(): Promise<void> {
    const rawId = this.socket?.user?.id;
    if (!rawId) return;
    const selfJid = this.normalizeJidForComparison(rawId);
    try {
        await this.socket?.sendMessage(selfJid, { text: t('service.whatsapp.qrWelcomeMessage') });
    } catch {
        // Best-effort — welcome send failure must not abort the session.
    }
}
```

### 1.3 — New test file (`tests/unit/whatsapp.service.qr-welcome.test.ts`)

Reuse the Baileys mock pattern from `whatsapp.service.auth-failure.test.ts`. Four tests:

| Test | What it verifies |
|------|-----------------|
| `sends welcome and prints on QR-driven connection` | After QR event + connection open, `socket.sendMessage` called with self-JID and welcome text; `console.log` called with `"WhatsApp connected"` |
| `does not send welcome on credential-restore connection` | No QR event before connection open → no `sendMessage` call, no console log |
| `does not send welcome on auto-reconnect` | QR event in session 1, connect; disconnect; reconnect (no second QR) → `sendMessage` called once total |
| `send failure does not abort the session` | `socket.sendMessage` rejects → session status remains `"connected"` |

## Complexity Tracking

No constitution violations. Total change surface: ~20 lines added across two source files plus a new test file.
