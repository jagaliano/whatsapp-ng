# Implementation Plan: WhatsApp Processing Reaction

**Branch**: `main` (no feature branch created) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/043-whatsapp-processing-reaction/spec.md`

## Summary

Add a ⏳ reaction to each WhatsApp message handed to Pi and remove it once the run that consumed it (or the path that withdrew it) ends. A new single-purpose `ProcessingIndicator` service owns per-message indicator records, captured session context and best-effort egress through the existing `ReactionSender`. The composition root (`whatsapp-ng.ts`) calls it at hand-off, consumption, run end, retired-input abort and the existing reset paths. No routing, history, reaction-filter, setting or dependency changes. See [research.md](research.md) for decisions.

## Technical Context

**Language/Version**: TypeScript ES modules on Node 26.x; Pi 1.5.0 host

**Primary Dependencies**: Existing `baileys` socket via `WhatsAppService`; existing `ReactionSender`; no new dependencies

**Storage**: None (process-local in-memory records; not persisted)

**Testing**: Vitest (`npm test -- --maxWorkers=2`), ESLint (`npm run lint`), `tsc` (`npm run typecheck`); synthetic socket/Pi fixtures in `tests/unit` and `tests/fixtures`

**Target Platform**: Pi extension runtime (macOS/Linux/Windows hosts as already supported)

**Project Type**: Pi extension (single project)

**Performance Goals**: Zero added latency on prompt hand-off and final reply: reaction egress is fire-and-forget

**Constraints**: Best-effort, no retry, no fallback send, metadata-only logs, fenced by account/session generation and explicit Off; one tracked record per admitted message; independent hard cap of 500 indicator records (the router cap excludes consumed messages); router retirement retains its existing 24 h expiry

**Scale/Scope**: One service (~100 lines), ~6 call-site hooks in `whatsapp-ng.ts`, one router callback, new unit tests plus entry-level regressions; README/reference/CHANGELOG updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. OOP | Pass | New `ProcessingIndicator` class with narrow injected ports (reaction send, context check, logger). |
| II. Clean Code | Pass | Single owner for indicator state; no logic spread across handlers beyond one-line calls. |
| III. SOLID | Pass | SRP: indicator lifecycle only; depends on interfaces, not `WhatsAppService` internals; router only gains an optional callback. |
| IV. TypeScript Excellence | Pass | Strict types; `.js` local imports. |
| V. Simplicity | Pass | No setting, no persistence, no framework; reuses `ReactionSender` and session-context checks. |
| Workflow | Pass | Spec, plan and tasks in `specs/043-…`; regressions first. |

Post-design re-check: unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/043-whatsapp-processing-reaction/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── processing-indicator.md
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
whatsapp-ng.ts                                  # wire hand-off, consume, run end, retired abort, resets
src/services/processing-indicator.service.ts    # NEW: per-message indicator lifecycle
src/services/conversation-router.service.ts     # optional onRetired(key) callback for withdrawn/expired pending inputs
src/services/reaction.sender.ts                 # reused unchanged
# whatsapp-ng.ts send_reaction tool: indicator.supersede(key) before sending (no await)
# src/services/whatsapp.service.ts: own-reaction notification hook after existing reconciliation
tests/unit/processing-indicator.service.test.ts # NEW
tests/unit/conversation-router.service.test.ts  # retired-callback regressions
tests/unit/whatsapp-ng.message-end.test.ts      # entry-level add/clear/fence regressions
README.md, docs/reference.md, CHANGELOG.md      # documentation
```

**Structure Decision**: Existing single-project layout; one new service under `src/services/` following the existing service pattern.

## Resolved Decisions (2026-11-07)

1. No wait in `send_reaction`; best-effort precedence, no retries (research R8).
2. Verified own-account phone reactions/removals supersede the indicator; history reconciliation unchanged (R8).
Accepted residual races are listed in R8; none blocking.

## Complexity Tracking

No constitutional deviations.

### Implementation inspection (T001)

- Router `consume()` also deletes pending requests rejected for missing observation, expiry or stale scope. Notify retirement there too, otherwise those indicators have no terminal hook. Keep routing decisions unchanged.
- Phone `/stop` resets the router directly; settle indicators there before reset, as well as at session reset. Explicit Off/shutdown discard instead.
- Preserve captured admission authority before every egress (including deferred cleanup): `start` takes the existing `admissionCurrent` predicate. Revoked admissions suppress cleanup rather than sending to withdrawn chats.
- Keep records awaiting an add/removal settlement inside the 500-record cap; otherwise hung sends could create unbounded deferred cleanup outside the map. Recheck supersession and record identity immediately before deferred removal. No reaction await in prompt, reply or explicit-tool paths.
- Ignore setup verified: existing `.gitignore` covers Node artifacts/secrets; flat ESLint config covers generated dependencies; package `files` is the publication allow-list. No new ignore files or dependency changes needed.
