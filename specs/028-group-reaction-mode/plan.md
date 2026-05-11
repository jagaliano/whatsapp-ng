# Implementation Plan: Allowed Group Reaction Mode

**Branch**: `028-group-reaction-mode` | **Date**: 2026-05-11 | **Spec**: `specs/028-group-reaction-mode/spec.md`
**Input**: Feature specification from `/specs/028-group-reaction-mode/spec.md`

## Summary

Add per-allowed-group reaction mode with two behaviors: passive (reply only when mentioned with @) and active (reply to every allowed group message). Preserve current active behavior as default for existing groups.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `@whiskeysockets/baileys`, `pino`, `qrcode-terminal`, `pi-agent-sdk`  
**Storage**: Local file config in `~/.pi/whatsapp-pi/config.json`  
**Testing**: Vitest  
**Target Platform**: Desktop Node.js CLI/TUI extension  
**Project Type**: desktop CLI/TUI extension  
**Performance Goals**: Keep message filtering decision effectively instantaneous for each incoming WhatsApp message  
**Constraints**: Must preserve existing allowed-group behavior by default; passive mode only affects allowed groups; maintain backward-compatible config loading  
**Scale/Scope**: Single-user local configuration with one reaction mode per allowed group

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Design fits existing class-based services and UI handlers.
- [x] **II. Clean Code**: Names are explicit; logic can stay focused in service and menu methods.
- [x] **III. SOLID**: Settings belong in SessionManager; message routing belongs in WhatsAppService; UI belongs in MenuHandler.
- [x] **IV. TypeScript**: Plan uses strict typed fields and small interfaces/enums.
- [x] **V. Simplicity**: Single new setting on existing allowed-group record; no extra subsystem.

## Project Structure

### Documentation (this feature)

```text
specs/028-group-reaction-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── models/
├── services/
└── ui/

tests/
└── unit/
```

**Structure Decision**: Reuse existing `src/services`, `src/ui`, and `src/models` layers; add no new top-level source area. Persist mode in existing config-backed allowed-group records.

## Complexity Tracking

No constitution violations expected.
