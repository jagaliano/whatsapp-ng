# WhatsApp-NG roadmap

Completed milestones and future work for easier phone control, optional local speech-server management and a more maintainable extension. Status distinguishes implemented work from proposals; this document does not authorize starting processes, changing settings, running live tests or publishing a release.

The existing [extension improvement records](specs/039-extension-improvements/) preserve earlier completed work and validation evidence. This roadmap tracks completed milestones and next work; it does not restart completed improvements or replace their validation records.

## Priorities

| Item | Goal | Status |
| --- | --- | --- |
| R1 | Fuzzy search in the WhatsApp `/model` command | Implemented in `1.1.0-rc.2`; publication pending |
| R2 | Optional managed CrispASR HTTP servers through `CRISPASR_STT_CMD` and `CRISPASR_TTS_CMD` | Planned; lifecycle/configuration contract needed first |
| R3 | General code review, followed by focused corrections | Planned; review in bounded areas |
| R4 | Improve and maintain the documentation | Ongoing; extend the current guides |
| R5 | Answer `@juicesharp/rpiv-ask-user-question` prompts from WhatsApp | Planned; public integration contract needs verification |
| R6 | Additional suggestions: speech diagnostics/recovery, compatibility and acceptance coverage | Proposed; select independently |

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

## R2. Optional CrispASR HTTP-server lifecycle

### Why

CrispASR currently requires the operator to start and stop HTTP servers separately. Optional managed startup would simplify local STT/TTS while retaining the broader model and hardware choices described in the [CrispASR guide](docs/crispasr.md).

### Proposed variables

| Variable | Intended purpose |
| --- | --- |
| `CRISPASR_STT_CMD` | Operator-supplied foreground launch command for the local STT HTTP server. |
| `CRISPASR_TTS_CMD` | Operator-supplied foreground launch command for the local TTS HTTP server. |

**These variables are proposals, not implemented settings.** They are distinct from the existing `CRISPASR_CLI_PATH`, which selects the direct transcription executable. A launch command is not an endpoint URL, a stop command or permission to change the selected speech provider.

Each command must have an explicit **operator-declared endpoint binding in Pi's trusted launch configuration**, alongside the command: canonical loopback endpoint, protocol and expected service/backend. Keep this binding outside chat-editable speech settings; WhatsApp/model tools cannot create, retarget or renew it. Do not derive authority from command parsing or whichever saved endpoint happens to exist at first use. Settle the binding's exact encoding with the command format before implementation.

### Activation and compatibility

- If a variable is unset or blank, preserve today's behavior: no automatic process management for that service, and manually managed servers remain usable.
- Defining a variable opts into management of the corresponding bound local server. Proposed startup is on first use of an enabled STT/TTS path, only after the existing request admission, currentness and applicable destination/group-consent checks pass—not merely when a model is listed or the extension is discovered.
- Require the selected speech endpoint/protocol/backend to match the trusted launch binding. A mismatch fails managed startup and explains the need for local reconfiguration; it must not launch the command for a newly selected endpoint.
- Do not start a local server for an unrelated hosted endpoint, silently replace working Groq/Fish/Edge settings, or infer new endpoints from arbitrary command text. Start with loopback endpoints.
- STT and TTS are independent. One defined variable must work without the other; separate model processes normally need separate ports. Shared endpoints/processes need an explicit ownership design, not two competing launches.
- Keep existing destination approval, group opt-in, owner authorization and request bounds. Starting a server never grants speech consent or triggers a preview/inference request.
- Managed startup does not add arbitrary-backend support to the CPU-only direct CLI path, nor resolve provider-specific language, reference-voice or cloning-consent requirements.

### Command and process safety

- Set launch commands only in the trusted environment that starts Pi. Do not accept them from WhatsApp messages, model tool parameters or persisted chat settings.
- Decide the exact command encoding before implementation. Prefer executable/argument data or an explicit operator-owned launch script; do not casually pass strings to a shell or concatenate chat/model text into commands.
- Keep commands in the foreground so the extension can retain a real child handle. Do not assume a daemonizing wrapper's first PID owns the server.
- Define the minimal launch environment instead of copying or logging every inherited secret. Never put API-key values into documented command arguments, diagnostics or process-status replies.
- Track only processes started by this extension. Never kill a process by name/port, adopt an unrelated listener or terminate a separately managed server. An occupied port is not ownership proof.
- If the bound endpoint is already occupied without the current owned-process proof, do not launch or use it in managed mode: report an external-server/port conflict and fail closed. This includes possible orphaned children after a Pi crash. Leave the listener untouched; using it as a manually managed service requires the operator to unset the corresponding command, or deliberately stop their own process and retry.
- Prevent duplicate starts for concurrent requests and conflicting Pi instances. Failed or superseded startup must not publish readiness or stop a newer process.

### Readiness, failure and shutdown

- Wait for bounded, non-inference health/readiness checks for the expected service/model before admitting requests. Owned readiness requires a still-live child, exact launch/session-generation authority and evidence correlating that child with the probed listener. A matching health response from another process is insufficient; a child that fails to bind or exits cannot become ready through a foreign endpoint. If ownership cannot be established, fail closed and stop only the child actually owned.
- Separate startup/model-loading deadlines from the existing request deadlines; do not silently extend the current sixty-second HTTP speech budgets. Report starting, ready, failed and stopped truthfully.
- Make model downloads and licence requirements explicit: an operator's launch command containing `-m auto` can download files. Defining a command must not silently accept licences or install binaries.
- Handle missing executables, invalid commands, port conflicts, slow loading, early exits, partial STT/TTS startup and cancellation without hanging Pi or switching to another speech provider.
- Bind ownership to the active extension/session generation. On Off, reload, session replacement or shutdown, cancel/drain affected requests and stop only the owned server resources. Endpoint/protocol/backend changes, clearing the corresponding settings with `{}`, switching to remote/CLI/Edge, and Voice Reset also retire affected work and drain/stop the affected owned server. A new endpoint needs a matching trusted local binding before another managed launch; do not stop an unrelated STT/TTS service.
- Default to stopping on session replacement. Any later warm-server reuse must explicitly transfer only proven process ownership to fresh session authority, never stale Pi callbacks.
- Use graceful termination, a bounded wait and an explicitly scoped forced-termination fallback where supported. Verify process-tree handling on Windows/macOS/Linux; do not claim that stopping a wrapper necessarily stops descendants.
- After failed startup, retain a failed state until explicit local operator retry/restart or a relevant trusted launch-configuration change. New incoming requests must not trigger repeated model loads/downloads. Bound subprocess output and retain metadata-only diagnostics, not raw stdout/stderr, transcripts, spoken text or credentials; no unlimited restart loop.

### Done when

- [ ] The command format, trusted endpoint-binding encoding, activation rules, startup/shutdown deadlines and ownership proof are documented before implementation.
- [ ] Fake-server tests cover unset variables, independent STT/TTS startup, concurrent requests, foreign/orphan listeners, bind races, readiness timeout, early child exit with a healthy foreign endpoint, crashes, cancellation and partial startup cleanup.
- [ ] Tests prove that denied requests cannot start servers, failed startup is not retried per request, and chat/model setting changes cannot retarget a trusted launch binding.
- [ ] Production-entry Pi tests prove that Off/reload/replacement and relevant speech-setting clear/change/reset fence late work and close affected owned children without killing external servers.
- [ ] Supported platforms have actual process-lifecycle evidence; unsupported combinations remain clearly marked.
- [ ] A separately approved short local STT/TTS check confirms the chosen server/model configuration, without a competing WhatsApp connection.

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
- Document managed versus external speech servers, required variables, readiness/shutdown behavior and non-destructive recovery once R2 exists. Clearly mark proposed variables until then.
- Keep the distinction between upstream capabilities and extension-tested behavior: OS/GPU/model/language support is not an all-combinations guarantee.
- Check commands against current upstream flags; distinguish English-only/base defaults, explicit model downloads and user-selected models. Preserve upstream/model credits and licence cautions.
- Keep a concise troubleshooting path for invalid endpoints, missing models, voice-mode fallbacks, server timeouts and Off/reconnect behavior.

### Done when

- [ ] New features have a runnable, version-appropriate quick start and a clear failure/recovery explanation.
- [ ] Local links, examples, package inclusion and platform notes are checked; no secrets or machine-specific personal paths appear.
- [ ] Changes in shipped behavior update the changelog, while historical validation stays dated and scoped.

## R5. Answer LLM questions from WhatsApp

### Why

Add support for [`@juicesharp/rpiv-ask-user-question`](https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question) so a user can answer questions asked by the LLM directly from the WhatsApp chat. A phone-originated task should not require returning to Pi's terminal just to complete an interactive question.

### Proposed behavior

- First verify the package's supported public request/response hooks and compatible versions. Use a producer-supported adapter; do not scrape private UI state, inject terminal input or assume every extension dialog can be remotely resolved.
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

## Suggested delivery sequence

1. R1 implementation, review, regressions and user-confirmed live checks are complete; publication of RC2 remains a separately authorized release step.
2. Settle R2's command/ownership contract, then implement with fake servers before enabling real server startup.
3. Implement R5 through the package's supported question lifecycle; it can ship independently of managed speech servers.
4. Use R3 review and R4 documentation continuously around each coherent change, not only at the end.
5. Select R6 suggestions independently. Prioritize diagnostics and scoped acceptance evidence that support the features being shipped; do not turn the full list into a new release-blocking program.

All work should preserve the saved login, existing settings/history, explicit speech consent and no-retry-on-unknown-delivery rules. No commit, push, publication, dependency installation or live server/account operation is implied by this roadmap.
