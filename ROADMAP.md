# WhatsApp-NG roadmap

Completed milestones and future work for easier phone control, optional local speech-server management and a more maintainable extension. Status distinguishes implemented work from proposals; this document does not authorize starting processes, changing settings, running live tests or publishing a release.

The existing [extension improvement records](specs/039-extension-improvements/) preserve earlier completed work and validation evidence. This roadmap tracks completed milestones and next work; it does not restart completed improvements or replace their validation records.

## Priorities

| Item | Goal | Status |
| --- | --- | --- |
| R1 | Fuzzy search in the WhatsApp `/model` command | Implemented in `1.1.0-rc.2`; publication pending |
| R2 | Optional managed CrispASR HTTP servers through `CRISPASR_STT_CMD` and `CRISPASR_TTS_CMD` | Implemented; local macOS STT/TTS/both cases accepted; broader qualification open |
| R3 | General code review, followed by focused corrections | Planned; review in bounded areas |
| R4 | Improve and maintain the documentation | Ongoing; extend the current guides |
| R5 | Answer `pi-ask-user` prompts from WhatsApp | Planned, deferred pending upstream responder support |
| R6 | Additional suggestions: speech diagnostics/recovery, compatibility, acceptance coverage and Edge TTS resilience | Proposed; select independently |

Ship small, independently useful changes. This is not a requirement to finish the entire roadmap before the next release.

## R1. Fuzzy search in WhatsApp `/model` — implemented

**Status:** implemented for `1.1.0-rc.2` in commit `5b0661e`. RC2 has not been published.

### Delivered behavior

- Preserve `/model` browsing and byte-exact authenticated `provider/model` direct selection.
- Search full public provider/model identifiers with Pi's case-insensitive fuzzy helper. `/model DeepSeek`, `/model Deepseek` and `/model deepseek` return equivalent matches across authenticated providers; `/model anthropic/opus` and `/model opus anthropic` combine search terms.
- Every non-exact search requires an explicit numbered selection, even with one result. Never switch to the nearest match or another provider automatically.
- Rank by Pi's fuzzy score with alphabetical tie ordering. Matching uses ordered-character subsequences and whitespace/slash-separated terms without another LLM call; separate display-name search and general typo correction are not part of this implementation.
- Show at most ten model choices per page, retaining the filter through next/previous navigation and clamping the page when availability shrinks. Store exact provider/model identities rather than selecting a replacement list index.
- Search only Pi's authenticated registry and recheck model availability, verified owner/chat/account/session binding and idle/pending-work guards before applying a choice.
- Retain the existing 2,048-character command limit, five-minute menu expiry and group quoted-reply requirements. No-match leaves the current model unchanged; queries are not echoed into replies or ordinary agent prompts.
- Keep filesystem identifiers redacted and available through plain browsing, not fuzzy search. Search full public identifiers independently of the displayed label's length limit.

### Completion evidence

- [x] Regression tests cover partial/provider-qualified searches, fuzzy subsequences, all three DeepSeek spellings across multiple providers, ranking, no-match cases, filtered pagination and changing availability.
- [x] Byte-exact selection remains direct; other matches require a choice. Tests preserve private-identifier, owner/group, stale-availability and busy-session protections.
- [x] The real Pi production-entry RPC fixture exercises search, pagination and exact selection using synthetic transport/provider data, isolated HOME and blocked network. This is not live WhatsApp evidence.
- [x] Native Anthropic Opus 5.5 review completed; its private-placeholder search finding was corrected with failing-before/passing-after regressions. Focused re-review returned **OK**.
- [x] Full source validation passed **1,408 tests across 83 files**, with zero failures/skips; lint, typecheck and whitespace checks passed. The user subsequently confirmed live owner-chat checks after reloading the extension. That live evidence is operator-attested, not independent per-case instrumentation or all-platform certification.
- [x] Phone help, [README search guidance](README.md#phone-controls) and the [changelog](CHANGELOG.md#unreleased) describe the behavior and shared-session effect.

Implemented in the existing [command router](src/services/whatsapp-command.router.ts) and [menu service](src/services/command-menu.service.ts), with [router regressions](tests/unit/whatsapp-command.router.test.ts) and [production-entry RPC coverage](tests/unit/phone-control.rpc.test.ts); no second phone-control stack or dependency was added.

## R2. Optional CrispASR HTTP-server lifecycle — implemented

The owner-approved trigger is now **verified WhatsApp connection**, including manual Connect and saved auto-connect, rather than the original first-use proposal. Existing hosted providers, manually operated endpoints and direct CLI transcription remain available.

### Delivered contract

- Optional trusted `CRISPASR_STT_CMD` / `CRISPASR_TTS_CMD` JSON descriptors bind an absolute executable/argv/cwd to a numeric-loopback endpoint, backend, selected API model and expected loaded-model ID. No shell parsing, persisted command writer or command-execution tool was added.
- Launch only the matching selected service. STT/TTS have independent lifetimes and distinct ports; startup does not enable speech, grant destination/group consent or perform inference. Unset variables preserve unmanaged behavior.
- Use exclusive endpoint leases separate from transport/auth/config/archive locks. Refuse unknown locks/foreign listeners; prove child listener ownership and matching bounded health/backend/model metadata before readiness and each managed request.
- Keep startup separate from HTTP/synthesis budgets. Cancel stale callers, retain failures without per-message/chat-toggle restart loops and preserve no-provider-fallback boundaries.
- Retire affected owned processes/work on Off, disconnect, reload/session replacement/shutdown and relevant speech-setting changes/clears. Ordinary `/stop` cancels work without stopping the connected server.
- A core-Node watchdog handles Pi IPC loss with bounded TERM/KILL of its own non-daemonized server process group. It does not adopt listeners, kill by name/port, accept licences or recover unknown crash leftovers. Minimal environment inheritance and metadata-only diagnostics avoid forwarding native output/credentials.

### Validation and remaining scope

See [implementation/validation records](specs/043-managed-crispasr/validation.md), [setup and descriptor examples](docs/crispasr.md#optional-managed-startup) and the [operating contract](docs/reference.md#optional-managed-speech-servers). The source includes macOS `lsof` and Linux procfs ownership paths; synthetic macOS tests are not Linux/native-model qualification. Windows management is explicitly unsupported; manual Windows endpoints remain unchanged.

Three local macOS native cases were accepted with English Whisper tiny.en and Kokoro Q8_0/af_heart, including maintainer-accepted native auxiliary resources; the [review/acceptance record](specs/043-managed-crispasr/review.md) preserves the original download-scope history. Broader platform/model and real WhatsApp acceptance remain open. Simultaneous watchdog/OS failure, daemonizing wrappers and damaged retained locks need operator inspection. Richer speech status/recovery UI remains R6 work. R5 stays deferred.

## R3. General code review

### Why

The extension has grown across identity/routing, phone controls, speech, persistence and optional outputs. Passing tests are necessary, but do not replace a review of how these boundaries interact.

### Scope

Review in bounded passes rather than attempting one opaque repository-wide rewrite:

- Authorization and data egress: verified owner controls, group participants, endpoint changes, file uploads and optional forwarding.
- Lifecycle/concurrency: session/account replacement, queue admission, cancellation, transport ownership and future server processes.
- Delivery/persistence: exact response ownership, full-text fallbacks, unknown sends, archive isolation and history updates.
- Resource/privacy limits: subprocess lifetime, bounded downloads/queues, private scratch files, cleanup and redacted diagnostics.
- Maintainability/tests: cohesive service ownership, unnecessary duplication, untested failure paths, native SDK compatibility and dependency/license exposure.

### Done when

- [ ] Findings have severity, precise source locations, reproducible scenarios and an introduced/pre-existing distinction.
- [ ] Concrete defects are corrected with failing-before/passing-after regressions; agreed residual risks remain explicit.
- [ ] Relevant tests, lint/typecheck and packaged-entry checks pass for the affected closure.
- [ ] Runtime/egress/process-management changes receive a focused independent review when authorized. A review does not imply live compatibility, release approval or permission to refactor unrelated code.

## R4. Improve the documentation

### Why

Users need a short route from installation to a working configuration, with the important differences between the chat model, STT model and TTS model explained plainly.

### Work

- Extend the current [README](README.md), [operating reference](docs/reference.md) and [CrispASR guide](docs/crispasr.md), rather than duplicating complete instructions across files.
- Separate quick starts from advanced backend, transport, privacy, recovery and model-selection details. Keep examples visibly optional and adapt them for POSIX shells and PowerShell.
- Explain `/model` search and which controls affect the shared Pi session versus a single chat.
- Maintain managed versus external speech-server guidance, descriptor examples, readiness/shutdown behavior and non-destructive recovery. Distinguish R2's implemented variables from still-proposed settings.
- Keep the distinction between upstream capabilities and extension-tested behavior: OS/GPU/model/language support is not an all-combinations guarantee.
- Check commands against current upstream flags; distinguish English-only/base defaults, explicit model downloads and user-selected models. Preserve upstream/model credits and licence cautions.
- Keep a concise troubleshooting path for invalid endpoints, missing models, voice-mode fallbacks, server timeouts and Off/reconnect behavior.

### Done when

- [ ] New features have a runnable, version-appropriate quick start and a clear failure/recovery explanation.
- [ ] Local links, examples, package inclusion and platform notes are checked; no secrets or machine-specific personal paths appear.
- [ ] Changes in shipped behavior update the changelog, while historical validation stays dated and scoped.

## R5. Answer LLM questions from WhatsApp

**Status: planned, deferred.** The target extension is [`edlsh/pi-ask-user`](https://github.com/edlsh/pi-ask-user). Implementation waits until its maintainer accepts [PR #21: external responder bridge](https://github.com/edlsh/pi-ask-user/pull/21), or provides another supported public API for pending questions, external answers/cancellation and safe settlement. Recheck the actual API and compatible available versions before proceeding; no fork, private UI interception or terminal-input workaround is planned.

### Why

Add support for `pi-ask-user` so a user can answer questions asked by the LLM directly from the WhatsApp chat. A phone-originated task should not require returning to Pi's terminal just to complete an interactive question.

### Proposed behavior

- After the upstream dependency above is unblocked, verify the package's supported public request/response hooks and compatible versions. Use a producer-supported adapter; do not scrape private UI state, inject terminal input or assume every extension dialog can be remotely resolved.
- Project a pending question into the exact originating WhatsApp chat, with its choices and instructions. Preserve single-choice, multiple-choice, free-text and cancellation semantics where the package supports them; bound question size, choice count and pending requests.
- Reuse numbered-choice rendering where suitable, but keep pending-question state and authority outside the existing single control-menu slot. `/status`, `/model`, another control menu or ordinary chat text must not silently cancel the package request or remove its ability to accept an answer.
- Bind each question and answer to its request ID, Pi run/session/account generation, source chat, exact projected message ID and verified requester. Require a quoted reply to that question for **all phone answers, including numbered choices and free text, in direct chats and groups**. Group answers must come from the authorized participant, not just any member of an allowed group.
- Recognize valid quoted answers after basic admission/identity checks but before ordinary command/queued-input dispatch. Resolve the original package request directly while the existing run waits; the payload is answer data, not a new prompt or a command to execute. Recognized duplicate, expired or superseded question replies must not enter the model queue. Unquoted messages keep their normal control/queue behavior and are not consumed as answers.
- Initially accept text answers only. A voice note or media reply quoting a pending question gets an unsupported-answer notice without transcription/download or being queued as another prompt; the question stays pending until a valid text answer, cancellation or timeout. Unquoted voice/media follows normal admission without settling the question. Any later voice-answer support needs explicit question correlation and session-fenced transcription.
- Settle each question once. Offer terminal and WhatsApp concurrently only if the verified public package contract supports atomic first-response settlement and withdrawing the losing surface. Otherwise select one supported surface per question, retaining terminal-only behavior until a safe WhatsApp-only route exists. Never simulate dismissal through private UI state. Reject duplicate, expired, foreign-chat and superseded answers.
- Preserve local terminal behavior when WhatsApp is unavailable or the request has no unambiguous WhatsApp owner. Exporting a terminal-originated question to the phone requires a separate explicit routing/consent policy, never a last-chat guess.
- Give each question and its answer controls the same explicit deadline: no later than the package timeout or a bounded bridge lifetime. Do not inherit the control menu's unrelated five-minute expiry or extend the producer's deadline. Define how timeout, explicit question cancellation, Stop/Off, disconnect and session/account replacement settle the producer exactly once, or perform a supported single-surface handoff. If the public API cannot safely settle/withdraw a question, keep that path local-only. No orphaned tool call or cancelled-question revival after reconnecting.
- Do not mirror secret-entry dialogs, hidden reasoning or arbitrary security approvals. A question answer alone does not grant permission for shell execution, credential access or other independently gated actions.
- If the optional package or a supported hook is unavailable, retain the normal local interaction and explain the limitation. Do not silently install it or hard-code unsupported internal APIs.

### Done when

- [ ] The package's public integration contract, optional-dependency behavior, supported question types, deadline rules and supported single-/dual-surface policy are documented.
- [ ] A WhatsApp-originated question can be shown and answered from the same chat, and the LLM continues the existing run with exactly one validated result.
- [ ] Quoted choice/free-text validation in direct chats/groups, unquoted follow-ups, slash-prefixed answer data, unsupported voice/media, group requester checks, cross-chat spoofing and duplicate replies have regression tests.
- [ ] Tests cover `/status`/`/model` and control-menu replacement during a question, ordinary text and reconciled deadlines, without losing the producer request. Terminal/phone races are tested only when supported; otherwise test single-surface fallback.
- [ ] Timeout, cancellation, failed/unknown question delivery, disconnect, Off and session replacement leave no stale question authority or duplicated prompt; late question replies never become queued agent input.
- [ ] Native Pi fixtures cover the real question lifecycle; a separately approved phone check confirms the user-visible flow.
- [ ] Help/docs explain answering, quoting group questions, cancellation and the fact that an answer is not generic approval authority.

## R6. Additional suggestions

These are recommendations, not extra features automatically approved by the five requested items.

### R6.1. Speech status and targeted recovery

Make it easy to distinguish a discovered CLI, a configured endpoint, an owned starting server and an externally managed server. Offer a local/owner diagnostic summary with safe scheme/host, readiness, selected backend and failure category—never commands, keys, raw output or conversation content. Version/model checks must not silently download models or send audio.

Consider a narrow endpoint/transport repair flow that preserves unrelated chat preferences. Today, losing the deliberate non-loopback HTTP opt-in can invalidate saved speech settings and pause automatic replies; the existing Voice Reset is broader than endpoint repair. Preserve originals, require explicit changes and fresh approval for a changed destination, and never silently relax HTTP policy. See [current recovery behavior](docs/crispasr.md#http-transport-and-privacy).

### R6.2. Model/voice compatibility and latency guidance

Maintain a small evidence-based compatibility table for representative STT/TTS setups: exact tool/model version, language/voice, OS/acceleration and observed latency. Distinguish ready/healthy from usable inference, and cold model loading from warm requests. Use the existing explicitly confirmed preview instead of adding automatic synthetic speech calls.

Treat additional language fields, arbitrary model switching and voice-cloning workflows as separate provider-specific proposals. Managed server startup alone does not make every CrispASR backend compatible with the extension's standard HTTP request bodies.

### R6.3. Close remaining acceptance and packaging gaps

Use the [manual acceptance guide](tests/manual/prerelease-acceptance.md) to select small, explicitly approved checks instead of treating source-test counts as client proof:

- The owner-deferred [automatic-image projection/terminal-image isolation check](specs/039-extension-improvements/c3-validation.md) remains open; do not run it or schedule it automatically.
- [Settings/Off validation](specs/039-extension-improvements/c4-validation.md) includes owner-reported basic smoke acceptance, not independently recorded evidence for every Off/reload/reconnect/logging transition.
- Refresh actual installed-package checks and the relevant Linux/Windows evidence after runtime/process-management changes. Record production and host/development dependency exposure separately.
- Keep speech pronunciation, multilingual accuracy and client rendering claims limited to the models/devices actually checked. Do not reset authentication or repeat uncertain sends to manufacture coverage.

### R6.4. Edge TTS retry and fallback diagnostics

**Status:** proposed (owner-requested 2026-10-30); not implemented.

**Observed problem.** In `mirror` mode with an approved Edge destination and an audio input, a reply was delivered as text only. Configuration was correct. Local probes showed intermittent Edge failures: `TtsService.prepare` failed 1 of 4 runs with `Edge speech synthesis failed`, and direct `msedge-tts@2.1.1` failed 1 of 3 runs with `Stream closed before the synthesis completed (no turn.end received)`. The runtime log had no speech entry, because every layer drops the cause:

- [`edge-tts.worker.mjs`](src/services/edge-tts.worker.mjs) catches everything and posts only `{ ok: false }`.
- [`EdgeTtsService.write`](src/services/edge-tts.service.ts) maps every failure, including worker exit, to one generic `TtsError`.
- In [`FinalOutputCoordinator.deliver`](src/services/final-output.service.ts), the `prepareSpeech` `catch` falls back to text without a retry or log. The only signal is the terminal-only `speech.textOnly` notice, so a phone user just sees text.

**1. Bounded synthesis retry.**

- Retry only *pre-send synthesis* failures that are classified as transient. Retrying is safe here because nothing has been uploaded. Never retry after `sendVoice` is invoked or when delivery is unknown; the no-retry-on-uncertain-send rule is unchanged.
- Place the retry inside `TtsService.run`, or a small wrapper around the provider `write` call, with a fresh `tts-` temp directory/partial file per attempt. Then the queue, timeout, cancellation and cleanup ownership stay in one place. `FinalOutputCoordinator` keeps a single `prepareSpeech` call.
- Worker classification:
  - Return a fixed, non-sensitive failure category instead of a bare `ok: false`: `transport` (connect/close/no `turn.end`/timeout), `empty`, `limit`, `config` or `unknown`.
  - Never forward provider messages, text, voice payloads or stack traces.
  - Retry only `transport` and `empty`. `limit`, `config`, consent/destination, cancellation and stale-job (`isCurrent`) failures fail immediately.
- Budget:
  - At most two retries (three attempts) with short backoff (for example 250 ms, then 750 ms).
  - All attempts must fit inside the existing per-job synthesis timeout. Do not extend the overall budget.
  - Re-check `signal`, `isCurrent` and the approved destination key before each attempt.
- Apply the same policy to remote OpenAI-compatible/Fish TTS only where the HTTP status is clearly transient (connection reset, 429/5xx without a partial body). Otherwise keep remote providers single-attempt. Managed CrispASR admission is not re-run per attempt.

**2. Fallback diagnostics.**

- Log one bounded metadata-only line per synthesis outcome to the runtime log, for example `[Speech] TTS failed provider=edge category=transport attempts=3 fallback=text`. Optionally log success with `attempts>1`.
- Never log text, chat identity, voice payloads, keys, endpoints beyond the already-disclosed host, or raw provider errors (see the diagnostics rule in [AGENTS.md](AGENTS.md)).
- Give `FinalOutputResult` a `fallbackReason` (`synthesis`, `consent`, `speech-text-unavailable`, `voice-send-failed`) so the terminal notice and the log line can tell consent problems apart from provider instability.
- Optional, needs owner decision: a short phone-visible marker on text fallbacks in voice/mirror chats (for example a localized "(voice unavailable)" suffix). The current default is silent text fallback.

**Tests.**

- Unit tests for worker category mapping using a fake `msedge-tts` client.
- `TtsService` retry tests:
  - transient failure then success
  - exhausted retries
  - non-retryable category
  - cancellation between attempts
  - timeout spanning attempts
  - temp-file cleanup per attempt
- `FinalOutputCoordinator` tests showing that no retry happens after `sendVoice`/unknown delivery and that the fallback reason propagates.
- A log-redaction regression.
- Live Edge behavior stays manual and owner-approved; tests must not call the real service.

**Done when.** Transient Edge failures are usually absorbed without a text fallback. Every remaining fallback leaves a categorized runtime-log line. Docs ([reference](docs/reference.md) speech section, [changelog](CHANGELOG.md)) describe the retry budget and the log fields.

## Suggested delivery sequence

1. R1 implementation, review, regressions and user-confirmed live checks are complete; publication of RC2 remains a separately authorized release step.
2. Correct independent-review findings in R2, then qualify bounded native STT/TTS cases and platform behavior without treating synthetic checks as live evidence.
3. Keep R5 deferred until upstream accepts PR #21 or provides a suitable supported API. Once unblocked and revalidated, it can ship independently of managed speech servers.
4. Use R3 review and R4 documentation continuously around each coherent change, not only at the end.
5. Select R6 suggestions independently. Prioritize diagnostics and scoped acceptance evidence that support the features being shipped; do not turn the full list into a new release-blocking program.

All work should preserve the saved login, existing settings/history, explicit speech consent and no-retry-on-unknown-delivery rules. No commit, push, publication, dependency installation or live server/account operation is implied by this roadmap.
