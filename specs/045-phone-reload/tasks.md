# Tasks: Phone-Initiated Pi Reload

**Input**: `specs/045-phone-reload/` (plan.md, spec.md, research.md, data-model.md, contracts/phone-reload.md, quickstart.md)
**Tests**: Included — AGENTS.md requires regression tests and spec defines independent tests per story. Write tests first; confirm they fail.

> **Test-history note (not retroactive compliance):** In the first implementation pass, T004, T005, T013, T015, T016, T017 and T019 were written alongside or after their implementation tasks, and none was observed failing first. This is recorded as deviation D1 in [plan.md Complexity Tracking](plan.md#complexity-tracking). `[X]` below means implemented and passing, not that tests came first. Review tasks: R1–R3 (T024–T026) and B1/B2 (T028–T029) were regression-first; T027 and the same-account no-retire guard were not failing-first. See the review-fix test history.

## Phase 1: Setup

- [X] T001 Confirm `ExtensionCommandContext.reload()` and `session_start`/`session_shutdown` `reason` values (`"reload"`) in the installed Pi types (`dist/core/extensions/types.d.ts`) in the Pi 1.5.0 baseline (`node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`); keep 1.5.0 as baseline, record evidence in specs/045-phone-reload/research.md (R1)

## Phase 2: Foundational

- [X] T002 Add i18n keys `phone.help.cmd.reload`, `phone.reload.title`, `phone.reload.confirm`, `phone.reload.privateOnly`, `phone.reload.started`, `phone.reload.expired`, `phone.reload.notConnected`, `phone.reload.ready`, `phone.reload.failed` in en, pt-BR, es, fr in src/i18n.ts; `phone.reload.ready` says WhatsApp reconnected after reload and must not claim all extensions loaded; fixed titles/labels must fit the 120-char `safeLabel` cap untruncated
- [X] T003 Add `'reload'` to the `commands` set and `Action.command` union, and add `ReloadHandoff` type (`profile, account, sessionId, actor, chat, expires`) plus `globalThis.__whatsappNgReloadHandoffs?: Map<string, ReloadHandoff>` declaration in src/services/whatsapp-command.router.ts

## Phase 3: User Story 1 — Owner reloads Pi from the phone (P1) 🎯 MVP

**Goal**: owner `/reload` → confirm → standard reload → same-account reconnect → one acknowledgment.
**Independent test**: synthetic owner/private chat; `ctx.reload` called once; after simulated shutdown(reload)/start(reload), `resume` called once and `phone.reload.ready` sent once; auto-connect preference unchanged.

- [X] T004 [P] [US1] Router test: owner `/reload` in private allowed chat shows a 2-option menu (Reload/Cancel); confirm queues `/whatsapp --internal control-reload <uuid>` via `sendUserMessage({ expandPromptTemplates: true, deliverAs: 'followUp' })`; gateway calls `ctx.reload()` exactly once and makes no send/port calls afterward, in tests/unit/whatsapp-command.router.test.ts
- [X] T005 [P] [US1] Router test: `publishReload('reload')` with armed intent then `consumeReload('reload', ctx)` calls `ports.resume(current, account)` once and sends `phone.reload.ready` once; with auto-connect off `resume` still runs and no preference setter is called; assert Pi session id, conversation history and config/operator revision unchanged; with a pending auto-connect retry exactly one `start()` occurs, in tests/unit/whatsapp-command.router.test.ts
- [X] T006 [US1] Implement `/reload` command branch: reject arguments with `phone.usage`; refuse any group (`SessionManager.isGroupJid(chat)`, including group-only mode) with `phone.reload.privateOnly`; open menu `phone.reload.title` with `{command:'reload', value:'confirm'}` and cancel, in src/services/whatsapp-command.router.ts
- [X] T007 [US1] In `apply`, for `reload` confirm: create `reloadTickets` entry (uuid, frame, "expires: now + 15 000"; clear previous tickets; cleared in `reset()`), reply `phone.reload.started`, queue internal command, in src/services/whatsapp-command.router.ts
- [X] T008 [US1] Extend `gateway` regex to `control-(new|resume|reload)`; for reload: delete ticket first, require unexpired, `frame.current()`, `ctx.isIdle()`, `!ctx.hasPendingMessages()`, `getEffectiveStatus() === 'connected'` and unchanged account scope (else `phone.reload.notConnected`); arm single-slot `reloadIntent` {profile=`getAuthStateDir()`, account, sessionId, actor, chat, "expires: now + 30 000"}; then `try { await ctx.reload(); } finally { clear intent if still armed }` and return with nothing after (no catch, so Pi keeps diagnostics), in src/services/whatsapp-command.router.ts
- [X] T009 [US1] Add `publishReload(reason)`: take-and-clear intent; if `reason === 'reload'` and unexpired, store in global map keyed by profile (prune expired, "at most 10 entries"); otherwise delete this profile's entry, in src/services/whatsapp-command.router.ts
- [X] T010 [US1] Add `consumeReload(reason, ctx)`: get+delete profile entry before validating; ignore unless `reason === 'reload'`; validate per data-model then `resume(current, account)` with `current` bound to operator revision, owner, allowed chat, sessionId; send `phone.reload.ready` only if true and `current()`, in src/services/whatsapp-command.router.ts
- [X] T011 [US1] Wire lifecycle: in `session_shutdown(event)` call `phoneControls.publishReload(event.reason)` before `reset()`/`whatsappService.stop()`; in `session_start(event, ctx)` add, after the existing auto-connect block (`await tryConnect()`, `whatsapp-ng.ts:727`) and `syncManagedSpeech()` and guarded by `startupLifecycle === managedLifecycle`, `void phoneControls.consumeReload(event.reason, ctx)`; pass a `cancelAutoConnectRetry` port bound to `cancelStartupRetry()`; `consumeReload` validates synchronously, calls that port only for a valid handoff before any await, then calls `resume` (ordering: specs/045-phone-reload/research.md R3), in whatsapp-ng.ts
- [X] T012 [US1] Add `phone.help.cmd.reload` under "WhatsApp and process" in `helpText` in src/services/whatsapp-command.router.ts

## Phase 4: User Story 2 — Unauthorized or unsafe requests refused (P1)

**Goal**: no reload for non-owner, group, cancel, expiry, replay, busy, pending; localized explanation; connection stays up.
**Independent test**: each case asserts `ctx.reload` not called, expected reply, no stop/off port call.

- [X] T013 [P] [US2] Router tests: non-owner → `phone.denied`; group (owner) → `phone.reload.privateOnly`; cancel → `phone.cancelled`; expired ticket (fake timers past 15 000 ms) and replayed token → `phone.reload.expired`/terminal warning; busy or `hasPendingMessages()` at confirm and at gateway → `phone.busy`; WhatsApp connecting/disconnected or account changed at confirm and at gateway → `phone.reload.notConnected`; manual `/whatsapp --internal control-reload <random uuid>` → warning only; never `ctx.reload`, `stop` or `off`, in tests/unit/whatsapp-command.router.test.ts
- [X] T014 [US2] Re-check group (`SessionManager.isGroupJid`) and `connected` status at confirm in `apply`; implement gateway rejection replies (`phone.reload.notConnected`, (`phone.busy` / `phone.reload.expired` when frame current, else terminal notify) in src/services/whatsapp-command.router.ts
- [X] T015 [P] [US2] Locale test: all 9 new keys listed in contracts/phone-reload.md present and non-English in pt-BR, es, fr; menu and refusals rendered without English leakage, in tests/unit/phone-menu-i18n.test.ts

## Phase 5: User Story 3 — Safe handoff and failure handling (P2)

**Goal**: stale/changed/Off/terminal-reload/failure never reconnect or reply; diagnostics retained.
**Independent test**: each altered condition → `resume` not called (or returns false) and no `phone.reload.ready`.

- [X] T016 [P] [US3] Router tests: handoff rejected when expired (>30 000 ms), profile/sessionId differ, owner revoked, chat disallowed, or `resume` returns false due to explicit Off; consumed handoff replayed → ignored; `publishReload('quit'|'new')` or reload shutdown without armed intent discards existing entry; `consumeReload('startup', ctx)` discards and does nothing; an outbound send with uncertain delivery in flight at reload is never resent by either runtime; `ctx.reload()` rejecting propagates the error, clears the intent and leaves no handoff, in tests/unit/whatsapp-command.router.test.ts
- [X] T017 [P] [US3] Router test: `resume` false → terminal notify and exactly one `phone.reload.failed` attempt only when `current()`; uncertain delivery not repeated; no second `resume`, in tests/unit/whatsapp-command.router.test.ts
- [X] T018 [US3] Implement failure branch in `consumeReload`: terminal notify telling the operator to reconnect WhatsApp from the terminal (saved auto-connect retries were cancelled for this start), single best-effort `phone.reload.failed` via existing `reply` semantics, no retry, in src/services/whatsapp-command.router.ts
- [X] T019 [US3] Mandatory production-entry RPC test through actual `whatsapp-ng.ts` hooks: phone `/reload` → shutdown(reload) → start(reload) yields one socket start (also with saved auto-connect on and a pending retry), one `phone.reload.ready`, unchanged session id/config; ordinary terminal reload yields no resume or reply, in tests/unit/phone-control.rpc.test.ts. Required race cases (synthetic socket and real timers; the plan said fake timers): (a) first auto-connect attempt fails, retry timer pending at consume → retry never fires, one `start()` from `resume`; (b) retry fired and `start()` in flight at consume → joined, total socket starts = 1 [annotated: unreachable with research R3 ordering, see plan D4; implemented as the first auto-connect socket still opening at consume, RPC `reload-auto`]; (c) invalid handoff → retry timer still fires normally; (d) valid handoff and `resume` fails → no further automatic attempt, terminal reconnect notice. If the fixture cannot drive `ctx.reload()`, extend tests/fixtures/ production-entry adapters first — a missing fixture is a blocker, not a waiver

## Phase 6: Polish

- [X] T020 [P] Document phone `/reload` (owner-only, private chat, idle requirement, ack meaning) in README.md and docs/reference.md
- [X] T021 [P] Add CHANGELOG.md entry
- [X] T022 Run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`; record results in specs/045-phone-reload/quickstart.md

## Phase 7: Review fixes (2026-11-11, second pass)

- [X] T023 Records: Complexity Tracking D1–D5 in specs/045-phone-reload/plan.md and the test-history note in this file (G1, G2, C1)
- [X] T024 [US3] R2: add a failing regression (Off-then-Connect during the post-reload reconnect wait gets no acknowledgment) in tests/unit/whatsapp-command.router.test.ts, then bind an Off generation port in `consumeReload` in src/services/whatsapp-command.router.ts and whatsapp-ng.ts
- [X] T025 [US3] R3: add a failing regression (an already-connected different account refuses before cancelling retries or reconnecting; a mismatch found after reconnect retires the reload's own socket and sends no acknowledgment) in tests/unit/whatsapp-command.router.test.ts, then implement in src/services/whatsapp-command.router.ts and whatsapp-ng.ts
- [X] T026 [US2] R1: add a failing regression (`/compact` started after confirmation blocks the gateway) in tests/unit/whatsapp-command.router.test.ts, then record the confirming lock token in the reload ticket and refuse any other held lock in src/services/whatsapp-command.router.ts
- [X] T027 [US3] T1: real-entry `reload-off` run (terminal Off then Connect while the reload's reconnect socket is still opening, so no acknowledgment) in tests/unit/phone-control.rpc.test.ts, with a fixture delayed-open switch in tests/fixtures/phone-control-baileys.mjs

- [X] T028 [US3] B1: failing unit regressions first (retire only the exact socket this reload's `resume` started, only while `current()` holds; never an auto-connect or operator socket; never after Off then Connect). `resume` reports ownership through `onOwned(socket)`, and `retire(socket, current)` stops only if that exact socket is still active and the request is not Off, in src/services/whatsapp-command.router.ts and whatsapp-ng.ts
- [X] T029 [US3] B2: real-entry RPC `reload-account` (cleanup of the reload-owned socket) and `reload-account-auto` (refusal: the auto-connect socket is kept), both preserving `auth/creds.json`, the config auto-connect setting, owner and allow-list, and the Pi session; fixture switch `WA_PHONE_RPC_ACCOUNT_STARTS` in tests/fixtures/phone-control-baileys.mjs. The run exposed a failure notice being sent over the other account; a failing unit regression was added first, then the notice was restricted to the requesting account

- [X] T030 [US3] G-M1: real-entry `reload-offrace` in tests/unit/phone-control.rpc.test.ts with a test-only 100 ms poll gate in tests/fixtures/phone-control-preload.mjs and `hold-polls`/`release-polls` in tests/fixtures/phone-control-rpc.extension.ts
- [X] T031 [US2] G-M2: real-entry `reload-busy` (gateway deferred during `agent_settled`, a group `/think` reply held via a group-send gate in tests/fixtures/phone-control-baileys.mjs)

### Review-fix test history (observed, 2026-11-11)
- T024 R2: the unit regression failed before the Off-generation binding and passes after.
- T025 R3: both mismatch regressions failed before the fix and pass after. The same-account no-retire guard passed before and after; it guards against over-retiring and is not a failing-first test.
- T026 R1: the first regression used `/compact` in the same chat. It failed for the wrong reason, because the owner's command voids its own frame, so it was rewritten to use another allowed chat (a group). It fails when the lock check is removed and passes with it.
- T027 T1: real-entry `reload-off` passed on its first run. Reverting the R2 fix leaves it passing, because real Off makes `resume` return false before Connect, so this run proves Off blocks reconnection and acknowledgment end to end but does not tell R2 apart; R2 rests on the unit regression only. No other way to drive the timing was found without injecting it into production code.

- T028 B1: three unit regressions failed before the ownership fix (exact socket retired; not-started socket kept; authority changed means no retire) and pass after.
- T029 B2: `reload-account` passed on its first run. `reload-account-auto` failed on its first run because of a real defect (the failure notice was sent through the other account's socket). The unit regression "never sends the failure notice over a different account" failed before the fix and passes after. Mutation check: restoring ownership-blind retirement makes `reload-account-auto` fail, so that run guards B1 at the real entry.
- T030/T031 (fourth pass): both runs were written after their guards existed, so they could not fail first. Mutation checks: removing the R2 Off-generation guard makes `reload-offrace` fail (the failure notice is sent); removing the R1 lock check makes `reload-busy` fail (no `phone.busy`, the reload proceeds). After restoring both, they pass, and passed 3 of 3 repeated runs.

### Coverage by proof tier
| Fix | Unit | Real entry |
|---|---|---|
| R1 | yes, failed first | `reload-busy` (fourth pass, mutation-checked) |
| R2 | yes, failed first | `reload-offrace` (fourth pass, mutation-checked; observable is the failure notice, see plan G-M1) |
| R3 refusal / B1 ownership | yes, failed first | `reload-account-auto` (mutation-checked) |
| R3 cleanup | yes, failed first | `reload-account` (passed first run) |
| Same-account failure notice | yes, failed first | `reload-account-auto` |

## Dependencies

- T001 → T002, T003 → US1 (T004–T012) → US2, US3 (both build on gateway/consume) → Polish.
- US2 and US3 can proceed in parallel after US1.
- Tests (T004/T005, T013, T016/T017) precede their implementation tasks.
- T019 is a release gate for the feature; it cannot be skipped or replaced by documentation.

## Parallel Examples

- US1: T004 ∥ T005 (same file but independent test blocks; serialize if editing conflicts).
- US2: T013 ∥ T015.
- US3: T016 ∥ T017 ∥ T019 fixture extension.
- Polish: T020 ∥ T021.

## Implementation Strategy

MVP = Phases 1–3 (owner reload end-to-end). Then US2 refusals, then US3 hardening, then docs and full validation.
