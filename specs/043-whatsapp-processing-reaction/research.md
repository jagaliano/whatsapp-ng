# Research: WhatsApp Processing Reaction

Sources: fork `18c4b8d` (`whatsapp-ng.ts`, `conversation-router.service.ts`, `reaction.sender.ts`, `whatsapp.service.ts`); upstream project (see [attribution](../../README.md#fork-and-legacy-names)) `9eaa35b` commits `ceae428`, `75ea838`.

## R1. When to add ⏳

- **Decision**: Immediately after `pi.sendUserMessage(...)` in the message callback (`whatsapp-ng.ts` hand-off, after `router.prepare`), alongside `markIncomingProcessing(key, 'handed-off')`.
- **Rationale**: This is the single point after every refusal path (system, phone command, foreign own-echo, admission/group policy, stale context, media failure) and before Pi queues it. It matches the clarification: add when accepted and queued, even while busy.
- **Alternatives**: At `router.consume` (would show nothing while queued; rejected by clarification). Upstream's add-on-every-upsert (would react to ignored traffic).

## R2. When to remove ⏳

- **Decision**: Record message keys consumed in the current run (router `onConsumed`) and settle all of them in `agent_end`, after `turn_end` final delivery has been awaited. Also settle on: retired-input abort (`router.abortRetiredInput` true), pending expiry/retirement, and resets.
- **Rationale**: `agent_end` is the run's terminal point for success, error, abort, and ambiguity refusal (notice is sent in `turn_end`). `message_end` fires for tool-call messages too (upstream bug).
- **Alternatives**: `turn_end` (multiple per run with tools), `message_end` (upstream; clears early).
- **Note**: Recoverable-error runs keep the router epoch for retry; the indicator still clears at `agent_end` because visible processing ended. A Pi-level retry does not re-add ⏳ (accepted, cosmetic).

## R3. Reset and Off semantics

- **Decision**: Two operations: `settleAll()` (remove if context current) for `session_before_switch`/`session_start` resets and abort paths; `discardAll()` (no egress) for explicit Off, `session_shutdown` and graceful shutdown. Every egress rechecks captured `WhatsAppSessionContext` via `isSessionContextCurrent`.
- **Logout (verified 2026-11-07)**: logout is triggered from `src/ui/menu.handler.ts:144` via `WhatsAppService.logout()` (`src/services/whatsapp.service.ts:1330`), which sets `intentionalStop` and increments `sessionGeneration` synchronously before any await. `isSessionContextCurrent` is therefore false for every captured context, so no indicator egress can follow; no extra logout hook is added. Remaining records are released on run end/withdrawal (stale → discarded without egress).
- **Rationale**: Off calls `router.reset()` before `whatsappService.stop()`, so context is still current at that moment; FR-008 forbids egress after Off. Account/generation changes are caught by the per-egress check.

## R4. Egress mechanism

- **Decision**: Reuse `ReactionSender` with the exact stored `WAMessageKey` (`key` option), emoji `⏳` then `''`. Fire-and-forget (`void`), catch everything, log `[WhatsApp-NG] Processing reaction add|remove failed` with no ids/JIDs.
- **Rationale**: Existing validated key path (group participant required); no resend on unknown delivery. Not routed through `trackOwnedSend`, so reply-suppression accounting is untouched.
- **Ordering**: If removal is requested before add settles, chain removal after the add promise (single attempt), satisfying the "finish before add" edge case.

## R8. Explicit and manual reaction precedence

- **Decision (explicit)**: `send_reaction` resolves its exact target key (existing `findMessageKey`), calls synchronous `indicator.supersede(key)`, then sends normally. Supersede marks the record `superseded`: no future automatic add, removal skipped at run end. No waiting, no retry.
- **Decision (manual)**: In the existing reaction intake/lifecycle paths, after current history reconciliation, notify `indicator.observeOwnReaction(targetKey, text)` when the reacting actor is verified as the connected account (`fromMe` / `isOwnJid`). Text `⏳` is treated as the indicator's echo and ignored; any other text, including `''` removal, supersedes. Reconciliation is unchanged; this is a read-only notification.
- **Rationale**: WhatsApp keeps one reaction per account per message, last write wins. Stopping future automatic egress prevents cleanup erasure. A cosmetic indicator must not stall tools or replies.
- **Accepted trade-offs (user-approved 2026-11-07)**:
  1. An already-transmitted ⏳ add may arrive after the explicit/manual reaction and overwrite it; not corrected.
  2. A manual ⏳ from the phone is indistinguishable from the indicator's echo and does not supersede; cleanup may then remove it.
  3. An indicator removal already in flight when a manual reaction occurs can still erase it (race window).
- **Alternatives rejected**: bounded wait (stalls tool), re-send explicit reaction (forbidden), tracking sent reaction ids (echo may precede send response).

## R9. Withdrawal callback and capacity (verified 2026-11-07)

- **onRetired** fires exactly once per pending request that leaves `pending` without consumption, at the four existing branches: `observeInput` interactive/rpc deletion (`conversation-router.service.ts:109`), non-extension source deletion (`:112`), `isRetiredInput` admission-invalid retirement (`:329`) and `retireExpiredPending` (`:344`). Not fired by `abortRetiredInput` (already fired at retirement) nor by `reset()` (covered by `settleAll`/`discardAll`).
- **Capacity**: router cap (`:83`) bounds `pending + retiredInputs` only; consumed records are not covered. `ProcessingIndicator` enforces its own 500-record cap.

## R5. Echo handling

- **Decision**: No change. Own reaction upserts already reconcile into history and never prompt (`whatsapp.service.ts` reaction branch); add a regression asserting this for ⏳/'' echoes.

## R6. Setting toggle

- **Decision**: None. No blocking need found; always on.

## R7. Phone commands / terminal input

- **Decision**: No ⏳ for phone-control commands (handled before hand-off) or terminal input (no WhatsApp key).
