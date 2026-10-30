# Managed speech validation — 2026-10-28

This is the original implementation checkpoint. The later [Opus correction and local native acceptance record](review.md) supersedes its specific no-review/no-native-evidence limits without rewriting the original runs below.

## Delivered scope

Implements the approved [specification](spec.md) and [plan](plan.md): matching selected local STT/TTS servers start after verified WhatsApp connection, including manual Connect and saved auto-connect. Trusted JSON descriptors remain outside chat-editable settings. A typed service owns lifecycle/request authority; a core-Node watchdog owns one foreground server and a separate endpoint lease. No dependencies, package version, transport/auth/archive ownership or destination-consent rules changed.

Production integration uses existing connection/Off/session/shutdown owners, SessionManager post-commit notifications and pre-transcription/pre-synthesis gates. Cancellation of ordinary speech work remains separate from server retirement. Readiness requires owned listener PID plus expected health/backend/loaded-model metadata; requests recheck rather than trusting a retained ready flag. Foreign listeners/unknown leases are never adopted or removed. Native output is discarded and failure notices contain fixed metadata-only codes.

## Test-first and correction evidence

- The initial new-service suite failed because the module did not exist. This was a feature scaffold baseline, not a claim that all later scenarios independently failed first.
- Two integration regressions initially failed: AudioService never called its pre-upload gate; SessionManager had no committed-speech-config callback. Both pass after wiring.
- A stale caller initially remained waiting after its authority expired. The regression observed `still-waiting` after 350 ms; bounded currentness monitoring now cancels that caller without cancelling shared startup.
- A release fixture initially accepted a package missing the managed worker. The required-file gate now rejects it. Tests invoke mocked release operations only; no release preparation/publication ran.
- An older credential-selection request initially borrowed a replacement entry at the same endpoint/model. Exact selected-configuration matching now refuses that lifetime substitution.
- A cancelled waiter initially abandoned a failed readiness-check Promise, producing an unhandled rejection. The unwrapped regression reproduced it; settlement is now observed even if cancellation wins before the wait attaches. A spy-wrapped draft masked the rejected Promise, so it was replaced rather than counted as failing evidence.
- Production-entry fixture assertions were corrected to distinguish phone-control acknowledgement from completion of asynchronous child retirement, and to compare post-Off socket attempts with the captured pre-Off baseline rather than assume one construction per session. These were harness assumptions, not separately established transport defects.

## Commands and results

Platform: **Darwin x86_64, Node v26.13.0, Pi development peers 1.4.0**. Commands ran with disposable HOME / `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`, `WHATSAPP_NG_LOCALE=en` and an allow-listed credential-free environment. `PI_OFFLINE` is not a network sandbox: existing RPC guards block parent network egress and synthetic transport/model adapters replace real WhatsApp/providers. New watchdogs deliberately clear inherited Node loader options and make only loopback health/model requests to the synthetic server in these tests.

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2 tests/unit/managed-speech.service.test.ts` | Focused 23-case checkpoint passed before the additional missing-executable case; final full suite includes all 24 cases. |
| `npm test -- --maxWorkers=2 tests/unit/phone-control.rpc.test.ts --testNamePattern=managed-` | Both managed manual/auto scenarios passed; 11 unrelated cases filtered out in this focused run. |
| `npm test -- --maxWorkers=2` | **1,480 tests across 84 files passed**, zero failures/skips/unhandled errors. This includes all phone-control RPC modes. |
| `npm run lint` | Exit 0; covers production `.ts`/`.mjs`, scripts and test `.ts`. |
| `npm run typecheck` | Exit 0; source/entry scope, not independent test-fixture type qualification. |
| `node --check src/services/managed-speech.worker.mjs` | Exit 0. |
| `node --check tests/fixtures/managed-speech-server.mjs` | Exit 0; fixture `.mjs` is outside the lint glob. |
| `npm pack --dry-run --json --ignore-scripts` | Exit 0; 63 entries, managed worker included, no `tests/` or `.pi/` payload. Dry-run only, not consumer-install qualification or publication. |
| `git diff --check` | Exit 0; additional new-file whitespace scan also passed. |

An earlier stable gate passed 1,478 tests; the final count additionally includes missing-executable cleanup and the unhandled-rejection regression. Preserve that distinction rather than rewriting the earlier run as the final result.

## Exercised boundaries

- Unset/blank and malformed descriptors; loopback/role/model/path constraints; no startup during discovery/disconnected state or for unrelated hosted settings.
- Independent STT/TTS operation, concurrent startup coalescing, missing executable, port/lease conflicts and unchanged unknown lock content.
- Real macOS listener-PID inspection, private lease directory/file permissions, graceful and forced owned shutdown, lease removal after confirmed cleanup.
- Wrong backend/model, startup timeout/early exit, ready-state model change, sticky failures across requests/chat-setting toggles and selective retirement without killing the other role.
- Caller abort/staleness, interrupted startup, selected credential-lifetime replacement and handled late rejection.
- Abrupt synthetic Pi-parent SIGKILL: watchdog IPC loss stops its child and releases its own lease. The test waits for observed process death and lease cleanup, not only signal acceptance.
- Actual `whatsapp-ng.ts` loaded into isolated Pi RPC: manual/auto connection, synthetic model calls through guarded `configure_wa_stt({})` and restore, native-child retirement/restart after committed configuration changes, ordinary `/stop` retaining the server, new session, reload and Off surviving subsequent reload/session replacement. Parent network guards report zero attempts; there are no real provider or WhatsApp calls.

## Remaining limits and authorization

- No real CrispASR server/inference/model download, voice preview, actual WhatsApp account or real configuration was used or changed. Earlier help/version inspection does not qualify the native HTTP schema or model performance. A live reload/check remains an operator action.
- Linux procfs ownership is implemented but was **not executed on Linux** in this work. No container/platform qualification ran. Windows managed startup is explicitly rejected; a synthetic platform-refusal test does not qualify Windows processes. Existing manually operated endpoints remain supported.
- No new addon/model/codec compatibility claim follows from zero test skips. Native models, IPv6 listener behavior, third-party wrappers and client rendering remain unqualified here.
- Foreground non-daemonizing commands are required. Simultaneous watchdog/OS failure, uninterruptible operations or unknown retained locks may require operator inspection; no lock stealing, process-name/port killing or hostile-same-user sandbox guarantee is supplied.
- No independent reviewer was dispatched. No fresh security audit, dependency installation, clean consumer install, Git staging/commit/push, automation activation, version change or release/publication ran. R5 remains deferred; unrelated README/roadmap introduction work and its 042 records are preserved.

Static validation passed over 10 changed Markdown files: 77 relative paths/heading or explicit HTML-anchor targets, plus whitespace checks for the eight new source/test/specification files. External URL availability was not checked. A draft checker initially missed an existing explicit README HTML anchor; its HTML-anchor handling was corrected without changing that historical link. Public behavior lives in the [operating reference](../../docs/reference.md#optional-managed-speech-servers) and [setup guide](../../docs/crispasr.md#optional-managed-startup), not in private validation logs.
