# Implementation Plan: Localize System Messages to en-US

**Branch**: `009-localize-system-messages` | **Date**: 2026-04-13 | **Spec**: [specs/009-localize-system-messages/spec.md]
**Input**: Feature specification from `/specs/009-localize-system-messages/spec.md`

## Summary

The goal is to perform a full audit and localization of all user-facing and agent-facing system messages to US English (`en-US`). This involves replacing Portuguese strings in `whatsapp-pi.ts` and service files with English equivalents to ensure consistency with the Pi Code Agent environment.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@whiskeysockets/baileys`, `pi-agent-sdk`, `pino`
**Storage**: N/A (String constants)
**Testing**: `npm test` (Visual verification in TUI)
**Target Platform**: Node.js
**Project Type**: Pi Extension
**Performance Goals**: N/A
**Constraints**: US English (`en-US`) only.
**Scale/Scope**: Codebase audit of all literal strings.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Does the design use appropriate classes/interfaces? (N/A for string replacement)
- [x] **II. Clean Code**: Are names meaningful and functions focused? (Improving message clarity)
- [x] **III. SOLID**: Does the design respect SOLID principles? (Consistent with current architecture)
- [x] **IV. TypeScript**: Is the typing strict and appropriate? (Maintaining existing strict typing)
- [x] **V. Simplicity**: Is this the simplest possible implementation? (Direct string replacement)

## Project Structure

### Documentation (this feature)

```text
specs/009-localize-system-messages/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A
└── tasks.md             # Phase 2 output (generated later)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── audio.service.ts
│   └── whatsapp.service.ts
└── whatsapp-pi.ts
```

**Structure Decision**: Standard structure. Only text literals will be modified.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
