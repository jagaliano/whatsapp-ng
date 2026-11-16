# Research: Persisted Local Preferences

Evidence is from current source (`file:line` at plan time).

## R1 — Locale bootstrap before registration metadata

- **Decision**: Make the default export async. Construct `SessionManager` first, `await sessionManager.readSavedLocale()` (read-only: assert storage ready, read `config.json`, parse with existing `parseConfig`, validate against `en|pt-BR|es|fr`; any failure → `undefined`, no write, no recovery save, no writer lock), then `initI18n(pi, saved)`, then register flags/tools/commands.
- **Rationale**: Pi 1.5 `ExtensionFactory = (pi) => void | Promise<void>`. `initI18n(pi)` is called first at `whatsapp-ng.ts:48`. Registration metadata that *is* translated: tool `label`/`description` via `t()` (e.g. `whatsapp-ng.ts:976-977, 1054-1055, 1102-1103, 1129-1130, 1170-1171`) and `/whatsapp` command metadata. `registerFlag` descriptions (`whatsapp-ng.ts:51-86`) are **static English literals**, not `t()`; this feature does not localize them (separate change needing new keys ×4). Tests assert translated tool metadata and assert flag descriptions stay unchanged English. Config reads are already lock-free ("A retained writer lock protects mutations, not existing readable settings", `session.manager.ts:132`). Using full `ensureInitialized()` at factory time would run temp-file cleanup, auto-connect refresh and auth sync early — larger behaviour change.
- **Alternatives**: Metadata refresh after registration (no supported Pi API to re-describe flags; rejected per spec decision). Ad hoc `readFile` in `whatsapp-ng.ts` (violates single config owner).

## R2 — Locale resolution, reset and invalid overrides

- **Current**: `getLocaleOverride` (`i18n.ts:2271`) returns nonblank env, else `--whatsapp-ng-locale=` value or following argv value, blank → `undefined`. `initI18n` sets `currentLocale` only when an override exists, so a previous value survives re-invocation (stale-locale bug for this feature). Invalid locale strings are stored and `t()` falls back to English (`translations[locale]` undefined).
- **Decision**: `resolveLocale({ env, argv, saved })` returns `{ locale, source }` with sources `WHATSAPP_NG_LOCALE | --whatsapp-ng-locale | saved | default`. A *present* flag (including blank) wins over saved; blank flag keeps current English result. Invalid winning override is kept as-is (English via fallback), never replaced by saved. `initI18n` always assigns `currentLocale` (resetting to `undefined` when nothing applies).
- **Restart**: phone `/reload` and session replacement re-run the factory (`whatsapp-ng.ts:92`), but the spec forbids claiming that; terminal save notice says "restart Pi". Phone gets no notice and no control.

## R3 — Local STT language resolution and validation

- **Current**: Language read from env at execution time in `whisper-cpp-node.transcriber.ts:167` and `whisper-cli-audio.transcriber.ts:90`: nonblank `CRISPASR_LANGUAGE` → nonblank `WHISPER_LANGUAGE` → `auto`. Env values are not validated (passed raw).
- **Decision**: `resolveLocalSttLanguage(env, saved)` → `{ language, source }`, same order with saved inserted before `auto`. Env winner passed through unvalidated (existing behaviour preserved; never falls to saved/other alias). Saved/terminal input validated by `isSttLanguageSyntax`: `auto` or `/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/` (extracted from `remote-audio.transcriber.ts:17`); this regex already rejects `--foo`, blank and whitespace.
- **Alternatives**: Validate env too (behaviour change; rejected).

## R4 — Per-operation options snapshot and cached selection

- **Current env reads during execution**:
  - Language: `whisper-cpp-node.transcriber.ts:167`, `whisper-cli-audio.transcriber.ts:90`.
  - Model path + override source: `getModelPath()`/`ensureWhisperModel()` (`whisper-cpp-node.transcriber.ts:45-47, 113`), `modelPath()`/`ensureModel` (`whisper-cli-audio.transcriber.ts:33-35, 56`) — read per operation, path and source separately (a mid-operation env change can split them).
  - CLI selection: `getCliPath()` reads `CRISPASR_CLI_PATH`/`WHISPER_CLI_PATH`/`PATH`; child env (`LD_LIBRARY_PATH` prefix) built at creation (`whisper-cli-audio.transcriber.ts:70-74`); `tryCreateWhisperCppAudioTranscriber` rereads CLI aliases (`whisper-cpp-audio.transcriber.ts:13`).
  - `AudioService.whisperCppTranscriber` caches transcriber or `null` forever (`audio.service.ts:47-51`).
- **Decision — selection snapshot** (once per local selection): `tryCreateWhisperCppAudioTranscriber(logger, env)` receives one env object (copied once by the caller). It resolves `{ cliPath, cliSource: 'CRISPASR_CLI_PATH'|'WHISPER_CLI_PATH'|'PATH', childEnv }` once; `childEnv` is a frozen copy with the existing `LD_LIBRARY_PATH` prefixing. The alias-present check uses the same env object. Kept for the cached transcriber's lifetime.
- **Decision — operation snapshot** (once per local transcription): `resolveLocalSttOptions(env, savedLanguage)` → `{ language, languageSource, modelPath, modelSource: 'CRISPASR_MODEL_PATH'|'WHISPER_MODEL_PATH'|'default' }` from a single read via an injected `getEnv` provider in `AudioService`. Passed as `options.local`. Backends use only the snapshot: CLI `--model`/`--language`; native `ensureWhisperModel(snapshot)` decides override-vs-download from `modelSource` (explicit override missing ⇒ existing error, never download); `ensureContext` keyed by `snapshot.modelPath` (existing reuse/replace semantics unchanged). Remote-first: snapshot computed only after remote is absent.
- **Paths stay environment-only**: path fields come only from env/default; nothing persisted or newly displayed.
- **Decision — cache refresh**: `AudioService.refreshLocalSelection()` resets cached `null` to `undefined`; a cached working transcriber is kept. Called after successful **Set and Clear** of `localSttLanguage`. Never calls `freeWhisperCppContext`; `ffmpegCommands` untouched. In-flight operations keep their snapshots.
- **Tests**: mutate the env mid-operation (after snapshot, while backend is pending) for language, model alias, CLI alias and `LD_LIBRARY_PATH`; assert backend args, child env and download decision use the snapshot.

## R5 — Persistence, failure and concurrency

- **Decision**: `SessionManager` stores raw loaded values (`storedLocalSttLanguage: unknown`, `storedLocale: unknown`), exposes validated getters (invalid → `undefined` + `…Invalid` flag), revisions per field, and `setLocalSttLanguage/clearLocalSttLanguage/setLocale/clearLocale(value, expectedRevision, current)` following `setMediaLimit` (`session.manager.ts:306`): `ensureInitialized`, refuse on unreadable config, `queueConfig`, currentness check, `writeConfig(..., preferences)` with the candidate, assign in-memory only after success, bump revision. Serializer emits keys only when defined, preserving raw (even invalid) values semantically.
- **Concurrency**: `writeConfig` serializes this process's in-memory state; another process's later write replaces it. New fields inherit this last-writer limitation; the writer lock prevents torn writes, not merges.
- **Downgrade**: older serializers use an explicit field list (`session.manager.ts:454`), so they ignore unknown fields on load and drop them on next save. Documented; no migration.

## R6 — Terminal-only exposure

- `configure_wa_stt`/`configure_wa_tts` touch `SttConfig`/TTS fields only; new fields are not added there, nor to phone command router or model tools. Regression tests assert absence in tool schemas and phone menus.
