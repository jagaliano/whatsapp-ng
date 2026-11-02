# Feature Specification: Speech and settings improvements for 1.1.x

**Feature Directory**: `specs/040-speech-and-settings-1.1/`
**Created**: 2026-11-02 (consolidated)
**Status**: Implemented; shipped in 1.1.0–1.1.4
**Input**: Consolidation of former records 040–054 (October 29 – November 2, 2026). Those folders mixed feature decisions with per-release checklists. This record keeps the behavior decisions as one specification. Release history lives in [CHANGELOG.md](../../CHANGELOG.md).

Companion documents: [plan](plan.md), [tasks](tasks.md), [evidence](evidence.md).

## Scope and provenance

| User story | Former record | Shipped in |
| --- | --- | --- |
| US1 Saved auto-connect and Back navigation | 040 | 1.1.0 |
| US2 Managed CrispASR speech servers | 043 | 1.1.1 |
| US3 Explicit server-default voice | 044 | 1.1.1 |
| US4 Protected automatic spoken replies | 047, 048 | 1.1.2 |
| US5 Longer synthesis budget for slower providers | 048 | 1.1.2 |
| US6 Decorative separators removed from speech | 049, 050 | 1.1.3 |
| US7 Correct owner-menu guidance | 052 | 1.1.4 |
| US8 Chat-first Voice menu and consistent Back/Cancel | 053 | 1.1.4 |
| US9 Release tooling compatible with npm 12 | 054 | 1.1.4 |

These former records only covered documentation, releases or dependencies, so their content went into the changelog or current guides instead of this spec:

- 041, 046, 048, 050 and 054 (releases)
- 042 (speech-provider README introduction)
- 045 (documentation cleanup)
- 051 (plan-status reconciliation)
- the `follow-redirects` 1.16.2 security patch

Fuzzy `/model` search shipped in 1.1.0 but never had a spec. That gap is recorded here and is not backfilled.

## User Scenarios & Testing

### User Story 1 - Saved auto-connect and Back navigation (Priority: P1)

As the operator, I want WhatsApp to reconnect automatically when Pi starts if I chose that, without surprise pairing or connections from scripted runs.

**Why this priority**: Reconnecting by hand after every Pi start was the most frequent friction point. A wrong default could connect accounts unexpectedly.

**Independent Test**: In an isolated Pi RPC session with synthetic saved credentials, set Auto-connect on, restart the session and observe a connection. Set it off or leave it unset, restart, and observe no connection.

**Acceptance Scenarios**:

1. **Given** `autoConnect` is literally `true` and credentials are saved, **When** a TUI or RPC session starts, **Then** WhatsApp connects without pairing.
2. **Given** `autoConnect` is absent, `false` or malformed, **When** Pi starts, **Then** nothing connects.
3. **Given** print/JSON mode, **When** Pi starts, **Then** the saved preference does not connect unless the explicit online flag is set.
4. **Given** the operator chose Off in this process, **When** the session reloads or is replaced, **Then** Off stays in effect.
5. **Given** the Auto-connect setting is open, **When** the operator presses Back, **Then** the menu returns to Connection, then to the main menu, without changing the preference or the transport.

### User Story 2 - Managed CrispASR speech servers (Priority: P1)

As the operator using local CrispASR, I want my selected STT/TTS servers to start when WhatsApp connects and stop when it disconnects. I should not have to babysit native processes.

**Why this priority**: Local speech was unusable without manually started servers. If a process were orphaned or adopted by mistake, it could hold ports or answer for the wrong model.

**Independent Test**: Use a synthetic server fixture and a trusted JSON descriptor. Connect and observe exactly one owned server per role, with health/model checks. Then run Off, reload, `/stop`, a settings change and an abrupt kill of the parent process. Check that each one either retires the server or keeps it, as the scenarios below require.

**Acceptance Scenarios**:

1. **Given** `CRISPASR_STT_CMD`/`CRISPASR_TTS_CMD` hold valid descriptors that match the selected endpoint/model, **When** WhatsApp connects (manual Connect or auto-connect), **Then** only the matching roles start. Each role becomes ready only after the owned listener PID, health response, backend and loaded model are all verified.
2. **Given** a running managed server, **When** the operator runs Off, disconnects, reloads, replaces the session, shuts down or changes the relevant endpoint/model/protocol, **Then** the owned child is fenced and stopped.
3. **Given** a running managed server, **When** a phone `/stop` cancels speech work, **Then** the server keeps running with the same PID.
4. **Given** the Pi parent is killed or its terminal hangs up, **When** the watchdog loses IPC or receives SIGHUP, **Then** it stops its own child and releases only its own lease.
5. **Given** startup failed, **When** messages arrive or chat settings are toggled, **Then** startup is not retried. Only an explicit terminal retry or a new runtime retries.
6. **Given** a malformed descriptor for a role, **When** connected with that role selected, **Then** numeric-loopback requests are refused and one redacted notice is shown.

### User Story 3 - Explicit server-default voice (Priority: P2)

As an operator of a compatible OpenAI-style server, such as Chatterbox, I want to use the server's built-in voice without inventing a voice ID.

**Why this priority**: Users were told, wrongly, that Chatterbox always needs a voice file. A placeholder voice would be an implicit fallback.

**Independent Test**: Configure `ttsUseServerVoice: true` through `configure_wa_tts` in isolated RPC. Save, reopen and synthesize against a synthetic provider. The JSON body must have no `voice` key.

**Acceptance Scenarios**:

1. **Given** an explicit `openai-compatible` protocol with endpoint/model/key-variable name, **When** `ttsUseServerVoice: true` is set, **Then** requests omit `voice`, with no sentinel, empty value or null.
2. **Given** both a named voice and `ttsUseServerVoice` are supplied, **When** they are submitted, **Then** the update is rejected atomically.
3. **Given** Fish or Edge, **When** server-default voice is requested, **Then** it is rejected.
4. **Given** server-default voice was chosen, **When** the effective endpoint/provider/model changes, **Then** the choice must be made again. A reset removes it.

### User Story 4 - Protected automatic spoken replies (Priority: P1)

As a contact who receives Voice/Both/audio-Mirror replies, I want the voice reply I approved. A text message the model sent by accident should not replace it.

**Why this priority**: When the model sent text with `send_wa_message` to the same chat, that send counted as the whole final answer, so speech never happened.

**Independent Test**: A synthetic real-Pi RPC turn calls `send_wa_message` to the owning chat while the approved policy is Voice. The tool must return a zero-attempt error, and exactly one normal final reply must follow.

**Acceptance Scenarios**:

1. **Given** an eligible owning final under a captured Voice, Both or audio-Mirror policy, **When** the model sends same-chat text, including through an explicit JID, PN/LID alias, native quote or gateway resolution, **Then** the send is refused before transmission, history recording or send-ledger coverage.
2. **Given** a legacy caption/tool-only attachment already covers the final, **When** the model sends an explanation, **Then** the send is allowed, because no automatic final remains eligible.
3. **Given** the speech policy is revoked during the frame, **When** the final is delivered, **Then** revocation and currentness still fence it. Protection never grants delivery authority.
4. **Given** text-only, disabled, unapproved, non-audio Mirror, groups without opt-in, terminal or idle replies, **When** the model sends text, **Then** behavior is unchanged. Other-chat sends remain allowed.

### User Story 5 - Longer synthesis budget for slower providers (Priority: P3)

As a user of a slow TTS provider, I want long answers to complete instead of timing out at 60 seconds.

**Independent Test**: With fake timers, a 75-second synthesis completes using the default budget. Expiry is measured from each job's admission.

**Acceptance Scenarios**:

1. **Given** the default constructor, **When** a job is admitted, **Then** its shared queue-plus-synthesis budget is `TTS_SYNTHESIS_TIMEOUT_MS` (180 s), and shorter overrides still apply.
2. **Given** any provider, **When** synthesis runs, **Then** the following stay unchanged:
   - the 2,000-character, 8 MiB, one-active and five-pending limits
   - cancellation
   - Edge connection/inactivity timers
   - STT budgets

### User Story 6 - Decorative separators removed from speech (Priority: P3)

As a listener, I do not want lines of `────` read aloud or garbled into the transcript.

**Independent Test**: Run parser and coordinator cases with synthetic text that contains standalone Unicode rules. The prepared speech has none, and the displayed or saved text is unchanged.

**Acceptance Scenarios**:

1. **Given** a standalone line of three or more of `─━╌╍┄┅┈┉═–—`, optionally spaced, **When** speech is prepared, **Then** the line becomes a paragraph break.
2. **Given** short dash runs, inline punctuation, dates, names or approximation signs, **When** speech is prepared, **Then** they are preserved.
3. **Given** code, tables, links or indentation, **When** speech is prepared, **Then** the existing text-only rejection rules still apply.

### User Story 7 - Correct owner-menu guidance (Priority: P2)

As an operator refused on a phone `/voice` command, I want guidance that names a menu path that actually exists.

**Independent Test**: In isolated RPC with no owner set, phone `/voice mirror` is denied. The denial names `/whatsapp > Chats / Owner > Owner`, and that path opens the Owner chooser. Owner and speech settings are unchanged.

**Acceptance Scenarios**:

1. **Given** an owner-only phone command, **When** it is denied, **Then** the message names `/whatsapp > Chats / Owner > Owner`, and nothing is mutated or appointed automatically.
2. **Given** English, Portuguese, Spanish or French, **When** owner-authorization or pairing-welcome copy is shown, **Then** it uses the grouped navigation with localized submenu labels, including Recents.

### User Story 8 - Chat-first Voice menu and consistent Back/Cancel (Priority: P1)

As a new user, I want to set up voice replies for one known chat without going through backend controls. Back and Cancel should behave the same way everywhere.

**Why this priority**: Setting up Mirror for one chat meant going through provider settings, and Back/Cancel behaved differently from one view to the next.

**Independent Test**: Use mocked views plus actual-entry RPC. Configure Mirror for a known chat: choose the chat, the mode and consent, then see the effective status. No synthesis, preview or send happens. Back climbs one level and Cancel closes the request.

**Acceptance Scenarios**:

1. **Given** the Voice menu, **When** it opens, **Then** it shows these options, in this order:
   - Set up replies for a chat
   - Manage chat replies and introductions
   - Advanced speech settings
   - Text-only everywhere / revoke speech consent
   - Back
2. **Given** chat setup, **When** a mode needs approval, **Then** group opt-in, destination approval and shared enablement are requested explicitly. The consent text explains that retained defaults and overrides may resume. Paused chats stay paused.
3. **Given** a remote backend setup, **When** values are entered, **Then** they are staged and saved atomically after validation. The protocol is explicit, and the voice is either named or an explicit server-default. A backend change that loses approval is shown.
4. **Given** any nested settings dialog, **When** the user presses Back, it returns to the parent view and refreshes it. **When** the user cancels, the request closes without an error or retry. A declined confirmation changes nothing. In every case the original captured authority is reused and never renewed.
5. **Given** a phone `/voice` refusal, **When** it is shown, **Then** it names the missing group opt-in, destination approval or shared enablement, and points to chat setup. It does not grant any of them.

### User Story 9 - Release tooling compatible with npm 12 (Priority: P3, maintainer)

As the maintainer, I want `npm run release:prepare` to work with npm 11 and npm 12 output and still fail closed.

**Acceptance Scenarios**:

1. **Given** npm 12's package-keyed `npm pack --json` object or npm 11's single-entry array, **When** preparation parses it, **Then** the single expected package is selected.
2. **Given** an empty, multi-package, foreign-key, bare-object or malformed result, **When** it is parsed, **Then** preparation fails before a receipt or publish dry-run.

### Edge Cases

- A managed endpoint is already in use or its lock is unknown → refuse; never steal the lock, adopt the listener or kill by name or port.
- A transient health/model probe fails during startup → retry only within the startup budget. A transient admission failure does not retire a healthy server.
- Retirement of an older managed server is unconfirmed → keep the fence; never borrow the predecessor's authority. WhatsApp stop is always attempted.
- A different chat gains a verified owning-chat alias during the send preflight → a late refusal through the existing sender outcome; this may leave a failed archive intent.
- A settings request expires mid-dialog → no new dialog and no mutation; show one reopen notice. A revision conflict that is still current invites the user to choose again.
- Recents is reached from Advanced/history → Back returns to the captured parent category.

## Requirements

### Functional Requirements

- **FR-001**: Auto-connect MUST be default-off, profile-wide and enabled only by a literal `true` with saved credentials. Print/JSON MUST remain opt-in.
- **FR-002**: Config writes MUST keep newer cooperative choices from other writers and reject stale ones. When an unknown lock blocks writes, the settings MUST stay readable.
- **FR-003**: Managed descriptors MUST be shell-free JSON taken only from the trusted process environment. They declare:
  - an absolute `executable`
  - string-array `args`
  - an absolute `cwd`
  - a numeric-loopback `endpoint` (`/v1` for STT, `/v1/audio/speech` for TTS)
  - `backend`, `model` and `loadedModel`
  - an optional `env` allowlist of variable names
  - `startupTimeoutMs`
- **FR-004**: Managed startup MUST NOT enable speech, grant consent or switch providers on failure. Windows MUST fail before launching a managed child.
- **FR-005**: `ttsUseServerVoice` MUST be an explicit boolean, valid only with `openai-compatible`. When it is set, the voice field is omitted.
- **FR-006**: Same-chat model text MUST be refused while an approved spoken final is eligible. The refusal uses the router's read-only `canFinalize` check and canonical identity/transport resolution.
- **FR-007**: The default synthesis budget MUST be 180 s, measured from admission. The other resource limits MUST stay unchanged.
- **FR-008**: The spoken copy MUST drop standalone Unicode horizontal rules. The displayed and saved text MUST stay unchanged.
- **FR-009**: Owner guidance MUST name the real grouped menu path in all four locales.
- **FR-010**: Settings navigation MUST give consistent Back (parent) and Cancel (close) behavior, with captured authority shared across nested and recursive views.
- **FR-011**: Configuration MUST NOT synthesize, preview or send anything by itself.
- **FR-012**: Release preparation MUST accept exactly one expected package result from npm 11 or npm 12 and reject everything else.

### Key Entities

- **Managed speech descriptor**: the trusted per-role launch contract, `CRISPASR_STT_CMD` or `CRISPASR_TTS_CMD`.
- **Endpoint lease**: an exclusive file lease for one managed endpoint. It is separate from the auth, config and archive locks.
- **Captured speech policy**: the effective Voice/Both/Mirror decision for one assistant frame. It is used for refusal only.
- **Speech settings**: backend, protocol, endpoint, model, key-variable name, voice or `ttsUseServerVoice`, speed, format and per-chat modes.
- **Settings request**: a scoped navigation context that carries the original authority through nested dialogs.

## Success Criteria

- **SC-001**: Each user story has failing regressions recorded before its fix, and passing source checks afterward ([evidence](evidence.md)).
- **SC-002**: Production-entry RPC fixtures show zero external network attempts and no real account, provider or settings access.
- **SC-003**: Local macOS STT-only, TTS-only and combined CrispASR cases produce correct transcripts and valid Opus audio ([native acceptance](evidence.md#native-crispasr-acceptance)).
- **SC-004**: A user can configure Mirror for one chat without opening Advanced settings.

## Assumptions and Out of Scope

- Linux managed ownership is implemented but not qualified on Linux. Windows management is unsupported. IPv6, daemonizing wrappers and hostile same-user processes are outside the guarantees.
- No live WhatsApp, listening, transcription-accuracy, pronunciation or platform certification is claimed. These remain operator acceptance.
- The Edge retry/fallback proposal in [ROADMAP.md](../../ROADMAP.md) is not implemented.
- Broader glyph and box-drawn-table speech filtering and phone-language localization are optional follow-ups, not requirements.
