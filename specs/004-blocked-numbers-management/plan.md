# Implementation Plan: Blocked Numbers Management

**Branch**: `004-blocked-numbers-management` | **Date**: 2026-04-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-blocked-numbers-management/spec.md`

## Summary

Implement a "Blocked Numbers" management system for the WhatsApp integration. This includes adding a block list to the session state, providing a sub-menu to view blocked contacts, and implementing a migration action to move a number from the Blocked List to the Allowed List.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@whiskeysockets/baileys`, `pi-agent-sdk`
**Storage**: `config.json` (Local persistent storage in `.pi-data/`)
**Testing**: Vitest
**Target Platform**: Pi Code Agent TUI
**Project Type**: Pi Code Agent Extension
**Performance Goals**: <200ms for list migration operations.
**Constraints**: Mutual exclusivity between Allowed and Blocked lists MUST be strictly enforced.
**Scale/Scope**: Local list management; limited by file I/O speed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Will extend `SessionManager` class with block list logic and migration methods.
- [x] **II. Clean Code**: Use descriptive method names like `unblockAndAllow`.
- [x] **III. SOLID**: Encapsulate migration logic within the `SessionManager` service, keeping the UI layer thin.
- [x] **IV. TypeScript**: Strictly typed phone number lists and migration results.
- [x] **V. Simplicity**: Standard array filter/push operations for list management.

## Project Structure

### Documentation (this feature)

```text
specs/004-blocked-numbers-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── services/
│   └── session.manager.ts   # Update with block list and migration logic
├── ui/
│   └── menu.handler.ts      # Update with Blocked Numbers menu
└── models/
    └── whatsapp.types.ts    # Verify/Update types
```

**Structure Decision**: Continuous improvement of existing services.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
