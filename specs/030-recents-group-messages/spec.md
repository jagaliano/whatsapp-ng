# Feature Specification: Recents — Group Messages by Same Text and Time

**Feature Branch**: `030-recents-group-messages`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "In Recents, group messages with same text and same time into one line, as a single entity. For allowed contacts in this entity, consider JID when user sets allowed contact."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grouped Recents List Display (Priority: P1)

A user opens the Recents view and sees a compact, deduplicated list. When several different contacts received (or sent) the exact same message text within the same minute, all of those conversations are collapsed into a single line. The line shows the shared message preview, the shared time, and a count of how many contacts are in the group. This prevents the recents list from being flooded by multiple identical entries — a common pattern with broadcast-style messages.

**Why this priority**: The core visual improvement. Without this, the recents list becomes cluttered whenever the same text arrives from multiple senders at the same time. Grouping is the minimum deliverable.

**Independent Test**: Populate recents with three contacts that all have the same `lastMessagePreview` and `lastMessageTime` (same minute). Open the Recents view and verify exactly one grouped line appears in place of three separate lines, displaying the shared text and the count "3 contacts".

**Acceptance Scenarios**:

1. **Given** three recent contacts share identical preview text and their last-message timestamps fall within the same minute, **When** the user opens Recents, **Then** the three contacts are collapsed into one grouped line showing the shared text, the time, and "(3 contacts)".
2. **Given** two contacts share the same preview text but their timestamps differ by more than one minute, **When** the user opens Recents, **Then** they appear as two separate ungrouped lines.
3. **Given** two contacts share the same timestamp (same minute) but have different preview texts, **When** the user opens Recents, **Then** they appear as two separate ungrouped lines.
4. **Given** all recent contacts have unique text/time combinations, **When** the user opens Recents, **Then** the display is identical to the current ungrouped behaviour.

---

### User Story 2 - Expanding a Grouped Entry (Priority: P2)

A user sees a grouped line in Recents and wants to act on a specific contact within the group. They select the grouped line and are presented with a sub-list of all the individual contacts that belong to that group, each shown with its own display name and sender identifier. From there they can choose one individual contact and proceed as normal (view history, send a message, or allow the contact).

**Why this priority**: Grouping without the ability to drill down would hide contacts from the user. This story makes grouping non-destructive: no conversation is inaccessible, the group is only a display convenience.

**Independent Test**: Create a group of two contacts with identical text/time. Select the grouped entry. Verify a sub-list shows both contacts individually. Select one and verify the normal per-contact actions are available.

**Acceptance Scenarios**:

1. **Given** a grouped entry representing N contacts, **When** the user selects that grouped entry, **Then** a sub-list of all N individual contacts is presented.
2. **Given** a sub-list of individual contacts within a group, **When** the user selects one contact, **Then** the standard per-contact actions (History, Send Message, Allow Contact, etc.) are available for that contact.
3. **Given** a grouped entry, **When** the user navigates back from the sub-list, **Then** the Recents list is shown again with the grouped view intact.

---

### User Story 3 - JID-Aware "Allow Contact" from a Grouped Entity (Priority: P2)

When a user allows a contact from within a grouped entity's sub-list, the system stores and matches the contact using the full WhatsApp JID (e.g. `12345678901@s.whatsapp.net`) rather than only a normalized phone number string. This ensures that the "is this contact allowed?" check in the recents view reflects correctly for that contact, including for contacts whose JID representation differs from a plain phone number (e.g. contacts that never had a `+` prefix normalised, or contacts added via JID directly).

**Why this priority**: Equal priority to story 2 because it is the second explicit user requirement. Incorrect JID handling would cause "allow contact" actions taken from the grouped entity to fail to mark the contact as allowed in the Recents list.

**Independent Test**: From a grouped entity sub-list, select a contact and choose "Allow Contact". Verify the contact's JID is stored in the allowed list. Re-open Recents and verify the `isAllowed` flag for that contact's conversation is `true`.

**Acceptance Scenarios**:

1. **Given** a contact appears inside a grouped entity sub-list, **When** the user chooses "Allow Contact" for that contact, **Then** the contact is added to the allowed list keyed by its full JID.
2. **Given** a contact was allowed via JID from a grouped entity, **When** a subsequent message arrives from that JID, **Then** the message is processed (not silently dropped) and `isAllowed` is `true` in the Recents summary for that conversation.
3. **Given** a contact is already allowed, **When** the user opens the grouped entity sub-list, **Then** the "Allow Contact" action is not shown for that contact (consistent with current per-contact behaviour).

---

### Edge Cases

- What happens when a grouped entity contains only one contact after the others are removed from recents? The single-contact group should display as a normal ungrouped line.
- How does the system handle a grouped entry where some contacts are already allowed and others are not? Each contact within the sub-list shows its individual allowed status.
- What happens when two contacts have the same text and same minute but one is an incoming message and the other is outgoing? They are still grouped (same text + same minute is sufficient); direction difference is shown per contact in the sub-list.
- What if the recents list has exactly one page and all entries belong to a single group? The group line occupies one slot; pagination behaviour is unchanged.
- How does the system handle a contact whose JID cannot be resolved to a phone number? The JID itself is used as the identifier throughout (storing, matching, and displaying).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Recents list MUST collapse all entries that share the same normalized message preview text AND whose last-message timestamps fall within the same clock minute into a single grouped line.
- **FR-002**: A grouped line MUST display the shared message preview, the shared time, and the number of contacts in the group (e.g. "(3 contacts)").
- **FR-003**: Selecting a grouped line MUST open a sub-list showing each individual contact within the group.
- **FR-004**: From the sub-list, the user MUST be able to access all standard per-contact actions (History, Send Message, Allow Contact) for each individual contact.
- **FR-005**: When the user adds a contact to the allowed list from within a grouped entity sub-list, the system MUST store the contact keyed by its full JID.
- **FR-006**: The `isAllowed` flag computed for each conversation in the Recents list MUST correctly reflect JID-based allowed-list entries added via the grouped entity flow.
- **FR-007**: Contacts that do not share text and time with any other contact MUST continue to appear as ungrouped, individual lines with no change to current display behaviour.
- **FR-008**: The grouping logic MUST be applied at display time (read path) and MUST NOT alter the underlying stored recents data.

### Key Entities

- **Grouped Recents Entry**: A display-only entity representing one or more individual `RecentConversationSummary` records that share the same normalized preview text and same clock minute. Carries: shared preview text, shared time, list of constituent contacts, combined `isAllowed` awareness per contact.
- **RecentConversationSummary** (existing): One record per sender number/JID. Stores `senderNumber`, `lastMessagePreview`, `lastMessageTime`, `isAllowed`, etc. Not mutated by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When N ≥ 2 conversations share the same preview and minute, the Recents list displays exactly 1 grouped line instead of N lines.
- **SC-002**: No existing conversation is inaccessible — every contact reachable before grouping remains reachable via the sub-list after grouping.
- **SC-003**: A contact allowed via the grouped entity sub-list appears as `isAllowed: true` in the Recents list on the very next open, without requiring a restart.
- **SC-004**: The underlying `recents.json` store is not modified by the grouping feature; only the display layer changes.

## Assumptions

- "Same time" is defined as timestamps that share the same calendar minute (year, month, day, hour, minute); sub-minute differences are considered the same time.
- Grouping applies to all entries in the Recents list regardless of message direction (incoming or outgoing).
- The JID stored when allowing a contact from a grouped entity is the `senderNumber` value already present in the `RecentConversationSummary` (which may be a full JID like `12345678901@s.whatsapp.net` or a normalized phone number); no additional JID resolution from Baileys is required.
- The existing `normalizeNumber` logic in the recents service correctly normalizes phone numbers before storage; this feature does not change that normalization for contacts not entering via the grouped allow-contact flow.
- Grouped entries respect the existing 20-conversation limit — grouping is a display-only reduction and does not increase data stored.
- This feature applies only to the Recents view and does not affect the Allowed Contacts or Allowed Groups lists.
