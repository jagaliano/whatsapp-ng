# Contract: Terminal UI (terminal-only)

## Voice settings → Local transcription language

- Title shows: effective value, source label, and when overridden `saved: <v> (overridden by <VAR>)`.
- Actions: **Set** (input; blank/invalid → localized error, nothing saved), **Clear** (shown only when a saved value exists), **Back**.
- On success (Set or Clear): notify saved; reset a cached unavailable local selection; next local transcription uses the new value; no restart required.
- Stale revision / expired authority → existing `voice.changed`/expired message; nothing saved.

## WhatsApp settings → Advanced → Extension language

- Shows effective locale, source, saved-overridden note.
- Actions: **Set** (select en / pt-BR / es / fr), **Clear**, **Back**.
- On success: notify "Saved. Restart Pi to apply the extension language." Never mentions phone `/reload`.

## Never shown

Credentials, environment contents beyond the winning variable *name* and its language/locale value, model or CLI paths.

## Not exposed

`configure_wa_stt`, `configure_wa_tts`, any model tool schema, phone commands/menus. Phone presentation uses the startup locale and shows no restart notice.

All new strings exist in en, pt-BR, es, fr.
