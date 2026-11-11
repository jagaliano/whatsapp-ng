# Tasks: Autonomous Answer Forwarding

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/autonomous-forwarding.md](contracts/autonomous-forwarding.md), [quickstart.md](quickstart.md)

**Tests**: Required; each behavior's regression is written and observed failing before its implementation task.

**Format**: `- [ ] T### [P?] [US#] Description with file path`. `[P]` = different files, no dependency on an incomplete task.

**Constraints for every task**: no commit/push/branch change; synthetic data only; no real credentials or conversation data; no new dependencies; no live WhatsApp or provider calls; no retry, replay, fallback or voice for autonomous answers; metadata-only logs; `getControlOrigin()` results and OwnerAuthorization behavior unchanged; existing separately enabled terminal forwarding unchanged.

**Already done (research R1a, 2026-11-09)**: host classification observed through the real Pi entry with the test-only `classify` scenario (`tests/unit/phone-control.rpc.test.ts`, `tests/fixtures/phone-control-rpc.extension.ts`). Implementation tasks extend it rather than recreate it.

## Phase 1: Setup

- [X] T001 Re-read `src/services/conversation-router.service.ts` (consume/freeze/getControlOrigin/takeTerminalAnswer/buffer), `src/services/optional-output.service.ts`, `src/ui/optional-output-settings.view.ts`, `whatsapp-ng.ts` (optionalOutputs policy ~L229, `agent_start`, `message_start`, `turn_end` forwardTerminal call, `agent_end`), `src/services/session.manager.ts` (getOptionalOutputs/setOptionalOutputs, getAllowedGroups, getBoundGroup), `src/i18n.ts` menu.optional keys, and mirrored tests `tests/unit/conversation-router.service.test.ts`, `tests/unit/optional-output.service.test.ts`, `tests/unit/optional-output-settings.view.test.ts`, `tests/unit/session.manager.test.ts`, `tests/unit/whatsapp-ng.message-end.test.ts`, `tests/unit/terminal-menu-i18n.test.ts`; confirm hook points and record any mismatch in `specs/044-autonomous-answer-forwarding/plan.md` before coding.

## Phase 2: Foundational (blocks all stories)

- [X] T002 [P] Add failing validator tests in `tests/unit/optional-output.service.test.ts` for `validateOptionalOutputs`: `autonomous` absent = Off; accepts `{ kind: 'owner', jid, ownerJid, accountScope }` with owner `jid` matching `^\\d+@(s\\.whatsapp\\.net|lid)$` and equal to `ownerJid`; accepts `{ kind: 'group', jid, ownerJid, accountScope }` with `jid` matching `^\\d+(-\\d+)?@g\\.us$`; `ownerJid` and `accountScope` (1–256 chars) required for both kinds; rejects missing `ownerJid`/`accountScope`, unknown keys, other kinds, a group `jid` for kind owner and vice versa; existing `terminal`/`imageTools` cases unchanged; `terminal` and `autonomous` are independent.
- [X] T003 Extend `OptionalOutputs` and `validateOptionalOutputs` in `src/services/optional-output.service.ts` with the `AutonomousConsent` shape per [data-model.md](data-model.md) (`kind: 'owner' | 'group'`; `ownerJid` and `accountScope` required for both kinds; owner `jid` must equal `ownerJid`; `accountScope` 1–256 chars); allow the `autonomous` key; keep every existing rule. Make T002 pass.
- [X] T004 [P] Add failing round-trip tests in `tests/unit/session.manager.test.ts`: `setOptionalOutputs` persists/reloads `autonomous` atomically with the expected-revision check, revision bumps, malformed saved `autonomous` yields the existing invalid-settings outcome (nothing forwarded). Make them pass; change `src/services/session.manager.ts` only if its serialization rejects the new key.
- [X] T005 [P] Add failing router tests in `tests/unit/conversation-router.service.test.ts` for `isAutonomous(snapshot)` per research R1/R1b: true only when the run-start marker is `custom` and every consumed input has role `custom`; false for a user-started run, an `extension` user message, terminal input, a WhatsApp request, a WhatsApp request followed by a queued custom message in the same epoch (mixed), a custom message followed by user input, no inputs, expired/stale snapshots; `getControlOrigin()` still returns `'unknown'` for autonomous turns and OwnerAuthorization still refuses them.
- [X] T006 Implement in `src/services/conversation-router.service.ts`: a run-start marker setter (`noteRunStart(type: 'user' | 'custom' | undefined)`, cleared in `endRun`/`reset`), an epoch source `autonomous` added by `consume()` for role `custom` messages (still `unowned`), `isAutonomous(snapshot)` (current, exact epoch, sources exactly `{autonomous}`, marker custom) and a generalized claim `takeLocalAnswer(kind: 'terminal' | 'autonomous', destinationJid)` that keeps the claimed-response, `coveringSend` and eligibility checks of `takeTerminalAnswer` (which delegates to it, behavior unchanged). Do not change `getControlOrigin` output. Make T005 pass.
- [X] T007 Wire in `whatsapp-ng.ts`: call `router.noteRunStart(event.messageType)` from a `before_agent_start` handler (ignore unknown values) without altering existing handler behavior; expose `router.isAutonomous` to `OptionalOutputService` through its dependencies. No forwarding yet.

**Checkpoint**: validator, persistence and classification tests pass; no behavior change for existing flows.

## Phase 3: User Story 1 - Receive background results on WhatsApp (P1) 🎯 MVP

**Goal**: an eligible autonomous final answer reaches the owner's private chat exactly once, as text.

**Independent Test**: quickstart items 1 and 6; classification table in research R1a.

- [X] T008 [US1] Add failing service tests in `tests/unit/optional-output.service.test.ts` for `forwardAutonomous()` with owner consent: one text send via the existing `send` dependency to the owner; only the final answer (tool-call/intermediate/error/aborted messages not sent); Off or absent consent sends nothing; text only (no voice/content/Mirror even when the destination chat prefers voice); duplicate lifecycle callbacks send once; explicit send already covering the same epoch/destination suppresses it; terminal-origin and WhatsApp-origin frames never use it; existing `forwardTerminal` cases unchanged and still owner-only with its own consent.
- [X] T009 [US1] Implement `forwardAutonomous()` in `src/services/optional-output.service.ts` beside `forwardTerminal()`: require `isAutonomous(snapshot)`, consent kind owner whose `ownerJid` equals the policy's current owner and `accountScope` equals the policy scope, then claim via `takeLocalAnswer('autonomous', jid)` and send through the existing `deliver()` text path; extend `Frame.origin` handling so `current()` applies the same Off/connection/session/revision checks; do not touch `FinalOutputCoordinator`. Make T008 pass.
- [X] T010 [US1] Add failing production-entry unit tests in `tests/unit/whatsapp-ng.message-end.test.ts`: a custom-started run with only custom inputs and owner consent sends one text to the owner's JID with `preserveTransport` semantics matching terminal forwarding, records it in recents once; no `trackOwnedSend` double accounting; ordinary WhatsApp-owned runs unchanged.
- [X] T011 [US1] In `whatsapp-ng.ts` extend the `optionalOutputs` policy (~L229) with the autonomous consent fields and call `await optionalOutputs.forwardAutonomous()` next to `forwardTerminal()` in `turn_end` before the WhatsApp mirror; keep `terminalCurrent` semantics for terminal only. Make T010 pass.
- [X] T012 [US1] Extend the production-entry scenario `classify` in `tests/unit/phone-control.rpc.test.ts` (config seeded with disposable owner autonomous consent) to assert: custom wake-up → exactly one text to the owner; `sendUserMessage`, terminal prompt and mixed WhatsApp+custom runs → no autonomous send (mixed still sends only its existing WhatsApp-owned reply); add two not-yet-observed real-host scenarios (research R1a addendum): (a) a custom message steered (`deliverAs: 'steer'`) into an active terminal run and (b) a terminal run that also consumes a queued custom message — record actual host events first, then assert both are excluded from autonomous forwarding while existing routing and separately enabled terminal forwarding are unchanged (stop and report if host labels contradict the design); zero extension errors and zero network attempts. Seed consent only through the disposable `config.json` fixture, never a real profile.

**Checkpoint**: US1 independently demonstrable (MVP).

## Phase 4: User Story 2 - Choose and understand the destination (P2)

**Goal**: terminal settings select Off / owner / one allowed group with disclosure; group delivery works and is eligibility-checked.

**Independent Test**: quickstart items 2 and 7.

- [X] T013 [P] [US2] Add failing view tests in `tests/unit/optional-output-settings.view.test.ts`: menu shows a **Background answers** entry; Off → owner by default (no group prompt); missing verified owner warns and changes nothing; choosing a group lists only allowed groups (none → notice), requires the disclosure confirm (all members can see potentially sensitive background results) and declining leaves settings unchanged; choosing Off clears `autonomous` only; terminal forwarding and image tool choices stay independent; owner/revision change between dialog and save expires the request without saving (existing `expireSettingsRequest` pattern); Back destinations unchanged.
- [X] T014 [US2] Implement the **Background answers** flow in `src/ui/optional-output-settings.view.ts` (extend `OptionalOutputSettingsActions` with `groups(): Array<{ jid: string; label: string }>`; save through `session.setOptionalOutputs(settings, revision, current)`; consent records `ownerJid`/`accountScope` via `actions.owner()` and rechecks them after the confirm). Make T013 pass.
- [X] T015 [P] [US2] Add the new menu/disclosure/status keys to all four locales in `src/i18n.ts`; add failing completeness checks in `tests/unit/terminal-menu-i18n.test.ts` (all keys present, placeholders match, no English leftovers in pt-BR/es/fr). Update `menu.optional.status` to include the background-answer state. Make them pass.
- [X] T016 [US2] Wire the `groups` action and status text in `whatsapp-ng.ts` (allowed groups from `sessionManager.getAllowedGroups()`, bound-group mode restricts to the bound group).
- [X] T017 [US2] Add failing service tests in `tests/unit/optional-output.service.test.ts` for group consent: one text to the group JID; sends nothing when the group left the allowed list, is paused (`automaticReplies` false), differs from the consent `jid`, is not the bound group in group-only mode, or when the owner/account changed after consent; group membership grants no owner/settings authority (an `@g.us` participant cannot pass `OwnerAuthorization`). Extend `allowed` in the `whatsapp-ng.ts` optionalOutputs dependencies and `forwardAutonomous()` to evaluate group eligibility; make T017 pass.

**Checkpoint**: US1+US2 pass together.

## Phase 5: User Story 3 - Never misroute or leak (P3)

**Goal**: ambiguous, stale or ineligible cases produce no message; no replay or retry.

**Independent Test**: quickstart items 3–5.

- [X] T018 [US3] Add failing tests in `tests/unit/optional-output.service.test.ts`: no send after disconnect, Off, logout/account/session-generation change, settings revision change, consent withdrawn mid-turn; destination changed mid-turn (owner→group, group→owner, group→other group) sends nothing to either the old or new destination and nothing is replayed later; answers above 64 KiB stay local with the existing notice and nothing partial/split; unknown delivery produces the existing notice and no retry or second send; delivery rejection does not replay on later events; enabling consent mid-run exports nothing for the already-running turn (admission captured at input) and nothing earlier; capacity of 4 jobs not exceeded; malformed saved settings forward nothing.
- [X] T019 [US3] Fix gaps T018 exposes in `src/services/optional-output.service.ts` / `whatsapp-ng.ts` (reuse existing limits; no new retry paths). Make T018 pass.
- [X] T020 [P] [US3] Extend `tests/unit/whatsapp-ng.message-end.test.ts` with regressions that existing behavior is unchanged: WhatsApp-requested runs route as before; terminal forwarding (separately enabled, owner-only) still forwards terminal turns and never forwards autonomous turns, and autonomous forwarding never forwards terminal turns; both enabled → each sends only its own turn type; Off blocks both paths independently as today.

**Checkpoint**: all stories pass independently and together.

## Phase 6: Polish & Cross-Cutting

- [X] T021 [P] Update `README.md` and `docs/reference.md` (Optional outputs: background answers setting, owner/one-group choice, group disclosure, eligibility, text-only, 64 KiB local, no replay/retry, separate from terminal forwarding, how classification works and what stays local, limits) and `docs/menu-diagrams.md` (new Background answers panel, Back destination, group warning).
- [X] T022 [P] Add a `CHANGELOG.md` entry under Unreleased (no version bump) and a `specs/README.md` index row for `044-autonomous-answer-forwarding`.
- [X] T023 Run targeted suites then `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check` in the isolated environment (credential-free `env -i`, disposable HOME/`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`, `PI_OFFLINE=1`; quote PATH); check changed Markdown links/anchors; record exact commands, results and skips in `tasks.md` Validation evidence.
- [X] T024 Re-run the `classify` RPC scenario (`-t '\\(classify\\)'`) and confirm host classification still matches research R1a; run the full `tests/unit/phone-control.rpc.test.ts`. Do not reload or stop the live Pi process; live WhatsApp confirmation stays a separate operator check.

## Approved cron compatibility amendment (research R1c)

The 24 completed tasks above and their evidence describe the original custom-only implementation. The operator approved these additional tasks after reproducing the cron/user-message mismatch; they do not retroactively change the original results.

- [X] T025 Update this feature's spec, plan, research, data model, contract and quickstart for positively observed extension-origin user messages (including live-session cron), preserving control origin/owner denial and explicitly excluding headless/RPC-resume cron paths.
- [X] T026 Add and observe failing regressions in `tests/unit/conversation-router.service.test.ts`, `tests/unit/owner-authorization.service.test.ts`, `tests/unit/whatsapp-ng.message-end.test.ts` and the real-Pi RPC fixture/suite for exact extension proof, cron-style follow-up, first-input role, transformation/supersession/replay/expiry/scope/reset, pending/withdrawn WhatsApp priority and independent terminal forwarding.
- [X] T027 Extend only `src/services/conversation-router.service.ts` as needed: bounded latest-input terminal/extension proof, exact one-use digest/scope/TTL validation, known matching start and whole-run autonomous eligibility latch. Preserve existing routing/control-origin behavior and fail closed for all unmatched inputs.
- [X] T028 Extend service regressions as needed for proven extension input using the same first-input consent, owner/group destinations, revocation, no replay and text-only/size/capacity policy. Make affected suites and real Pi RPC checks pass.
- [X] T029 Update `README.md`, `docs/reference.md` and `CHANGELOG.md` to explain positive extension provenance, live cron compatibility and remaining limitations without claiming real-account acceptance.
- [X] T030 Run the actual Pi RPC regression under isolated tmux, the full RPC suite, repository tests/lint/typecheck, fixture syntax, Markdown link/anchor and diff checks. Record exact new results separately from earlier evidence; operator reload/live acceptance remain pending.

Dependencies: T025 → T026 (red) → T027/T028 (green) → T029 → T030. Preserve unrelated changes and do not inspect real credentials, start another real transport, install packages, modify installed cron, delegate or perform Git/release actions.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories → Phase 6.
- Phase 2: T002→T003; T004 and T005 [P] with T002; T006 after T005; T007 after T006.
- US1 (T008→T009; T010→T011→T012) needs T003, T006, T007. T010 after T009.
- US2: T013→T014; T015 [P] with T013; T016 after T014/T015; T017 after T009 and T016 (same service/entry files as US1).
- US3 needs US1+US2 service paths (T009, T017); T018→T019; T020 [P] with T018 (different test file).
- Polish after all stories; T023 then T024 last.

## Parallel Examples

- Phase 2: T002, T004, T005 (three different test files).
- US2: T013 (view test) and T015 (i18n) in parallel.
- Polish: T021 and T022 in parallel.

## Implementation Strategy

- **MVP**: Phases 1–2 + US1 (T001–T012): owner-only background forwarding with proven host classification.
- **Increment 2**: US2 (T013–T017): settings UI, group destination, disclosure, translations.
- **Increment 3**: US3 (T018–T020) fail-closed and unchanged-behavior proofs, then Polish.
- Failing test first for every behavior; stop and report if a plan assumption (hook point, host label) proves wrong. Never broaden autonomous eligibility to unowned/unknown turns.


## Validation evidence

Source checkout only, macOS, Node `v26.13.0`, installed Pi `1.5.0`, 2026-11-11. No installs, real accounts/providers, delegation or release/Git mutations. Existing test-only classification edits were extended, not replaced. Checklists were read-only (requirements: 16/16 checked); implementation Git hooks are disabled. Setup verified existing `.gitignore` / flat ESLint ignores and the package `files` allow-list: no ignore/config/dependency changes needed (no Docker/Prettier/Terraform/Helm setup detected).

All test/lint/typecheck commands below used this literal credential-free prefix from the repository root:

```sh
env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" HOME="$PWD/.pi/cache/044-implementation/home" PI_CODING_AGENT_DIR="$PWD/.pi/cache/044-implementation/home/agent" WHATSAPP_NG_LOCALE=en PI_OFFLINE=1
```

Disposable HOME was created with `mkdir -p .pi/cache/044-implementation/home`. RPC children additionally isolate their own HOME/agent directory and guard network calls; socket/provider results are synthetic. No live owning Pi process was reloaded or stopped.

### Gate before dependent production edits

Prefix plus `WA_PHONE_RPC_CLASSIFY_OUT="$PWD/.pi/cache/044-implementation/classification.json" ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify\)' --maxWorkers=2`: **1 passed, 25 name-filter skips**, 6.50 s. Steer and queued terminal+custom both started `user`, consumed `user` then `custom`, and remain excluded. Zero extension errors/network attempts. This new observation is separate from historical research R1a.

### Regression-first checkpoints

Each row names the exact command suffix after the prefix above. Counts are Vitest results, not shell wrapper exit statuses. Red runs establish the new regressions before the relevant production implementation.

| Command suffix | Red → passing evidence |
|---|---|
| `./node_modules/.bin/vitest run tests/unit/conversation-router.service.test.ts tests/unit/optional-output.service.test.ts tests/unit/session.manager.test.ts --maxWorkers=2` | 10 failed / 138 passed → 148 passed (13.82 s). No SessionManager source change needed. |
| `./node_modules/.bin/vitest run tests/unit/owner-authorization.service.test.ts --maxWorkers=2` | 24 passed (451 ms); autonomous eligibility never authorizes configuration. |
| `./node_modules/.bin/vitest run tests/unit/optional-output.service.test.ts --maxWorkers=2` | 32 failed / 16 passed → 48 passed (512 ms). Includes destination changes to neither target/no replay, first-input Off/invalid admission, limits, unknown delivery and separate terminal projection. |
| `./node_modules/.bin/vitest run tests/unit/whatsapp-ng.message-end.test.ts --maxWorkers=2` | Initial fixture failure also exposed persistent test Off state; fixed test cleanup. Corrected red run: 5 failed / 139 passed; after wiring and preserving unconfigured mock behavior: 144 passed (3.31 s). Includes bound-group eligibility and unchanged routing/terminal forwarding. |
| `./node_modules/.bin/vitest run tests/unit/optional-output-settings.view.test.ts --maxWorkers=2` | 8 failed / 6 passed before the panel. Additional Back/revision regression: 1 failed / 14 passed before the revision fence. |
| `./node_modules/.bin/vitest run tests/unit/terminal-menu-i18n.test.ts --maxWorkers=2` | 1 failed / 183 passed before new keys; explicit four-locale labels/placeholders verified after translations. |
| `./node_modules/.bin/vitest run tests/unit/optional-output-settings.view.test.ts tests/unit/terminal-menu-i18n.test.ts --maxWorkers=2` | Final 199 passed (2.22 s), no skips. |
| `WA_PHONE_RPC_CLASSIFY_OUT="$PWD/.pi/cache/044-implementation/forwarding-classification.json" ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(-terminal)?\)' --maxWorkers=2` | First attempt: 1 failed / 1 passed / 25 filtered skips because idle custom input raced asynchronous connection startup. After waiting for disposable config status `connected`: 2 passed / 25 filtered skips (13.28 s). Classification never contradicted R1. Terminal-only baseline counts per six scenarios: 0,0,1,1,0,1 sends; autonomous consent adds exactly the first custom wake-up send. No routing/terminal difference otherwise, zero extension errors/network attempts. |

### Stable repository gate

```sh
./node_modules/.bin/vitest run tests/unit/conversation-router.service.test.ts tests/unit/optional-output.service.test.ts tests/unit/optional-output-settings.view.test.ts tests/unit/session.manager.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/terminal-menu-i18n.test.ts tests/unit/owner-authorization.service.test.ts --maxWorkers=2
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
```

Each command used the prefix above. Results: targeted **547 passed / 7 files** (14.51 s); full repository **2075 passed / 90 files** (211.44 s), **no skips** (including no reported native-tool skips); lint and typecheck **exit 0**. No build script is declared. Existing tests' native-tool coverage is not a new platform/provider qualification.

Static checks: `git diff --check` clean. Inline Python relative-link/heading/HTML-anchor check covers changed Markdown and all 044 Markdown; initial check found the not-yet-written `tasks.md#validation-evidence` target, now supplied by this section. Final check passed: 13 Markdown files, 92 relative links/anchors, zero failures; `git diff --check` clean.

### Final T024 production-entry verification

Using the same prefix:

- `WA_PHONE_RPC_CLASSIFY_OUT="$PWD/.pi/cache/044-implementation/final-classification.json" ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(-terminal)?\)' --maxWorkers=2` — **2 passed, 25 name-filter skips**, 13.75 s. All six host classifications match research; exactly the custom-only wake-up gains an autonomous send, with unchanged terminal-only baseline/routing and zero extension errors/guarded network attempts.
- `./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts --maxWorkers=2` — **27 passed, no skips**, 162.14 s. Actual production entry and real installed Pi host exercised; WhatsApp/model/speech fixtures remain synthetic.
- Source was unchanged after the full repository/static checks; only feature evidence/status documentation was finalized. Pre/post implementation hooks are disabled; no hook was dispatched. No new constitutional deviations; existing class/service ownership, strict production types, narrow interfaces and dependency-free scope retained.

### Original checkpoint: pending operator acceptance (not execution permission)

This was the original checkpoint's pending list. Subsequent operator-confirmed private-owner cron ON/Off results are recorded separately below; they do not qualify group or broader live behavior.

- Reload the changed extension only when the operator chooses; the owning live Pi process was untouched.
- Visually inspect Background answers and group disclosure in the supported terminal locales.
- Explicitly consent and confirm private-owner/group delivery, Off/withdrawal behavior, rendering and unchanged terminal forwarding on a real account. API/socket acceptance is not recipient delivery.
- Actual scheduler/subagent integrations, real providers and new Linux/Windows/package/release qualification were not exercised; custom vs ordinary-user wake-up classification remains the documented boundary.

### Cron compatibility amendment evidence (T025–T030, 2026-11-11)

The prior sections describe the completed original checkpoint, including its then-custom-only boundary; they are not fresh evidence for the amendment. The operator approved adding positively verified extension-origin user messages after the installed cron 0.7.0 live bridge was found to use `sendUserMessage`. No installed package/global config changes or live account/history inspection occurred.

Fresh disposable state: `/tmp/wa044-tmux.h8feAL/`. Independent tmux server: `wa044-diagnostic-h8feAL`; sessions `wa044-check`, `wa044-cron-red`, `wa044-cron-green`, `wa044-gates` exited naturally. The actual Pi production entry was launched by the existing RPC harness with synthetic account/socket/model adapters and network guards. This is real host lifecycle evidence, **not** a real cron-daemon run, provider call or phone-delivery confirmation. The fixture uses the same public API/options as cron's live bridge; it never manufactures input provenance.

All test/lint/typecheck commands used this exact prefix from the repository root:

```sh
env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" HOME=/tmp/wa044-tmux.h8feAL/home PI_CODING_AGENT_DIR=/tmp/wa044-tmux.h8feAL/home/agent WHATSAPP_NG_LOCALE=en PI_OFFLINE=1
```

| Command suffix | Result |
|---|---|
| `WA_PHONE_RPC_CLASSIFY_OUT=/tmp/wa044-tmux.h8feAL/classification.json ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(?:-terminal)?\)' --maxWorkers=2` | Before amendment: 2 passed, 25 filtered skips, 13.70 s. Custom added one send; ordinary extension-user wake-up added none. |
| `./node_modules/.bin/vitest run tests/unit/conversation-router.service.test.ts tests/unit/owner-authorization.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts --maxWorkers=2` | Red before production change: 7 failed / 264 passed; extension eligibility/owner-denial assertion and owner/group delivery positives failed. |
| `./node_modules/.bin/vitest run tests/unit/optional-output.service.test.ts --maxWorkers=2` | Red before production change: 7 failed / 73 passed. Same policy regressions now run for both custom and proven extension-user input. |
| `WA_PHONE_RPC_CLASSIFY_OUT=/tmp/wa044-tmux.h8feAL/cron-red-classification.json ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(?:-terminal)?\)' --maxWorkers=2` | Red before production change in tmux: 1 failed, 1 passed, 25 filtered skips. Actual cumulative sends `[1,1,1,2,3,3,4]`, required `[1,2,3,4,5,5,6]`. |
| `./node_modules/.bin/vitest run tests/unit/conversation-router.service.test.ts tests/unit/optional-output.service.test.ts tests/unit/owner-authorization.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts --maxWorkers=2` | After router-only fix: 351 passed / 4 files; no skips. |
| `WA_PHONE_RPC_CLASSIFY_OUT=/tmp/wa044-tmux.h8feAL/cron-green-classification.json ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(?:-terminal)?\)' --maxWorkers=2` | After fix in tmux: 2 passed, 25 filtered skips, 26.63 s. Custom, extension-user and cron-style wake-ups each add exactly one send. Seven-scenario cumulative counts `[1,2,3,4,5,5,6]`; terminal-only baseline `[0,0,0,1,2,2,3]`. No extension errors or guarded network attempts. |
| `npm test -- --maxWorkers=2` | Stable gate in tmux: 2,134 passed / 90 files, no skips, 182.52 s, exit 0. Includes all 27 production-entry RPC cases. |
| `npm run lint` | Exit 0. |
| `npm run typecheck` | Exit 0; production source scope only. |

Static checks: `node --check tests/fixtures/phone-control-rpc.extension.ts` and `node --check tests/fixtures/phone-control-preload.mjs` passed. `python3 /tmp/wa044-tmux.h8feAL/check-markdown.py` checked 13 changed/044 Markdown files and 92 relative links/anchors, zero failures. `git diff --check` passed. No build script exists. Changed-path LSP probes found no production TypeScript errors; pre-existing router style findings and an inferred-settings fixture warning on the existing optional STT endpoint remain outside the change. The new entry-test mock return type was made explicit instead of introducing another inferred `never` warning.

At the source-validation checkpoint above, operator reload, visual review and real-account acceptance were pending. Cron headless user/project execution and RPC-resume fallback remain outside this amendment. Existing consent/revision/owner/account/Off, group eligibility, text-only/64 KiB/four-job/no-replay policies are unchanged. That checkpoint performed no commits, pushes, releases, installs, delegation, real sends or owning-process reloads.

### Operator-confirmed private-owner cron receipt (2026-11-11)

The operator reported reloading Pi, connecting WhatsApp and enabling owner forwarding. With explicit approval, one session-scoped, one-shot job `wa044-owner-forwarding-acceptance` was scheduled for `2026-11-11T15:25:42.134Z` using the already-running cron daemon. Its instruction prohibited tools, explicit WhatsApp/Telegram sends and file/settings changes, and required the final answer `WA044-ON-TEST`. The delivered wake-up produced exactly that normal final answer; the operator then confirmed: “Yes phone received”.

This is operator-confirmed receipt for one live-session cron answer in the private owner chat, not merely API acceptance. No owner history, credentials or message dump was inspected. At this checkpoint the report did not establish duplicate counts, group delivery, Off/revocation behavior, cross-platform behavior or cron headless/RPC-resume support; no automatic resend or further live job had been created.

### Operator-confirmed background-forwarding Off check (2026-11-11)

After the operator reported setting Background answers to Off while leaving WhatsApp connected, one separately approved session-scoped, one-shot job `wa044-owner-forwarding-off-acceptance` was scheduled for `2026-11-11T15:29:28.787Z` using the existing daemon. Its instruction prohibited tools, explicit WhatsApp/Telegram sends and file/settings changes and required only `WA044-OFF-TEST`. That normal final appeared in Pi; the operator confirmed: “not on WhatsApp, yes in terminal”.

Together these observations confirm the private-owner live-session cron ON/Off path for these two test turns. They do not establish group delivery, mid-run revocation, exact duplicate counts, other extension integrations, cross-platform/package qualification or cron headless/RPC-resume support. No further test job or automatic resend was scheduled; the last operator-reported Background answers state is Off.

### Documentation consistency pass (2026-11-11)

Reconciled the current 044 spec/design/contract/checklist/quickstart, README/reference, menu-diagram eligibility, changelog and specification index with the approved extension-input scope and the operator-confirmed private-owner ON/Off results. Original custom-only tasks, observations and pending lists remain explicitly labeled historical checkpoints. Fixed the quickstart's overescaped test-name filter. Group and broader live/platform acceptance remain unverified; cron headless/RPC-resume execution remains outside this path.

Static validation: `git diff --check` passed; `python3 /tmp/wa044-tmux.h8feAL/check-markdown.py` checked 13 Markdown files and 95 relative links/anchors with zero failures; targeted current-document searches found no remaining custom-only eligibility claims. No production or test code changed in this pass, so runtime tests/lint/typecheck were not rerun; their prior results above are not new validation runs. No commit, version bump or publication.
