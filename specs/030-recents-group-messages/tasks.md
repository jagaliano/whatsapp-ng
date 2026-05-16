# Tasks: Recents — Group Messages by Same Text and Time

**Input**: Design documents from `/specs/030-recents-group-messages/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or no file conflicts)
- **[Story]**: User story this task belongs to

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Interface declaration and i18n string additions that every subsequent phase depends on.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [ ] T001 Add `GroupedRecentEntry` interface `{ conversations: RecentConversationSummary[]; sharedPreview: string; sharedTime: number; }` after the `HistoryOptionEntry` interface in `src/ui/menu.handler.ts`
- [ ] T002 [P] Add `menu.recents.grouped.contacts` (`({count} contacts)`) and `menu.recents.grouped.title` (`Recents • ({count} contacts)`) keys to all four locales (en, pt, es, fr) in `src/i18n.ts`

**Checkpoint**: Interface declared, i18n keys available — user story phases can begin.

---

## Phase 2: User Story 1 — Grouped Recents List Display (Priority: P1) 🎯 MVP

**Goal**: The Recents list collapses conversations sharing the same preview text and calendar minute into one line showing the shared text, time, and contact count.

**Independent Test**: Populate recents with three contacts sharing identical preview + same minute timestamp. Open Recents and confirm exactly one grouped line appears showing `(3 contacts)`, while contacts with unique text/time remain as individual lines.

### Implementation for User Story 1

- [ ] T003 [US1] Implement `private getRecentsGroupKey(conversation: RecentConversationSummary): string` in `src/ui/menu.handler.ts` — builds key `{lastMessagePreview}::{year}-{month}-{day}-{hour}-{minute}` using `new Date(conversation.lastMessageTime)`
- [ ] T004 [US1] Implement `private groupRecentConversations(conversations: RecentConversationSummary[]): GroupedRecentEntry[]` in `src/ui/menu.handler.ts` — uses `Map<string, RecentConversationSummary[]>` keyed by `getRecentsGroupKey`, returns one `GroupedRecentEntry` per key (depends on T003)
- [ ] T005 [US1] Implement `private formatGroupedRecentOption(entry: GroupedRecentEntry): string` in `src/ui/menu.handler.ts` — for single-member entries delegates to `formatRecentConversationOption(entry.conversations[0])`; for multi-member entries returns `{sharedPreview} • {time} • {countLabel}` using `t('menu.recents.grouped.contacts', { count })` (depends on T002)
- [ ] T006 [US1] Refactor `manageRecents()` in `src/ui/menu.handler.ts` — after fetching `recentConversations`, call `this.groupRecentConversations(recentConversations)` and paginate/display over the resulting `GroupedRecentEntry[]` using `formatGroupedRecentOption`; for now route all selections to `manageRecentConversation(ctx, entry.conversations[0])` regardless of group size (depends on T004, T005)

### Tests for User Story 1

- [ ] T007 [P] [US1] Create `tests/unit/menu.handler.recents-grouping.test.ts` with a minimal `MenuHandler` stub (mock `WhatsAppService`, `SessionManager`, `RecentsService`) and write tests: (a) two conversations same preview + same minute → `groupRecentConversations` returns 1 entry with both in `conversations`; (b) same preview but different minute → 2 separate entries; (c) same minute but different previews → 2 separate entries; (d) single-member entry → `formatGroupedRecentOption` output matches `formatRecentConversationOption` output exactly (access private methods via `(handler as any).method(...)`) (depends on T003, T004, T005)

**Checkpoint**: User Story 1 fully functional — grouped line appears in Recents, single-contact groups display normally.

---

## Phase 3: User Story 2 — Expanding a Grouped Entry (Priority: P2)

**Goal**: Selecting a grouped line opens a sub-list of all individual contacts; selecting a contact from the sub-list leads to the normal per-contact menu.

**Independent Test**: With a 2-contact group, select the grouped entry → confirm a sub-list appears with 2 individual contact options → select one → confirm standard per-contact actions (History, Send Message, Allow Contact, Back) are available. Navigate Back → confirm Recents is shown with the grouped view.

### Implementation for User Story 2

- [ ] T008 [US2] Implement `private async manageGroupedRecentEntry(ctx: ExtensionCommandContext, entry: GroupedRecentEntry): Promise<void>` in `src/ui/menu.handler.ts` — shows a `ctx.ui.select` with title `t('menu.recents.grouped.title', { count })`, lists each contact via `formatRecentConversationOption`, includes Back option; on selection calls `manageRecentConversation(ctx, selected)`, on Back calls `manageRecents(ctx)` (depends on T002)
- [ ] T009 [US2] Update `formatGroupedRecentOption()` in `src/ui/menu.handler.ts` — add the multi-member branch: return `{sharedPreview} • {time} • {countLabel}` with `t('menu.recents.grouped.contacts', { count: entry.conversations.length })` (this completes the partial implementation from T005) (depends on T005)
- [ ] T010 [US2] Update `manageRecents()` in `src/ui/menu.handler.ts` — change the selection handler so that when `entry.conversations.length > 1` it calls `manageGroupedRecentEntry(ctx, entry)` instead of `manageRecentConversation` directly (depends on T006, T008)

### Tests for User Story 2

- [ ] T011 [P] [US2] Add tests to `tests/unit/menu.handler.recents-grouping.test.ts`: (a) N > 1 member entry → `formatGroupedRecentOption` output contains `(N contacts)`; (b) N = 1 member entry → output does NOT contain `contacts` count label; (c) conversation order within a group is preserved (members appear in input order) (depends on T007, T009)

**Checkpoint**: User Stories 1 AND 2 functional — grouped line visible, drill-down sub-list works, all per-contact actions accessible.

---

## Phase 4: User Story 3 — JID-Aware Allow Contact from Grouped Entity (Priority: P2)

**Goal**: Allowing a contact from within a grouped entity sub-list stores the contact keyed by its `senderNumber` (JID as recorded by `RecentsService`), matching the existing `isConversationAllowed` lookup correctly.

**Independent Test**: Allow a contact via the grouped sub-list path → confirm `sessionManager.addNumber` was called with the exact `senderNumber` from the `RecentConversationSummary` → confirm `isAllowed` is `true` for that number on the next Recents open.

> **Note**: No production code change required. `manageRecentConversation()` already calls `sessionManager.addNumber(conversation.senderNumber, ...)`. This phase is verification-only.

### Tests for User Story 3

- [ ] T012 [US3] Add test to `tests/unit/menu.handler.recents-grouping.test.ts`: simulate the allow-contact flow from a grouped sub-list entry — mock `sessionManager.addNumber`, call `(handler as any).manageRecentConversation(ctx, conversation)` selecting the allow-contact option, assert `addNumber` was called with `conversation.senderNumber` unmodified (i.e., not further transformed) (depends on T011)

**Checkpoint**: All three user stories functional and verified — grouping, drill-down, and JID-correct allow-contact all tested.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T013 [P] Verify no unused import or variable warnings in `src/ui/menu.handler.ts` after all additions (TypeScript compiler check via `npm run build` or `tsc --noEmit`)
- [ ] T014 Run full test suite `npm test` to confirm no regressions in existing recents, session, or other unit tests
- [ ] T015 Validate Scenarios A–E from `specs/030-recents-group-messages/quickstart.md` against a live WhatsApp session

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Requires Phase 1 complete (interface + i18n)
- **US2 (Phase 3)**: Requires Phase 2 complete (grouping infrastructure must exist)
- **US3 (Phase 4)**: Requires Phase 3 complete (sub-list must navigate to `manageRecentConversation`)
- **Polish (Phase 5)**: Requires all story phases complete

### Within Each Phase

- T001 and T002 are independent of each other (different files) → run in parallel
- T003 before T004 (T004 calls `getRecentsGroupKey`)
- T003 + T004 before T005/T006 (formatting and navigation depend on grouping)
- T007 after T003–T005 (tests cover implemented methods)
- T008 before T010 (T010 routes to `manageGroupedRecentEntry`)
- T009 after T005 (extends single-member implementation to multi-member)
- T011 after T007, T009
- T012 after T011

### Parallel Opportunities

- T001 ‖ T002 (different files, no conflict)
- T007 ‖ T011 ‖ T012 are in the same test file but can be drafted in parallel and merged; final write must be sequential

---

## Parallel Example: Phase 1

```
T001: Add GroupedRecentEntry interface to src/ui/menu.handler.ts
T002: Add i18n keys to src/i18n.ts
→ Both can execute simultaneously (different files)
```

## Parallel Example: Phase 2

```
Sequential chain:
T003 → T004 → T005 → T006 → T007
(each step builds on the previous in the same file)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001, T002)
2. Complete Phase 2: User Story 1 (T003–T007)
3. **STOP and VALIDATE**: Grouped line visible in Recents; single-contact groups unaffected; tests pass
4. Demo if ready

### Incremental Delivery

1. Phase 1 → Phase 2 → **Demo grouped Recents list**
2. Phase 3 → **Demo drill-down sub-list**
3. Phase 4 → **Demo JID-correct Allow Contact**
4. Phase 5 → Full polish and sign-off

---

## Notes

- `[P]` marks tasks in different files with no shared write conflict
- `[Story]` maps each task to its user story for traceability
- Private methods on `MenuHandler` are tested via `(handler as any).method()` — standard Vitest pattern for this codebase
- No changes to `RecentsService`, `SessionManager`, or `recents.json` — the entire feature is display-layer only
- US3 requires zero new production code; its phase is pure test coverage
