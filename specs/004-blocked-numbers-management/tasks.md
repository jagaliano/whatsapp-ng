# Tasks: Blocked Numbers Management

**Input**: Design documents from `specs/004-blocked-numbers-management/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Unit tests for `SessionManager` migration logic are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: [US1], [US2]

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Update existing infrastructure to support the new feature.

- [X] T001 Verify existing project structure and ensure `src/services/session.manager.ts` and `src/ui/menu.handler.ts` are ready for modification.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data model and persistence updates for the block list.

- [X] T002 Update `blockList` state and load/save logic in `src/services/session.manager.ts`
- [X] T003 Implement `blockNumber(number: string)` and `unblockNumber(number: string)` in `src/services/session.manager.ts`
- [X] T004 Implement mutual exclusivity logic (removing from one list when adding to another) in `src/services/session.manager.ts`
- [X] T005 [P] Create unit test for block list management and list exclusivity in `tests/unit/session.manager.test.ts`

---

## Phase 3: User Story 1 - View Blocked Numbers (Priority: P2)

**Goal**: As a user, I want to see a dedicated list of phone numbers that I have blocked.

**Independent Test**: Navigate to the "Blocked Numbers" menu and verify the list reflects the numbers added via `blockNumber`.

- [X] T006 Add "Blocked Numbers" option to the main menu in `src/ui/menu.handler.ts`
- [X] T007 Implement `showBlockList(ctx)` method in `src/ui/menu.handler.ts` using `ctx.ui.select`
- [X] T008 Handle empty list state (show "No blocked numbers") in the blocked list menu

**Checkpoint**: User can now view their blocked numbers through the `/whatsapp` command.

---

## Phase 4: User Story 2 - Unblock and Allow Number (Priority: P1) 🎯 MVP

**Goal**: As a user, I want to select a number from the blocked list and move it to the allowed list.

**Independent Test**: Select a blocked number, choose "Unblock and Allow", and verify it moves to the allowed list and is immediately ready for interaction.

- [X] T009 Implement `unblockAndAllow(number: string)` atomic migration method in `src/services/session.manager.ts`
- [X] T010 [P] Create unit test for atomic migration logic in `tests/unit/session.manager.test.ts`
- [X] T011 Implement sub-menu actions for a selected blocked number (Unblock and Allow, Delete, Cancel) in `src/ui/menu.handler.ts`
- [X] T012 Add `ctx.ui.confirm` for the "Unblock and Allow" operation in `src/ui/menu.handler.ts`
- [X] T013 Update `handleIncomingMessages` in `src/services/whatsapp.service.ts` to explicitly check `isBlocked()` (precautionary)

**Checkpoint**: Core requested feature is complete. Numbers can be migrated between lists via the TUI.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation updates.

- [X] T014 [P] Update `specs/004-blocked-numbers-management/quickstart.md` with any final implementation details
- [X] T015 Run all tests and verify SC-001 to SC-003 from `specs/004-blocked-numbers-management/spec.md`

---

## Dependencies & Execution Order

1. **Foundational (Phase 2)** -> **US1 (Phase 3)** & **US2 (Phase 4)**
2. **US1 (Phase 3)** and **US2 (Phase 4)** can proceed in parallel once the foundation is laid in `SessionManager`.
3. **Polish (Phase 5)** depends on all user stories being complete.

---

## Parallel Execution Examples

### Foundational Parallel Tasks
- T005 [P] (Tests) and T002-T004 (Implementation) can start together.

### User Story Parallel Tasks
- US1 (UI viewing) and US2 (UI migration logic) can be worked on in parallel by different developers.

---

## Implementation Strategy

1. **MVP First**: Complete Phase 2 and Phase 4. This provides the core migration capability.
2. **Incremental Delivery**: Complete Phase 3 to provide full visibility into the blocked state.
3. **Polish**: Finalize documentation and verify performance metrics.
