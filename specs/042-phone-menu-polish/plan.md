# Implementation Plan: Phone Menu Polish

**Branch**: `main` (setup script reported `042-phone-menu-polish`; no branch created, Git hooks disabled) | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/042-phone-menu-polish/spec.md`

## Summary

Presentation-only pass over the phone command surface. Move every phone-facing string in `WhatsAppCommandRouter` and `CommandMenuService` to `src/i18n.ts` keys (en, pt-BR, es, fr); regroup `/help`, split `/status` into shared/this-chat sections; give menus friendly labels with a current-selection marker and a localized answer instruction; deliver the full `/replies` disclosure and shared-session guidance in a menu body that is not subject to the 120-character title cap; the body must fit its 1,000-character limit in every locale and is never truncated. Action values, option order/count, authorization, expiry, poll opt-in and routing are untouched.

## Technical Context

**Language/Version**: TypeScript ES modules, Node 26.x, Pi 1.5.0 host
**Primary Dependencies**: existing only (Baileys, Pi SDK); no additions
**Storage**: none changed (no config keys)
**Testing**: Vitest (`tests/unit/whatsapp-command.router.test.ts`, `command-menu.poll.test.ts`, `phone-control.rpc.test.ts`, new `phone-menu-i18n.test.ts`)
**Target Platform**: Pi extension on macOS/Linux/Windows
**Project Type**: single-package Pi extension
**Performance Goals**: n/a (text formatting)
**Constraints**: WhatsApp message delivery unchanged; menu ≤12 options; poll option names must stay unique and identical to text labels; `safeLabel` 120-char cap per title/label retained, with fixed titles/labels required to fit it untruncated in all locales (dynamic model labels retain the existing privacy/display cap, reserving room for the current marker); body ≤1,000, rejected rather than truncated
**Scale/Scope**: 2 source files + `i18n.ts`; 116 new phone strings × 4 locales

## Constitution Check

| Principle | Status |
|---|---|
| I. OOP | Pass — changes stay inside existing `WhatsAppCommandRouter`/`CommandMenuService` classes. |
| II. Clean Code | Pass — replaces inline literals with named i18n keys; one small `mark(label, current)` helper. |
| III. SOLID | Pass — `CommandMenuService.create` gains an optional `body` parameter (open/closed; callers unchanged). |
| IV. TypeScript | Pass — new keys typed via existing `t()` key union; strict typecheck. |
| V. Simplicity | Pass — no framework, dependency, setting or command. |

Workflow: behavior-preserving UX change with a spec folder (feature work); CHANGELOG entry required. **Post-design re-check: Pass.**

## Project Structure

### Documentation (this feature)

```text
specs/042-phone-menu-polish/
├── plan.md  research.md  data-model.md  quickstart.md
├── contracts/phone-surface.md
├── checklists/requirements.md
└── tasks.md   (next: /speckit.tasks)
```

### Source Code (repository root)

```text
src/i18n.ts                               # phone.* keys, 4 locales
src/services/command-menu.service.ts      # localized instruction; optional unabridged body
src/services/whatsapp-command.router.ts   # help/status/menus/replies via t(); current markers
tests/unit/whatsapp-command.router.test.ts, command-menu.poll.test.ts, phone-control.rpc.test.ts  # update English literals only
tests/unit/phone-menu-i18n.test.ts        # new four-locale + action-parity matrix
tests/fixtures/phone-control-rpc.extension.ts # gated delivery hook for the four real-entry scenarios
README.md, docs/reference.md, docs/menu-diagrams.md, CHANGELOG.md
```

**Structure Decision**: existing single-project layout; no new modules except one test file.

## Complexity Tracking

No constitutional deviations. Execution adjustments: T026’s body regression ran before T004 to honor test-first validation; US1/US2/US3 regressions are centralized in the new locale/parity suite rather than duplicating the router fixture. Final review added failing four-locale regressions to preserve `/voice` menu availability when saved speech preferences are unreadable; current state then stays unmarked and the original action guard still refuses. Fixed labels are not clipped by the marker helper; only dynamic model labels reserve marker space inside their existing display cap. A one-line, explicitly gated addition to the existing RPC fixture delivers synthetic phone requests for T036; no new fixture framework. T040 must not alter reviewer/spec checklist files or markers (the implementation command’s read-only checklist gate takes precedence).
