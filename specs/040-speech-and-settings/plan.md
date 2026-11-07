# Implementation Plan: Speech and settings improvements for 1.1.x

**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md) | **Evidence**: [evidence.md](evidence.md)
**Status**: Implemented; released in 1.1.0–1.1.3, with US7–US9 in the 1.1.4 source pending publication. This consolidated record describes the design as built, not registry availability. It grants no permission to start servers, download models, release or publish.

## Technical Context

- **Language/Runtime**: TypeScript ES modules on Node 26.x; Pi 1.4.0 development peers.
- **Dependencies**: unchanged except the separately approved `follow-redirects` 1.16.2 lock refresh (see the [1.1.2 changelog](../../CHANGELOG.md#112--2026-10-31)).
- **Testing**: Vitest unit tests. Real behaviour is exercised through production-entry Pi RPC fixtures (`tests/unit/phone-control.rpc.test.ts`), which use a synthetic socket, model and provider and a network guard.
- **Platform**: development and native acceptance on macOS. Linux procfs ownership exists but is unqualified. Windows managed startup is refused.

## Constitution Check

- **OOP/SOLID**: each concern extends its existing owner. Only one new service (`ManagedSpeechService`) and its worker were added; a crash-safe process owner needs them.
- **Simplicity**: no new framework, dependency or configuration store. `SessionManager` remains the only config writer.
- **Strict TypeScript**: optional fields replace sentinels (for example, an omitted voice instead of a placeholder ID).

## Design by user story

| Story | Owners touched | Approach |
| --- | --- | --- |
| US1 Auto-connect | `whatsapp-ng.ts`, `src/services/session.manager.ts`, `src/ui/menu.handler.ts` | A strict boolean is re-read under cooperative config locking. The startup gate checks the mode (TUI/RPC versus print/JSON), saved credentials and process-local Off. The Back result returns to the Connection category. |
| US2 Managed servers | `src/services/managed-speech.service.ts`, `src/services/managed-speech.worker.mjs`, `whatsapp-ng.ts` | Details below. |
| US3 Server-default voice | `src/services/tts-config.ts`, `src/services/speech-settings.ts`, `src/services/remote-tts.service.ts`, `configure_wa_tts` schema | An optional boolean is validated against the protocol. The merge clears the opposite choice. Persistence allowlist, reset and identity-change invalidation are covered. |
| US4 Spoken-reply guard | `src/services/final-output.service.ts`, `send_wa_message` in `whatsapp-ng.ts`, `MessageSender` predicate | A read-only captured-protection query on `FinalOutputCoordinator` shares the effective-mode resolver with delivery. The guard requires `router.canFinalize(snapshot)`. The existing trusted predicate gets an optional resolved-recipient argument; zero-argument callers stay compatible. |
| US5 Synthesis budget | `src/services/tts-config.ts` (`TTS_SYNTHESIS_TIMEOUT_MS = 180_000`), `src/services/tts.service.ts` | The constant changes; the admission-scoped timer and other limits do not. |
| US6 Separators | `src/services/whatsapp-text.ts` (`cleanSpeechText`) | One extra alternative in the existing standalone-rule regex, applied after the code/indent guards. |
| US7 Owner guidance | `src/i18n.ts`, phone command router | String-only changes. Locale tests compare against the real navigation labels. |
| US8 Menus | `src/ui/voice-settings.view.ts`, `src/ui/whatsapp-settings.view.ts` (`withSettingsRequest`), `src/ui/menu.handler.ts`, `src/ui/optional-output-settings.view.ts` | Details below. |
| US9 npm 12 | `scripts/release.mjs` | A pack-result shape check selects exactly one expected package before the existing integrity, source and auth gates. |

### Managed speech servers (US2)

1. `ManagedSpeechService` parses descriptors from `CRISPASR_<ROLE>_CMD` and matches them against the committed selection. It owns lifetimes and the request gates that run before STT/TTS. A narrow post-commit callback from `SessionManager` drives restarts, so there is no parallel config writer.
2. A dependency-free Node worker:
   - takes the endpoint lease
   - spawns one foreground process group
   - proves listener ownership (`lsof` on macOS, procfs on Linux)
   - checks `/health` and the authenticated `/v1/models`
   - discards native output
   - on IPC loss, SIGHUP or retirement, applies bounded TERM/KILL
3. Server lifetime is tied to the transport and account, not to turn ownership. Phone `/stop` therefore cancels work without restarting the server. A pre-switch proposal that can still be cancelled only cancels work; native ownership retires when the replacement or shutdown is committed.
4. Transient probes retry within the startup budget. A definite backend/model mismatch or loss of ownership is fatal and sticky until an explicit retry.

### Settings navigation (US8)

1. The scoped `withSettingsRequest` wrapper derives a request context that preserves Pi's lazy context/UI getters. It is weak-keyed and removed when the outer request completes. It fences every dialog before and after each await, and it unwinds cancellation once.
2. The existing recursive menu structure stays. Every recursion shares the same derived request and guard, so authority cannot be renewed.
3. Speech policy and mutations stay in their existing owners. Chat setup captures one revision snapshot before the picker and saves once.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected |
| --- | --- | --- |
| Separate watchdog worker process for managed servers | It must clean up after the Pi parent is killed (SIGKILL) or its terminal hangs up | In-process child handling cannot survive the parent's death |
| Scoped UI-port wrapper in the navigation module | Demonstrated reuse of cancelled dialogs across views and authority renewal on recursive Back | A process-wide "current menu" variable would be mutable shared authority |
| Optional resolved-recipient argument on the trusted send predicate | Failing regressions showed that gateway/quote resolution could bypass the guard | A model-controlled field would be untrusted |

## Known limits carried forward

- Native acceptance downloaded auxiliary CrispASR assets beyond the approved 256 MiB cap. The owner accepted this ([exception](evidence.md#native-download-scope-exception)). Strict future budgets require blocking native egress.
- The optional hardening below was found in review but not applied:
  - late admission timing for legacy-covered explanations
  - wider decorative glyphs and box-drawn tables
  - phone-language localization of refusal prose
  - literal-label locale assertions
- `.gitignore` deliberately excludes the 039 plan. That earlier traceability gap remains open.
