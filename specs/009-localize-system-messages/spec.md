# Feature Specification: Localize System Messages to en-US

**Feature Branch**: `009-localize-system-messages`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Review all the System messages to en-us."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified English TUI Experience (Priority: P1)

As a user managing the WhatsApp integration through the Pi TUI, I want all menus, status updates, and notifications to be in US English, so the interface is consistent with the rest of the Pi environment.

**Why this priority**: Essential for professional appearance and consistency in the agent's primary operating language.

**Independent Test**: Open the `/whatsapp` menu and trigger various actions (Connect, Disconnect, Clear). Verify that every notification and status line is in English.

**Acceptance Scenarios**:

1. **Given** the WhatsApp integration is running, **When** a session is compacted via `/compact`, **Then** the bot should reply with "Session compacted successfully! ✅" instead of Portuguese text.
2. **Given** the extension is starting, **When** the `session_start` event fires, **Then** the notification "WhatsApp: Session reset via /new is now fully supported." should be displayed in English.

---

### User Story 2 - Localized Agent Communication (Priority: P1)

As a coding agent, I want the system-generated context messages (like forwarded WhatsApp message headers) to be in US English, so I can process them more accurately within my English-based reasoning loop.

**Why this priority**: Improves agent understanding by removing mixed-language context.

**Independent Test**: Send a message to the bot. Check the message received by the agent in the TUI logs. It should say "Message from [Name] (+[Number])" instead of "Mensagem de...".

**Acceptance Scenarios**:

1. **Given** a user sends a text message via WhatsApp, **When** it is forwarded to the agent, **Then** the prefix must be "Message from [Name] (+[Number]):".
2. **Given** a user sends an audio message, **When** it is transcribed, **Then** the injected text must be "[Transcribed Audio]: [content]".

---

### User Story 3 - Clean English Logging (Priority: P2)

As a developer, I want the console logs and trace messages to be in English, so they are easier to search and consistent with standard development practices.

**Why this priority**: Facilitates debugging and log analysis.

**Independent Test**: Enable `--verbose` mode and verify that logs like "Downloading image from..." and "Document saved to..." are in English.

**Acceptance Scenarios**:

1. **Given** verbose mode is enabled, **When** an image is downloaded, **Then** the log output must be in US English.

---

### Edge Cases

- **Transcription Language**: While system messages (errors, status) are in English, the actual transcribed text from the user remains in its original language.
- **Special Characters**: Emoji and symbols (✅) should be preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace "Mensagem de" with "Message from" in all forwarding logic.
- **FR-002**: System MUST replace "[Áudio Transcrito]" with "[Transcribed Audio]" in the audio service callback.
- **FR-003**: System MUST replace "[Transcrição vazia]" and transcription error messages in `audio.service.ts` with English equivalents.
- **FR-004**: System MUST translate all TUI feedback messages (e.g., "Sessão compactada com sucesso", "Abortado") to US English.
- **FR-005**: System MUST ensure all console log strings in `whatsapp-pi.ts` use US English.
- **FR-006**: System MUST verify that all status updates (e.g., "Connecting...", "Connected") follow a consistent English format.

### Key Entities *(include if feature involves data)*

- **System Message**: Any string literal displayed to the user or agent by the extension logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of hardcoded Portuguese strings identified in `whatsapp-pi.ts` and `src/` are replaced with US English.
- **SC-002**: No Portuguese-prefixed messages are sent to the Pi agent during normal operation.

## Assumptions

- **Target Language**: US English (`en-US`).
- **Scope**: Includes TUI, Agent Notifications, and Console Logs.
- **Transcription Model**: The Whisper `--language` flag might still be set to `pt` if the target audience is Portuguese-speaking, but the *metadata* identifying the transcription is English.
