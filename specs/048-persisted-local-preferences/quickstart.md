# Quickstart: Validate Persisted Local Preferences

Use synthetic data only. No real account, model download or speech server.

Isolation in separate steps (never expand `$HOME` in the assignment that replaces it), run with a credential-free allowlisted environment (`env -i`), mirroring `scripts/release.mjs`:

```sh
TEST_HOME="$(mktemp -d)"
TEST_AGENT_DIR="$TEST_HOME/.pi/agent"
mkdir -p "$TEST_AGENT_DIR"
run_isolated() {
  env -i PATH="$PATH" HOME="$TEST_HOME" PI_CODING_AGENT_DIR="$TEST_AGENT_DIR" \
    USERPROFILE="$TEST_HOME" TMPDIR="${TMPDIR:-/tmp}" WHATSAPP_NG_LOCALE=en "$@"
}
```

Scenario variables are added explicitly per command (e.g. `run_isolated env WHATSAPP_NG_LOCALE= …` to unset). No API keys, `.env` or provider credentials. On Windows also isolate `APPDATA`/`LOCALAPPDATA`.

## Unit regressions (expected new/extended suites)

| Area | Scenarios | Contract |
|---|---|---|
| `session.manager` | set/clear each field; preserved across unrelated saves (incl. invalid raw values); failed `rename` → unchanged; stale revision / `current()=false` → unchanged; unreadable config → reject; blank/`--foo` rejected; loaded invalid → getter invalid, no rewrite; `readSavedLocale` read-only (no write, no lock) | [config-fields](contracts/config-fields.md) |
| local language resolver | env CrispASR > Whisper > saved > auto; blank env falls through; invalid env wins unchanged | [resolution](contracts/resolution.md) |
| `audio.service` | one snapshot per op (language, model path + source); env mutated mid-op (language, model alias, CLI alias, `LD_LIBRARY_PATH`) doesn't affect it; remote configured → no local probe/snapshot; cached `null` refreshed after Set and after Clear; cached transcriber kept, no context free, no FFmpeg re-probe | [data-model](data-model.md) |
| backends | CLI `--model`/`--language`/child env and native language/model path/override decision come from snapshots; no `process.env` read during execution; explicit missing model override → error, no download | [resolution](contracts/resolution.md) |
| `i18n` | translated tool/command registration metadata follows saved locale; flag descriptions unchanged English; env > flag > saved > en; blank flag → en not saved; invalid override → en not saved; re-init with no override resets stale locale | [resolution](contracts/resolution.md) |
| views | Voice and Advanced entries: source labels, overridden note, Set/Clear/Back, restart notice text, stale handling; strings ×4 locales | [terminal-ui](contracts/terminal-ui.md) |
| exposure | `configure_wa_stt/tts` schemas and phone menus lack new fields | [terminal-ui](contracts/terminal-ui.md) |

## Production entry (isolated)

1. Write synthetic `config.json` with `"locale":"fr"` in the isolated data root.
2. `run_isolated env WHATSAPP_NG_LOCALE= pi --no-extensions -e ./whatsapp-ng.ts` (or existing RPC fixture): translated registration metadata (tool labels/descriptions, `/whatsapp` command description) is French; `registerFlag` descriptions remain the existing English literals.
3. With `WHATSAPP_NG_LOCALE=es` → Spanish tool metadata; with `--whatsapp-ng-locale=` → English.
4. Re-invoke the factory (reload fixture) with override removed → saved locale, not the prior override.

## Declared checks

```sh
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
git diff --check
```

Not claimed: native model compatibility, real CLI behaviour per language, live WhatsApp delivery.
