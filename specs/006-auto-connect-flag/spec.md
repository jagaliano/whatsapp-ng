# Feature Specification: Auto-Connect CLI Flag

**Feature Branch**: `006-auto-connect-flag`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Is it possible to run pi -connect then it connect automatically in whatsapp login?"

## Clarifications

### Session 2026-04-10
- Q: Should we explicitly support both the long form (`--whatsapp`) and the short form (`-w`) for this feature? → A: Support both `--whatsapp` and `-w`
- Q: If the saved status is `disconnected` but the user launches with the `--whatsapp` flag, which one should take precedence? → A: CLI Flag overrides saved status (connects)
- Q: How should the system inform the user that auto-connect was skipped due to missing credentials? → A: Show a non-blocking TUI notification
- Q: How should the system behave if the initial auto-connection attempt fails? → A: Retry automatically (max 3 times)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-Connect via Flag (Priority: P1)

As a Software Engineer using the WhatsApp extension, I want to skip the manual menu steps by adding a `--whatsapp` flag to the launch command so that the integration is ready for use immediately upon starting Pi.

**Why this priority**: High. Improves developer productivity and enables smoother workflow integration.

**Independent Test**: Run `pi -e ./whatsapp-pi.ts --whatsapp` and verify that the "WhatsApp: Connected" status appears in the Pi footer without any manual interaction.

**Acceptance Scenarios**:

1. **Given** a valid registered WhatsApp session exists, **When** the extension is loaded with the `--whatsapp` flag, **Then** the WhatsApp socket connection is established automatically, overriding any previously saved "disconnected" status.
2. **Given** no active session exists, **When** the extension is loaded with the `--whatsapp` flag, **Then** the system notifies the user via a non-blocking notification that a manual login is required and remains disconnected.

---

### User Story 2 - Manual Connect by Default (Priority: P2)

As a security-conscious user, I want the extension to remain disconnected by default if no flags are provided, so that I have full control over when the Agent is online.

**Why this priority**: Medium. Maintains user control and prevents unintended resource usage.

**Independent Test**: Run `pi -e ./whatsapp-pi.ts` (without `--whatsapp`) and verify that the status remains "WhatsApp: Disconnected" until changed via the menu.

**Acceptance Scenarios**:

1. **Given** a valid session exists, **When** the extension is loaded without the `--whatsapp` flag, **Then** the status is set to "Disconnected" and no socket is opened.

### Edge Cases

- **Flag with Conflict**: If the flag is used and a connection is already in progress, the system MUST handle it gracefully without spawning duplicate sockets.
- **Auto-Connect Failure**: If auto-connect fails due to network issues, the system MUST retry automatically up to 3 times before displaying a clear error notification in the TUI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST register a `--whatsapp` (alias `-w`) flag using the `pi.registerFlag` API.
- **FR-002**: System MUST detect the presence of the flag during the `session_start` event and prioritize it over the saved `config.json` status.
- **FR-003**: System MUST verify the existence of local credentials (`creds.json`) before attempting auto-connection.
- **FR-004**: System MUST trigger the `whatsappService.start()` method if both the flag is present and credentials exist.
- **FR-005**: System MUST implement an automatic retry mechanism (max 3 attempts) for failures during the auto-connect sequence.
- **FR-006**: System MUST set the session status to `connected` upon successful auto-connection.

### Key Entities

- **Auto-Connect State**: A boolean flag derived from CLI arguments and session validity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Auto-connection sequence begins within 100ms of extension activation.
- **SC-002**: Flag detection is 100% accurate for both `--whatsapp` and `-w` variants.
- **SC-003**: The extension successfully avoids triggering a QR code display during an auto-connect failure.
- **SC-004**: System successfully retries up to 3 times on transient network failures during startup.

## Assumptions

- The user has previously successfully paired their device using the manual `/whatsapp` menu.
- The `pi` harness correctly passes the `--whatsapp` flag to the extension's flag registry.
- Terminal output verbosity still respects the `-v` flag if combined with `--whatsapp`.
