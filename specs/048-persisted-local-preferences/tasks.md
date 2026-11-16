# Tasks: Persisted Local Preferences

**Input**: Design documents from `specs/048-persisted-local-preferences/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Required (FR-023, repository rule: failing regression before fix). Write each test task before its implementation task and confirm it fails.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1 local language, US2 locale, US3 environment-only boundary

## Phase 1: Setup

- [X] T001 Confirm baseline: run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck` and record results (pre-existing failures noted, not fixed) in the PR notes

---

## Phase 2: Foundational (blocks all stories)

- [X] T002 [P] Test shared language syntax validator (`auto`, `pt`, `pt-BR`, `yue`; reject blank, whitespace, `--foo`, `-l`, `EN`, `en_US`) in `tests/unit/local-stt-options.test.ts`
- [X] T003 Create `src/services/local-stt-options.ts` with `isSttLanguageSyntax()` and reuse it in `src/services/remote-audio.transcriber.ts:16-17` with no remote behaviour change (existing `tests/unit/remote-audio.transcriber.test.ts` stays green)
- [X] T004 Tests in `tests/unit/session.manager.test.ts` (new `describe('local preferences')`): load valid/invalid/absent `localSttLanguage` and `locale`; invalid loaded values reported invalid, not rewritten, preserved semantically across unrelated saves (e.g. `setMediaLimit`, `setAutoConnect`); Set/Clear commit and bump revision; blank/option-like Set rejected; stale revision, `current()=false` and failed `rename` leave memory and disk unchanged; unreadable config rejects; `readSavedLocale()` returns validated value or `undefined`, performs no write and takes no writer lock
- [X] T005 Implement in `src/services/session.manager.ts`: raw `storedLocalSttLanguage`/`storedLocale` loaded in `loadConfig`; validated getters; revisions; `setLocalSttLanguage`/`clearLocalSttLanguage`/`setLocale`/`clearLocale(value?, expectedRevision, current)` following `setMediaLimit` (`queueConfig`, currentness, assign after commit); extend `writeConfig` with a defaulted `preferences` parameter serializing keys only when defined; read-only `readSavedLocale()` using existing `parseConfig` and storage-ready check (contract: [config-fields](contracts/config-fields.md))

**Checkpoint**: persistence layer complete and tested.

---

## Phase 3: User Story 1 — Saved local transcription language (P1) 🎯 MVP

**Goal**: terminal-saved local language with env-alias precedence, per-operation options snapshot, cache refresh.

**Independent Test**: spec US1 — save `pt` with no env aliases; mocked local backend receives `pt`; UI shows source "saved".

### Tests

- [X] T006 [P] [US1] Resolver tests in `tests/unit/local-stt-options.test.ts`: `CRISPASR_LANGUAGE` > `WHISPER_LANGUAGE` > saved > `auto`; blank/whitespace env falls through; invalid winning env passed unchanged and never replaced by saved/other alias; model path `CRISPASR_MODEL_PATH` > `WHISPER_MODEL_PATH` > default with matching `modelSource`; one env read per call ([resolution](contracts/resolution.md))
- [X] T007 [P] [US1] Backend tests in `tests/unit/whisper-transcribers.test.ts` and `tests/unit/whisper-native-model.test.ts`: CLI `--model`/`--language` and child env come from snapshots; native language, model path and override-vs-download decision come from the snapshot; explicit missing model override errors with no download; CLI path/source and `LD_LIBRARY_PATH` child env captured once at selection; mutating `process.env` (language, model alias, CLI alias, `LD_LIBRARY_PATH`) while a transcription is pending does not change that operation
- [X] T008 [P] [US1] AudioService tests in `tests/unit/audio.service.test.ts`: one snapshot per operation via injected env/saved providers; mid-operation env and saved-value changes don't affect the running op; remote configured ⇒ no local selection, snapshot or model init; cached `null` reset by `refreshLocalSelection()` (after Set and after Clear); working cached transcriber kept; `freeWhisperCppContext` not called; FFmpeg commands not re-probed; cancellation/`isCurrent` behaviour unchanged
- [X] T009 [P] [US1] View tests in `tests/unit/voice-settings.view.test.ts`: Local transcription language entry shows effective value + source (`CRISPASR_LANGUAGE`/`WHISPER_LANGUAGE`/saved/default), "saved (overridden by …)" note, Set/Clear/Back; blank/`--foo` rejected with localized message; stale revision → existing changed message, nothing saved; successful Set and Clear call the refresh hook; no model/CLI paths or env contents shown ([terminal-ui](contracts/terminal-ui.md))

### Implementation

- [X] T010 [US1] Add `resolveLocalSttLanguage(env, saved)` and `resolveLocalSttOptions(env, saved)` (language/source, modelPath/modelSource) to `src/services/local-stt-options.ts`
- [X] T011 [US1] Add `local?: LocalSttOptions` to `AudioTranscriptionOptions` in `src/services/audio-transcriber.ts`
- [X] T012 [US1] `src/services/whisper-cli-audio.transcriber.ts`: selection takes one env object, captures `{ cliPath, cliSource, childEnv }` (frozen, existing `LD_LIBRARY_PATH` prefixing); execution uses `options.local` for `--model`/`--language` and the model-override decision; no `process.env` reads during execution
- [X] T013 [US1] `src/services/whisper-cpp-node.transcriber.ts`: `ensureWhisperModel`/`ensureContext` use snapshot `modelPath`/`modelSource`; `transcribeAsync` language from snapshot; existing context reuse/replace semantics unchanged
- [X] T014 [US1] `src/services/whisper-cpp-audio.transcriber.ts`: `tryCreateWhisperCppAudioTranscriber(logger, env)` uses the same env object for CLI-alias check and passes it to CLI selection
- [X] T015 [US1] `src/services/audio.service.ts`: inject `getEnv` and `getSavedLocalSttLanguage` providers; after remote is absent, snapshot once and pass `options.local`; add `refreshLocalSelection()` (`null → undefined` only)
- [X] T016 [US1] `whatsapp-ng.ts`: wire providers from `SessionManager` and `process.env` into `AudioService`
- [X] T017 [US1] `src/ui/voice-settings.view.ts`: Local transcription language entry (Set/Clear/Back) using SessionManager revisions; call `audioService.refreshLocalSelection()` after successful Set and Clear (via existing view action wiring)
- [X] T018 [P] [US1] Add `voice.localStt*` strings (title, sources, overridden note, invalid, saved, cleared) in en/pt-BR/es/fr in `src/i18n.ts`; cover them in `tests/unit/voice-settings.view.test.ts` and `tests/unit/local-stt-options.test.ts`

**Checkpoint**: US1 independently testable (T006–T009 green).

---

## Phase 4: User Story 2 — Saved extension locale (P2)

**Goal**: saved locale applied to existing `t()`-built metadata/UI after restart; overrides keep priority; static English `registerFlag` descriptions unchanged.

**Independent Test**: spec US2 — isolated environment, saved `fr`, restart production entry; `t()`-built tool/command/UI metadata French; flag descriptions unchanged English.

### Tests

- [X] T019 [P] [US2] i18n tests in new `tests/unit/i18n-locale.test.ts`: `resolveLocale` env > `--whatsapp-ng-locale=v` / `--whatsapp-ng-locale v` > saved > English; blank env falls through; present blank flag ⇒ English, saved ignored; unsupported winning override ⇒ English strings, saved not substituted; `initI18n` with no override after a previous override resets (no stale locale); source reported ([resolution](contracts/resolution.md))
- [X] T020 [P] [US2] Extension registration tests in `tests/unit/whatsapp-ng.extension.test.ts`: with synthetic saved `fr` and no overrides, awaited factory registers French `t()` tool labels/descriptions and `/whatsapp` command metadata; `registerFlag` descriptions equal the existing English literals; env `es` wins; re-invoking factory with override removed uses saved; unreadable/invalid saved locale ⇒ English and no config write
- [X] T021 [P] [US2] View tests in new `tests/unit/whatsapp-settings.locale.test.ts` (or `tests/unit/settings-navigation.test.ts`): Advanced → Extension language shows effective locale/source/overridden note, Set (en/pt-BR/es/fr)/Clear/Back, success notice says restart Pi and never mentions `/reload`; stale revision handling
- [X] T022 [P] [US2] Phone presentation tests in `tests/unit/phone-menu-i18n.test.ts`: phone menus use the startup locale, offer no locale/local-language control and show no restart notice

### Implementation

- [X] T023 [US2] `src/i18n.ts`: export `resolveLocale({ env, argv, saved })` → `{ locale, source }` preserving present-blank-flag and invalid-override behaviour; `initI18n(pi, saved?)` always assigns `currentLocale`; export getter for effective locale/source
- [X] T024 [US2] `whatsapp-ng.ts`: make default export async; construct `SessionManager` before translated registration; `await sessionManager.readSavedLocale()`; `initI18n(pi, saved)`; keep static flag descriptions unchanged; ensure no other behaviour reorders (registration order of flags/tools/commands preserved)
- [X] T025 [US2] `src/ui/whatsapp-settings.view.ts`: Advanced → Extension language entry with Set/Clear/Back via `SessionManager` locale setters and restart notice
- [X] T026 [P] [US2] Add `settings.locale*` strings (title, language choices, sources, overridden note, restart notice) in en/pt-BR/es/fr in `src/i18n.ts`; cover them in `tests/unit/i18n-locale.test.ts` and `tests/unit/whatsapp-settings.locale.test.ts`

**Checkpoint**: US2 independently testable (T019–T022 green).

---

## Phase 5: User Story 3 — Environment-only boundary (P3)

**Goal**: no persistence or settings path for the eight environment-only variables; no new exposure.

**Independent Test**: spec US3 — with those variables set, save both preferences; config contains only the new fields; behaviour unchanged.

- [X] T027 [P] [US3] Test in `tests/unit/session.manager.test.ts`: with `FFMPEG_PATH`, `WHISPER_CLI_PATH`, `CRISPASR_CLI_PATH`, `CRISPASR_STT_CMD`, `CRISPASR_TTS_CMD`, `WHATSAPP_NG_ALLOW_PLAIN_HTTP`, `WHISPER_MODEL_PATH`, `CRISPASR_MODEL_PATH` set to synthetic values, every Set/Clear path writes none of them nor any env value
- [X] T028 [P] [US3] Test in `tests/unit/whatsapp-ng.extension.test.ts` (or existing tool tests): `configure_wa_stt`/`configure_wa_tts` schemas and model tools expose neither `localSttLanguage` nor `locale`; phone command router has no handler for them
- [X] T029 [US3] Fix any exposure found by T027–T028 (expected none)

---

## Phase 6: Polish & cross-cutting

- [X] T030 [P] Docs: `README.md` (preference sources, restart for locale), `docs/reference.md` (fields, resolution order, terminal-only, last-writer limitation, downgrade, environment-only security boundary incl. ROADMAP R2), `docs/crispasr.md` (alias precedence vs saved language; paths remain env-only); `docs/menu-diagrams.md` if it documents Voice/Advanced trees
- [X] T031 [P] `CHANGELOG.md` Unreleased entry
- [X] T032 Production entry in isolated synthetic environment per [quickstart.md](quickstart.md) (`run_isolated pi --no-extensions -e ./whatsapp-ng.ts` or existing RPC fixtures): registration and reload with saved `fr`, env override, blank flag
- [X] T033 Run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`; check changed Markdown links/anchors; record exact results, skips and that no native-model or live WhatsApp qualification is claimed

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T002→T003, T004→T005) → Phases 3–5.
- US1 and US2 depend only on Phase 2; they touch shared files (`src/i18n.ts`, `whatsapp-ng.ts`), so sequence edits to those files: T016 before T024; T018 and T026 edit `src/i18n.ts` — run sequentially.
- Within US1: T006–T009 before T010–T018; T010→T011→T012/T013/T014→T015→T016→T017.
- Within US2: T019–T022 before T023→T024→T025.
- US3 after US1/US2 implementation (asserts against final surfaces).
- Phase 6 last; T033 is the final gate.

## Parallel Opportunities

- T006, T007, T008, T009 (different test files).
- T019, T020, T021, T022.
- T027, T028; T030, T031.

## Implementation Strategy

- MVP: Phases 1–3 (US1) then validate independently.
- Then US2, then US3, then Polish/T033 gate.
- No commits, publication or live-account operations as part of these tasks.

## Validation Evidence — 2026-11-16

- Baseline: `npm test -- --maxWorkers=2` passed 100 files/2364 tests with 3 skipped; `npm run typecheck` passed; `npm run lint` failed with 2882 pre-existing errors, dominated by vendored JavaScript/MJS.
- Feature production entry: `npx vitest run tests/unit/phone-control.rpc.test.ts -t 'local-preferences' --maxWorkers=1 --reporter=dot --silent` passed 3 isolated synthetic saved-locale/environment-override/blank-flag registration, reload and terminal Set/Clear scenarios; network was blocked.
- Final: `npm test -- --maxWorkers=2 --reporter=dot` passed 103 files/2446 tests with 1 file/3 tests skipped. `npm run typecheck` passed. ESLint over every changed TypeScript file passed. Declared `npm run lint` still reports the unchanged 2882-error baseline.
- `git diff --check` passed. Relative links and heading/HTML anchors in README, reference, CrispASR, menu diagrams and changelog passed a local checker.
- No native-model compatibility, real CLI language support or live WhatsApp qualification is claimed. No credentials, real accounts, model downloads, server launches, commits or publication were used.

### Snapshot-hardening follow-up — 2026-11-16

- Both local backends now require `options.local` and throw `Local transcription options snapshot required` before backend work when it is absent; neither `transcribe()` reads `process.env`. Direct-call fixtures resolve and pass their own snapshots.
- New regressions reject missing snapshots and mutate language/model environment values while CLI/native execution is pending; original model/language arguments remain in use. Affected suites: 53 tests passed. Final full suite: 103 files/2448 tests passed, 3 skipped. Typecheck, changed-file ESLint and `git diff --check` passed. The unrelated 2882-error repository lint baseline was not changed. No commits.

### Independent-test hardening — 2026-11-16

- `tests/unit/i18n-locale.test.ts` now neutralizes `WHATSAPP_NG_LOCALE` in `beforeEach` and resets i18n state. The affected locale/native/audio suites passed 30 tests with the variable set to `en` and 30 with it unset.
- Replaced the vacuous AudioService free-function mock assertion with a native-backend regression: two inferences using the same model and languages `en` then `es` create one context, pass that identical context to both calls and never call `free`.
- Updated `specs/README.md` navigation, marked the specification Implemented and corrected T018/T026 test references.
- Full suites used separate credential-free disposable `HOME`/`PI_CODING_AGENT_DIR` roots: `WHATSAPP_NG_LOCALE=en` passed 103 files/2449 tests with 3 skipped; the unset variant also passed 103 files/2449 tests with 3 skipped. Typecheck, changed-file ESLint and `git diff --check` passed. No commits or live operations.
