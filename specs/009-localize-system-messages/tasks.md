# Implementation Tasks: Localize System Messages to en-US

**Branch**: `009-localize-system-messages`
**Feature**: Localize System Messages to en-US
**Spec**: [specs/009-localize-system-messages/spec.md]
**Plan**: [specs/009-localize-system-messages/plan.md]

## Implementation Strategy

We will proceed with a direct replacement strategy for all hardcoded strings identified during research. Tasks are organized by user story to ensure that each communication channel (TUI, Agent, Logs) is fully localized and independently testable.

- **MVP**: Localization of all agent-forwarded messages and critical TUI feedback.
- **Full Feature**: Complete audit and translation of all logs, comments, and status updates.

## Phase 1: Setup & Audit

- [x] T001 Perform a final grep-based audit of the entire `src/` directory for any remaining Portuguese string literals

## Phase 2: User Story 1 - Unified English TUI Experience [US1]

**Goal**: Ensure all interactive feedback in the Pi TUI is in US English.
**Independent Test**: Trigger `/compact` and `/abort` commands and verify English confirmation messages.

- [x] T002 [P] [US1] Replace "/compact" and "/abort" success messages with US English in `whatsapp-pi.ts`
- [x] T003 [P] [US1] Update Portuguese code comments to US English in `src/ui/menu.handler.ts`

## Phase 3: User Story 2 - Localized Agent Communication [US2]

**Goal**: Ensure the Pi agent receives all context and metadata in US English.
**Independent Test**: Send a message and an audio file to the bot; verify the agent's received headers are in English.

- [x] T004 [P] [US2] Translate "Mensagem de" forwarding headers to "Message from" in `whatsapp-pi.ts`
- [x] T005 [P] [US2] Translate "[Áudio Transcrito]" prefix to "[Transcribed Audio]" in `whatsapp-pi.ts`
- [x] T006 [P] [US2] Translate transcription status and error strings in `src/services/audio.service.ts`

## Phase 4: User Story 3 - Clean English Logging [US3]

**Goal**: Standardize all console and trace logs to US English.
**Independent Test**: Enable `--verbose` mode and verify all startup and message logs are in English.

- [x] T007 [P] [US3] Audit and replace internal console log strings with US English equivalents in `whatsapp-pi.ts`
- [x] T008 [P] [US3] Verify and standardize status update strings in `src/services/whatsapp.service.ts`

## Phase 5: Polish & Integration

- [x] T009 [P] Perform a final visual verification of all notifications in the Pi TUI
- [x] T010 Verify end-to-end flow of an audio transcription being sent to the agent in English

## Dependencies

1. **Phase 2, 3, and 4** are independent and can be executed in any order.
2. **Phase 5** depends on the completion of all prior phases.

## Parallel Execution Examples

- **T002**, **T004**, and **T007** can be performed in parallel as they touch different sections of the same file or different files.
- **T003**, **T006**, and **T008** can be performed in parallel as they target different service files.
