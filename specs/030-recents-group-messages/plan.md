# Implementation Plan: Recents — Group Messages by Same Text and Time

**Branch**: `030-recents-group-messages` | **Date**: 2026-05-15 | **Spec**: `specs/030-recents-group-messages/spec.md`

## Summary

Add display-time grouping to the Recents view: conversations sharing the same normalized preview text and calendar minute are collapsed into one line. Selecting a grouped line shows a sub-list of individual contacts. All per-contact actions (including Allow Contact) work unchanged on the drilled-down individual contact, using the stored `senderNumber` as the JID key. No changes to the recents data store.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `@whiskeysockets/baileys`, `@mariozechner/pi-coding-agent` (ExtensionCommandContext / ui)  
**Storage**: No storage changes — grouping is display-only; `recents.json` is unchanged  
**Testing**: Vitest  
**Target Platform**: Desktop Node.js CLI/TUI extension  
**Performance Goals**: Grouping logic is O(n) over at most 20 conversations; imperceptible overhead  
**Constraints**: Must not mutate `RecentsService` or `recents.json`; must preserve all existing per-contact actions; must not break pagination  
**Scale/Scope**: At most 20 conversations in the recents list; display-only change confined to `MenuHandler`

## Constitution Check

- [x] **I. OOP**: Grouping logic is encapsulated in new private methods on `MenuHandler`; `GroupedRecentEntry` is a typed local interface.
- [x] **II. Clean Code**: `groupRecentConversations`, `getRecentsGroupKey`, `formatGroupedRecentOption`, `manageGroupedRecentEntry` each have a single, clearly named responsibility.
- [x] **III. SOLID**: `MenuHandler` is extended open/closed — new grouping path added without touching existing `manageRecentConversation`; `RecentsService` is untouched (SRP preserved).
- [x] **IV. TypeScript**: `GroupedRecentEntry` interface is strictly typed; no `any` additions.
- [x] **V. Simplicity**: Pure display-layer change; no new service, no persistence, no new dependency. Minimal new code surface.

## Project Structure

### Documentation (this feature)

```text
specs/030-recents-group-messages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Changes

```text
src/
├── ui/
│   └── menu.handler.ts          ← grouping logic + new sub-list flow
└── i18n.ts                      ← new grouped-entry i18n key (all locales)

tests/unit/
└── menu.handler.recents-grouping.test.ts   ← new test file
```

**Structure Decision**: Single project, Option 1. Changes are confined to the UI layer (`src/ui/`) and the i18n string table.

## Phase 1: Implementation

### 1.1 — New local interface in `src/ui/menu.handler.ts`

Add after the existing `HistoryOptionEntry` interface:

```typescript
interface GroupedRecentEntry {
    conversations: RecentConversationSummary[];
    sharedPreview: string;
    sharedTime: number;
}
```

### 1.2 — New private methods in `MenuHandler`

#### A. `getRecentsGroupKey` — builds the grouping key

```typescript
private getRecentsGroupKey(conversation: RecentConversationSummary): string {
    const d = new Date(conversation.lastMessageTime);
    const minuteKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
    return `${conversation.lastMessagePreview}::${minuteKey}`;
}
```

#### B. `groupRecentConversations` — converts the flat list into grouped entries

```typescript
private groupRecentConversations(conversations: RecentConversationSummary[]): GroupedRecentEntry[] {
    const groups = new Map<string, RecentConversationSummary[]>();
    for (const conversation of conversations) {
        const key = this.getRecentsGroupKey(conversation);
        const existing = groups.get(key) ?? [];
        existing.push(conversation);
        groups.set(key, existing);
    }
    return Array.from(groups.values()).map(members => ({
        conversations: members,
        sharedPreview: members[0].lastMessagePreview,
        sharedTime: members[0].lastMessageTime
    }));
}
```

#### C. `formatGroupedRecentOption` — formats a line in the grouped recents list

```typescript
private formatGroupedRecentOption(entry: GroupedRecentEntry): string {
    if (entry.conversations.length === 1) {
        return this.formatRecentConversationOption(entry.conversations[0]);
    }
    const time = this.formatDateTime(entry.sharedTime);
    const countLabel = t('menu.recents.grouped.contacts', { count: entry.conversations.length });
    return `${entry.sharedPreview} • ${time} • ${countLabel}`;
}
```

#### D. `manageGroupedRecentEntry` — sub-list for multi-contact groups

```typescript
private async manageGroupedRecentEntry(ctx: ExtensionCommandContext, entry: GroupedRecentEntry) {
    const title = t('menu.recents.grouped.title', { count: entry.conversations.length });
    const backLabel = t('menu.recents.contact.back');
    const options = [
        ...entry.conversations.map(c => this.formatRecentConversationOption(c)),
        backLabel
    ];

    const choice = await ctx.ui.select(title, options);
    if (!choice || choice === backLabel) {
        await this.manageRecents(ctx);
        return;
    }

    const selected = entry.conversations.find(
        c => this.formatRecentConversationOption(c) === choice
    );
    if (!selected) return;

    await this.manageRecentConversation(ctx, selected);
}
```

### 1.3 — Modify `manageRecents` in `MenuHandler`

Replace the flat `recentConversations` loop with a grouped one. Key changes:

- After fetching `recentConversations`, apply `this.groupRecentConversations(recentConversations)` to produce `groupedEntries`.
- Iterate and paginate over `groupedEntries` instead of `recentConversations`.
- Format each entry with `formatGroupedRecentOption(entry)` instead of `formatRecentConversationOption(conversation)`.
- On selection: if `entry.conversations.length === 1`, call `manageRecentConversation(ctx, entry.conversations[0])`; else call `manageGroupedRecentEntry(ctx, entry)`.

### 1.4 — i18n additions in `src/i18n.ts`

Add to every locale:

| Key | English value |
|-----|---------------|
| `menu.recents.grouped.contacts` | `({count} contacts)` |
| `menu.recents.grouped.title` | `Recents • ({count} contacts)` |

### 1.5 — New test file `tests/unit/menu.handler.recents-grouping.test.ts`

Unit tests for the pure grouping helpers (called via a minimal `MenuHandler` stub or extracted helper):

| Test | What it verifies |
|------|------------------|
| Two conversations with same preview and same minute are grouped into one entry | `groupRecentConversations` returns 1 entry for 2 matching inputs |
| Two conversations with same preview but different minutes are not grouped | Returns 2 separate entries |
| Two conversations with different previews but same minute are not grouped | Returns 2 separate entries |
| A group with one conversation uses individual display format | `formatGroupedRecentOption` delegates to `formatRecentConversationOption` |
| A group with N > 1 conversations shows count label | `formatGroupedRecentOption` output contains `(N contacts)` |
| Original conversation order within a group is preserved | Members in the grouped entry appear in arrival order |

## Complexity Tracking

No constitution violations. Total change surface: ~60 lines added in `menu.handler.ts`, ~8 i18n string additions across 4 locales, plus the new test file.
