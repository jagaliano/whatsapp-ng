# Contract: Resolution order

## Local transcription language (per local transcription operation)

1. `CRISPASR_LANGUAGE` if nonblank (trimmed) → source `CRISPASR_LANGUAGE` (passed as-is, not validated — existing behaviour)
2. `WHISPER_LANGUAGE` if nonblank → source `WHISPER_LANGUAGE` (same)
3. valid saved `localSttLanguage` → source `saved`
4. `auto` → source `default`

Remote STT configured ⇒ none of this is evaluated and no local transcriber/model is initialized.

## Local operation snapshot (same single env read)

- Model path: nonblank `CRISPASR_MODEL_PATH` → nonblank `WHISPER_MODEL_PATH` → default storage path; `modelSource` records the winner. Explicit override missing/empty ⇒ existing error, no download.
- CLI selection (once per local selection): `CRISPASR_CLI_PATH` → `WHISPER_CLI_PATH` → `PATH`; child `LD_LIBRARY_PATH` prefixed with the CLI directory, captured once.
- Backends never read `process.env` during execution; env changes affect only later operations (CLI: next re-selection).

## Extension locale (once per factory invocation)

1. `WHATSAPP_NG_LOCALE` if nonblank → source `WHATSAPP_NG_LOCALE`
2. `--whatsapp-ng-locale=<v>` or `--whatsapp-ng-locale <v>` present → source `--whatsapp-ng-locale`; blank value ⇒ English, saved not used
3. valid saved `locale` → source `saved`
4. English → source `default`

Scope: `t()`-built metadata (tool labels/descriptions, command metadata, UI). `registerFlag` descriptions are static English and not localized by this feature.

Unsupported winning override ⇒ English strings (existing fallback); saved locale not substituted. Every `initI18n` call assigns the result (no carry-over).
