# Feature Specification: Persisted Local Preferences

**Feature Branch**: `048-persisted-local-preferences` (spec directory only; no branch created)

**Created**: 2026-11-16

**Status**: Implemented

**Input**: User description: "Reduce unnecessary environment variables in WhatsApp-NG by moving only low-risk preference-type configuration (local transcription language, extension locale) into persisted terminal settings. Keep program/command selection, model paths and transport-security authorization environment-only." (Full request retained in the originating `/speckit.specify` invocation.)

## Clarifications

### Session 2026-11-16

- Q: When an environment variable or `--whatsapp-ng-locale` overrides a preference, may the owner still save a value for it? → A: Yes; the save is stored and shown as "saved (overridden by `<variable or flag>`)" next to the effective value and source.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saved local transcription language (Priority: P1)

The owner sets the language used by local transcription from the terminal Voice settings, independently of the remote transcription language, and sees the effective value together with its source (environment alias, saved setting or default). Services started with a different environment (e.g. launchd) then transcribe in the same language as the owner's terminal.

**Why this priority**: The local language is the most common reason a background service behaves differently from the terminal; a saved preference removes that inconsistency without touching any security boundary.

**Independent Test**: With no language environment variables, save a local language in terminal Voice settings, transcribe a synthetic voice note through a mocked local backend, and confirm the backend receives the saved language and the UI shows source "saved".

**Acceptance Scenarios**:

1. **Given** no `CRISPASR_LANGUAGE`/`WHISPER_LANGUAGE` and no saved value, **When** the owner opens Voice settings, **Then** the effective local language is `auto` with source "default".
2. **Given** the owner saves `pt`, **When** a local transcription runs, **Then** the local backend receives `pt` and the UI shows source "saved".
3. **Given** a nonblank `CRISPASR_LANGUAGE` or `WHISPER_LANGUAGE`, **When** the owner views or saves the setting, **Then** the environment value stays effective (CrispASR alias before Whisper alias), the UI names the winning alias as the source, and the saved value is stored but shown as overridden; the environment value is never imported into config.
4. **Given** a winning environment override with an invalid value, **When** transcription runs, **Then** existing invalid-override behaviour is reported and neither the saved value nor the other alias is silently used.
5. **Given** the owner enters `--foo`, a blank or whitespace-only value or malformed syntax via Set, **When** saving, **Then** the input is rejected with a localized message and the previous saved value is unchanged.
8. **Given** a saved local language, **When** the owner chooses the separate explicit Clear action, **Then** the saved value is removed and resolution falls to the next source.
6. **Given** a remote STT backend is configured, **When** a voice note arrives, **Then** remote transcription is used and no local model/transcriber is initialized, regardless of the saved local language.
7. **Given** a local transcription is in progress, **When** the owner changes only the local language, **Then** the running transcription completes with its original language snapshot, no native model context is released mid-inference, no FFmpeg re-detection occurs, and the next transcription uses the new value.

---

### User Story 2 - Saved extension locale (Priority: P2)

The owner chooses a saved extension locale (en, pt-BR, es, fr) in terminal settings, sees the effective locale and its source, and is told explicitly that the change applies fully after restarting Pi.

**Why this priority**: Locale is a pure presentation preference, but it affects strings built at registration time, so it needs a clear restart contract.

**Independent Test**: In an isolated synthetic environment without locale overrides, save `fr`, restart the production entry, and confirm existing `t()`-built tool/command/UI metadata and terminal and phone presentation are French, while static English `registerFlag` descriptions remain unchanged.

**Acceptance Scenarios**:

1. **Given** no `WHATSAPP_NG_LOCALE` and no `--whatsapp-ng-locale`, **When** a saved locale exists, **Then** after restarting Pi all existing `t()`-built strings, including registration-time tool/command metadata and UI, use the saved locale; static English `registerFlag` descriptions remain unchanged (not localized by this feature).
2. **Given** the owner saves a new locale, **When** the save succeeds, **Then** the UI says the change applies after restarting Pi and does not claim the phone `/reload` applies it.
3. **Given** a nonblank `WHATSAPP_NG_LOCALE` or a `--whatsapp-ng-locale` value, **When** the owner views or saves the setting, **Then** the override remains effective with its existing priority (environment, then flag), the UI names it as the source, and any saved value is stored but shown as overridden.
4. **Given** a winning invalid override, **When** Pi starts, **Then** its existing behaviour applies; the saved locale is not silently substituted.
5. **Given** a session or runtime replacement where the override is now absent, **When** the extension reinitializes, **Then** the locale is resolved freshly from current sources (saved value or English), never retained from a stale earlier resolution.
6. **Given** a corrupt or unsupported saved locale value, **When** config loads, **Then** it is ignored for resolution (English fallback unless overridden), reported without exposing other config contents, and not rewritten as a recovery.

---

### User Story 3 - No change for environment-only settings (Priority: P3)

Existing users with local CLI paths, model paths, managed speech-server commands, FFmpeg path or plain-HTTP authorization see no new persisted configuration for those settings and no behaviour change.

**Why this priority**: Preserves the security boundary that program/command selection and transport-security authorization remain environment-only.

**Independent Test**: With those variables set in a synthetic environment, save the two new preferences and confirm config contains only the new preference fields and runtime behaviour for those variables is unchanged.

**Acceptance Scenarios**:

1. **Given** `FFMPEG_PATH`, `WHISPER_CLI_PATH`, `CRISPASR_CLI_PATH`, `CRISPASR_STT_CMD`, `CRISPASR_TTS_CMD`, `WHISPER_MODEL_PATH`, `CRISPASR_MODEL_PATH` or `WHATSAPP_NG_ALLOW_PLAIN_HTTP` are set, **When** any settings save occurs, **Then** none of them is written to config and no terminal, phone or model-tool path exists to set them.
2. **Given** the Voice settings view, **When** effective values are shown, **Then** no credential, environment content or private model path is displayed.

### Edge Cases

- Blank or whitespace-only environment alias: treated as absent, falling through to the next source.
- `auto` entered explicitly: accepted and stored; equivalent to default for the backend.
- Option-like values (`--foo`, `-l`) rejected both at terminal input and on load.
- Saved value invalid on load: ignored for resolution and not automatically repaired; unrelated saves preserve its JSON value semantically (not necessarily byte-for-byte formatting) until the owner explicitly Sets or Clears it.
- Blank Set input: rejected for both preferences; removing a saved value requires the separate explicit Clear action.
- Blank `--whatsapp-ng-locale` value (with no nonblank `WHATSAPP_NG_LOCALE`): keeps its existing English result and does not select the saved locale.
- Unrelated config save: new fields preserved unchanged.
- Failed commit or stale request: neither the in-memory nor persisted value changes; the owner sees the existing failure/stale message.
- Two processes editing settings concurrently: new fields inherit the existing last-writer limitation; locking prevents torn writes but does not merge concurrent edits.
- Downgrade to a version without these fields: older versions ignore the fields on load and drop them on their next config serialization; no migration, recovery or re-import is provided.
- Local selection previously cached as unavailable: refreshed on the next operation after a relevant settings change, without interrupting active work or bypassing cancellation/currentness checks.
- Phone users: cannot view or change these preferences via phone commands; phone presentation uses the locale resolved at startup and shows no restart notice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store a distinct saved local transcription language (`localSttLanguage`), separate from remote `sttLanguage`.
- **FR-002**: Effective local language MUST resolve: nonblank `CRISPASR_LANGUAGE` → nonblank `WHISPER_LANGUAGE` → saved `localSttLanguage` → `auto`.
- **FR-003**: Set input that is blank or whitespace-only MUST be rejected for both preferences; clearing requires a separate explicit Clear action. `localSttLanguage` MUST be validated with the same syntax as the remote language field, accept `auto` explicitly, and reject option-like values; validation applies to terminal input and loaded config. Syntax acceptance does not assert backend support.
- **FR-004**: The system MUST store a saved extension locale limited to `en`, `pt-BR`, `es`, `fr`, validated on input and on load.
- **FR-005**: Effective locale MUST resolve: nonblank `WHATSAPP_NG_LOCALE` → `--whatsapp-ng-locale` → saved locale → English. A present but blank `--whatsapp-ng-locale` value keeps its existing English result and MUST NOT select the saved locale.
- **FR-006**: A winning invalid override (either preference) MUST keep its current behaviour and MUST NOT fall through to a saved value or another alias.
- **FR-007**: Existing environment/flag values MUST NOT be imported into config.
- **FR-008**: New fields MUST persist only through the existing session/config owner's load, explicit serialization, revision, atomic write and currentness mechanisms; no ad hoc config reads or writes.
- **FR-009**: New fields MUST survive unrelated saves with semantic JSON-value preservation (including invalid saved values, which are never automatically repaired), and MUST remain unchanged after failed commits and stale requests.
- **FR-010**: New preferences MUST be terminal-only: not exposed through `configure_wa_stt`, `configure_wa_tts`, model tools or phone commands.
- **FR-011**: Terminal UI MUST show each effective value and its source (named alias/flag, saved, default), and, when an override is active, any saved value labelled as overridden by the named variable or flag, without exposing credentials, environment contents or model paths.
- **FR-012**: All new user-visible strings MUST be localized in en, pt-BR, es and fr.
- **FR-013**: Local transcriber options MUST be resolved once per transcription operation and passed to local backends, not re-read from the environment during execution.
- **FR-014**: Remote-first selection MUST be preserved: configured remote STT never initializes a local model or transcriber.
- **FR-015**: Cached local selection, including a cached unavailable result, MUST refresh appropriately after relevant changes while preserving active-work, currentness and cancellation semantics; a language-only change MUST NOT free a native model context during inference nor trigger FFmpeg refresh.
- **FR-016**: The saved locale MUST be available before registration-time `t()`-built tool/command metadata is constructed (static English `registerFlag` descriptions are out of scope), by loading only the validated persisted locale through the existing config owner (preferred smallest design) or by a tested metadata refresh strategy.
- **FR-017**: Terminal locale saves MUST show a notice that the change applies after restarting Pi and MUST NOT claim phone `/reload` applies it. Phone presentation uses the locale resolved at startup and offers no way to change these preferences.
- **FR-018**: Locale initialization MUST resolve freshly on every init so an absent override never retains a stale locale across session or runtime replacement.
- **FR-019**: The system MUST NOT persist or add any settings path for `FFMPEG_PATH`, `WHISPER_CLI_PATH`, `CRISPASR_CLI_PATH`, `CRISPASR_STT_CMD`, `CRISPASR_TTS_CMD`, `WHATSAPP_NG_ALLOW_PLAIN_HTTP`, `WHISPER_MODEL_PATH` or `CRISPASR_MODEL_PATH`, preserving ROADMAP R2's no-persisted-command-writer boundary.
- **FR-020**: No automatic install, download or launch of CLIs, models or servers is introduced.
- **FR-021**: Both `WHISPER_*` and `CRISPASR_*` alias families MUST remain with current precedence and invalid-override behaviour.
- **FR-022**: README, `docs/reference.md`, `docs/crispasr.md` and `CHANGELOG.md` MUST document preference sources, the restart requirement, the environment-only security boundary, the multi-process last-writer limitation and downgrade behaviour (older versions ignore the fields on load and drop them on next serialization).
- **FR-023**: Source-level regressions MUST cover session persistence, precedence, per-operation option snapshots, cached selection, invalid/blank values, locale bootstrap and restart semantics; production-entry registration/reload MUST be exercised in an isolated synthetic environment.

### Key Entities

- **Local transcription language preference**: optional saved string (`auto` or remote-syntax language code); terminal-only; overridden by environment aliases.
- **Extension locale preference**: optional saved value from {en, pt-BR, es, fr}; terminal-only; overridden by environment then flag; applies after restart.
- **Effective value + source**: resolved value with origin (`CRISPASR_LANGUAGE`, `WHISPER_LANGUAGE`, `WHATSAPP_NG_LOCALE`, `--whatsapp-ng-locale`, saved, default) shown in the UI.
- **Local transcription options snapshot**: per-operation resolved options passed to local backends.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can set both preferences from the terminal in under 1 minute each without editing environment or service files.
- **SC-002**: In 100% of precedence test cases, the effective value and displayed source match the defined order, including blank and invalid overrides.
- **SC-003**: A background service started without language/locale variables uses the saved preferences (locale after restart) in 100% of tested starts.
- **SC-004**: Zero environment-only settings (8 listed variables) appear in persisted config after any tested save path.
- **SC-005**: Zero native model contexts released during active inference and zero FFmpeg re-detections after language-only changes in tested scenarios.
- **SC-006**: All new strings present in all 4 supported languages.
- **SC-007**: Declared unit, lint and typecheck checks pass, and production-entry registration/reload succeeds in an isolated synthetic environment; no native-model or live-WhatsApp qualification is claimed.

## Assumptions

- The previous spec format/numbering (sequential `048`) applies; no git branch is created (hooks disabled).
- Clear is a separate explicit terminal action for each preference; it removes the saved value so resolution returns to the next source (default). Blank Set input is never treated as Clear.
- Out of scope: model-path persistence, model downloads/changes, media size limits, remote STT uploads/languages, API-key variable names, managed server descriptors, plain-HTTP policy, alias retirement, commits, publication, live-account operations.
- Deferred (separate proposal): model-path settings with absolute regular-file validation, clearing/missing/symlink semantics and safe native-context retirement; an explicit invalid path must never trigger fallback or download.
