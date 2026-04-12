# Tasks: Auto-Connect CLI Flag

**Input**: Design documents from `specs/006-auto-connect-flag/`
**Prerequisites**: plan.md (required), spec.md (required), research.md (required)

**Tests**: Manual CLI verification is primary.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: [US1], [US2]

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Verify the environment and existing services are ready for the new flag.

- [X] T001 Verify `whatsapp-pi.ts` is ready for additional flag registrations and event logic updates.

---

## Phase 2: User Story 1 & 2 - Auto-Connect Toggle (Priority: P1) 🎯 MVP

**Goal**: As a user, I want to use the `--whatsapp` flag to automatically start the WhatsApp service if credentials exist.

**Independent Test**: Run `pi -e ./whatsapp-pi.ts --whatsapp` with an existing session and verify auto-connection; then run without it and verify it stays disconnected.

- [X] T002 Register the `whatsapp` and `w` flags using `pi.registerFlag` in `whatsapp-pi.ts`.
- [X] T003 Implement the `whatsapp` flag detection logic within the `session_start` event in `whatsapp-pi.ts`.
- [X] T004 Implement logic to check `sessionManager.isRegistered()` before triggering auto-connect in `whatsapp-pi.ts`.
- [X] T005 Implement user notification (`ctx.ui.notify`) if `--whatsapp` is used but no session is registered.
- [X] T006 [US1] Implement an asynchronous retry loop (max 3 attempts with 3s delay) for `whatsappService.start()` within the auto-connect sequence in `whatsapp-pi.ts`.
- [X] T007 [US1] Ensure `whatsappService.start()` is triggered only if the flag is present and the session is registered.
- [X] T008 [US2] Ensure the manual default behavior is preserved (no connection if flag is absent) by verifying conditional logic.

**Checkpoint**: Core feature is complete. The integration can now be fully automated via CLI arguments.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation updates.

- [X] T009 [P] Update `specs/006-auto-connect-flag/quickstart.md` with final flag usage details.
- [X] T010 Verify that auto-connect logic does not conflict with the existing session restoration loop in `session_start`.

---

## Dependencies & Execution Order

1. **Phase 2 (Implementation)** can start immediately after Phase 1.
2. **Phase 3 (Polish)** depends on Phase 2 completion.

---

## Implementation Strategy

1. **MVP First**: Complete Phase 2. This provides the requested automatic connection and retry capability.
2. **Polish**: Finalize documentation and verify no side effects on the manual TUI workflow.
