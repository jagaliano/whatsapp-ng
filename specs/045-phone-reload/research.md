# Research: Phone-Initiated Pi Reload

## R1. How to invoke Pi's standard reload from a phone event
- **Decision**: Queue `/whatsapp --internal control-reload <uuid>` with `pi.sendUserMessage(..., { expandPromptTemplates: true, deliverAs: 'followUp' })`. The gateway runs in `ExtensionCommandContext` and calls `await ctx.reload(); return;`.
- **Rationale**: `ctx.reload()` exists only in command context, per `docs/extensions.md` "ctx.reload()". The `/new` path already uses this gateway, which cannot be invoked manually because its tokens are in-memory and one-use. Pi will not reload while the agent is running.
- **Alternatives**: Calling reload from the socket event is impossible because that context lacks the method. Restarting the process is out of scope.

- **Evidence (T001)**: Pi 1.5.0 development dependency `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:341` declares `reload(): Promise<void>` on the command context; the production-entry RPC fixture already drives `ctx.reload()`. Baseline stays 1.5.0.

## R2. Handoff publication without work after reload
- **Decision**: The gateway arms a one-use in-memory intent (owner, chat, account, profile, sessionId, expiry) and then reloads. The `session_shutdown` handler publishes the handoff only when `event.reason === 'reload'` and the armed intent is still fresh; arming is consumed either way. Any other shutdown, or a reload shutdown without an armed intent, deletes this profile's handoffs.
- **Rationale**: This satisfies "no work after reload in the old handler". It also prevents an ordinary terminal `/reload` from reviving a stale request, because only the shutdown that immediately follows the phone gateway carries the intent.
- **Alternatives**: Writing the handoff before `ctx.reload()` was rejected because a failed reload would leave a live handoff for the next terminal reload. Persisting to disk was rejected as unbounded and surviving process restart.

## R3. Consumption and revalidation in the new runtime
- **Decision**: Consume the handoff in `session_start` only when `reason === 'reload'`, after `sessionManager.ensureInitialized()` and Off-profile restoration. Delete it before validating. The checks are: not expired, `profile === getAuthStateDir()`, `sessionId === ctx.sessionManager.getSessionId()`, `owner(actor)`, `allowed(chat)` and a private chat. Then call the existing `resume(current, account)` port. If the result is true and `current()` still holds, send `phone.reload.ready` once. Any other `session_start` reason discards the handoff.
- **Ordering (no duplicate connection)**: Precise post-reload ordering (verified against `whatsapp-ng.ts` and `whatsapp.service.ts`): (1) `session_start(reason:'reload')` runs its existing body unchanged, including `await tryConnect()` for the first saved auto-connect attempt (`whatsapp-ng.ts:727`), which can leave a 3 s `autoConnectRetry` timer (`:719`). (2) Only after that block and `syncManagedSpeech()`, and only if `startupLifecycle === managedLifecycle`, call `void phoneControls.consumeReload(event.reason, ctx)`; it is not awaited, so startup is not blocked by the up-to-30 s `resume` poll. (3) `consumeReload` takes and deletes the handoff and validates it synchronously. If it is invalid, it returns and leaves saved auto-connect retries untouched. (4) If it is valid, it calls `cancelStartupRetry()` (`:283`; bumps `startupAttemptEpoch` and clears the timer, so any pending or later `tryConnect` returns at `:706`/`:711`) before any await. (5) Then it calls `resume(current, account)`, which reuses an existing socket (`:337`). A retry `start()` that fired before step 4 and is still in flight is joined through `WhatsAppService.start()` reuse of the same-generation `startPromise` (`whatsapp.service.ts:706`), so at most one socket start happens. Required race tests: (a) the first attempt fails and the retry timer is pending when the handoff is consumed, so the retry never fires and exactly one `start()` comes from `resume`; (b) the retry timer fires and `start()` is in flight when the handoff is consumed, so `resume` joins it and the total number of socket starts is one; (c) an invalid handoff leaves the retry timer intact.
- **Failure after cancellation (U4)**: If `resume` returns false after step 4, there is no saved auto-connect retry and no reload retry; the terminal notice says to reconnect WhatsApp from the terminal, and one best-effort `phone.reload.failed` is attempted.
- **Rationale**: `resume` already handles explicit Off, the operator revision, runtime identity and account-scope match. It also observes an auto-connect socket that `session_start` started instead of starting a second one, so there are no duplicate connections. It starts a socket when auto-connect is off.
- **Alternatives**: A separate reconnect routine was rejected as duplicated logic.

## R4. Old socket and credential retirement
- **Decision**: Rely on the existing `session_shutdown` → `whatsappService.stop()` path. It already holds the transport lease through pending credential I/O.
- **Rationale**: This is existing generation-aware teardown, so no new path is needed.

## R5. Busy, pending and connection refusal
- **Decision**: Require `getEffectiveStatus() === 'connected'` and an unchanged account scope at confirmation and in the gateway; otherwise reply `phone.reload.notConnected` (when possible) and do not reload. Check `idle(ctx)` when the menu is confirmed (inside `apply`). Recheck `ctx.isIdle()`, `!ctx.hasPendingMessages()` and `frame.current()` in the gateway. On rejection, reply with `phone.busy` or `phone.reload.expired` while the frame is current and notify the terminal.
- **Rationale**: Same as `/new`.

## R6. Failure behavior
- **Decision**: Add no catch-and-retry around `ctx.reload()`, so Pi surfaces its diagnostics; wrap only with `try/finally` that clears the armed intent, so a rejected reload leaves no handoff. If the new runtime's `resume` fails, notify the terminal and attempt `phone.reload.failed` once, only when a send is possible and `current()` holds. That notice is best effort, never retried, and an unknown delivery outcome is not repeated.

## R8. Private chat and group-only mode
- **Decision**: Use `SessionManager.isGroupJid(chat)`; any group, including the bound group in `--whatsapp-group` mode, gets `phone.reload.privateOnly`. Checked when opening the menu and again on confirm.

## R9. Real-entry regression coverage
- **Decision**: Mandatory. If `phone-control.rpc.test.ts` cannot drive `ctx.reload()`, extend the existing production-entry fixture (synthetic socket/Pi adapters under `tests/fixtures/`) so it can. A missing fixture is not a waiver; the feature is not done until this test passes.

## R7. Lifetimes and bounds
- **Decision**: Menu/ticket lifetime 15 s, the same as `/new`. Armed intent and handoff lifetime 30 s, the same as the control-resume handoff. The map is capped at 10 entries and pruned on write.

## R10. Implementation notes (2026-11-11; deviations D1–D5 in plan.md Complexity Tracking)
- Race (b) in practice: because `consumeReload` runs only after the awaited first auto-connect attempt and cancels retries synchronously, a retry `start()` cannot be in flight at consume time; the reachable in-flight case is the first auto-connect socket still opening, which `resume` joins (RPC `reload-auto`: 2 starts total).
- The gateway does not check the router mutation lock: the confirming `apply` may still hold it when Pi dispatches the follow-up command. Pi idle/pending checks remain.
- `consumeReload`'s `current()` omits the router epoch, because connection-status resets during the reconnect itself bump it; owner, allowed chat, operator revision and session id remain bound.

## R11. Review fixes (2026-11-11, second pass)
- **R1**: the reload ticket records the confirming lock token; the gateway refuses any other held router lock.
- **R2**: `consumeReload`'s `current()` binds an Off generation port, bumped only by explicit Off (`setOutboundEnabled(false)`).
- **R3**: if WhatsApp is already connected when the handoff is consumed, a different account refuses before retries are cancelled or a reconnect starts. If the account becomes known only after the reload's own reconnect and differs, `retire()` (the existing `whatsappService.stop()` path) disconnects it, and no acknowledgment is sent. Pre-connect credential reads were rejected because they would touch auth state outside the transport lease.

## R12. Reload-owned socket (third pass, B1/B2)
- Ownership comes from object identity, not status: `resume` calls `onOwned` with `whatsappService.getSocket()` only after its own `start()`, and only when no socket existed beforehand. `retire` compares that exact object with the active socket and also requires `current()` and the request not being Off. A Baileys-internal reconnect replaces the object, so it is conservatively not retired.
- No other `start()` can be joined by the reload's own `start()`: `consumeReload` runs after the awaited first auto-connect attempt and cancels retries synchronously before `resume`.
- The best-effort failure notice is sent only while the active account equals the handoff account.

## R13. Deterministic real-entry races (fourth pass)
- **R1 reachability**: Pi runs an idle extension command synchronously up to its first await, so on the ordinary path the gateway's checks run inside the confirming `apply` and no other phone mutation can interleave. The race is reachable when Pi defers `prompt()` during `agent_settled` emission (`agent-session.js` `_isEmittingAgentSettled`/`_deferredSettledActions`); `reload-busy` uses exactly that.
- **R2 reachability**: Off calls `router.reset()`, which changes the runtime id that `resume` checks, so a post-Off acknowledgment is impossible at the real entry. The guard's real-entry effect is suppressing the failure notice (and the B1 retire decision) after Off then Connect. `reload-offrace` holds the 100 ms poll so Connect completes before `resume` observes anything.
- Fixture controls are test-only (preload, synthetic socket, fixture extension) and enabled only by `WA_PHONE_RPC_RELOAD_RACE`. No authorization check is mocked.
