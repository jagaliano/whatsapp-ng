# Feature Specification: Phone-Initiated Pi Reload

**Feature Branch**: `045-phone-reload`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Add phone /reload so the verified owner can refresh Pi resources from WhatsApp without returning to the terminal or restarting Pi. The owner sends /reload in an allowed private chat and confirms a short-lived menu. Non-owners and group chats cannot trigger it. Cancelled, expired, replayed, busy or pending-message requests must not reload; explain rejection while the connection remains available. Use Pi's standard reload and preserve the current conversation, saved login and preferences. After successful WhatsApp initialization, reconnect the same account and acknowledge in the requesting chat, including when saved auto-connect is off. Explicit Off and changed authorization must prevent reconnection. Carry only a bounded, expiring, one-use, reload-specific authorization handoff across runtime replacement. The new runtime consumes it after initialization and revalidates profile, account, session, verified owner and allowed chat before reconnecting or replying. Ordinary terminal reload must not revive stale requests. Retire the old socket and credential operations through existing shutdown/lease ownership. Avoid duplicate connections, automatic resends of uncertain sends and additional reload retry loops. Do no work after reload in the old handler. On failure, retain Pi's terminal diagnostics and recovery path. Phone failure notices are best effort. Acknowledgment confirms WhatsApp recovery, not that every extension loaded. Include localized help and messages in all four languages. Scope excludes installation, shell execution, agent tools and process restart."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner reloads Pi from the phone (Priority: P1)

The verified phone owner, away from the terminal, sends `/reload` in an allowed private chat, confirms a short-lived menu, and Pi refreshes its resources. WhatsApp comes back on the same account and the owner receives an acknowledgment in the same chat; the Pi conversation, saved login and preferences are unchanged.

**Why this priority**: This is the whole value: refreshing extensions/skills/prompts without terminal access or a process restart.

**Independent Test**: With a synthetic verified owner and allowed private chat, send `/reload`, confirm, and observe one standard reload, one reconnection of the same account, one acknowledgment, and an unchanged conversation and settings.

**Acceptance Scenarios**:

1. **Given** WhatsApp is online and the verified owner writes `/reload` in an allowed private chat with no Pi work running or queued, **When** the owner confirms within the menu lifetime, **Then** Pi performs its standard reload, WhatsApp reconnects the same account once, and the requesting chat receives a localized acknowledgment.
2. **Given** saved auto-connect is off but WhatsApp was online when the request was confirmed, **When** the reload succeeds, **Then** WhatsApp still reconnects for this request and the saved auto-connect preference stays off.
3. **Given** a successful reload, **When** the owner reads the acknowledgment, **Then** it states WhatsApp recovered and does not claim every extension loaded.

---

### User Story 2 - Unauthorized or unsafe requests are refused (Priority: P1)

Requests from non-owners, groups, cancelled/expired/replayed menus, or while Pi is busy or has pending messages never reload Pi; the requester receives a localized explanation and the connection stays up.

**Why this priority**: Reload replaces the runtime; misuse or an untimely reload would disrupt the shared session.

**Independent Test**: Exercise each rejection path and verify no reload starts, a localized explanation is sent where a reply is allowed, and WhatsApp stays connected.

**Acceptance Scenarios**:

1. **Given** an allowed contact who is not the verified owner, **When** they send `/reload`, **Then** no menu appears, no reload occurs, and they receive the standard owner-only refusal.
2. **Given** a group chat (even from the owner), **When** `/reload` is sent, **Then** no reload occurs and the group gets a private-chat-only refusal.
3. **Given** a reload menu, **When** the owner cancels, lets it expire, or re-uses an already-consumed selection, **Then** no reload occurs and a localized explanation is sent.
4. **Given** Pi is processing a turn or has queued/pending messages, **When** the owner confirms, **Then** no reload occurs and the owner is told to retry once Pi is idle.
5. **Given** WhatsApp is connecting, reconnecting or disconnected, or the account changed since the menu opened, **When** the owner confirms, **Then** no reload occurs and, when a reply is possible, a localized not-connected explanation is sent.

---

### User Story 3 - Safe handoff and failure handling (Priority: P2)

Only the confirmed request can cause post-reload reconnection and acknowledgment. Explicit Off, changed authorization, stale requests or failed initialization prevent it, and failures stay visible in the terminal.

**Why this priority**: Prevents stale or forged handoffs from reviving connections or replies and keeps recovery operator-controlled.

**Independent Test**: Simulate reload with altered owner/account/session/chat, explicit Off, expired handoff, ordinary terminal reload, and initialization failure; verify no reconnect/reply in each case and terminal diagnostics retained.

**Acceptance Scenarios**:

1. **Given** a confirmed phone reload, **When** the new runtime finishes WhatsApp initialization, **Then** it consumes the handoff once and revalidates profile, account, session, verified owner and allowed chat before reconnecting or replying.
2. **Given** the owner, account, session, chat permission or profile changed, or explicit Off is active, **When** the new runtime consumes the handoff, **Then** it neither reconnects nor replies.
3. **Given** an unconsumed or expired handoff exists, **When** the operator runs an ordinary terminal reload later, **Then** no reconnection or phone reply results from the stale request.
4. **Given** the reload or WhatsApp initialization fails, **When** failure occurs, **Then** Pi's terminal diagnostics and recovery path remain available, a phone failure notice is attempted at most once on a best-effort basis, and no reload retry is made.

---

### Edge Cases

- Owner sends `/reload` twice quickly: at most one menu is actionable and at most one reload occurs.
- Confirmation arrives exactly as the menu expires: treated as expired.
- An outgoing message has an uncertain delivery outcome at reload time: it is not automatically resent by either runtime.
- The old runtime receives events after reload begins: it performs no further WhatsApp work, replies, or reconnection.
- The old socket or credential write is still in flight: it is retired through existing shutdown/lease ownership before the new runtime connects; no duplicate connection exists.
- The handoff is replayed after successful consumption: it is ignored.
- Pi process restarts instead of reloading: the handoff does not survive as authority to reconnect or reply.
- Owner locale changes: messages use the active locale (English, Portuguese (Brazil), Spanish, French).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept `/reload` as a phone command and list it in localized phone help.
- **FR-002**: Only the verified phone owner in an allowed private chat MUST be able to open the reload menu; non-owners and group chats MUST receive a localized refusal without reload.
- **FR-003**: The reload MUST require explicit confirmation in a short-lived, one-use menu bound to the requesting verified owner, private chat, profile, account, Pi session and operator revision.
- **FR-004**: Cancelled, expired, replayed or superseded confirmations MUST NOT reload and MUST produce a localized explanation while WhatsApp stays connected.
- **FR-005**: If Pi is processing a turn or has pending/queued messages at confirmation, the system MUST refuse the reload with a localized explanation.
- **FR-005a**: A confirmation MUST be accepted only while WhatsApp is connected on the requesting account; connecting, reconnecting or disconnected states MUST be refused with a localized explanation when a reply is possible.
- **FR-006**: An accepted request MUST invoke Pi's standard reload, preserving the current conversation, saved WhatsApp login and preferences.
- **FR-007**: Before reload, the old runtime MUST retire its connection and credential operations through existing shutdown/lease ownership and MUST perform no further work after reload is requested.
- **FR-008**: The system MUST carry across runtime replacement only a bounded, expiring, one-use, reload-specific authorization handoff containing only profile, account, Pi session, verified owner, private chat and expiry, and no secrets or message content.
- **FR-009**: After successful WhatsApp initialization, the new runtime MUST consume the handoff exactly once and revalidate profile, account, session, verified owner and allowed chat before reconnecting or replying.
- **FR-010**: On successful revalidation the system MUST reconnect the same account once, even when saved auto-connect is off, without changing that preference; it MUST coordinate with any saved auto-connect attempt or pending retry so exactly one connection attempt owns the account, and send one localized acknowledgment to the requesting chat.
- **FR-011**: Explicit Off, changed authorization, expiry or failed revalidation MUST prevent reconnection and acknowledgment.
- **FR-012**: An ordinary terminal reload, or a reload not initiated by a valid confirmation, MUST NOT reconnect or reply based on any stale handoff.
- **FR-013**: The system MUST NOT create duplicate connections, automatically resend uncertain sends (in either runtime, including outbound sends in flight at reload), or add reload retry loops.
- **FR-014**: On reload or initialization failure, Pi's terminal diagnostics and recovery path MUST remain intact (a rejected reload propagates to Pi, clears the armed intent and leaves no handoff); after a valid handoff, the single post-reload reconnect replaces saved auto-connect retries for that start, so if it fails WhatsApp stays disconnected and the operator reconnects from the terminal; any phone failure notice MUST be best effort and attempted at most once.
- **FR-015**: The acknowledgment MUST state WhatsApp recovery only and MUST NOT claim all extensions loaded.
- **FR-016**: All new help text, menu text, refusals, acknowledgments and failure notices MUST be localized in English, Portuguese (Brazil), Spanish and French.
- **FR-017**: The feature MUST NOT install software, run shell commands, expose an agent tool, or restart the Pi process.

### Key Entities

- **Reload request**: Pending confirmation bound to owner, private chat, account, session and expiry; single use.
- **Reload handoff**: Bounded, expiring, one-use authorization carried across runtime replacement, identifying profile, account, session, owner and chat; consumed after initialization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can complete a phone reload and receive an acknowledgment within one confirmation step and without terminal interaction.
- **SC-002**: 100% of non-owner, group, cancelled, expired, replayed, busy and pending-message requests result in zero reloads in validation.
- **SC-003**: 100% of validated reloads leave the Pi session, conversation history, saved login, saved auto-connect setting and other preferences unchanged.
- **SC-004**: Every successful phone reload yields exactly one connection and exactly one acknowledgment; no duplicate connection or automatic resend occurs.
- **SC-005**: 100% of stale-handoff, changed-authorization, explicit-Off and ordinary terminal reload scenarios produce no reconnection or phone reply.
- **SC-006**: All new user-visible strings exist in all four supported languages.

## Assumptions

- Menu lifetime matches the existing phone confirmation-menu lifetime; the handoff expires within a similar short bound (minutes, not hours).
- "Busy" means an active agent turn or any queued/pending incoming message in the shared session.
- The handoff is process-local; a full Pi restart discards it.
- "Private chat" excludes every group chat, including the bound group in group-only mode; in group-only mode phone `/reload` is therefore unavailable.
- Verified-owner, allowed-chat, explicit Off and menu-authority semantics reuse existing owner authorization and navigation behavior.
- Reload-failure recovery is the operator's existing terminal path; no automatic retry. A valid handoff cancels the new runtime's pending saved auto-connect retries before the single reconnect; if that reconnect fails, no further automatic attempt is made, and the terminal notice directs the operator to reconnect.
