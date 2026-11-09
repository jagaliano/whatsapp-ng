# Feature Specification: WhatsApp Processing Reaction

**Feature Branch**: `043-whatsapp-processing-reaction` (spec directory only; no branch created)

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Add a small WhatsApp processing acknowledgement: when an allowed WhatsApp message is accepted for Pi processing, react to that exact incoming message with ⏳ in WhatsApp, then remove the reaction when that request reaches a terminal outcome. Bounded UX feature inspired by upstream project (see [attribution](../../README.md#fork-and-legacy-names)) commits ceae428 and 75ea838 (upstream master 9eaa35b, 2026-11-06), not a port of their global single-key implementation."

## Context

- The indicator is visible only in the WhatsApp chat, as an emoji reaction on the user's message. Nothing changes in the Pi terminal.
- Fork 1.1.7 (`18c4b8d`) already shows typing presence and offers an explicit, model-invoked reaction tool, but never reacts automatically.
- Upstream keeps one shared "message being processed" reference and clears it on any assistant message end. That model is unsafe here: overlapping requests can clear the wrong message, intermediate tool-use messages clear it too early, and cancellation or reset can leave it behind. This feature defines per-request behavior instead.
- Upstream's reaction-loop early return (`b83aa1e`) and same-digits own-LID rewrite (`0f56028`) are explicitly excluded: the fork already records reactions into history without prompting Pi and routes through verified identity aliases and preserved transport addresses.

## Clarifications

### Session 2026-11-07

- Q: If a WhatsApp message arrives while Pi is already working on an earlier request, should it get ⏳ immediately when it is queued, or only once Pi starts processing it? → A: Immediately when accepted and queued; removed when the request containing it ends.
- Q: Should send_reaction wait for an in-flight ⏳ add so the explicit reaction lands last? → A: No. Stop future automatic egress immediately and send the explicit reaction normally; precedence is best-effort and an already-in-flight add may still arrive late. No retries.
- Q: Should a reaction made from the phone with the same account also override the indicator? → A: Yes, an observed, verified own-account reaction (including removal) overrides it, without changing history reconciliation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See that a request is being worked on (Priority: P1)

A person in an allowed chat or group sends a message that Pi accepts for processing. The message promptly shows a ⏳ reaction; when Pi's answer has been sent (or the request otherwise ends), the ⏳ disappears.

**Why this priority**: This is the entire user value: immediate confirmation that the message was received and is being worked on, especially for long-running requests.

**Independent Test**: Deliver one admitted message through a simulated connection; observe one ⏳ reaction on that exact message before or alongside processing start, and one removal after the final reply settles.

**Acceptance Scenarios**:

1. **Given** an allowed direct chat, **When** a message is admitted for Pi processing, **Then** exactly that message receives ⏳.
2. **Given** an allowed group, **When** a participant's message is admitted, **Then** the ⏳ targets that participant's message in that group, not another participant's or another chat's message.
3. **Given** a request with ⏳, **When** its final reply settles (successfully or not), **Then** the ⏳ is removed once.
4. **Given** a request whose processing uses tools and produces intermediate assistant messages, **When** those intermediate messages complete, **Then** the ⏳ remains until the request's terminal outcome.

---

### User Story 2 - No stray or misplaced indicators (Priority: P2)

Indicators appear only for real admitted requests and never linger, move to the wrong message, or appear after the WhatsApp connection is turned off or the account changes.

**Why this priority**: A stale or misplaced ⏳ is misleading and, in groups, visible to others; correctness matters more than the indicator itself.

**Independent Test**: Simulate ignored, duplicate, history, own-echo and ambiguous inputs plus concurrent, cancelled, reset, Off and account-change runs; verify no unexpected reaction is added and every added one is removed exactly once (or suppressed once the context is stale).

**Acceptance Scenarios**:

1. **Given** a message that is not admitted (disallowed sender/group, system or reaction event, history/append/backfill import, duplicate, own echo, or input refused as ambiguous before admission), **When** it arrives, **Then** no ⏳ is added.
2. **Given** two admitted requests from different chats, **When** one finishes, **Then** only its own ⏳ is removed and the other remains until its own terminal outcome.
3. **Given** inputs combined into one ambiguous run that is refused, **When** the refusal is settled, **Then** each ⏳ added for those inputs is removed.
4. **Given** an in-progress request, **When** it is aborted/cancelled, the session is reset, or it fails, **Then** its ⏳ is removed if the original connection context is still current.
5. **Given** an in-progress request, **When** WhatsApp is turned Off, logged out, or the account/connection generation changes, **Then** no further reaction add or remove is sent through the old context, and the tracked indicator is discarded.

---

### User Story 3 - Indicator never harms delivery (Priority: P3)

If the reaction cannot be sent or removed, the request and its reply proceed exactly as without the feature.

**Why this priority**: The indicator is cosmetic; reply delivery and safety rules are the product's core.

**Independent Test**: Make reaction sends fail, hang, or report an unknown outcome; verify the prompt, reply, routing and history are unchanged, no retry or substitute message occurs, and only metadata-only diagnostics are logged.

**Acceptance Scenarios**:

1. **Given** the ⏳ add fails or is slow, **When** a message is admitted, **Then** Pi receives the prompt without waiting for the reaction outcome.
2. **Given** the ⏳ removal fails, **When** the reply settles, **Then** no retry or alternative message is sent and the reply outcome is unaffected.
3. **Given** the connection echoes back the extension's own ⏳ reaction or its removal, **When** it arrives, **Then** Pi is not prompted and history keeps its existing reaction reconciliation behavior.

### Edge Cases

- A request whose terminal outcome occurs before the ⏳ add completes: the indicator must not remain (at most a single removal attempt after the add, if the context is still current; no repeated attempts).
- The same message arriving twice: a single indicator only, since duplicates are not admitted.
- A user who already reacted to their own message: the extension only adds/removes its own reaction and does not alter others' reactions.
- Terminal-originated (local) Pi work: no WhatsApp message exists, so no indicator.
- Explicit reactions via the existing reaction tool on the same message take best-effort precedence: once an explicit reaction (including an explicit removal) is requested for that message, the automatic indicator must not add ⏳ afterwards and must not remove the reaction later. The explicit reaction is sent immediately without waiting; a ⏳ add already transmitted may still arrive after it and is not corrected (no retry or re-send).
- A reaction (or removal) made from the phone with the same account on a message with an active indicator, once observed and verified as the own account's, overrides the indicator the same way. An observed own ⏳ is treated as the indicator's own echo, so a manual ⏳ is indistinguishable and does not override (accepted: same visible result).
- Voice/spoken replies and attachments: the terminal outcome is the settlement of the owning request's final delivery, regardless of reply format.
- A message accepted while Pi is busy: ⏳ appears when it is queued; if it is later merged into a combined run, its ⏳ is removed when that run ends (including ambiguity refusal).
- Off then On during processing: indicators from the old context are not cleaned up through the new context.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add a ⏳ reaction to an incoming WhatsApp message only when that message is admitted into Pi processing. Admission includes being accepted and queued while another request is active; the ⏳ is added at that point, not when processing of that message later starts.
- **FR-002**: The system MUST NOT add ⏳ for messages from disallowed chats/senders, system or reaction events, history/append/backfill imports, duplicates, own echoes, or inputs refused before admission.
- **FR-003**: The reaction MUST target the exact original message identity (chat address as received, message id, direction and group participant where applicable); the system MUST NOT reconstruct a target from displayed numbers or linked-identity digits.
- **FR-004**: Each admitted request MUST track its own indicator; finishing one request MUST NOT remove another request's indicator.
- **FR-005**: The system MUST remove a request's ⏳ at most once, upon its terminal outcome: final reply settled (success or failure), processing failure, abort/cancellation, ambiguity refusal, or session reset.
- **FR-006**: Intermediate assistant messages (including those that invoke tools) MUST NOT remove the ⏳.
- **FR-007**: Before every reaction add or removal, the system MUST verify that the connection, account and session generation captured at admission are still current; otherwise it MUST skip the egress and discard the tracked indicator.
- **FR-008**: Explicit Off, logout and account/generation changes MUST stop all pending indicator work for the old context.
- **FR-009**: Reaction add/remove MUST be best-effort: it MUST NOT block or delay prompt submission or reply delivery, MUST NOT be retried automatically, and MUST NOT trigger any fallback message.
- **FR-010**: Reaction failures MUST be logged with metadata only (no message text, phone numbers or keys beyond existing diagnostic conventions).
- **FR-011**: Echoes of the extension's own processing reactions MUST NOT prompt Pi and MUST be handled by the existing reaction history reconciliation without new special cases that drop other reactions.
- **FR-012**: The feature MUST NOT add a success reaction, a terminal indicator, or a new user setting. If planning identifies a blocking need for a toggle, it MUST be raised as an open decision rather than added.
- **FR-013**: Existing behavior MUST be preserved: conversation ownership and ambiguity refusal, transport targets, owner authorization, reply delivery and voice behavior, history archive semantics, the explicit reaction tool, Off/lifecycle fencing, and no-resend-on-unknown-outcome rules.
- **FR-014**: Public documentation (README, operating reference) and the changelog MUST describe the indicator, its best-effort nature and when it is removed.
- **FR-015**: An explicit reaction requested through the reaction tool for a message with an active indicator MUST supersede that indicator immediately: no later automatic add or removal may be sent for that message. The explicit send MUST NOT wait for the indicator; precedence is best-effort and an already-in-flight ⏳ add is not corrected or retried.
- **FR-016**: An observed reaction or removal on that message that is verified as coming from the connected account and was not sent by the indicator MUST supersede the indicator in the same way, without changing existing history reaction reconciliation. An own ⏳ observation is treated as the indicator's echo.

### Key Entities

- **Processing indicator**: The association between one admitted request and the exact incoming message that received ⏳, plus the connection/account/session context captured at admission and whether removal has been attempted.
- **Terminal outcome**: The single event that ends an admitted request (settled final reply, failure, cancellation, ambiguity refusal, reset, Off/logout or context change).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In simulated runs, 100% of admitted messages within the 500-record capacity and with current authority receive exactly one ⏳ add attempt, and 0 non-admitted messages receive one.
- **SC-002**: In simulated runs covering success, failure, tool use, cancellation, ambiguity refusal and reset, every added ⏳ not superseded by an explicit/own-account reaction receives exactly one removal attempt once its add settles while its context and admission are current, and none before the terminal outcome.
- **SC-003**: With two or more overlapping requests, 0 removals target a message belonging to a different request.
- **SC-004**: After Off, logout or account/generation change, 0 reaction attempts are made through the old context.
- **SC-005**: With reaction sending forced to fail or hang, prompt submission and reply outcomes are identical to runs without the feature, with 0 retries and 0 extra messages.
- **SC-006**: All existing regression suites and declared repository checks pass unchanged in behavior.
- **SC-007**: In simulated runs where an explicit or verified own-account manual reaction targets a message with an indicator, 0 automatic adds or removals are sent for that message afterwards, and the explicit send is never delayed by the indicator.

## Assumptions

- The indicator is always on for admitted requests; no setting is introduced (open only if planning finds a blocking need).
- WhatsApp allows one reaction per account per message; removing means clearing the extension account's reaction on that message.
- Indicators are process-local and not persisted; after a restart, a lingering ⏳ from a crashed process is not repaired.
- If Pi retries a run after a recoverable error, the ⏳ removed at the end of the failed attempt is not added again for the retry (accepted, cosmetic).
- At most 500 indicators are tracked at once; beyond that, newly admitted messages get no ⏳ (prompt handling unchanged). Records are released on removal, discard or withdrawal, so the bound is not reached in normal use.
- Logout invalidates the connection generation immediately, so every later indicator egress is skipped by the FR-007 check; leftover records are released when their request ends or is withdrawn.
- Validation uses simulated connections and synthetic data only; live WhatsApp confirmation is out of scope and would be a separate operator check.
- Implementation will add failing regressions first (admission add, ineligible no-add, tool-call non-clearing, per-request independence, cancellation/reset/Off cleanup, non-blocking failures, stale-context suppression), then run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck` and `git diff --check`.
- Out of scope: importing upstream code, routing changes, reaction-filter changes, new dependencies, menu changes and live validation.
