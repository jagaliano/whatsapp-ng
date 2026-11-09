# Tasks: WhatsApp Processing Reaction

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/processing-indicator.md](contracts/processing-indicator.md), [quickstart.md](quickstart.md)

**Tests**: Required. Regression tests are written and observed failing before each implementation task (repository validation rules, spec Assumptions).

**Format**: `- [ ] T### [P?] [US#] Description with file path`. `[P]` = different files, no dependency on an incomplete task.

**Constraints for every task**: no commit/push/branch change; synthetic data only; no new dependencies/settings/menu changes; no live WhatsApp calls; no retries or fallback sends; log metadata only (no ids, JIDs or text).

## Phase 1: Setup

- [X] T001 Read `whatsapp-ng.ts` (message callback ~L751, `trackOwnedSend`, `message_start`, `agent_end`, `session_*`, Off/shutdown paths, `send_reaction` tool), `src/services/conversation-router.service.ts` (`prepare`, `consume`, `abortRetiredInput`, `retireExpiredPending`, `reset`), `src/services/reaction.sender.ts`, `src/services/whatsapp.service.ts` (`reactionUpdate`, reaction intake ~L1167, `messages.reaction` listener ~L580, `findMessageKey`, `isSessionContextCurrent`) and the mirrored tests `tests/unit/whatsapp-ng.message-end.test.ts`, `tests/unit/conversation-router.service.test.ts`, `tests/unit/reaction.sender.test.ts`, `tests/unit/whatsapp.service.lifecycle.test.ts`, `tests/unit/whatsapp.service.intake.test.ts` to confirm hook points; record any plan mismatch in `specs/043-whatsapp-processing-reaction/plan.md` before coding.

## Phase 2: Foundational (blocks all stories)

- [X] T002 [P] Write failing unit tests in `tests/unit/processing-indicator.service.test.ts` for the contract in [contracts/processing-indicator.md](contracts/processing-indicator.md): `start` creates one record per exact key and fires one `⏳` add without awaiting; duplicate `start` is a no-op; stale context at `start` sends nothing; `markConsumed`/`finishRun` remove once; `settle(key)`; `settleAll()` removes only while context current; `discardAll()` never egresses; removal requested before add settles is chained after the add (single attempt); send rejection/`success:false` logs once with no ids and never throws or retries; method calls never throw; capacity: with 500 live records `start` creates no record and sends nothing (one metadata-only log), and a slot freed by removal/discard/withdrawal is reusable.
- [X] T003 Create `src/services/processing-indicator.service.ts`: class `ProcessingIndicator` with injected ports `react(key, emoji)`, `isCurrent(context)`, `log(message)`; records per [data-model.md](data-model.md) (`id` = JSON tuple `[remoteJid, id, fromMe, participant]`, key copy, captured `WhatsAppSessionContext`, `added` promise, state `active | superseded | settled` plus a separate `consumed` flag; "at most one add and one removal attempt"; "hard capacity of 500 live records", records deleted when settled); methods `start`, `markConsumed`, `finishRun`, `settle`, `settleAll`, `discardAll`, `supersede`, `observeOwnReaction` per contract (all synchronous, never throw, never await egress; recheck `isCurrent` before every egress). Strict types, `.js` local imports. Make T002 pass.
- [X] T004 Add optional `onRetired: (key: WAMessageKey) => void = () => {}` constructor callback to `ConversationRouter` in `src/services/conversation-router.service.ts`, fired exactly once per pending request that leaves `pending` without consumption at these branches only (research R9): `observeInput` interactive/rpc deletion (~L109), non-extension source deletion (~L112), `isRetiredInput` admission-invalid retirement (~L329), `retireExpiredPending` (~L344). Do NOT fire from `abortRetiredInput` or `reset()`. Write failing cases first in `tests/unit/conversation-router.service.test.ts`, including an at-most-once assertion across retirement then `abortRetiredInput`; existing constructor callers and behavior unchanged.
- [X] T005 Wire a `ProcessingIndicator` instance in `whatsapp-ng.ts` next to `router` creation (~L128): `react` uses `ReactionSender` with the active socket and the stored exact key (`key` option, emoji `⏳` or `''`), `isCurrent` = `whatsappService.isSessionContextCurrent`, `log` = existing `logger`; pass `key => indicator.markConsumed(key)` alongside the existing `markIncomingProcessing(key,'consumed')` onConsumed callback and `key => indicator.settle(key)` as `onRetired`. No behavior change yet beyond wiring.

**Checkpoint**: service unit tests and router tests pass; entry still behaves as before.

## Phase 3: User Story 1 - See that a request is being worked on (P1) 🎯 MVP

**Goal**: ⏳ appears on the exact admitted message (direct and group, including queued while busy) and is removed once when its run ends; intermediate tool-call messages do not remove it.

**Independent Test**: Quickstart checks 1, 3 and 5 in [quickstart.md](quickstart.md).

- [X] T006 [US1] Add failing entry-level tests in `tests/unit/whatsapp-ng.message-end.test.ts` (reuse its `setup`/`incoming`/`submit`/`finalTurn` helpers): admitted direct message → exactly one `⏳` add with the exact key; group message → key includes participant; queued message accepted while a run is active gets `⏳` immediately; tool-call `message_end`/`turn_end` do not remove; `agent_end` removes once per consumed key; ambiguity refusal (combined A/B) removes both after the fixed notice; failed final delivery still removes.
- [X] T007 [US1] In `whatsapp-ng.ts` message callback, call `indicator.start(msg.key, msg.sessionContext, admissionCurrent)` — the same `msg.key` object passed to `router.prepare`, unmodified — immediately after `pi.sendUserMessage(...)` / `markIncomingProcessing(msg.key,'handed-off')` (~L848); never before any refusal path; use the same key fields (`remoteJid`, `id`, `fromMe`, `participant`) the router receives, never reconstructed from digits. Make T006 add cases pass.
- [X] T008 [US1] In `whatsapp-ng.ts` `agent_end` handler (~L1340), call `indicator.finishRun()` after the existing `router.endRun(...)` so it runs after `turn_end` final delivery/ambiguity notice has been awaited; make remaining T006 removal cases pass.

**Checkpoint**: US1 independently demonstrable (MVP).

## Phase 4: User Story 2 - No stray or misplaced indicators (P2)

**Goal**: ⏳ only for admitted requests; per-request independence; cleanup on withdraw/reset; nothing sent after Off/logout/account change; explicit and verified own-account reactions take best-effort precedence.

**Independent Test**: Quickstart checks 2, 4, 6, 9 and 10.

- [X] T009 [US2] Add failing entry-level tests in `tests/unit/whatsapp-ng.message-end.test.ts`: no reaction call for system event, phone-control command, foreign own-echo, group-policy/admission refusal, stale session context, duplicate delivery, history/append import; two overlapping chats clear only their own key; abort/retired input removes its `⏳` when context is current; `session_before_switch`/`session_start` reset settles while current; Off, `session_shutdown` and graceful shutdown discard with zero reaction calls; account/generation change before removal → no call; logout (simulate `WhatsAppService.logout()` generation increment / `isSessionContextCurrent` false) during a run → zero reaction calls at `agent_end`.
- [X] T010 [US2] In `whatsapp-ng.ts` call `indicator.settleAll()` on `session_before_switch` and `session_start` resets, and `indicator.discardAll()` in `turnWhatsAppOff`, `session_shutdown` and the graceful-shutdown `stop` handler — always before `router.reset()` / `whatsappService.stop()` as appropriate so Off never egresses. Logout needs no hook: it is fenced by the generation check (research R3, `src/services/whatsapp.service.ts:1330`, triggered from `src/ui/menu.handler.ts:144`). Make T009 cases pass.
- [X] T011 [US2] Add failing tests in `tests/unit/whatsapp-ng.message-end.test.ts` (after T009, same file) for the explicit tool: `send_reaction` on a message with an active indicator calls `supersede` synchronously, sends immediately even while the ⏳ add is pending (no wait), and afterwards no automatic add/removal is sent for that key; explicit removal (`''`) also supersedes; other messages' indicators unaffected.
- [X] T012 [US2] In the `send_reaction` tool in `whatsapp-ng.ts` (~L1020), after resolving the exact key via `whatsappService.findMessageKey` and before sending, call `indicator.supersede(key)` (synchronous, no await, no timeout); `ReactionSender` unchanged. Make T011 pass.
- [X] T013 [P] [US2] Add failing tests in `tests/unit/whatsapp.service.intake.test.ts` and `tests/unit/whatsapp.service.lifecycle.test.ts`: a verified own-account reaction (raw upsert and `messages.reaction`) on a tracked key with text other than `⏳`, including `''` removal, invokes the observer; own `⏳` echo does not; foreign actor reaction does not; history reconciliation results are byte-for-byte unchanged and no Pi prompt occurs.
- [X] T014 [US2] In `src/services/whatsapp.service.ts` add a narrow `setOwnReactionObserver(observer)` port and call it from the raw reaction branch (~L1167) and the `messages.reaction` listener (~L580) only after existing `messageStore.reconcile`, only when the actor resolves to the connected account (`isOwnJid` / `fromMe`), passing the target key and reaction text; wire it to `indicator.observeOwnReaction` in `whatsapp-ng.ts`. No change to reconciliation, filtering or prompting. Make T013 pass.

**Checkpoint**: US1+US2 pass together; no stray indicators.

## Phase 5: User Story 3 - Indicator never harms delivery (P3)

**Goal**: failures or slowness of the cosmetic reaction never alter prompt hand-off, reply, routing or history.

**Independent Test**: Quickstart checks 7 and 8.

- [X] T015 [US3] Add failing tests in `tests/unit/whatsapp-ng.message-end.test.ts`: reaction send rejects, returns `delivery:'unknown'`, or never resolves → `pi.sendUserMessage` is still called synchronously with the same content, final reply delivered with identical calls, zero retries, zero extra `sendMessage` calls, log line contains no ids/JIDs/text; router reply-suppression accounting (`beginSend`/`finishSend`) is not touched by reactions.
- [X] T016 [US3] Add failing regression in `tests/unit/whatsapp.service.lifecycle.test.ts` / `tests/unit/whatsapp.service.intake.test.ts`: echo of the extension's own `⏳` add and removal does not prompt Pi and history reconciliation matches the existing behavior.
- [X] T017 [US3] Fix any gaps T015/T016 expose (e.g. ensure `void` fire-and-forget with caught rejections and a single metadata-only log in `src/services/processing-indicator.service.ts`; no change to `whatsapp.service.ts` filtering). Make T015/T016 pass.

**Checkpoint**: all stories pass independently and together.

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Update `README.md` (feature overview) and `docs/reference.md` (when ⏳ is added/removed, best-effort nature, precedence of explicit/own-account reactions, accepted races, no setting, not persisted, WhatsApp-only) with links, no duplicated rolling counts.
- [X] T019 [P] Add a `CHANGELOG.md` entry (no version bump unless requested) and update `docs/menu-diagrams.md` only if it mentions reactions (expected: no change); update `specs/README.md` index entry for `043-whatsapp-processing-reaction`.
- [X] T020 Run `npx vitest run tests/unit/processing-indicator.service.test.ts tests/unit/conversation-router.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/whatsapp.service.lifecycle.test.ts tests/unit/whatsapp.service.intake.test.ts tests/unit/reaction.sender.test.ts` in an isolated HOME/`PI_CODING_AGENT_DIR` with `WHATSAPP_NG_LOCALE=en`; then `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`; check changed Markdown links. Report exact commands, results and skips.
- [X] T021 Exercise the production entry once with `pi --no-extensions -e ./whatsapp-ng.ts` (or the existing production-entry RPC fixtures in `tests/unit/phone-control.rpc.test.ts`) in an isolated environment to confirm the extension loads and no `extension_error` appears; do not reload or terminate the live Pi process, and do not use a real account. Live WhatsApp confirmation stays a separate operator check.

## Validation evidence — 2026-11-09

Source validation on macOS (Darwin x86_64), Node v26.13.0, Pi 1.5.0. No dependency installation, real-account operations, publication, branch changes or commits. Requirements checklist remained read-only.

Commands used a credential-free allow-listed environment (`env -i`, PATH/TMPDIR only inherited), disposable HOME and `PI_CODING_AGENT_DIR` under ignored `.pi/cache/043-validation/`, `WHATSAPP_NG_LOCALE=en`, `PI_OFFLINE=1`. Offline alone is not a sandbox; the production-entry RPC fixtures additionally install their existing network guards and synthetic socket/provider boundaries.

- Red first: missing indicator import; then six retirement-callback failures; 14 entry lifecycle/precedence failures; four own-reaction observer failures; one revoked-admission deferred-cleanup failure. All resolved with affected suites passing.
- `./node_modules/.bin/vitest run tests/unit/whatsapp-ng.message-end.test.ts tests/unit/whatsapp.service.lifecycle.test.ts tests/unit/whatsapp.service.intake.test.ts tests/unit/processing-indicator.service.test.ts tests/unit/conversation-router.service.test.ts tests/unit/reaction.sender.test.ts tests/unit/namespace-contract.test.ts --maxWorkers=2`: **271 passed**.
- `npm test -- --maxWorkers=2`: **2004 passed / 89 files, no skips**. The first full run exposed a namespace-provenance wording violation and the old synthetic socket's text-only echo/ID assumptions; attribution now links to the existing README, and the fixture separately records reaction echoes with synthetic IDs.
- `./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\\(self-auto\\)' --maxWorkers=2`: **1 passed, 24 deselected** (subsequent full suite ran all 25). Actual Pi entry asserts original LID target, one final text echo plus two reaction echoes, no extra model request/extension error, and zero guarded network attempts.
- `npm run lint` and `npm run typecheck`: **passed**, rerun after final test annotations. Typecheck covers production source, not tests.
- `node --check tests/fixtures/phone-control-baileys.mjs`: **passed**; fixture MJS is outside declared lint scope and additionally exercised by production-entry RPC.
- Active LSP scan covered ten changed TypeScript files. New inferred-test callback warnings were corrected; pre-existing inferred-project warnings in `whatsapp.service.intake.test.ts` (old Vitest Mock generics) are not resolved by this feature.
- Final changed entry suite after type-only test annotations: **132 passed**.
- `git diff --check`: **passed**. Local Markdown link/anchor check: **12 files, 71 links, no errors**.
- Live WhatsApp visual/delivery confirmation and fresh Linux/Windows qualification were **not run**. Operator reload remains pending; the active Pi process was not reloaded or stopped.

### Follow-up diagnostic cleanup — 2026-11-09

User-requested before release: `eslint.config.js` now scopes the existing Node globals to fixture MJS as well as TypeScript, with two regression tests in `tests/unit/eslint-config.test.ts` proving undefined-name checks remain enabled and globals do not leak into unrelated JS. Updated the two old Vitest Mock declarations in `tests/unit/whatsapp.service.intake.test.ts`; intentional lazy-UI `Reflect.get` policy findings are unchanged.

- Regression observed failing first on the missing fixture globals, then **33 targeted tests passed**.
- `npm test -- --maxWorkers=2`: **2006 passed / 90 files, no skips** in the same isolated environment.
- `npm run lint`, `npm run typecheck`, `./node_modules/.bin/eslint tests/fixtures/phone-control-baileys.mjs`, `node --check tests/fixtures/phone-control-baileys.mjs`, `git diff --check`: **passed**.
- Active LSP scan: no current findings on the four cleanup paths; two push-only probes inconclusive, so CLI checks above are the authoritative evidence.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories → Phase 6.
- Phase 2: T002 → T003; T004 [P with T002/T003]; T005 after T003 and T004.
- US1 (T006→T007→T008) is the MVP and needs Phase 2.
- US2 needs US1's wiring (T007/T008) for entry tests; T009 → T011 (same test file); T013 [P] with T011; T012 after T011; T014 after T013 and T005.
- US3 needs US1 and T014 (echo behavior); T016 after T013 (same files); T015/T016 are written before T017.
- Polish after all stories; T020 then T021 last.

## Parallel Examples

- Phase 2: T002 (service tests) and T004 (router callback + tests) touch different files.
- US2: T011 (`whatsapp-ng.message-end.test.ts`) and T013 (`whatsapp.service.*.test.ts`) in parallel once T009 is done.
- Polish: T018 and T019 docs in parallel.

## Implementation Strategy

- **MVP**: Phase 1–2 + US1 (T001–T008): ⏳ on admission, removal at run end.
- **Increment 2**: US2 (T009–T014) for safety fences and precedence.
- **Increment 3**: US3 (T015–T017) delivery-isolation proofs, then Polish.
- Failing test first for every behavior; stop and report if a plan assumption (hook point, router callback semantics) proves wrong.
