<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp Logo" width="100">
</p>

# whatsapp-ng

Use WhatsApp to talk to your [Pi](https://pi.dev) agent: send tasks, share files and voice notes, receive answers, and control the running session from your phone.

## Features

- **Manual WhatsApp connection:** pair by QR code, keep the saved login, and reconnect when needed or on startup.
- **Allowed contacts:** choose who can interact with Pi; add names and aliases, inspect ignored senders, and print contact identifiers from the menu.
- **Allowed groups:** allow specific group JIDs with aliases, then choose mention/reply triggers or all-message handling. Other groups do not trigger the agent.
- **Recents and history:** browse conversations offline, inspect message details and send native quoted replies.
- **Reliable messaging:** stable message IDs, bounded pre-transmission retries and explicit uncertain outcomes instead of blind resends.
- **Terminal menu:** manage connection, contacts, groups, history, reply delivery, voice settings and the authorized phone owner through `/whatsapp`.
- **Phone controls:** select models and thinking levels, stop work, compact context or start a new shared session from the owner's phone.
- **Group-only mode:** bind Pi to one WhatsApp group with `--whatsapp-group <jid>`.
- **Media support:**
  - **Images:** forward incoming WhatsApp images to Pi for analysis with a vision-capable model.
  - **Audio transcription:** use Whisper.cpp/CrispASR locally, a compatible native Whisper addon, or a configured transcription API. FFmpeg first converts voice notes to 16 kHz mono WAV.
  - **Documents:** save documents for agent access, with bounded text previews for readable PDFs and optional local OCR for scans.
  - **Outgoing attachments:** explicitly send documents, images, audio, voice notes and video, with optional native quotes.
- **Spoken replies:** opt into text, voice, voice + text or input-mirroring output, with per-chat preferences and separate group consent.

**All allowed chats share one Pi session and its context. Only allow people and groups you trust with that shared access.**

## Install and connect

With Pi already installed:

```bash
pi install npm:whatsapp-ng@1.1.0-rc.1
```

Restart Pi, then:

1. Open `/whatsapp` → **Connection** → **Connect WhatsApp** and scan the QR code.
2. Add contacts under **Chats / Owner → Allowed Contacts**, or groups under **Groups → Allowed Groups**.
3. Send a message from an allowed chat. Pi answers in that conversation.

The login is saved. To reconnect automatically on startup:

```bash
pi --whatsapp-ng-online
```

<a id="auth-adoption-and-recovery"></a>

Use `--whatsapp-group <jid>` to bind the extension to one group. Stop any other instance using the same WhatsApp profile before connecting. For an existing installation with an older data directory, use the [migration guide](docs/reference.md#migration-and-recovery) rather than pairing again or deleting its data.

<a id="pdf-previews-and-ocr"></a>

## Optional system tools

Text chat needs no additional media tools. Install the tools below only for the features you use, following their instructions for **macOS, Linux or Windows**. System executables and model/language data are not bundled; availability depends on the tool's supported platforms.

| Tool | Needed for |
| --- | --- |
| [FFmpeg](https://ffmpeg.org/download.html) | Audio conversion, video processing and outgoing image/video preparation. Required for voice-note transcription and spoken replies, even with a remote speech API. |
| [Whisper.cpp](https://github.com/ggml-org/whisper.cpp) with a GGML model | Local transcription through `whisper-cli`. Not needed for remote transcription or when using a compatible native addon. |
| [CrispASR](docs/crispasr.md) with a compatible Whisper GGML model | An alternative local transcription CLI. It can also be operated separately as a compatible speech server; see its setup guide. |
| [Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html) with language data | Local OCR of scanned PDFs. PDFs with readable text do not require OCR. |

For local CLI transcription, choose Whisper.cpp **or** CrispASR; you do not need both. The included `whisper-cpp-node` addon offers an alternative backend on compatible **macOS/Windows** builds, not Linux. It includes its own Whisper engine and still needs a model, but no separate CLI. Setting an explicit CLI path disables native-addon fallback.

Make executables available on `PATH` to the process running Pi, or set `FFMPEG_PATH`, `WHISPER_CLI_PATH` or `CRISPASR_CLI_PATH` for an executable elsewhere. Point `WHISPER_MODEL_PATH` or `CRISPASR_MODEL_PATH` to your existing model. Services may have a different environment from your terminal. See [PDF/OCR setup and manual checks](docs/reference.md#pdf-previews-and-ocr) for scanned documents.

## Audio transcription

Choose local transcription or a compatible remote API. FFmpeg is required for both.

### Local

Install `whisper-cli` and point `WHISPER_MODEL_PATH` to your existing GGML model. Set `WHISPER_LANGUAGE` to `auto` or a language code such as `en` or `es` in the environment that launches Pi.

Local transcription runs on CPU. Without a model override, the base model downloads on first use. When neither CLI is available and no explicit CLI path is set, compatible macOS/Windows builds can use the included native addon instead; Linux requires a CLI.

[CrispASR](docs/crispasr.md) is another supported local CLI/server option. See the [speech reference](docs/reference.md#speech-configuration) for discovery order and environment variables.

### Remote

Use any provider or self-hosted server implementing the OpenAI-compatible **`/audio/transcriptions`** API. This is not tied to Groq or to Pi's model provider; chat API compatibility alone does not guarantee transcription support.

From a verified local terminal/RPC request or the configured WhatsApp owner's chat, ask Pi to call `configure_wa_stt` with your provider's base URL, transcription model and API-key environment-variable name. Other allowed contacts cannot change or clear these settings. Replace these placeholders:

```json
{
  "sttEndpoint": "https://speech.example.com/v1",
  "sttModel": "your-transcription-model",
  "sttEnv": "STT_API_KEY"
}
```

Set `STT_API_KEY` securely in the environment that launches Pi, then restart Pi. **Pass only the variable's name to the tool, never the key itself.** Optional `sttLanguage` selects a language; omit it or use `auto` for server detection.

Configuring remote transcription authorizes sending admitted voice-note audio to that endpoint. The provider's billing and retention policies apply. Failures are reported without silently switching providers or falling back to local transcription.

Updates preserve omitted settings. Call `configure_wa_stt({})` to return to local transcription. See [endpoint and request details](docs/reference.md#remote-speech-endpoints) for local servers and transport limits.

## Speech replies (opt-in)

Open `/whatsapp` → **Voice** to choose a speech backend, voice, speed and reply mode:

| Mode | Output |
| --- | --- |
| Text | Text only. |
| Voice | A voice note when the answer is suitable for speech. |
| Voice + text | Both formats. |
| Mirror | Voice for verified audio input; text otherwise. |

Backends include Fish, OpenAI-compatible speech APIs and the unofficial Microsoft Edge speech service. Edge requires no configured API key but is an online service, not offline synthesis. The transcription and speech backends are independent.

Speech is disabled until you approve its destination in the terminal Voice menu. Groups need separate opt-in. Changing the endpoint requires new approval; configuring a backend with `configure_wa_tts` does not enable speech or grant consent.

Voice settings also let you pause automatic replies for individual chats and send a confirmed preview. Long or code-heavy answers stay as text. See the [speech reference](docs/reference.md#speech-replies) for backend fields and failure behavior.

<a id="settings-off-and-diagnostic-privacy"></a>

## Chats and replies

The `/whatsapp` menu groups settings into **Connection**, **Chats / Owner**, **Replies**, **Voice**, **Groups** and **Advanced**. See [Off behavior and diagnostic privacy](docs/reference.md#off-and-diagnostics) for shutdown and log retention.

- **Contacts:** add phone numbers in `+E164` format; use aliases to identify them.
- **Groups:** add the group JID. By default, the agent responds to actual WhatsApp mentions of its account or replies to that account's messages. Change this under **Groups → Group replies**.
- **Recents:** browse conversations, inspect messages, reply manually or allow a new chat.
- **Replies:** choose whether attachments are followed by a final explanation. Optional elapsed/tool-count stats, file-path summaries, interim text and live activity are off by default.
- **Optional outputs:** explicitly approve individual tools whose image results may be shared, or forward future terminal answers to the private owner. These are off by default.
- **Owner:** explicitly choose the person authorized to use phone controls. An allowed contact or paired device is not automatically an owner.

WhatsApp `@lid` identifiers are not phone numbers. Select known conversations in the menu rather than constructing a recipient from displayed digits.

## Phone controls

Allowed people can use `/help` and `/status`. State-changing commands require the configured owner and affect the shared Pi session.

| Command | Action |
| --- | --- |
| `/model [provider/model]` | Choose an authenticated model. |
| `/think [level]` | Change thinking level. |
| `/stop`, `/abort` | Stop current work and withdraw queued WhatsApp input. |
| `/compact [focus]` | Compact session context. |
| `/new` | Confirm a new Pi session, keeping login, settings and history. |
| `/voice [text\|voice\|both\|mirror]` | Change this chat's mode within existing speech approvals. |
| `/replies` | Change reply delivery and optional reporting. |
| `/off` | Confirm WhatsApp shutdown without logging out. Re-enable from the terminal Connection menu. |
| `/quit` | Confirm graceful Pi shutdown. |

Menus use numbered replies. Group selections must quote the menu. Native polls are experimental and require `--whatsapp-ng-native-polls`. Configuration changes require idle Pi; stop active work explicitly rather than interrupting it through a settings change.

## LLM-Callable Tools

The extension registers these tools for Pi's agent:

| Tool | Direction | Description |
| --- | --- | --- |
| `send_wa_message` | Outbound | Send text to a contact/group, optionally quoting a retained message. Omit `jid` only when the current turn has one owning conversation; idle manual calls retain the last-conversation/operator fallback. |
| `send_wa_media` | Outbound | Explicitly send a local document, image, audio file, voice note or video, with optional caption and native quote. Uses the same recipient-ownership rules as text. |
| `send_reaction` | Outbound | React to an unambiguous retained message. Optional `fromMe` and `participant` fields disambiguate its key; compound emoji are supported. |
| `list_wa_conversations` | Read-only | List local recent conversations. Supports `onlyIncoming`, `onlyAllowed`, `limit` and local `scope`; returns available scope IDs. |
| `get_wa_conversation_history` | Read-only | Read messages for `senderNumber` (`+E164`, raw phone digits or a JID). Supports `limit`, local `scope` and opaque `cursor` / `nextCursor` pagination. |
| `check_wa_new_messages` | Read-only | List conversations whose latest message is incoming. Supports `sinceTimestamp` (milliseconds since epoch) and local `scope`. |
| `request_wa_history` | Network request / local status | `{mode:"request",jid,count?}` explicitly requests up to 100 older messages for an allowed connected chat; `{mode:"status",requestId?}` reads retained request status locally. |
| `configure_wa_stt` | Guarded configuration | Owner/local-only: set or update `sttEndpoint`, `sttModel`, `sttEnv` and optional `sttLanguage`. Pass the key's environment-variable name, never its value; `{}` selects local transcription. |
| `configure_wa_tts` | Guarded configuration | Update speech backend settings for an authorized local/owner request. Does not grant consent, enable speech or synthesize immediately. |

File uploads must be explicit, at most **25 MiB**, and under the current workspace or extension media directory. Mentioning a file path does not upload it. Native quotes require a retained, unambiguous message in the same chat.

The three read-only inbox tools use the selected local archive under `~/.pi/agent/extensions/whatsapp-ng/archive/`. They work offline, never fetch network history and do not mark messages as read. The list/history tools default to, and cap at, 20 items; `check_wa_new_messages` returns all matching conversations. Only an explicit `request_wa_history` request fetches older messages; availability depends on WhatsApp and the linked devices.

## Data and privacy

Settings, login, history and downloaded media live under `~/.pi/agent/extensions/whatsapp-ng/`. Recents remain readable offline. Archive retention is bounded to 1,000 messages per conversation, 30 days and 100 MiB per account partition; it does not erase Pi transcripts, logs or downloaded media.

- Allowed chats share model context; routing is not privacy isolation.
- Images may reach Pi's vision model. Remote transcription and speech send content to the selected service.
- A successful send means API acceptance, not proof of delivery or reading. An unknown outcome may still arrive; do not automatically resend it.
- **Connection → Turn WhatsApp off** (or `/off`) keeps your login. **Advanced → Logoff (Delete Session)** resets the current authentication profile. Do not delete login or history to resolve a lock.
- This uses an unofficial WhatsApp transport. Protocol changes or account policies can disrupt it.

See the [operating reference](docs/reference.md) for migration, recovery, media formats, history and diagnostics. [Security reports](SECURITY.md) must not include credentials or private conversation dumps.

## Development

The development baseline is Node 26.x and Pi 1.4.0.

```bash
git clone https://github.com/jagaliano/whatsapp-ng.git
cd whatsapp-ng
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm test
npm run lint
npm run typecheck
pi --no-extensions -e ./whatsapp-ng.ts
```

System tools must be installed separately. Add `--verbose` for extension diagnostics, not message bodies or protocol-key traces. See [dependencies and platform checks](DEPENDENCIES.md), the [manual acceptance guide](tests/manual/prerelease-acceptance.md), and [design records](specs/README.md).

## Support and license

Report bugs through [GitHub issues](https://github.com/jagaliano/whatsapp-ng/issues). See the [changelog](CHANGELOG.md) and [MIT license](LICENSE).

<a id="fork-and-legacy-names"></a>

Based on [Rapha Castelloes' original project](https://github.com/RaphaCastelloes/whatsapp-pi), maintained by José Antonio Galiano Sandoval. Older names and paths are listed in the [migration reference](docs/reference.md#historical-identifiers).
