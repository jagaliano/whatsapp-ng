# Feature Specification: Blocked Numbers Management

**Feature Branch**: `004-blocked-numbers-management`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Is it possible to include a Blocked Numbers item in the /whatsapp menu? This list will have the blocked numbers. Is it possible to select one blocked number and allow it in the allowed numbers list?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Blocked Numbers (Priority: P2)

As a Software Engineer using Pi TUI, I want to see a dedicated list of phone numbers that I have blocked so that I can keep track of ignored contacts.

**Why this priority**: Medium. Essential for transparency and management of the block list.

**Independent Test**: Can be fully tested by opening the `/whatsapp` menu, selecting "Blocked Numbers", and verifying the displayed list matches the expected blocked contacts.

**Acceptance Scenarios**:

1. **Given** the user has blocked numbers, **When** they navigate to "Blocked Numbers", **Then** the TUI displays a list of all currently blocked E.164 numbers.
2. **Given** the blocked list is empty, **When** the user opens the "Blocked Numbers" menu, **Then** a "No blocked numbers" message is shown.

---

### User Story 2 - Unblock and Allow Number (Priority: P1)

As a user, I want to easily restore an ignored contact by selecting them from the blocked list and moving them to the allowed list so that the Agent can start answering their messages.

**Why this priority**: High. This is the core functionality requested and provides a quick way to correct accidental blocks or change permissions.

**Independent Test**: Select a number in the "Blocked Numbers" list, choose the "Unblock and Allow" action, and verify the number moves to the "Allowed Numbers" list and receives Agent responses.

**Acceptance Scenarios**:

1. **Given** a number in the Blocked List, **When** the user selects it and chooses "Unblock and Allow", **Then** the number is removed from the Blocked List and added to the Allowed List.
2. **Given** the "Unblock and Allow" action is triggered, **When** the operation completes, **Then** a confirmation notification is displayed in the TUI.

### Edge Cases

- **Duplicate Entry**: What happens if a user manually tries to add a number to the "Allowed List" that is already in the "Blocked List"? (Requirement: FR-006 - Migration MUST be preferred or the number MUST be automatically removed from the block list).
- **Empty List Selection**: How does the UI handle attempts to access management actions when the Blocked List is empty? (Assumption: The "Blocked Numbers" menu item should either be disabled or show an informative empty state).
- **Invalid Number Format**: While numbers in the Blocked List should already be validated, any manual manipulation MUST re-verify E.164 compliance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a persistent "Block List" in the `config.json` file.
- **FR-002**: System MUST add a "Blocked Numbers" item to the main `/whatsapp` menu.
- **FR-003**: System MUST allow selecting a specific number from the Blocked List to trigger management actions.
- **FR-004**: System MUST provide an "Unblock and Allow" action for selected blocked numbers.
- **FR-005**: System MUST automatically migrate a number from the Blocked List to the Allowed List upon the "Unblock and Allow" action.
- **FR-006**: System MUST ensure that a number never exists in both the Allowed List and Blocked List simultaneously (enforce mutual exclusivity).

### Key Entities

- **Block List**: A collection of phone number strings authorized to be ignored by the Agent's message interceptor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: "Unblock and Allow" operation completes in under 200ms (local data migration).
- **SC-002**: Zero data loss or duplication during the migration between lists.
- **SC-003**: 100% of user-triggered unblocks result in the Agent immediately processing the next message from that contact.

## Assumptions

- Phone numbers are stored and managed in international E.164 format.
- The `config.json` file is the source of truth for both lists.
- User confirmation is required before performing a list migration to prevent accidental unblocks.
