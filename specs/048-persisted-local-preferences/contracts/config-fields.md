# Contract: Config fields

```jsonc
{
  // …existing fields unchanged…
  "localSttLanguage": "pt",   // optional; terminal-only
  "locale": "fr"              // optional; terminal-only; applies after Pi restart
}
```

- Written only by `SessionManager.writeConfig`; keys omitted when absent.
- Never written: `FFMPEG_PATH`, `WHISPER_CLI_PATH`, `CRISPASR_CLI_PATH`, `CRISPASR_STT_CMD`, `CRISPASR_TTS_CMD`, `WHATSAPP_NG_ALLOW_PLAIN_HTTP`, `WHISPER_MODEL_PATH`, `CRISPASR_MODEL_PATH` or any environment value.
- Older versions: ignore on load, drop on next save.
- Multi-process: last writer wins; no merge.
