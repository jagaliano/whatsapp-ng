# Research: QR Connect Welcome Message

## 1) Distinguishing a QR-driven connection from an auto-reconnect or credential-restore

- **Decision**: Add a `qrWasShown` boolean flag on `WhatsAppService`. Set it to `true` inside `handlePairingQr()` (called only when Baileys fires a `qr` event). Read and immediately reset it to `false` at the top of the welcome block in `handleConnectionOpen()`.
- **Rationale**: The `connection.update` event from Baileys carries either a `qr` field (pairing phase) or `connection: 'open'` (connected). When a session is restored from saved credentials, no `qr` event fires at all. When auto-reconnect happens, a new socket is created but again no `qr` fires unless the previous session expired. Therefore, `qrWasShown` is set if and only if the user physically scanned a QR code in the current session lifecycle — exactly the trigger the spec requires.
- **Alternatives considered**: Checking `sessionManager.getStatus() === 'pairing'` at connection-open time (unreliable — status is already being updated to `'connected'` by the time we would check); deriving from auth-state age (unnecessary complexity); persisting a flag across restarts (overkill — spec explicitly says no new persistence).

## 2) How to obtain the operator's own JID for the self-message

- **Decision**: Use `this.socket?.user?.id` immediately after connection opens, then pass it through the existing `normalizeJidForComparison()` helper to strip the `:0` device-suffix (e.g. `12345678901:0@s.whatsapp.net` → `12345678901@s.whatsapp.net`).
- **Rationale**: `socket.user.id` is populated by Baileys in the `connection.update` event with `connection: 'open'` — it is reliably available at the moment `handleConnectionOpen()` runs. The `:device` suffix must be stripped because `sendMessage` expects a plain JID (`XXXXXXX@s.whatsapp.net`). The `normalizeJidForComparison` helper already does exactly this stripping.
- **Alternatives considered**: Using `socket.user.lid` (a linked-device identifier — less stable); fetching the number from `SessionManager` config (not stored there); using a phone-number string stored at pairing time (requires extra state passed through multiple layers).

## 3) Which send API to use for the self-message

- **Decision**: Call `this.socket?.sendMessage(selfJid, { text })` directly inside the new `sendQrWelcome()` private method.
- **Rationale**: At the moment `handleConnectionOpen()` runs, `SessionManager.getStatus()` has just been set to `'connected'`, so the higher-level `sendMenuMessage()` would work. However, calling the socket directly avoids the `getActiveSocket()` guard check (which re-reads status synchronously) and keeps the method a focused fire-and-forget helper. `sendMessage` (the public method on `WhatsAppService`) is not used because it invokes `MessageSender` with retry logic and presence updates, which is overkill for a one-shot welcome.
- **Alternatives considered**: `sendMessage()` (the public wrapper) — too heavy (presence + retries); `sendMenuMessage()` — viable but pulls in a redundant null-check path for this internal call; a new `MessageSender` task — unnecessary abstraction for a single send.

## 4) Error handling strategy for the welcome send

- **Decision**: Wrap the `socket.sendMessage` call in a try/catch that silently discards failures. No logging, no retry, no status update.
- **Rationale**: The spec (FR-007) is explicit: "a failure to send the welcome message MUST NOT abort the session or prevent the agent from processing subsequent messages." The welcome is a best-effort, cosmetic notification. Any send error (network hiccup, JID resolution failure, Baileys not fully ready) must be invisible to normal operation. Verbose-mode logging of send failures is not required by the spec and would add noise.
- **Alternatives considered**: Logging in verbose mode only (slightly more debugging value, but also more code); retrying once (risks delaying the session-ready state on a bad network).

## 5) Console print placement and verbosity gating

- **Decision**: Print `t('service.whatsapp.qrConnected')` ("WhatsApp connected") unconditionally to `console.log` — **not** gated behind `this.verboseMode`.
- **Rationale**: The spec (FR-004, Assumption in spec.md) states this print is for operator confirmation and is not a debug detail. The analogous `onStatusUpdate` call already runs unconditionally. Making it verbose-only would hide the primary feedback from the operator.
- **Alternatives considered**: Writing to `fileLog()` only (invisible in the console — defeats the purpose); using `onStatusUpdate` instead of `console.log` (would replace the existing status bar string rather than printing an additional confirmation line).
