# Tasks: QR Connect Welcome Message

**Branch**: `032-qr-welcome-message` | **Generated**: 2026-05-16  
**Spec**: `specs/032-qr-welcome-message/spec.md` | **Plan**: `specs/032-qr-welcome-message/plan.md`

## Implementation Strategy

MVP = both user stories (both P1, tightly coupled, tiny surface). Deliver T001–T005 in one pass; add T006 (tests) immediately after. Total change: ~20 lines across two existing source files + one new test file.

---

## Phase 1: Foundation

> Prerequisite for both user stories. Adds the i18n message keys (used at runtime in Phase 2) and the `qrWasShown` flag (the sole mechanism that distinguishes QR-driven connections from reconnects).

- [x] T001 [P] Add two new i18n keys to every locale block in `src/i18n.ts` — after `"service.whatsapp.connected"` in each locale:
  - `"service.whatsapp.qrConnected"`: en `"WhatsApp connected"` | pt-BR `"WhatsApp conectado"` | es `"WhatsApp conectado"` | fr `"WhatsApp connecté"`
  - `"service.whatsapp.qrWelcomeMessage"`: en `"👋 Hello! I'm your Pi agent, now connected to WhatsApp and ready to assist you. Send me a message to get started!"` | pt-BR `"👋 Olá! Sou seu agente Pi, agora conectado ao WhatsApp e pronto para ajudar. Envie uma mensagem para começar!"` | es `"👋 ¡Hola! Soy tu agente Pi, ahora conectado a WhatsApp y listo para ayudarte. ¡Envíame un mensaje para empezar!"` | fr `"👋 Bonjour ! Je suis votre agent Pi, maintenant connecté à WhatsApp et prêt à vous aider. Envoyez-moi un message pour commencer !"`
- [x] T002 [P] Add `private qrWasShown = false` field to `WhatsAppService` in `src/services/whatsapp.service.ts` — insert after the `private lastRemoteJid` field declaration (line ~114)

---

## Phase 2: User Story 1 — Welcome Message on Fresh QR Pairing

> **Story goal**: After the operator scans the QR code, a self-message welcome arrives on their WhatsApp and "WhatsApp connected" is printed to stdout.  
> **Independent test**: Delete `.pi-data/` auth, start agent, scan QR — confirm "WhatsApp connected" in console and welcome message in operator's own WhatsApp chat within 5 s.

- [x] T003 [US1] Set `this.qrWasShown = true` at the end of `handlePairingQr()` in `src/services/whatsapp.service.ts` — add as the last statement in the method body
- [x] T004 [US1] Add private async method `sendQrWelcome()` to `WhatsAppService` in `src/services/whatsapp.service.ts`: read `this.socket?.user?.id`, return early if absent, normalize via `this.normalizeJidForComparison(rawId)`, then call `await this.socket?.sendMessage(selfJid, { text: t('service.whatsapp.qrWelcomeMessage') })` inside a `try/catch` that discards errors silently
- [x] T005 [US1] Add welcome block to `handleConnectionOpen()` in `src/services/whatsapp.service.ts` — append after `this.onStatusUpdate?.(t('service.whatsapp.connected'))`:
  ```typescript
  if (this.qrWasShown) {
      this.qrWasShown = false;
      console.log(t('service.whatsapp.qrConnected'));
      void this.sendQrWelcome();
  }
  ```

**Checkpoint**: At this point, scanning a QR code prints "WhatsApp connected" and sends a welcome self-message. US1 is fully functional and manually verifiable via quickstart Scenario A.

---

## Phase 3: User Story 2 — No Welcome on Auto-Reconnect

> **Story goal**: Auto-reconnects and credential-restore connections produce no welcome message and no console print.  
> **Independent test**: Connect normally (saved session), restart agent — confirm no "WhatsApp connected" print and no extra self-message.

> **Implementation note**: No additional source changes are required. US2 correctness is structural — `qrWasShown` is set only inside `handlePairingQr()`, which is called only when Baileys fires a `qr` event. Auto-reconnect and credential-restore paths never fire a `qr` event, so `qrWasShown` remains `false` and the welcome block in `handleConnectionOpen()` is bypassed. This phase is verification-only.

**Checkpoint**: US2 is correct-by-construction after Phase 2. Verify manually via quickstart Scenarios B and C before proceeding to tests.

---

## Phase 4: Tests

> All four test cases in one new file. Reuse the Baileys mock pattern from `tests/unit/whatsapp.service.auth-failure.test.ts` (hoisted `vi.mock('baileys', ...)`, spy on `socket.sendMessage`, spy on `console.log`).

- [x] T006 Create `tests/unit/whatsapp.service.qr-welcome.test.ts` with the following four test cases:
  - **[US1]** `"sends welcome self-message and logs qrConnected after QR pairing"`: fire `qr` event → then `connection: 'open'` → assert `socket.sendMessage` called once with the operator's own JID and `qrWelcomeMessage` text; assert `console.log` called with `"WhatsApp connected"`
  - **[US1]** `"does not send welcome when connecting from saved credentials (no QR event)"`: fire `connection: 'open'` without any prior `qr` event → assert `socket.sendMessage` not called; assert `console.log` not called with `"WhatsApp connected"`
  - **[US2]** `"does not send welcome on auto-reconnect after first QR-driven connection"`: fire `qr` + `connection: 'open'` (first connect, welcome fires); fire `connection: 'close'` + `connection: 'open'` (reconnect) → assert `socket.sendMessage` called exactly once total (only on first connect)
  - **[US1]** `"session stays connected when sendQrWelcome send fails"`: fire `qr` + `connection: 'open'`; make `socket.sendMessage` reject → assert `sessionManager.getStatus()` is `"connected"` after the rejection settles

---

## Phase 5: Polish

- [x] T007 Run `npm test` and confirm all existing tests still pass alongside the new `whatsapp.service.qr-welcome.test.ts` suite in `tests/unit/`

---

## Dependencies

```
T001 (i18n) ──► T005 (uses t() keys)
T002 (field) ──► T003 ──► T005
                      └──► T004 ──► T005

T003 + T004 + T005 ──► T006 (tests)

T006 ──► T007 (verify)
```

T001 and T002 are independent of each other [P] and can be done simultaneously. T003 and T004 are independent of each other [P] within the same file but should be applied sequentially to avoid diff conflicts. T005 depends on T003 and T004.

## Parallel Execution

| Parallel group | Tasks | Condition |
|----------------|-------|-----------|
| Foundation | T001, T002 | Different files — truly parallel |
| US1 implementation | T003, T004 | Same file — can be drafted in parallel but apply sequentially |

## Summary

| Phase | Tasks | User Story |
|-------|-------|------------|
| Foundation | T001–T002 | — |
| Welcome on QR (US1) | T003–T005 | US1 |
| No welcome on reconnect (US2) | — | US2 (structural) |
| Tests | T006 | US1 + US2 |
| Polish | T007 | — |

**Total tasks**: 7  
**Parallelizable**: T001 + T002 (different files); T003 + T004 (same file, draft-parallel)  
**MVP scope**: T001–T007 (all P1, tightly coupled, small surface — implement all together)
