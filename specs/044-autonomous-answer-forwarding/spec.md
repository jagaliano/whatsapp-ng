# Feature Specification: Autonomous Answer Forwarding

**Feature Branch**: `044-autonomous-answer-forwarding` (spec directory only; no branch created)

**Created**: 2026-11-09

**Status**: Implemented (including approved cron/extension-origin compatibility amendment; source/synthetic and operator-confirmed private-owner cron ON/Off evidence in [tasks](tasks.md#validation-evidence); group and broader live acceptance pending)

**Input**: User description: "Automatically forward final answers from autonomous/background Pi work to one explicitly chosen WhatsApp destination, independently of which extension started the work. Terminal settings offer Off (default), the verified owner's private chat, or exactly one allowed group with explicit disclosure. Only clearly identified autonomous/custom-message turns without a WhatsApp request qualify; mixed, ambiguous or unclassified turns remain local. Preserve WhatsApp-request routing and terminal forwarding; recheck connection, account/session, consent and group eligibility before egress; no replay, retry, per-request routing, multiple destinations, reminders, extension-specific integrations or new dependencies."

## Context

Source: the generic proposal in a local research note dated 2026-11-09, renumbered from 045 to 044. The earlier pi-subagents run-identifier design is excluded. Its findings were rechecked against current source (`1.1.8`, `20b3892`):

- **Original finding:** work woken by a non-WhatsApp custom message was classified as unowned/unknown. The listed scheduled-job example was not verified against the installed cron implementation: cron 0.7.0's live session bridge actually uses `sendUserMessage`, not custom messages (research R1c).
- **Verified:** existing **Replies → Optional outputs** terminal forwarding sends only positively identified terminal/RPC final answers, as text, to the verified private owner. Answers over 64 KiB stay local with a notice; failures are not retried; enabling does not replay earlier work.
- **Resolved original planning uncertainty:** not every background wake-up is custom. The approved amendment covers exactly proven extension-origin user messages, including live-session cron; ordinary messages without that proof stay local (research R1c).

## Clarifications

### Session 2026-11-09

- Q: Should autonomous answers always be sent as text, or follow the destination chat's voice/text reply preference? → A: Always text.
- Q: What happens to an autonomous answer above the existing 64 KiB forwarding limit? → A: Keep it local with a terminal notice; no partial output.
- Q: Do terminal-answer and autonomous forwarding share one destination setting? → A: No. Separate settings; terminal forwarding remains owner-only.

### Session 2026-11-11 (cron compatibility amendment)

- Q: Include cron session-job answers despite their ordinary user-message delivery? → A: Yes. Include other positively verified extension-origin user messages too; do not infer eligibility from an unowned turn or prompt text. This amendment supersedes the original custom-only restriction.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive background results on WhatsApp (Priority: P1)

The owner starts long-running or scheduled work, leaves the terminal, and receives the final answer of each autonomous turn in the chosen WhatsApp destination without the agent having to remember a send.

**Why this priority**: This closes the actual gap: background results requested from the phone are currently missed.

**Independent Test**: With forwarding set to the owner's private chat, simulate custom-message and positively proven extension-user/cron-style turns ending with final answers; observe exactly one forwarded answer per eligible final.

**Acceptance Scenarios**:

1. **Given** forwarding is set to the owner's private chat, **When** an autonomous turn finishes with a final answer, **Then** that answer is sent once to that chat.
2. **Given** forwarding is enabled, **When** an autonomous turn produces intermediate assistant messages or tool calls, **Then** none of them are forwarded; only the final answer is.
3. **Given** forwarding is Off (the default), **When** an autonomous turn finishes, **Then** nothing is sent.
4. **Given** forwarding is enabled, **When** the turn was started by any extension using a custom message, **Then** behavior is the same regardless of which extension started it.
5. **Given** forwarding is enabled, **When** the live cron session bridge or another extension injects a user message that is exactly proven by Pi's extension input event, **Then** its eligible final answer is sent once, with no owner/configuration authority.

---

### User Story 2 - Choose and understand the destination (Priority: P2)

From terminal settings, the owner selects Off, their private chat, or exactly one allowed group. Choosing a group requires acknowledging that every member can see potentially sensitive background results.

**Why this priority**: Destination choice is the consent boundary; groups multiply exposure.

**Independent Test**: Walk the terminal settings: enabling defaults to the owner's chat; selecting a group requires disclosure confirmation; cancelling leaves settings unchanged.

**Acceptance Scenarios**:

1. **Given** forwarding is Off, **When** the owner enables it, **Then** the owner's private chat is the default destination.
2. **Given** the owner chooses a group, **When** the disclosure is declined, **Then** the setting is not changed.
3. **Given** the owner chooses a group and confirms, **When** an autonomous answer is produced, **Then** it goes only to that group.
4. **Given** forwarding is set to a group, **When** a group member sends a message, **Then** that membership grants no owner or settings authority.

---

### User Story 3 - Never misroute or leak (Priority: P3)

Ambiguous, stale or ineligible cases produce no WhatsApp message; existing routing is unchanged.

**Why this priority**: A wrong destination for autonomous output is a privacy failure.

**Independent Test**: Simulate mixed, unclassified, WhatsApp-owned and terminal turns, disconnection, account/session change, removed group, revoked consent and unknown delivery; verify no unexpected or repeated sends.

**Acceptance Scenarios**:

1. **Given** a turn consumed both a WhatsApp request and a custom message, **When** it finishes, **Then** existing WhatsApp-request handling applies and no autonomous forwarding occurs.
2. **Given** a turn whose inputs cannot be clearly classified, **When** it finishes, **Then** the answer stays local.
3. **Given** a WhatsApp-requested or terminal turn, **When** it finishes, **Then** autonomous forwarding does not send it; WhatsApp-request routing and the separately enabled terminal forwarding (owner-only) behave exactly as today.
4. **Given** the chosen group was removed from allowed groups, the connection is down, the account/session changed, or consent was withdrawn, **When** an autonomous answer is ready, **Then** it stays local.
5. **Given** a forwarded answer's delivery outcome is unknown, **When** later events occur, **Then** it is never resent or retried.
6. **Given** forwarding was just enabled, **When** settings are saved, **Then** no earlier answer is exported.

### Edge Cases

- Autonomous turn with no final text (aborted, error, tool-only): nothing sent.
- The destination setting changes while an autonomous turn is running: the destination and consent at completion are rechecked; a removed or changed consent keeps the answer local.
- The owner identity changes: owner-chat consent captured for the previous owner or account no longer applies.
- Duplicate lifecycle callbacks for the same final answer: at most one send.
- Explicit model sends to the same destination within the turn: existing duplicate suppression applies.
- Answer exceeds the existing 64 KiB limit: stays local with a terminal notice; nothing partial is sent.
- Destination chat has voice or Mirror replies configured: autonomous answers are still sent as text.
- Terminal forwarding on and autonomous forwarding off (or vice versa): each applies only to its own turn type.
- Explicit Off or logout: no forwarding after the transition and none on later re-enable for older work.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a terminal-only setting for autonomous answer forwarding with exactly three choices: Off, the verified owner's private chat, or one allowed group. Off MUST be the default; enabling MUST default to the owner's private chat.
- **FR-002**: Selecting a group MUST require explicit confirmation that all group members can see potentially sensitive background results; declining MUST leave settings unchanged.
- **FR-003**: A run MUST start with a known `custom` or `user` type matching its first consumed input, and every consumed input MUST be either a custom message or a user message exactly matching a fresh, same-scope host observation proving extension origin. Known pending or withdrawn WhatsApp inputs MUST NOT acquire that extension proof. Any terminal, WhatsApp-owned, unproven or transformed consumed input permanently excludes the run from autonomous forwarding. This includes live-session cron delivery and other extension-origin user messages without granting control authority.
- **FR-004**: Runs mixed with terminal, WhatsApp or unproven inputs, ambiguous runs and otherwise unclassified runs MUST NOT be forwarded by this feature. Custom plus proven extension-user inputs alone are not such a mixed run.
- **FR-005**: The destination MUST be the single configured destination; the system MUST NOT infer it from the last chat, the originating extension, message content, or any other heuristic.
- **FR-006**: Only the final answer of an eligible turn MUST be forwarded; intermediate assistant messages and tool activity MUST NOT be.
- **FR-007**: Before each send, the system MUST recheck that WhatsApp is connected and on, that the account/session context is unchanged, that consent for that exact destination is still current, and, for a group, that it is still allowed; otherwise the answer stays local.
- **FR-008**: Destination membership MUST NOT grant owner, control or configuration authority.
- **FR-009**: Existing output limits and duplicate suppression MUST apply.
- **FR-010**: Enabling MUST NOT export earlier work; an unknown delivery outcome MUST NOT cause a resend, retry or fallback.
- **FR-011**: WhatsApp-request routing and existing terminal forwarding MUST remain unchanged. Terminal turns are excluded from autonomous forwarding only; they remain eligible for the separately enabled, owner-only terminal forwarding.
- **FR-012**: Autonomous answers MUST always be sent as text, independent of the destination chat's voice/text/Mirror reply preference; no speech is generated for them.
- **FR-013**: An autonomous answer above the existing 64 KiB forwarding limit MUST stay local with a terminal notice; no partial, truncated or split output may be sent.
- **FR-014**: Autonomous forwarding MUST be a separate setting from terminal-answer forwarding; terminal forwarding MUST remain owner-only and unchanged, and neither setting MUST enable or alter the other.
- **FR-015**: Settings MUST be validated on load; malformed or unsupported values MUST disable forwarding rather than guess a destination.
- **FR-016**: Public documentation, translations for all supported terminal languages, and the changelog MUST describe the setting, disclosure, eligibility and limits.

### Key Entities

- **Autonomous forwarding consent**: chosen destination kind (off, owner, group), destination identity, the owner/account it was granted under, and its revision.
- **Autonomous turn**: a known-start run consuming only custom messages or exactly proven extension-origin user messages, without WhatsApp, terminal or unproven inputs.
- **Extension input proof**: one latest-input digest, runtime scope and five-minute expiry, captured from Pi's actual extension input event; consumed once, cleared by a newer input/reset, never reconstructed from text. Transformed or superseded queued inputs fail closed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In simulated runs, 100% of eligible autonomous final answers within limits reach the configured destination exactly once, with no manual send.
- **SC-002**: 0 messages are sent for Off, runs mixed with terminal/WhatsApp/unproven inputs, unclassified, WhatsApp-owned or terminal-only turns by this feature.
- **SC-003**: 0 messages are sent after disconnection, Off, logout, account/session change, revoked consent or removed group eligibility.
- **SC-004**: 0 resends or retries follow a failed or unknown delivery; 0 earlier answers are sent after enabling.
- **SC-005**: Existing WhatsApp-request routing and terminal forwarding regression suites pass unchanged.
- **SC-006**: Choosing a group cannot be completed without explicit disclosure acknowledgement in 100% of attempts.

## Assumptions

- The original custom-only classification and its observations remain historical. The approved amendment also accepts exactly proven extension-origin user messages. Pi identifies the source as `extension`, not the sending extension's identity: this deliberately covers cron and other extension-injected user messages, not cron alone. It never broadens forwarding to all unowned turns.
- Live cron session-bridge delivery is covered. Headless user/project jobs and cron's RPC-resume fallback are not positively extension-classified and are not covered by this amendment; existing terminal/RPC forwarding is unchanged.
- Validation uses synthetic fixtures; no real credentials, accounts or conversation data are inspected.
- Out of scope: per-request return routing (including the former run-identifier design), multiple destinations, reminders, extension-specific integrations, intermediate-message forwarding and new dependencies.
- Implementation adds regression coverage first, then runs the repository's declared test, lint and typecheck commands.
