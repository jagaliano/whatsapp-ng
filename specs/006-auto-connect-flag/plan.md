# Implementation Plan: Auto-Connect CLI Flag

**Branch**: `006-auto-connect-flag` | **Date**: 2026-04-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-auto-connect-flag/spec.md`

## Summary

Implement a `--whatsapp` (alias `-w`) CLI flag that allows the WhatsApp extension to automatically establish a connection at startup, bypassing the manual TUI menu. The flag will override any saved "disconnected" status and will include a retry mechanism for transient network failures.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `pi-agent-sdk`
**Storage**: Memory-based flag detection; depends on existing `.pi-data/` auth state.
**Testing**: Manual verification using `pi -e ./whatsapp-pi.ts --whatsapp`
**Target Platform**: Pi Code Agent CLI
**Project Type**: Pi Code Agent Extension
**Performance Goals**: <100ms for flag detection and connection trigger.
**Constraints**: MUST NOT trigger a QR code display if auto-connect is used without an active session.
**Scale/Scope**: Extension-wide connection automation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Interaction between `whatsapp-pi.ts` entry point and the `WhatsAppService` instance will follow established patterns.
- [x] **II. Clean Code**: Use clear, descriptive variable names for flag state and retry counters.
- [x] **III. SOLID**: Flag registration is isolated from the core WhatsApp socket logic.
- [x] **IV. TypeScript**: Strict typing for CLI arguments and status enums.
- [x] **V. Simplicity**: Leveraging the built-in `pi.registerFlag` and `pi.getFlag` APIs.

## Project Structure

### Documentation (this feature)

```text
specs/006-auto-connect-flag/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
whatsapp-pi.ts           # Update for flag registration and auto-connect logic
```

**Structure Decision**: Integration into the existing main entry point file.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
