# Feature Specification: Allowed Group Reaction Mode

**Feature Branch**: `[028-group-reaction-mode]`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "No menu Allowed Groups, eu quero implementar uma option para como o agente deve reagir às mensagens. Serão dois modos:

passivo - nesse modo, quando allowed, o agente só responde quando for citado por @ na mensagem do whatsapp.
ativo - quando allowed, responde sempre, como é atualmente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Reaction Mode (Priority: P1)

As a user managing allowed groups, I want to choose how the agent reacts in each allowed group so I can control when it answers.

**Why this priority**: This is the core value of the feature and changes the agent behavior users care about most.

**Independent Test**: Configure one allowed group in passive mode and another in active mode, then verify each group follows its selected behavior.

**Acceptance Scenarios**:

1. **Given** an allowed group, **When** I set the reaction mode to passive, **Then** the agent only replies when it is directly mentioned with @ in a group message.
2. **Given** an allowed group, **When** I set the reaction mode to active, **Then** the agent replies to allowed group messages as it does today.

---

### User Story 2 - Preserve Current Behavior (Priority: P2)

As a user with existing allowed groups, I want current behavior to continue unless I change the mode so my setup does not break after the update.

**Why this priority**: Existing users should keep the current always-reply behavior by default.

**Independent Test**: Upgrade an environment with existing allowed groups and confirm they still respond in active mode until changed.

**Acceptance Scenarios**:

1. **Given** an existing allowed group with no mode previously configured, **When** the feature is enabled, **Then** the group behaves in active mode by default.

---

### User Story 3 - Ignore Untagged Messages in Passive Mode (Priority: P3)

As a user, I want passive mode to stay quiet on untagged messages so the group is not spammed.

**Why this priority**: This is the main benefit of passive mode after configuration.

**Independent Test**: Send messages without @ mentions to a passive allowed group and verify the agent does not answer.

**Acceptance Scenarios**:

1. **Given** an allowed group in passive mode, **When** a message does not mention the agent with @, **Then** the agent does not respond.
2. **Given** an allowed group in passive mode, **When** a message mentions the agent with @, **Then** the agent responds normally.

---

### Edge Cases

- An allowed group has no reaction mode set yet: it uses active mode by default.
- A passive group message contains multiple mentions: the agent responds when it is one of the mentioned recipients.
- A message in a non-allowed group is still ignored, regardless of reaction mode.
- A user changes the mode after messages have already been sent: only future messages follow the new mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let users set a reaction mode for each allowed group.
- **FR-002**: The system MUST support exactly two reaction modes: passive and active.
- **FR-003**: In passive mode, the system MUST respond only when the agent is directly mentioned with @ in the message.
- **FR-004**: In active mode, the system MUST respond to allowed group messages as it does today.
- **FR-005**: Existing allowed groups without a previously saved reaction mode MUST default to active mode.
- **FR-006**: The system MUST preserve the selected reaction mode for each allowed group across restarts.
- **FR-007**: The system MUST continue to ignore messages from groups that are not allowed, regardless of reaction mode.
- **FR-008**: The system MUST allow users to change a group's reaction mode after it has been created.

### Key Entities *(include if feature involves data)*

- **Allowed Group**: A group approved for interaction, with a configured reaction mode.
- **Reaction Mode**: The behavior setting for an allowed group; values are passive or active.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of allowed groups can be assigned one of the two reaction modes.
- **SC-002**: In passive mode, at least 95% of untagged messages receive no reply during validation tests.
- **SC-003**: Existing allowed groups continue replying in active mode by default after release.
- **SC-004**: Users can switch a group's reaction mode and verify the new behavior on the next message without data loss.

## Assumptions

- Allowed Groups already exists as the place where users manage group access.
- Passive mode means the agent answers only when directly mentioned with @.
- Active mode matches the current always-reply behavior.
- Existing allowed groups should keep current behavior unless the user changes the mode.
