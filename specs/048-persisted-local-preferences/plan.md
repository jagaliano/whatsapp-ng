# Implementation Plan: Persisted Local Preferences

**Branch**: `048-persisted-local-preferences` (spec directory; no git branch created) | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/048-persisted-local-preferences/spec.md`

## Summary

Add two terminal-only saved preferences — `localSttLanguage` and `locale` — persisted through `SessionManager`'s existing load/serializer/revision/atomic-writer/currentness path. Environment/argv overrides keep their current order and invalid-override behaviour above saved values. Local transcription resolves a full options snapshot once per operation in `AudioService` (language + source, model path + winning override source) from one environment read plus the saved language, and passes it to the CLI/native backends; CLI path/source and child `LD_LIBRARY_PATH` environment are captured once at local selection. No backend reads `process.env` during execution; all paths stay environment-only. A cached *unavailable* selection is reset after both Set and Clear of the local language. The saved locale is read (validated, read-only, through `SessionManager`) in the now-async extension factory before `initI18n` and before translated tool/command metadata (`t()` labels/descriptions) is built — `registerFlag` descriptions are static English today and stay so in this increment; `initI18n` always re-resolves so no stale locale survives factory re-creation. Locale saves tell the terminal user to restart Pi. Eight program/command/model-path/transport-security variables stay environment-only. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript ES modules (strict), Node 26.x

**Primary Dependencies**: Pi 1.5.0 extension API (async `ExtensionFactory` supported: `(pi) => void | Promise<void>`), Baileys; no new dependencies

**Storage**: `config.json` under `~/.pi/agent/extensions/whatsapp-ng/` via `SessionManager` (`src/services/session.manager.ts`)

**Testing**: Vitest (`tests/unit/**/*.test.ts`), production-entry RPC fixtures, `pi --no-extensions -e ./whatsapp-ng.ts` in isolated HOME/`PI_CODING_AGENT_DIR`

**Target Platform**: macOS, Linux, Windows (where Pi runs)

**Project Type**: Pi extension (single project)

**Performance Goals**: Preference resolution is constant-time per operation; no extra process spawn, FFmpeg probe or model load on language change

**Constraints**: No ad hoc config I/O; no exposure via tools/phone; no env import; no fallback past a winning override; no native context free during inference

**Scale/Scope**: 2 config fields, 2 terminal settings entries, ~4 i18n keys groups × 4 locales, resolver helpers, backend option plumbing, docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-design | Post-design |
|---|---|---|
| I. OOP | Pass — state stays in `SessionManager`/`AudioService` classes; resolvers are pure helpers beside owners | Pass |
| II. Clean Code | Pass — one resolver per preference returning `{ value, source }` | Pass |
| III. SOLID | Pass — backends receive options (DIP) instead of reading env; `SessionManager` remains sole config owner (SRP) | Pass |
| IV. TypeScript | Pass — typed `LocalSttLanguageSource`, `LocaleSource`, `Locale` union; no `any` added | Pass |
| V. Simplicity | Pass — read-only bootstrap read instead of metadata refresh machinery; no new framework | Pass |
| Workflow | Pass — behaviour change → this spec/plan/tasks folder | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/048-persisted-local-preferences/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── config-fields.md
│   ├── resolution.md
│   └── terminal-ui.md
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks
```

### Source Code (repository root)

```text
whatsapp-ng.ts                                  # async factory: read saved locale → initI18n before metadata
src/i18n.ts                                     # resolveLocale({env, argv, saved}) → {locale, source}; initI18n always re-resolves; new keys ×4
src/services/session.manager.ts                 # stored fields, getters (validated), set/clear with revisions, serializer, readSavedLocale()
src/services/local-stt-options.ts               # NEW: syntax validation (shared with remote), resolveLocalSttLanguage(env, saved), resolveLocalSttOptions(env, saved) → snapshot
src/services/remote-audio.transcriber.ts        # reuse shared syntax validator (no behaviour change)
src/services/audio-transcriber.ts               # AudioTranscriptionOptions.local?: LocalSttOptions (local only)
src/services/audio.service.ts                   # per-op snapshot (injected env provider); refreshLocalSelection() after Set/Clear
src/services/whisper-cli-audio.transcriber.ts   # CLI path/source + child env captured at selection; language/model from snapshot
src/services/whisper-cpp-audio.transcriber.ts   # selection receives one env snapshot (CLI alias check)
src/services/whisper-cpp-node.transcriber.ts    # language/model path/override source from snapshot; existing context reuse
src/ui/voice-settings.view.ts                   # Local transcription language: Set / Clear / Back
src/ui/whatsapp-settings.view.ts                # Advanced → Extension language: Set / Clear / Back + restart notice
tests/unit/…                                    # see quickstart.md
README.md, docs/reference.md, docs/crispasr.md, CHANGELOG.md, docs/menu-diagrams.md (if menu tree documented)
```

**Structure Decision**: Single-project Pi extension; extend existing owners, add one small resolver module for the local language (shared syntax with remote).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Extension factory becomes `async` | Saved locale must exist before registration-time `t()` tool/command metadata is built | Metadata refresh after registration is unsupported by Pi for already-registered flags/descriptions and would need new machinery |
| `writeConfig` gains one more defaulted parameter (`preferences`) | Follows existing explicit-serializer pattern so setters can commit a candidate value atomically | Mutating fields before write would break failed-commit/stale-request preservation |
