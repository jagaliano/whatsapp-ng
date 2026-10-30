# Managed CrispASR server lifecycle

## Approved scope

The owner requests startup when WhatsApp connects/auto-connects, replacing R2's first-use proposal. Explicit decisions: launch only matching selected local speech backends; use shell-free JSON descriptors in `CRISPASR_STT_CMD` / `CRISPASR_TTS_CMD`; include a Node watchdog for Pi crash cleanup. No real servers/models/configuration, installation, Git delivery or publication are authorized merely by implementation.

## Contract

- Each optional JSON descriptor declares absolute `executable`, string-array `args`, absolute `cwd`, numeric-loopback HTTP `endpoint`, expected CrispASR `backend`, selected API `model`, expected server `loadedModel`, optional `env` variable-name allowlist and bounded `startupTimeoutMs`. STT endpoint is `/v1`, TTS `/v1/audio/speech`. No shell; no secret values in descriptors/diagnostics.
- Capture descriptors from trusted process environment only. Match selected endpoint/model/protocol before launch. Unset variables preserve unmanaged behavior; hosted/Edge/local-CLI selections do not launch unrelated servers. STT/TTS are independent, with distinct listening addresses/ports. Starting processes does not enable speech or grant destination/group consent.
- Launch after verified WhatsApp connection, including manual Connect and saved auto-connect. Keep model startup separate from existing HTTP/synthesis request budgets. Requests wait only for the bounded startup and must hold current caller/account/session authority; failures never switch providers.
- Use separate exclusive endpoint leases before native startup, never auth/config/archive locks. Never steal unknown locks, adopt listeners or kill by process name/port. Establish owned listener PID plus expected health/backend/model before readiness and before admitting a managed request.
- Fence and stop owned children on Off, disconnect, reload/session replacement/shutdown and relevant selected endpoint/model/protocol changes or resets. Ordinary /stop cancels speech work without abandoning server ownership. Sticky startup failures are not retried by incoming messages or chat-setting toggles; explicit terminal connection retry/new runtime may retry.
- A core-Node worker owns the server and reacts to parent IPC loss. Use bounded TERM/KILL shutdown of its owned foreground process group; native output is discarded. Watchdog/OS simultaneous failure, daemonizing wrappers and damaged retained locks are not guaranteed recoverable. Never silently remove crash leftovers.
- Managed startup initially supports macOS and Linux process ownership inspection. Windows fails before launching a managed child; manually operated servers and all existing Windows paths remain unchanged. Platform claims require actual evidence, not fixtures alone.

## Installation inspection

The supplied installation contains Intel macOS CrispASR 0.8.48, source `cc114d2b4a5a9413738f390093e9131576743cb6`. Only isolated `--version`/`--help` ran. Matching upstream CLI/server source documents `/health` and `/v1/models`; no parent-death option was found in those reviewed paths. No server, inference, model download or live WhatsApp operation ran.
