# Tasks: Reaction Message Support

**Input**: Design documents from `/specs/034-reaction-message-support/`
**Prerequisites**: plan.md, spec.md, data-model.md

**Tests**: Unit tests included following existing project pattern

**Organization**: Tasks grouped by user story to enable independent implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US1b, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (i18n Setup)

**Purpose**: Add translation strings that all user stories will use

**⚠️ CRITICAL**: This phase MUST be complete before ANY user story implementation

- [ ] T001 Add reaction translation strings to `src/i18n.ts` (fallback locale)
  - `"incoming.media.reaction": "{emoji} Reacted to message"`
  - `"incoming.media.reactionRemoved": "Removed reaction"`
  - `"tool.sendReaction.label": "Send WhatsApp Reaction"`
  - `"tool.sendReaction.description": "React to a WhatsApp message with an emoji"`
  - `"tool.sendReaction.error.invalidEmoji": "Invalid emoji provided"`
- [ ] T002 [P] Add reaction translation strings to `src/i18n.ts` (pt-BR locale)
- [ ] T003 [P] Add reaction translation strings to `src/i18n.ts` (es locale)

**Checkpoint**: Translation strings ready - user story implementation can now begin

---

## Phase 2: User Story 1 - Display Emoji Reactions (Priority: P1) 🎯 MVP

**Goal**: Detect and display incoming reaction messages from contacts as human-readable text instead of "[Unsupported Message Type: reactionMessage]"

**Independent Test**: Have a contact react to a message with 👍, verify it displays as "👍 Reacted to message"

### Tests for User Story 1

- [ ] T004 [P] [US1] Add unit test for extracting reaction with emoji in `tests/unit/incoming-message.resolver.test.ts`
- [ ] T005 [P] [US1] Add unit test for handling removed reactions (empty text) in `tests/unit/incoming-message.resolver.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Extend `IncomingResolution` type union in `src/services/incoming-message.resolver.ts` to include `{ kind: 'reaction'; text: string; reactionMessage: any }`
- [ ] T007 [US1] Add reaction message detection logic in `extractIncomingText()` function in `src/services/incoming-message.resolver.ts` (check for `resolved?.reactionMessage`, format display text with emoji)
- [ ] T008 [US1] Update recents service to handle reaction message kind if needed (review `src/services/recents.service.ts`)

**Checkpoint**: User Story 1 complete - reactions from contacts display correctly

---

## Phase 3: User Story 1b - Agent Sends Reactions (Priority: P1) 🎯 MVP

**Goal**: Enable the agent to send emoji reactions to WhatsApp messages

**Independent Test**: Ask agent to "react to that message with 👍", verify reaction appears in WhatsApp

### Tests for User Story 1b

- [ ] T009 [P] [US1b] Create `tests/unit/reaction.sender.test.ts` with test for successful reaction sending
- [ ] T010 [P] [US1b] Add test for invalid emoji rejection in `tests/unit/reaction.sender.test.ts`
- [ ] T011 [P] [US1b] Add test for not-connected error in `tests/unit/reaction.sender.test.ts`

### Implementation for User Story 1b

- [ ] T012 [US1b] Create `src/services/reaction.sender.ts` with `ReactionSender` class
  - Constructor accepts `WASocket | null`
  - `sendReaction(options: SendReactionOptions): Promise<SendReactionResult>`
  - `isValidEmoji(emoji: string): boolean` with Unicode regex validation
- [ ] T013 [US1b] Define `SendReactionOptions` and `SendReactionResult` interfaces in `src/services/reaction.sender.ts`
- [ ] T014 [US1b] Register `send_reaction` Pi tool in extension (location depends on existing tool registration pattern)
  - Tool name: `send_reaction`
  - Parameters: `jid`, `messageId`, `emoji`
  - Integrate with `ReactionSender` service
- [ ] T015 [US1b] Add error handling for invalid inputs (missing jid, messageId, or invalid emoji)

**Checkpoint**: User Story 1b complete - agent can send reactions to messages

---

## Phase 4: User Story 2 - Handle Removed Reactions (Priority: P2)

**Goal**: Display clear indication when a contact removes a previously sent reaction

**Independent Test**: Have contact add then remove a reaction, verify "Removed reaction" message appears

### Tests for User Story 2

- [ ] T016 [P] [US2] Add unit test for removed reaction display text in `tests/unit/incoming-message.resolver.test.ts`

### Implementation for User Story 2

- [ ] T017 [US2] Verify removed reaction handling in `src/services/incoming-message.resolver.ts` (empty `text` field should trigger "Removed reaction" display)
- [ ] T018 [US2] Ensure removed reactions are properly logged in recents if applicable

**Checkpoint**: User Story 2 complete - removed reactions display correctly

---

## Phase 5: User Story 3 - Reaction Metadata Display (Priority: P3)

**Goal**: Optionally show which message was reacted to when context is available

**Independent Test**: Receive a reaction and verify the system can reference the original message context

### Implementation for User Story 3

- [ ] T019 [US3] Review and enhance reaction display to include message reference context if available in `src/services/incoming-message.resolver.ts` (optional enhancement)
- [ ] T020 [US3] Update recents service to store reaction context for reference in `src/services/recents.service.ts` if needed

**Checkpoint**: User Story 3 complete - reaction metadata context available

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and improvements

- [ ] T021 [P] Run all unit tests: `npm test -- tests/unit/incoming-message.resolver.test.ts tests/unit/reaction.sender.test.ts`
- [ ] T022 [P] Run linting: `npm run lint`
- [ ] T023 Verify TypeScript compilation: `npx tsc --noEmit`
- [ ] T024 Manual test per `quickstart.md` - display reactions
- [ ] T025 Manual test per `quickstart.md` - send reactions
- [ ] T026 Update AGENTS.md if new technologies were introduced (not expected for this feature)

**Final Checkpoint**: All user stories working, tests passing, lint clean

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies - can start immediately
- **Phase 2 (US1)**: Depends on T001 (fallback translations)
- **Phase 3 (US1b)**: Depends on T001 (fallback translations)
- **Phase 4 (US2)**: Depends on Phase 2 (US1) completion - uses same resolver logic
- **Phase 5 (US3)**: Depends on Phase 2 (US1) - enhances display with context
- **Phase 6 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (Display)**: Can start after Phase 1 complete
- **US1b (Send)**: Can start after Phase 1 complete - independent from US1
- **US2 (Removed)**: Depends on US1 (shares resolver logic) - extends display handling
- **US3 (Metadata)**: Depends on US1 - enhances with context

### Within Each User Story

- Tests should be written before implementation (TDD pattern)
- Models/interfaces before services
- Services before tool registration
- Core logic before edge cases

### Parallel Opportunities

- T001, T002, T003 (i18n for different locales) can run in parallel
- T004, T005 (resolver tests) can run in parallel
- T009, T010, T011 (sender tests) can run in parallel
- US1 and US1b can be implemented in parallel (different files)
- All Phase 6 polish tasks marked [P] can run in parallel

---

## Parallel Example: US1 + US1b Implementation

```bash
# Phase 1: Complete T001 first (blocking)
Task: "T001 Add reaction translation strings to src/i18n.ts"

# Then US1 and US1b can proceed in parallel:

# Track 1: User Story 1 (Display)
Task: "T004 Add unit test for extracting reaction with emoji"
Task: "T005 Add unit test for handling removed reactions"
Task: "T006 Extend IncomingResolution type union"
Task: "T007 Add reaction message detection logic"

# Track 2: User Story 1b (Send) - parallel with Track 1
Task: "T009 Create tests/unit/reaction.sender.test.ts"
Task: "T010 Add test for invalid emoji rejection"
Task: "T011 Add test for not-connected error"
Task: "T012 Create src/services/reaction.sender.ts"
Task: "T013 Define SendReactionOptions and SendReactionResult interfaces"
Task: "T014 Register send_reaction Pi tool"
```

---

## Implementation Strategy

### MVP First (US1 + US1b Only)

1. Complete Phase 1: T001 (translations)
2. Complete Phase 2: US1 (display reactions) - T004-T008
3. Complete Phase 3: US1b (send reactions) - T009-T015
4. **STOP and VALIDATE**: Test display and sending independently
5. Deploy/demo if ready (core functionality complete)

### Incremental Delivery

1. Complete Phase 1 (T001-T003) → i18n ready
2. Add US1 + US1b in parallel → Test independently → Deploy (MVP!)
3. Add US2 (removed reactions) → Test → Deploy
4. Add US3 (metadata) → Test → Deploy
5. Complete Phase 6 (polish)

### Parallel Team Strategy

With multiple developers:

1. Dev A: T001-T003 (i18n strings)
2. Once T001 complete:
   - Dev A: US1 (display) - T004-T008
   - Dev B: US1b (send) - T009-T015
3. Once US1 complete:
   - Dev A or C: US2 (removed) - T016-T018
   - Dev B or C: US3 (metadata) - T019-T020
4. Team: Phase 6 polish together

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | T001-T003 | i18n translations (blocking) |
| Phase 2 | T004-T008 | US1: Display reactions |
| Phase 3 | T009-T015 | US1b: Send reactions |
| Phase 4 | T016-T018 | US2: Removed reactions |
| Phase 5 | T019-T020 | US3: Metadata context |
| Phase 6 | T021-T026 | Polish & validation |

**Total Tasks**: 26
**MVP Tasks**: T001 + T004-T015 (13 tasks for US1 + US1b)
**Parallel Groups**: i18n locales (T002-T003), tests within each story
