# Research: Recents — Group Messages by Same Text and Time

## 1) Defining "same time" — granularity of the grouping window

- **Decision**: Two conversations are considered same-time when their `lastMessageTime` timestamps share the same calendar minute (identical year, month, day, hour, and minute).
- **Rationale**: Broadcast-style messages arrive within milliseconds of each other but may differ by sub-second amounts. A minute window catches all practical same-burst messages without grouping messages that are genuinely separate. Stricter windows (e.g., 5-second tolerance) would require a sliding-window comparison which is O(n²) on insertion; minute-level granularity allows a simple deterministic key.
- **Alternatives considered**: Exact millisecond match (too strict — broadcast arrivals differ by tens of ms); 5-minute window (too loose — unrelated messages could collapse); timestamp floored to the nearest second (reasonable but minute is more human-legible and no use case requires finer precision here).

## 2) Where grouping logic lives

- **Decision**: New private methods on `MenuHandler` (`groupRecentConversations`, `getRecentsGroupKey`, `formatGroupedRecentOption`, `manageGroupedRecentEntry`). No changes to `RecentsService`.
- **Rationale**: Grouping is a display concern — it should not affect how messages are stored, retrieved, or queried. `RecentsService` has a single responsibility (persist and retrieve raw conversation data). Mixing display logic there would violate SRP. `MenuHandler` already owns all formatting and navigation decisions for the Recents view.
- **Alternatives considered**: Adding a `getGroupedRecentConversations()` method to `RecentsService` (crosses service/UI boundary — the service would need to know about a display concept like "same minute"); creating a new `RecentsGroupingService` (overkill for a ~30-line transformation).

## 3) JID matching when allowing a contact from a grouped entry

- **Decision**: Pass `conversation.senderNumber` directly to `sessionManager.addNumber()` — identical to the existing allow-contact flow in `manageRecentConversation`. No additional JID transformation.
- **Rationale**: `RecentsService.normalizeNumber()` already converts raw Baileys JIDs (e.g., `5511999998888@s.whatsapp.net`) to a stable normalized form (`+5511999998888`) before storing them in `RecentConversationSummary.senderNumber`. The `SessionManager.isAllowed()` check compares against that same normalized value. The flow is already JID-consistent; the feature requirement is satisfied by drilling into the individual contact's `RecentConversationSummary` from the sub-list and using its `senderNumber` — no extra step needed.
- **Alternatives considered**: Storing the raw JID in a parallel field on `GroupedRecentEntry` (unnecessary — `senderNumber` is already the canonical identifier); calling `toJid()` inside the allow path (would re-add `@s.whatsapp.net`, breaking the `isAllowed` lookup which expects the normalized form).

## 4) Grouping key construction

- **Decision**: Key = `"{lastMessagePreview}::{year}-{month}-{day}-{hour}-{minute}"`. Uses the same `lastMessagePreview` value already stored (which is normalized by `buildPreview()` — special characters stripped, max 80 chars).
- **Rationale**: Preview text is already normalized before storage, so two conversations with the "same" raw text will have identical preview strings. Concatenating with a `::` separator makes accidental collisions between text content and time strings negligible.
- **Alternatives considered**: Hashing text + timestamp (adds a crypto/hash dependency for no benefit); using only the timestamp minute without the text (would group unrelated conversations at the same minute).

## 5) Pagination interaction with grouped entries

- **Decision**: The existing page-size-10 pagination operates over the `GroupedRecentEntry[]` array (the post-grouping list), not the raw `RecentConversationSummary[]` array.
- **Rationale**: The grouped list is at most 20 entries and may be fewer after collapsing. Paginating the grouped list is correct UX — the user sees pages of grouped lines. Paginating the raw list would show ungrouped entries on one page and then jump to a grouped view, creating a confusing inconsistency.
- **Alternatives considered**: No pagination change (would work for ≤10 grouped entries, but could break for >10).

## 6) Single-contact groups degrade gracefully

- **Decision**: When a `GroupedRecentEntry` has exactly one conversation, `formatGroupedRecentOption` delegates to `formatRecentConversationOption` (no count label shown), and on selection the handler calls `manageRecentConversation` directly (no sub-list shown).
- **Rationale**: The spec requires single-contact groups to display as normal ungrouped lines. This is the simplest implementation and avoids a confusing sub-list with only one item.
- **Alternatives considered**: Always showing the sub-list (poor UX for single items); filtering single-item groups out of the grouping pass entirely (equivalent result, but the delegate approach keeps the code path uniform).
