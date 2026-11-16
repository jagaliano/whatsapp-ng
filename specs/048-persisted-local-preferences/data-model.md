# Data Model: Persisted Local Preferences

## Persisted fields (`config.json`, owned by `SessionManager`)

| Field | Type when valid | Absent meaning | Validation (input and load) |
|---|---|---|---|
| `localSttLanguage` | string: `auto` or `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$` | no saved value | blank, whitespace, option-like (`--foo`) or malformed → rejected at input; on load → ignored for resolution, flagged invalid |
| `locale` | `"en" \| "pt-BR" \| "es" \| "fr"` | no saved value | anything else → rejected at input; on load → ignored, flagged invalid |

- Independent from remote `sttLanguage` (never read or written together).
- Raw loaded values (valid or not) are re-serialized unchanged by unrelated saves; never auto-repaired.
- Clear removes the key; Set with blank input is rejected (not a Clear).

## In-memory state (`SessionManager`)

- `storedLocalSttLanguage: unknown`, `storedLocale: unknown` — raw.
- `localSttLanguageRevision: number`, `localeRevision: number` — bumped only after a committed Set/Clear.
- Getters: `getSavedLocalSttLanguage(): { value?: string; invalid: boolean }`, `getSavedLocale(): { value?: Locale; invalid: boolean }`.

## Derived values

- **EffectiveLocalSttLanguage** `{ language: string; source: 'CRISPASR_LANGUAGE' | 'WHISPER_LANGUAGE' | 'saved' | 'default'; savedOverridden?: string }`
- **EffectiveLocale** `{ locale: string | undefined; source: 'WHATSAPP_NG_LOCALE' | '--whatsapp-ng-locale' | 'saved' | 'default'; savedOverridden?: Locale }`
- **LocalSttOptions** (operation snapshot) `{ language; languageSource; modelPath; modelSource: 'CRISPASR_MODEL_PATH' | 'WHISPER_MODEL_PATH' | 'default' }` — captured once per local transcription from one env read + saved language; immutable for that operation; paths env/default only.
- **LocalSelection** (selection snapshot) `{ cliPath; cliSource: 'CRISPASR_CLI_PATH' | 'WHISPER_CLI_PATH' | 'PATH'; childEnv }` — frozen; captured once when the local transcriber is selected.

## State transitions (each preference)

```text
absent ──Set(valid)──▶ saved(v) ──Set(valid w)──▶ saved(w)
saved ──Clear──▶ absent
invalid(loaded) ──Set(valid)──▶ saved(v);  invalid ──Clear──▶ absent
any ──failed commit / stale revision / !current()──▶ unchanged (memory and disk)
```

`AudioService` local cache: `undefined (unprobed) → transcriber | null`; `refreshLocalSelection()` (after Set **and** Clear): `null → undefined`; working transcriber, native context and FFmpeg commands unchanged.
