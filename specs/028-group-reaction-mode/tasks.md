# Tasks: Allowed Group Reaction Mode

**Input**: Design documents from `/specs/028-group-reaction-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared wording and type foundations for the feature

- [X] T001 [P] Add allowed-group reaction mode labels and menu text in `src/i18n.ts`
- [X] T002 [P] Define `ReactionMode` and extend allowed-group config shape in `src/models/whatsapp.types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core storage and defaults that all stories rely on

- [X] T003 Implement reaction-mode persistence helpers and typed accessors in `src/services/session.manager.ts`

**Checkpoint**: Reaction mode can be saved, loaded, and read by other features.

---

## Phase 3: User Story 1 - Choose Reaction Mode (Priority: P1) 🎯 MVP

**Goal**: Let users switch each allowed group between active and passive behavior.

**Independent Test**: Open an allowed group and change its mode; the selected mode should be stored and visible in the menu.

### Implementation for User Story 1

- [X] T004 [US1] Add reaction-mode selection to the Allowed Group detail menu in `src/ui/menu.handler.ts`

**Checkpoint**: Users can choose a mode for a specific allowed group.

---

## Phase 4: User Story 2 - Preserve Current Behavior (Priority: P2)

**Goal**: Existing allowed groups keep replying by default unless changed.

**Independent Test**: Load an existing config without reaction-mode values and confirm allowed groups behave as active.

### Implementation for User Story 2

- [X] T005 [US2] Backfill missing allowed-group reaction mode to active on config load and new group creation in `src/services/session.manager.ts`

**Checkpoint**: Legacy groups keep current always-reply behavior by default.

---

## Phase 5: User Story 3 - Ignore Untagged Messages in Passive Mode (Priority: P3)

**Goal**: Passive groups only trigger when the agent is directly mentioned with @.

**Independent Test**: Send one untagged message and one @-mention to a passive allowed group; only the mention should get a reply.

### Implementation for User Story 3

- [X] T006 [US3] Add incoming group mention detection helper in `src/services/whatsapp.service.ts`
- [X] T007 [US3] Gate passive-mode replies so only @-mentioned messages reach the agent in `src/services/whatsapp.service.ts`

**Checkpoint**: Passive mode ignores untagged messages and still responds to direct mentions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and docs alignment

- [X] T008 [P] Update `specs/028-group-reaction-mode/quickstart.md` with final verification steps and run project checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies; can start immediately.
- **Phase 2**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2.
- **Phase 5 (US3)**: Depends on Phase 2.
- **Phase 6**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1**: No dependency on other user stories; MVP slice.
- **US2**: Depends on foundation only; validates backward compatibility.
- **US3**: Depends on foundation only; validates message filtering.

### Parallel Opportunities

- **Setup**: `T001` and `T002` can run in parallel.
- **User stories**: `T005` and `T006` can run in parallel after foundation.
- **Polish**: `T008` can run after story completion.

## Parallel Example: User Story 1

```bash
Task: "Add reaction-mode selection to the Allowed Group detail menu in src/ui/menu.handler.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add incoming group mention detection helper in src/services/whatsapp.service.ts"
Task: "Gate passive-mode replies so only @-mentioned messages reach the agent in src/services/whatsapp.service.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and verify group mode switching works

### Incremental Delivery

1. Ship Setup + Foundational
2. Add User Story 1 for mode switching
3. Add User Story 2 for default active compatibility
4. Add User Story 3 for passive mention-only replies
5. Finish with polish and quickstart validation
