# Implementation Plan: Autonomous Answer Forwarding

**Branch**: `main` (no feature branch created) | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/044-autonomous-answer-forwarding/spec.md`

## Summary

Forward the final text answer of positively identified autonomous turns (known custom/user run start matching the first consumed input; inputs exclusively custom or exactly proven extension-origin user messages) to one consented destination: the verified owner or one allowed group. Add a separate autonomous-eligibility check (`isAutonomous`) in `ConversationRouter` while keeping its control origin unchanged (autonomous turns stay `unknown`, so eligibility grants no owner or configuration authority; research R1b), a separate `autonomous` consent in `OptionalOutputs`, a projection in `OptionalOutputService` that reuses the existing frame, currentness, 64 KiB cap, capacity, claim and delivery paths, and a terminal settings choice with group disclosure. Terminal forwarding and WhatsApp-request routing are unchanged. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript ES modules, Node 26.x, Pi 1.5.0 host

**Primary Dependencies**: Existing services only (`ConversationRouter`, `OptionalOutputService`, `SessionManager`, `WhatsAppService`); no new dependencies

**Storage**: Existing `config.json` `optionalOutputs` via `SessionManager` (atomic, revisioned)

**Testing**: Vitest (`npm test -- --maxWorkers=2`), `npm run lint`, `npm run typecheck`; synthetic unit fixtures and the production-entry RPC fixture (`tests/fixtures/phone-control-rpc.extension.ts`) extended with synthetic custom-message and positively observed `sendUserMessage` wake-ups, including cron-style live-session options

**Target Platform**: Pi extension runtime (existing supported hosts)

**Project Type**: Pi extension (single project)

**Performance Goals**: No added latency to non-autonomous turns; at most one send per eligible final answer

**Constraints**: Default off; text only; 64 KiB cap with local notice; no partial output, replay, retry or fallback; reuse capacity of 4 jobs; recheck connection/Off, account/session generation, settings and owner revisions, destination consent and group eligibility before egress

**Scale/Scope**: Existing router eligibility, one bounded input-provenance proof shared with terminal classification, optional-output projection/settings, four locales, tests and public docs. Approved cron amendment changes classification only; no cron dependency, installed-package edit or new setting.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. OOP | Pass | Extends existing classes; no free-floating state. |
| II. Clean Code | Pass | One eligibility query and one projection method mirroring the terminal path. |
| III. SOLID | Pass | Classification stays in the router; egress in OptionalOutputService; persistence in SessionManager. Terminal path closed for modification except shared helpers. |
| IV. TypeScript Excellence | Pass | Discriminated union for destination; strict validation. |
| V. Simplicity | Pass | No new service, setting store, framework or dependency. |
| Workflow | Pass | Spec, plan and tasks under `specs/044-…`; regressions first. |

Post-design re-check: unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/044-autonomous-answer-forwarding/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/autonomous-forwarding.md
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks
```

### Source Code (repository root)

```text
src/services/conversation-router.service.ts   # 'autonomous' input source, isAutonomous(), run-start marker; control origin unchanged
src/services/optional-output.service.ts       # autonomous consent validation + forwardAutonomous()
src/ui/optional-output-settings.view.ts       # Off / owner / one group, disclosure, revision checks
src/i18n.ts                                   # new menu keys (en, pt-BR, es, fr)
whatsapp-ng.ts                                # before_agent_start marker, policy fields, turn_end call
tests/unit/conversation-router.service.test.ts
tests/unit/optional-output.service.test.ts
tests/unit/optional-output-settings.view.test.ts
tests/unit/whatsapp-ng.message-end.test.ts
tests/unit/phone-control.rpc.test.ts + tests/fixtures/phone-control-rpc.extension.ts  # synthetic custom + extension-user/cron wake-ups
README.md, docs/reference.md, docs/menu-diagrams.md, CHANGELOG.md
```

**Structure Decision**: Existing single-project layout; no new files except tests if needed.

## Implementation hook verification

The original pre-task host-classification blocker was resolved by the authorized test-only fixture (research R1a); the remaining steer/terminal+custom observations passed before production edits (R1a addendum evidence). T012's enabled-forwarding assertions passed against a separately enabled terminal-only baseline; see [validation evidence](tasks.md#validation-evidence).

Source hook review: `before_agent_start` already owns prompt guidance; add the marker there without replacing it. Router epochs can change inside one run, so preserve the all-eligible-input proof across the run, not only the latest epoch (custom-only at the original checkpoint; custom plus proven extension-user input after R1c). Optional-output admissions reset on each consumed input: autonomous consent must retain its first-input admission across a run, including Off/invalid input, to prevent mid-run enable/retarget/replay. Existing terminal/image admissions stay per-input. `allowedConversation` includes bound-group checks; retain these for egress while verifying the autonomous consent's private owner independently of the bound-group destination (terminal behavior unchanged).

## Cron compatibility amendment

The owner approved accepting positively observed extension-origin user messages after the cron acceptance test exposed the custom-only mismatch (research R1c). Reuse the router's latest-input proof: tag its source as terminal or extension, capture the exact digest/scope/five-minute expiry, clear it on any newer input/reset, consume it once. Never capture extension proof for a pending or withdrawn WhatsApp request. Require the known run-start role to match the first input and latch the whole run ineligible on terminal, WhatsApp, missing/expired/superseded/transformed proof. Custom plus proven extension inputs may share an eligible run. Control origin stays unknown. Do not identify cron from prompt strings or inspect its job store. Live-session bridge delivery qualifies; RPC-resume/headless runs remain outside this amendment.

Regressions precede production changes: positive extension wake-up (idle and cron-style follow-up), replay/expiry/scope/reset/transformation/supersession/WhatsApp priority, owner denial, first-input consent and unchanged terminal/WhatsApp routing. Extend the actual Pi RPC fixture and rerun it in isolated tmux. Preserve earlier evidence as dated checkpoints.

## Complexity Tracking

No constitutional deviations. Cron compatibility uses the existing router provenance boundary; no cross-package coupling.
