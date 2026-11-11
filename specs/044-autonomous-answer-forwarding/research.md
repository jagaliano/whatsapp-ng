# Research: Autonomous Answer Forwarding

Verified against `1.1.8` (`20b3892`) and Pi 1.5.0 docs on 2026-11-09. The local research note's line references were dated; findings below are re-read from current source.

## R1. Classification signal

Original custom-only checkpoint; the current approved classification is in R1c below. Earlier host observations and validation results are retained unchanged.

- **Finding**: Pi `before_agent_start` reports `messageType: "custom"` for runs started by `pi.sendMessage(..., { triggerTurn: true })` while idle, and `"user"` for prompts and `pi.sendUserMessage()` (`docs/extensions.md`, before_agent_start). Custom messages arrive in `message_start` with role `custom`; `router.consume()` currently marks them `unowned`/`unknown` (`conversation-router.service.ts` consume).
- **Decision**: A turn is autonomous only if (a) the run started with `messageType: "custom"` and (b) every input consumed in the epoch has role `custom`. Router records source `autonomous` for role `custom`; a separate `isAutonomous(snapshot)` is true only when sources are exactly `{autonomous}` and the run-start marker is custom. The router's control origin is unchanged (autonomous turns remain `unknown`), so eligibility grants no owner or configuration authority (R1b). Anything else stays local.
- **Rejected**: forwarding all unowned turns (explicitly forbidden); extension/run-ID matching (out of scope).
- **Verification required (tasks)**: production-entry RPC fixture emits a synthetic `pi.sendMessage({customType}, { triggerTurn: true })` and asserts autonomous eligibility (`isAutonomous`, not control origin); a `sendUserMessage` wake-up, a custom message queued behind a WhatsApp request, and a steer during terminal work remain local. If Pi labels differently, stop and update this record.

### R1a. Verification status (2026-11-09): VERIFIED (observed host behavior)

Initial search found no existing fixture emitting a custom wake-up, so the user authorized two test-only changes:

- `tests/fixtures/phone-control-rpc.extension.ts`: when `WA_PHONE_RPC_CLASSIFY=1`, records host events only (`before_agent_start.messageType`, `input.source`, `message_start` role/customType, whether content carries a `[WhatsApp request` marker, `agent_end`). Actions: `custom-wake` (`pi.sendMessage(..., { triggerTurn: true })`), `user-wake` (`pi.sendUserMessage`), `mixed` (holds a real synthetic WhatsApp request at consumption, queues `pi.sendMessage(..., { triggerTurn: true, deliverAs: 'followUp' })`, then releases). It supplies no classification.
- `tests/unit/phone-control.rpc.test.ts`: `classify` scenario through the real Pi RPC entry and production `whatsapp-ng.ts`, plus a plain RPC prompt for terminal input. Synthetic account and socket, disposable HOME, existing network guard.

Command (repo root, PATH/TMPDIR only inherited):

```sh
env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" HOME="$PWD/.pi/cache/044-validation/home" PI_CODING_AGENT_DIR="$PWD/.pi/cache/044-validation/home/agent" WHATSAPP_NG_LOCALE=en PI_OFFLINE=1 WA_PHONE_RPC_CLASSIFY_OUT="$PWD/.pi/cache/044-validation/classification.json" ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify\)' --maxWorkers=2
```

Result: **1 passed, 25 skipped**; zero extension errors and zero guarded network attempts. Observed per run (Pi 1.5.0):

| Scenario | `before_agent_start.messageType` | `input` events | Consumed (`message_start`) | Current WhatsApp final sends |
|---|---|---|---|---|
| `sendMessage` + `triggerTurn` | `custom` | none | `custom` (customType kept) | none (stays local) |
| `sendUserMessage` | `user` | `extension` | `user` | none |
| RPC prompt (terminal) | `user` | `rpc` | `user` | none |
| WhatsApp request + queued custom follow-up | `user` | `extension` (WhatsApp marker) | `user` (WhatsApp), then `custom` in the **same run** | one, to the owner |

Conclusions:

- Matches R1's design: only a custom-started run whose consumed inputs are all custom qualifies; `sendUserMessage` and terminal runs start as `user` and stay excluded. The mixed case is a single run containing both, so the run-start marker alone is insufficient: classification must also require that every consumed input is custom (design R1 (b)).
- Custom messages produce no `input` event; WhatsApp/extension inputs do. This is not needed for classification.
- The "current sends" column is today's behavior. Autonomous forwarding is not implemented; no forwarding outcome was observed or asserted. Terminal forwarding was not enabled in this fixture and is unaffected by the test-only changes.

Regression checks after the change: full `tests/unit/phone-control.rpc.test.ts` **26 passed** (150.8 s); `npm run lint` and `npm run typecheck` passed; `git diff --check` clean. Production source unchanged.

### R1a addendum (planning checkpoint; new evidence below)

R1a above is historical evidence of four scenarios only. At the planning checkpoint, two further real-host scenarios were planned in T012 and had **not** been observed: a custom message steered into an active terminal run, and a terminal run that also consumes a custom message. Both must be excluded from autonomous forwarding with existing routing and terminal forwarding unchanged. If observed host labels contradict this, stop and update this record.

### R1a addendum evidence (2026-11-11, before production edits)

The two additional real-host scenarios above were run through the extended `classify` fixture: hold a terminal input at consumption, queue a custom message with `deliverAs: 'steer'` or `'followUp'`, then release. Both observed `before_agent_start.messageType: 'user'`, input source `rpc`, and consumed roles `user`, then `custom:fixture-background` in the same run. Both remain excluded by R1's positive eligibility. Existing WhatsApp final sends remained exactly one to the synthetic owner; no extension errors or guarded network attempts. Terminal forwarding was off in this initial observation; enabled-terminal regression remains pending. R1a's earlier four-scenario evidence above is unchanged.

Command: `env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" HOME="$PWD/.pi/cache/044-implementation/home" PI_CODING_AGENT_DIR="$PWD/.pi/cache/044-implementation/home/agent" WHATSAPP_NG_LOCALE=en PI_OFFLINE=1 WA_PHONE_RPC_CLASSIFY_OUT="$PWD/.pi/cache/044-implementation/classification.json" ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\\(classify\\)' --maxWorkers=2` — **1 passed, 25 filtered skips**, 6.50 s, macOS, Node 26 / Pi 1.5.0. Production source unchanged at this gate. T012's forwarding assertions still await implementation.

### R1b. Authority isolation (tasks refinement, 2026-11-09)

`controlOrigin` feeds `OwnerAuthorization` (`owner-authorization.service.ts:19-26`) and `FinalOutputCoordinator`. To make FR-008 structurally safe, do **not** widen `getControlOrigin()`; its type and results stay `'terminal' | 'whatsapp' | 'unknown'` (autonomous turns remain `'unknown'`, so owner authorization still refuses them). Add a separate router query `isAutonomous(snapshot)` that is true only when the epoch's sources are exactly custom inputs and the run started as custom. Plan and research wording updated accordingly (analysis I1/F1, 2026-11-09).

## R2. Egress path

- **Decision**: New `forwardAutonomous()` beside `forwardTerminal()`, called in `turn_end` before the WhatsApp mirror. Reuses `Frame`, `current()`, 64 KiB local notice, 4-job capacity, `deliver()` (text only, `maxRetries: 1`, no retry on unknown), `trackOwnedSend(..., 'final-text')` duplicate suppression and recents recording.
- **Claim**: generalize `takeTerminalAnswer(ownerJid)` into `takeLocalAnswer(origin, destinationJid)` keeping the claimed-response and coveringSend checks; terminal behavior unchanged.
- **Final only**: router `buffer()` already marks tool-call and error/aborted messages ineligible.

## R3. Destination eligibility

- Owner: `consent.ownerJid === current verified owner` and account scope unchanged (same as terminal).
- Group: must equal `consent.jid`, be in `getAllowedGroups()`, pass `allowedConversation`, and not be paused (`chatReplyPolicy(...).automaticReplies`). Bound-group mode: only the bound group is eligible.
- Consent revision and owner revision captured at input; `isCurrent()` rechecks Off, connection, session context.

## R4. Text only

- **Decision**: bypass `FinalOutputCoordinator`; send through `deliver()` text path. Destination voice/Mirror preferences are ignored for autonomous answers (FR-012).

## R5. Settings

- **Decision**: add `autonomous?: { kind: 'owner' | 'group'; jid; accountScope; ownerJid }` to `OptionalOutputs`; absence = Off. Separate from `terminal`; validator rejects unknown keys and invalid JIDs (group JIDs `@g.us`). Malformed settings disable all optional outputs (existing behavior).
- Group consent records the owner at consent time; owner change invalidates it (consent granted by a different owner).

## R6. Authority

- Delivery uses outbound send only; no change to `OwnerAuthorization`, phone controls or admission. Group membership grants nothing (FR-008); covered by an existing-guard regression.

## R1c. Approved cron compatibility amendment

The earlier custom-only decisions/observations above describe their original checkpoint and are superseded for current eligibility by this amendment. The operator's live cron acceptance attempt produced no phone answer. Inspection of installed `@ryan_nookpi/pi-extension-cron` 0.7.0, `session-bridge.ts:396`, found `sendUserMessage(request.prompt, { deliverAs: 'followUp', expandPromptTemplates: true })`, not `sendMessage`. Pi identifies that input as source `extension`, role/start `user`; it does not identify the sending extension. The earlier proposed cron acceptance instructions were therefore incompatible with the feature's custom-only contract.

A separate tmux server ran the existing real-Pi `classify` and `classify-terminal` RPC cases in a disposable credential-free HOME: **2 passed, 25 filtered skips**, exit 0, 13.70 s. With autonomous consent, the custom wake-up added one synthetic owner send and the extension user wake-up added none. No real transport/model calls or owner history were used. This reproduces the classification mismatch, not real phone delivery. Command: `env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" HOME=/tmp/wa044-tmux.h8feAL/home PI_CODING_AGENT_DIR=/tmp/wa044-tmux.h8feAL/home/agent WHATSAPP_NG_LOCALE=en PI_OFFLINE=1 WA_PHONE_RPC_CLASSIFY_OUT=/tmp/wa044-tmux.h8feAL/classification.json ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(?:-terminal)?\)' --maxWorkers=2`. Diagnostic outputs are disposable, not a tracked artifact.

The operator explicitly approved (1) cron support and (2) inclusion of other positively verified extension-origin user messages, not cron alone. Capture exact Pi input provenance, never prompt markers, guessed extension identity, cron job files or absence of a WhatsApp target. Reuse one latest-input proof with terminal/extension kind, same scope and five-minute expiry; consume once and invalidate on newer input/reset. Do not create extension proof for pending or retired WhatsApp inputs. A known start must match the first consumed role; every consumed input must be custom or carry valid extension proof. Terminal, WhatsApp or unproven input permanently excludes the run. Control origin and owner authorization remain unchanged.

Scope: live-session cron bridge delivery. Cron's headless user/project runs and same-session RPC-resume fallback have no positive extension source and remain outside this amendment. No installed cron changes, new dependency, service startup or live calls. New regression-first work/evidence is tracked as T025–T030; prior evidence stays unchanged.
