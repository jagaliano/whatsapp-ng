# Feature Specification: QR Connect Welcome Message

**Feature Branch**: `032-qr-welcome-message`  
**Created**: 2026-05-16  
**Status**: Draft  
**Input**: User description: "When user connects via QR code, send a message to this WhatsApp number with a friendly welcome. Then print 'WhatsApp connected'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Welcome Message on Fresh QR Pairing (Priority: P1)

After the operator scans the QR code and WhatsApp connects for the first time (or after re-pairing), the system automatically sends a friendly welcome message to the operator's own WhatsApp number. This gives the operator immediate proof that the agent is active and ready, directly inside WhatsApp. The operator does not need to send anything — the confirmation arrives unprompted.

**Why this priority**: This is the entire feature. The welcome message is the operator's first visible signal inside WhatsApp that the agent is live. Without it, there is no feature.

**Independent Test**: Start the agent without saved credentials so a QR code is shown. Scan the QR code with a real device. Verify that within a few seconds a welcome WhatsApp message arrives on that device and "WhatsApp connected" is printed to the console.

**Acceptance Scenarios**:

1. **Given** no saved session exists, **When** the operator scans the QR code and pairing succeeds, **Then** the agent sends a friendly welcome WhatsApp message to the operator's own number and prints "WhatsApp connected" to the console.
2. **Given** the welcome message is sent successfully, **When** the operator checks their WhatsApp, **Then** the message appears as a self-message in their own chat (message from self to self).
3. **Given** the agent fails to send the welcome message (e.g., temporary network issue), **When** the connection is established, **Then** "WhatsApp connected" is still printed to the console and normal operation continues — the failed welcome does not abort the session.

---

### User Story 2 - No Welcome Message on Auto-Reconnect (Priority: P1)

When the agent reconnects automatically after an unexpected disconnect (see feature 029), no welcome message is sent and no special console output is printed beyond the normal reconnect status. Only a genuine fresh QR pairing triggers the welcome flow.

**Why this priority**: Equal priority to Story 1 because sending a welcome on every reconnect would spam the operator with repeated messages during instability, undermining trust in the feature.

**Independent Test**: With a connected session, simulate an unexpected disconnect and wait for auto-reconnect. Verify no welcome WhatsApp message is sent and the console does not print "WhatsApp connected" as part of the welcome flow.

**Acceptance Scenarios**:

1. **Given** an active session drops unexpectedly, **When** the agent auto-reconnects, **Then** no welcome WhatsApp message is sent and the welcome console print does not appear.
2. **Given** the agent was started with a saved session (no QR required), **When** it connects on startup, **Then** no welcome message is sent.

---

### Edge Cases

- What if the operator's JID is not yet available when connection opens? The welcome is skipped or deferred; the session still proceeds normally.
- What if the operator re-pairs (scans QR after an explicit logout)? The welcome IS sent, as this is a fresh QR-driven pairing.
- What if multiple QR codes are generated in one session before a successful scan? The welcome is sent once, upon the single successful pairing event.
- What if the welcome message send request times out? The timeout is treated as a best-effort failure; the session is not affected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST send a welcome WhatsApp message to the operator's own number immediately after a successful QR-code-driven pairing.
- **FR-002**: The welcome message MUST be sent to the same number that authenticated (self-message from the connected account to itself).
- **FR-003**: The welcome message MUST have a friendly, welcoming tone; exact wording is an implementation detail but must be non-empty and non-technical.
- **FR-004**: The system MUST print "WhatsApp connected" to the console after a successful QR-driven connection.
- **FR-005**: The system MUST NOT send a welcome message or print "WhatsApp connected" when reconnecting from a saved session (no QR was shown in the current session).
- **FR-006**: The system MUST NOT send a welcome message or print "WhatsApp connected" on auto-reconnect after an unexpected disconnect.
- **FR-007**: A failure to send the welcome message MUST NOT abort the session or prevent the agent from processing subsequent messages.
- **FR-008**: The welcome message and console print MUST complete or be dispatched within 5 seconds of the connection-open event.

### Key Entities

- **QR Pairing Event**: A connection-open event that was preceded by a QR code being displayed in the current session lifecycle — as opposed to a session restored from saved credentials or an auto-reconnect.
- **Self-Message**: A WhatsApp message sent from the connected account's JID to that same JID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of fresh QR pairings result in exactly one welcome WhatsApp message delivered to the operator's device.
- **SC-002**: 0 welcome messages are sent during auto-reconnects or credential-restore connections.
- **SC-003**: "WhatsApp connected" appears in the console output within 5 seconds of the QR pairing completing.
- **SC-004**: A send failure for the welcome message does not interrupt the session — the agent remains connected and continues to process messages normally.

## Assumptions

- The operator's own WhatsApp JID is available from the socket's user object immediately after the connection-open event.
- Sending a self-message (to one's own number) is supported by the underlying messaging library without special configuration.
- "QR was shown in this session" can be tracked with an in-memory flag set when a QR code event fires and cleared after the connection-open handler runs.
- No new persistent storage is required; the QR-shown flag lives only in memory for the duration of the current process.
- The console print "WhatsApp connected" replaces or supplements the existing connection-open log output; it does not need to be hidden behind the verbose flag.
