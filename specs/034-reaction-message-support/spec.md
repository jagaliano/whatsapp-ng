# Feature Specification: Reaction Message Support

**Feature Branch**: `034-reaction-message-support`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: User description: "Implement the interpretation of the reaction message 'Message from Rapha Stello (276454310985862): [Unsupported Message Type: reactionMessage]'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Display Emoji Reactions (Priority: P1)

As a WhatsApp-Pi user, when someone reacts to a message with an emoji, I want to see a clear description of the reaction (e.g., "👍 Reacted to message") instead of "[Unsupported Message Type: reactionMessage]", so I can understand what happened without confusion.

**Why this priority**: This is the core value of the feature. Currently, reaction messages appear as confusing unsupported message types, degrading the user experience. This directly addresses the issue described in the feature request.

**Independent Test**: Can be fully tested by sending a reaction emoji to any message in WhatsApp and verifying the reaction appears as a human-readable message in the chat interface.

**Acceptance Scenarios**:

1. **Given** a contact reacts to a message with 👍 emoji, **When** the reaction is received, **Then** the system displays "👍 Reacted to message" or similar clear description
2. **Given** a contact reacts to a message with ❤️ emoji, **When** the reaction is received, **Then** the system displays "❤️ Reacted to message" with the actual emoji visible
3. **Given** a contact reacts to a message with any standard emoji, **When** the reaction is received, **Then** the system does NOT display "[Unsupported Message Type: reactionMessage]"

---

### User Story 1b - Agent Sends Reactions (Priority: P1)

As a WhatsApp-Pi user, I want the agent to be able to react to incoming messages with emojis, so I can acknowledge or express sentiment about messages without typing a full reply.

**Why this priority**: This provides a natural, lightweight interaction pattern that mirrors how humans use WhatsApp. It allows the agent to quickly acknowledge messages, express agreement, or show emotional response without verbose text.

**Independent Test**: Can be tested by prompting the agent to react to a message (e.g., "react with 👍") and verifying the reaction appears on the original message in WhatsApp.

**Acceptance Scenarios**:

1. **Given** the agent receives a message, **When** instructed to react with an emoji, **Then** the reaction appears on the original message in WhatsApp
2. **Given** the agent has a valid message ID and chat JID, **When** sending a reaction, **Then** the reaction is successfully delivered via the Baileys API
3. **Given** an invalid emoji or missing message reference, **When** attempting to send a reaction, **Then** the system returns an appropriate error

---

### User Story 2 - Handle Removed Reactions (Priority: P2)

As a WhatsApp-Pi user, when someone removes a reaction they previously made, I want to see a clear indication that the reaction was removed, so I understand the conversation history accurately.

**Why this priority**: While less common than adding reactions, removed reactions are part of normal WhatsApp behavior. Handling this provides completeness and prevents confusion when reactions disappear.

**Independent Test**: Can be tested by adding a reaction to a message in WhatsApp, then removing it, and verifying the system displays an appropriate message about the removal.

**Acceptance Scenarios**:

1. **Given** a contact removes a previously sent reaction, **When** the removal is received, **Then** the system displays a message indicating the reaction was removed (e.g., "Removed reaction")

---

### User Story 3 - Reaction Metadata Display (Priority: P3)

As a WhatsApp-Pi user, when viewing reaction messages, I want to optionally see which message was reacted to (when context is available), so I can better understand conversation flow.

**Why this priority**: This provides additional context that can be helpful in group chats or fast-moving conversations, but is not essential for basic functionality.

**Independent Test**: Can be tested by receiving a reaction and checking if the system can optionally reference the original message that was reacted to.

**Acceptance Scenarios**:

1. **Given** a contact reacts to a specific message, **When** the reaction is displayed, **Then** the system may include reference to the original message content or ID when available in context

---

### Edge Cases

- What happens when the reaction emoji is not a standard Unicode emoji?
- How does the system handle multiple reactions to the same message from different users?
- What happens when a user reacts to a message that hasn't been loaded into recents yet?
- How should the system handle reactions in group chats versus direct messages?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect `reactionMessage` type from incoming WhatsApp messages
- **FR-002**: System MUST extract the emoji/text from reaction messages
- **FR-003**: System MUST display reactions as human-readable messages (e.g., "{emoji} Reacted to message") instead of "[Unsupported Message Type: reactionMessage]"
- **FR-004**: System MUST handle removed reactions (when `text` is empty) with an appropriate message
- **FR-005**: System MUST support all standard Unicode emojis in reactions
- **FR-006**: System MUST include reaction messages in the recents/history system for context
- **FR-007**: System MUST provide an API/tool for the agent to send reactions to messages
- **FR-008**: System MUST validate emoji before sending reactions (must be single Unicode emoji or standard WhatsApp reaction emoji)
- **FR-009**: System MUST require message ID and chat JID to send a reaction
- **FR-010**: System MUST return success/error feedback when sending reactions

### Key Entities *(include if feature involves data)*

- **ReactionMessage**: Represents a reaction to a message
  - `key`: Reference to the message being reacted to (remoteJid, id, fromMe)
  - `text`: The emoji/text of the reaction (empty if reaction was removed)
  - `senderTimestampMs`: When the reaction was sent

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of reaction messages display human-readable text instead of "[Unsupported Message Type: reactionMessage]"
- **SC-002**: All standard WhatsApp reaction emojis (👍, ❤️, 😂, 😮, 😢, 🙏, etc.) render correctly in the display
- **SC-003**: Removed reactions display an appropriate message (not an error or blank)
- **SC-004**: Users can identify that a reaction occurred without confusion in 100% of cases

## Assumptions

- Baileys library provides reaction messages with `reactionMessage` property containing `key` and `text` fields
- Reaction messages follow the standard WhatsApp Web message format
- Reaction removal is indicated by an empty or null `text` field
- Baileys library supports sending reactions via `sendMessage` or similar API
- Message IDs from the recents system can be used as references for sending reactions
