# Data Model: Recents — Group Messages by Same Text and Time

## Overview

This feature introduces one new **display-only** entity, `GroupedRecentEntry`. No persistent storage is changed.

---

## New Display Entity: `GroupedRecentEntry`

A transient, in-memory value produced at render time by `MenuHandler.groupRecentConversations()`. It is never serialized or persisted.

| Field | Type | Description |
|-------|------|-------------|
| `conversations` | `RecentConversationSummary[]` | All individual conversations collapsed into this group. Always has ≥ 1 element. |
| `sharedPreview` | `string` | The normalized message preview text shared by all members. Taken from `conversations[0].lastMessagePreview`. |
| `sharedTime` | `number` | The representative timestamp for display (milliseconds). Taken from `conversations[0].lastMessageTime`. All members share the same calendar minute. |

### Grouping Rules

- **Key**: `{sharedPreview}::{year}-{month}-{day}-{hour}-{minute}` derived from each `RecentConversationSummary.lastMessageTime`.
- **Match condition**: Two conversations belong to the same group when their normalized preview texts are identical AND their timestamps share the same year, month, day, hour, and minute.
- **Order within group**: Conversations appear in the same order they were returned by `RecentsService.getRecentConversations()` (sorted by most recent message time descending).
- **Single-member group**: A group with exactly one conversation is rendered and navigated identically to a non-grouped conversation — no sub-list is shown.

### Validation Rules

- `conversations` MUST NOT be empty.
- `sharedPreview` MUST equal `conversations[0].lastMessagePreview`.
- `sharedTime` MUST be within the same calendar minute as every `conversation.lastMessageTime` in the group.

---

## Existing Entity: `RecentConversationSummary` (unchanged)

| Field | Type | Notes |
|-------|------|-------|
| `senderNumber` | `string` | Normalized phone number (e.g. `+5511999998888`) or group JID (e.g. `123@g.us`). Used as the JID key when allowing a contact. |
| `senderName` | `string \| undefined` | Display name if known. |
| `lastMessagePreview` | `string` | Normalized, max-80-char text. Used as grouping key component. |
| `lastMessageTime` | `number` | Unix ms timestamp. Calendar-minute component used as grouping key. |
| `lastMessageDirection` | `MessageDirection` | `'incoming'` or `'outgoing'`. Not used in grouping key. |
| `messageCount` | `number` | Total messages in history for this sender. |
| `isAllowed` | `boolean` | Whether this sender is in the allowed list. Shown per-contact in the sub-list. |

---

## Grouping Key Derivation

```
key(conversation) =
    conversation.lastMessagePreview
    + "::"
    + year(lastMessageTime)
    + "-" + month(lastMessageTime)       // 0-indexed, as returned by Date.getMonth()
    + "-" + dayOfMonth(lastMessageTime)
    + "-" + hour(lastMessageTime)
    + "-" + minute(lastMessageTime)
```

---

## Storage: No Changes

| Store | Changed? | Notes |
|-------|----------|-------|
| `~/.pi/whatsapp-pi/recents/recents.json` | No | Raw `RecentConversationSummary` records remain as-is. |
| `~/.pi/whatsapp-pi/config.json` | No | Allowed list entries added via this feature use the existing `addNumber()` / `addAllowedGroup()` path with no format changes. |
| Auth state files | No | Unaffected. |
