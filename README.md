<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp Logo" width="100">
</p>

# whatsapp-ng
[![GitHub](https://img.shields.io/badge/github-repo-black.svg?style=flat-square&logo=github)](https://github.com/jagaliano/whatsapp-ng)

A WhatsApp integration extension for the **[Pi Coding Agent](https://pi.dev)**. 

Pi is a powerful agentic AI coding assistant that operates in your terminal. This extension lets you chat and pair-program with your Pi agent through WhatsApp, with message filtering, allowed contacts/groups, recents/history browsing, message detail/reply, group-only binding, and explicit message-send outcomes.


Maintained continuation of [RaphaCastelloes/whatsapp-pi](https://github.com/RaphaCastelloes/whatsapp-pi), preserving original Git history and attribution for independent fixes and releases. Original author metadata remains **Rapha**; fork maintenance is led by **jagaliano**. This does not assert that upstream is abandoned.

> **Experimental prerelease:** `whatsapp-ng@1.1.0-rc.1` targets npm's `next` tag, not `latest`. See [installation](#installation), the [changelog](CHANGELOG.md), [MIT license](LICENSE) and [security policy](SECURITY.md).

## Fork and legacy names

Legacy project identifier: `whatsapp-pi`. This is an independently maintained fork, not an upstream rename. Original Git history, Rapha Castelloes attribution and MIT notices remain intact. Historical documents use the labels below instead of falsely renaming their original artifacts.

| Historical label | Original name/path | Current counterpart |
| --- | --- | --- |
| `<legacy-entrypoint>` | `whatsapp-pi.ts` | `whatsapp-ng.ts` |
| Legacy online flag | `--whatsapp-pi-online` | `--whatsapp-ng-online` |
| `<legacy-current-data-root>` | `~/.pi/agent/extensions/whatsapp-pi` | `~/.pi/agent/extensions/whatsapp-ng` |
| `<legacy-previous-data-root>` | `~/.pi/agent/extension/whatsapp-pi` | Explicit migration source only |
| `<legacy-original-data-root>` | `~/.pi/whatsapp-pi` | Explicit migration source only |

The [upstream project](https://github.com/RaphaCastelloes/whatsapp-pi), [legacy contribution fork](https://github.com/jagaliano/whatsapp-pi), [published upstream package 1.0.70](https://www.npmjs.com/package/whatsapp-pi/v/1.0.70) and [advisory licensing inquiry](https://github.com/RaphaCastelloes/whatsapp-pi/issues/17) are historical references, not installation targets for this fork. Upstream commit `49adbc3` and that package declare MIT; no upstream endorsement or unverified copyright dates are asserted.

## Status and known limits

- Development targets Node 26.x and Pi 1.4.0. Recorded source validation on macOS passed 585 tests across 58 files, lint and typecheck. See [dependency and test details](DEPENDENCIES.md).
- Live direct-chat tests cover messages, media, native replies, saved-session reconnects and selected history/receipt behavior. A real WhatsApp voice note was transcribed by Groq and received by Pi.
- Earlier Linux amd64 package tests used Pi 1.3.0; the updated Pi 1.4.0 package still needs fresh testing there. Windows, service installers and broader group/receipt behavior remain unverified.
- Known advisories remain in Pi's SDK/host HTTP dependency. The extension's production-only npm audit does not cover host-supplied packages. See the [current security assessment](DEPENDENCIES.md#latest-audit-refresh).
- This is experimental software, not a production-stability guarantee. A successful send means API acceptance, not confirmed recipient delivery or reading.

## Features

- **Manual WhatsApp Connection**: QR code-based authentication with session persistence
- **Allowed Contacts**: Control which phone numbers can interact with Pi
  - Add contacts with optional names for easy identification
  - View ignored numbers (not yet allowed) and add them when needed
  - Manage aliases and print allowed contacts from the menu
- **Allowed Groups**: Control which WhatsApp groups can interact with Pi
  - Add group JIDs with optional aliases
  - Only groups in Allowed Groups are processed by the agent
- **Recents & History**: Browse recent conversations, inspect full message history, and reply from message detail view
- **Reliable Messaging**: Connection-aware sending with stable message IDs, bounded pre-transmission retries, and explicit uncertain outcomes
- **TUI Integration**: Menu-driven interface for managing connections, contacts, and recent chats
- **Group-Only Mode**: Bind the agent to a single WhatsApp group with `--whatsapp-group`
- **Media Support**: 
  - **Vision Analysis**: Automatically forwards WhatsApp images to Pi for analysis.
  - **Audio Transcription**: Transcribes voice notes locally with Whisper.cpp or through an explicitly configured OpenAI-compatible remote STT endpoint; FFmpeg converts audio to 16 kHz mono WAV first.
  - **Document Handling**: Downloads and stores documents (PDF, text) for agent access; PDFs include a bounded text preview when readable.

## Prerequisites

### Pi Coding Agent

Install Pi from [pi.dev](https://pi.dev):

**Linux / macOS (recommended):**
```bash
curl -fsSL https://pi.dev/install.sh | sh
```

**Or via npm (current development target: Node.js 26.x and Pi 1.4.0):**
```bash
npm install -g @earendil-works/pi-coding-agent@1.4.0
```

Then authenticate or set an API key before starting:
```bash
# Use /login inside Pi for subscription providers, or set an API key:
export ANTHROPIC_API_KEY=sk-ant-...
# OpenAI
export OPENAI_API_KEY=sk-...
# Google Gemini
export GEMINI_API_KEY=...
```

See the [Pi documentation](https://pi.dev/docs/latest) for full setup, providers, and model configuration details.

### System media tools

Install and update native tools yourself; the extension does not ship or download FFmpeg or build Whisper.cpp. For a new macOS setup with Homebrew:

```bash
brew install ffmpeg whisper-cpp tesseract
```

FFmpeg is needed for audio/video conversion and applicable image/video preparation. Local transcription additionally needs `whisper-cli` and a compatible GGML model; remote transcription does not need Whisper.cpp. PDF OCR needs Tesseract and its language data. Install only the tools needed for your features. On other systems, follow each tool's installation instructions.

Verify discovery in the shell that launches Pi:

```bash
ffmpeg -version
whisper-cli --version
tesseract --version
tesseract --list-langs
```

Use `FFMPEG_PATH` or `WHISPER_CLI_PATH` for an executable outside `PATH`. The executable must also be accessible to the user/service running Pi. Keep system tools updated independently of this package.

### Audio Transcription

Local Whisper.cpp is the default. To use remote STT, apply all three fields below with `configure_wa_stt`. Alternatively, stop Pi and merge them into your existing `~/.pi/agent/extensions/whatsapp-ng/config.json`, preserving the other settings:

```json
{
  "sttEndpoint": "https://api.groq.com/openai/v1",
  "sttModel": "whisper-large-v3-turbo",
  "sttEnv": "GROQ_API_KEY"
}
```

`sttEnv` is the **name** of the environment variable containing the selected provider's API key, never the key itself. Export that variable securely in the environment that launches Pi, then restart Pi. The names are provider-neutral: choose your provider's base URL, transcription model and key-variable name. No vision key, Pi provider credential or other environment variable is used as a fallback.

**Configuring remote STT opts into uploading admitted WhatsApp voice-note audio to that provider.** Its billing, rate limits and data-retention policy apply. The client appends `/audio/transcriptions` to the HTTPS base URL and posts multipart `file` (16 kHz mono WAV), `model` and `response_format=json`, expecting a JSON `text` string. Verify that the particular endpoint/model supports this transcription API: OpenAI-compatible **chat** support alone (including a routing service's chat API) is not sufficient. No provider-specific/chat-audio adapters are implied.

FFmpeg is still required for conversion, but remote mode never initializes Whisper.cpp or downloads a local model. Partial/invalid settings, a missing `sttEnv` variable or a provider error fail rather than silently falling back to another backend. Tool updates preserve omitted fields and validate the combined configuration before saving; initial remote setup requires all three fields. Pass `configure_wa_stt({})` (or all three empty strings) to select local mode. Endpoint credentials/query strings/fragments and redirects are rejected; input/upload limits are 25 MiB, response limit is 1 MiB, conversion and remote-request timeouts are 60 seconds each, with no automatic upload retry. Providers can impose stricter limits. Account/session changes prevent stale uploads before sending and best-effort abort in-flight requests; already-uploaded audio cannot be recalled. Newly created private audio scratch files are cleaned on success/error, not on abrupt process death; previously saved media is not deleted.

With remote STT unconfigured, audio transcription prefers an installed Whisper.cpp CLI. A compatible macOS/Windows native addon can provide a fallback when no CLI is available. `whisper-cpp-node` packages its own native Whisper.cpp engine and does not require a separate CLI installation, but still needs a model. Its platform support is limited; an installed system CLI works independently of the addon. FFmpeg converts input audio; transcription runs on CPU and requires no transcription API key.

If Whisper.cpp already works locally, reuse it and your existing light model—no rebuild is necessary:

```bash
export WHISPER_CLI_PATH="$(command -v whisper-cli)"  # optional when already on PATH
export WHISPER_MODEL_PATH="/absolute/path/to/ggml-tiny.bin"
export WHISPER_LANGUAGE="auto"                      # or en, es, pt, ...
pi --no-extensions -e ./whatsapp-ng.ts
```

Choose the actual path of your installed GGML model; the example does not download one. Set these variables in the shell that launches Pi, then restart/reload the extension. Invalid explicit CLI/model paths fail rather than silently substituting a different backend/model. Without a model override, the existing fallback downloads `ggml-base.bin` into the extension's `whisper/models/` directory on first transcription if missing.

Local CLI preparation/transcription has a shared 10-minute budget. Cancellation or a session change aborts model preparation and kills the CLI child; scratch cleanup waits for child closure. Default model downloads use private temporary files and atomic publication, so failed downloads are not reused as complete models. This process-cancellation guarantee does not apply to the in-process native addon.

Incoming image/video/document downloads are limited to 25 MiB, including when the advertised size is absent or incorrect. Newly created media/document directories use `0700`; new files use unique names, exclusive creation and `0600`. Existing downloads/directories are not deleted or retroactively re-permissioned.

CLI lookup uses an explicit `WHISPER_CLI_PATH`, otherwise `PATH`; repository vendor directories are not searched. Install/build Whisper.cpp using its [upstream instructions](https://github.com/ggml-org/whisper.cpp), not extension-maintained build scripts. The CLI uses `--no-gpu`; the native fallback uses `use_gpu: false`. `WHISPER_MODEL_PATH` and `WHISPER_LANGUAGE` apply to both backends; language defaults to `auto`.

### PDF previews and OCR

PDF previews use pinned LiteParse 2.17.0 and its matching optional native package. Local OCR requires Tesseract and language data; native text can still be extracted without OCR. PDF support loads only when needed, and failure retains the saved file/fallback notice. Each PDF parser is closed afterward, with a 60-second parse-only deadline (not an initialization deadline). See [dependency/native-tool policy](DEPENDENCIES.md) for reviewed versions, native prerequisites and security evidence.

To verify OCR on your macOS installation, first confirm `eng` appears in `tesseract --list-langs`. For Spanish, also check for `spa`; missing additional language data can be installed with `brew install tesseract-lang`. No reinstall is needed when the data is already present.

From this checkout, run the direct Tesseract and LiteParse integration tests:

```bash
TEST_HOME="$(mktemp -d)"
HOME="$TEST_HOME" PI_CODING_AGENT_DIR="$TEST_HOME/agent" PI_OFFLINE=1 \
  npm test -- tests/unit/tesseract.contract.test.ts tests/unit/incoming-pdf.contract.test.ts --maxWorkers=2
```

The temporary HOME keeps these checks separate from your WhatsApp settings and history.

They recognize a generated `HELLO WORLD` image and a scanned PDF with no text layer, verify native PDF text extraction and OCR-disabled behavior, and check corrupt-file fallback and worker cleanup. Tesseract-dependent tests skip when the executable is absent; check the test output rather than treating a skipped test as success.

To try your own image locally:

```bash
tesseract "/absolute/path/to/scan.png" stdout -l eng --psm 6
# For Spanish text, use -l spa; for mixed text, use -l eng+spa.
```

Tesseract accepts images, not PDFs directly. LiteParse renders PDF pages before local OCR. Neither OCR path requires uploading the document to an OCR server.

## Quick Start

### Before switching from whatsapp-pi

Stop the prior extension and every same-profile Pi/tmux/headless service before enabling this continuation. Use `/whatsapp > Disconnect WhatsApp`, stop the owning Pi process as needed, and disable the old package/resource with `pi config` or remove its exact source with `pi remove <source>` after checking `pi list`. Project-local installations need the corresponding local configuration too. Do not edit global settings or delete auth as an automatic migration step.

This fork now uses its own `~/.pi/agent/extensions/whatsapp-ng` data namespace. It does not probe or import legacy roots automatically. Preserve your saved login/history with the explicit full-state migration below; do not treat an empty new namespace as a request to re-pair. A separate canonical-profile transport lease rejects competing cooperating instances before auth/socket work and remains held while admitted credential I/O settles. Archive locks alone do not provide this protection. Old clients that ignore the lease, copied credential directories and distributed/network-filesystem locking are outside this guarantee: stop prior instances first.

### Auth adoption and recovery

Stop **all owning Pi processes and services**, not only their WhatsApp connections, before migrating. Then start the new entry once with an explicit source:

```bash
pi --no-extensions -e ./whatsapp-ng.ts --whatsapp-ng-migrate-from "$HOME/.pi/agent/extensions/whatsapp-pi"
```

A private pending request can also be queued by the operator and will run before normal initialization on the next cold start. The destination must not already exist, even empty. The migration checks ownership/runtime locks and directory identity, then atomically renames the entire state root on the same filesystem; no credentials are copied, merged or recreated. Settings, default/group auth, media, relative profile bindings and archive UUID/account identities remain together. The derived old root log is renamed without changing its contents. Old transcripts/log contents remain historical.

Migration requests and exclusive migration locks are private sibling files outside the moved root. Interrupted moves resume only when directory identity proves the destination is the original source. Unknown/future metadata, runtime locks, symlinks, destination/log conflicts and cross-filesystem moves fail closed. No PID-based lock stealing or copy fallback occurs. After a crash, verified stale migration locks require separate explicit operator recovery; do not delete auth/config/archive data. Do not start the old client alongside the new one.

Remove the migration flag from future cold-start commands after completion. Within the same process, `/new`, resume, fork or extension recreation cannot replay the initial migration. A failed attempt or a newly queued request requires a fresh process; session replacement is not a migration retry. File logging, including shutdown logging, remains blocked while startup migration is incomplete.

Generic profile adoption remains available only for an explicitly supplied source; initialized auth is never merged and group profiles never borrow default-profile credentials. Pi session metadata and shutdown hooks use the new namespace; old session entries do not silently replace the migrated configuration.

Each canonical auth directory has sibling `<auth-directory>.transport-lock` and `<auth-directory>.auth-profile.json` control files. The latter contains only a schema version and adoption/reset state, not keys or account identifiers. Logout resets only the current profile and prevents later resurrection from preserved legacy originals. Interrupted adoption/reset, malformed auth or unsupported metadata fails closed; it is not silently replaced with a fresh identity.

Do not delete auth, config or archives to recover a lock. First stop every process using the profile, including old services. A lock is never automatically stolen merely because its PID appears dead; PID reuse is possible. Only after independently establishing that no owner remains may an operator explicitly remove that single stale transport-lock file. Corrupt/future/interrupted profile metadata and private orphan import/retired directories require separate explicit recovery after inspecting the preserved originals; do not attach their contents to an issue or blindly remove them. These are cooperative local-filesystem guards, not an OS sandbox.

Storage/auth directories are private (`0700`); config, saved credentials, profile-control files and new archive snapshots use `0600`. Baileys can create additional key files with umask-derived leaf modes; the private auth directory is their confidentiality boundary. Filesystem permissions are not encryption.

### Installation

Stop any prior installation using the same WhatsApp profile, then install the exact prerelease:

```bash
pi install npm:whatsapp-ng@1.1.0-rc.1
```

Alternatively, inspect a source checkout and use its explicit entry:

```bash
git clone https://github.com/jagaliano/whatsapp-ng.git
cd whatsapp-ng
# Candidate development branch:
git checkout chore/fork-release-readiness
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
pi --no-extensions -e ./whatsapp-ng.ts
```

Use the reviewed maintenance commit, not uncommitted local work. The lockfile reproduces maintainer dependencies with the flags above. Lifecycle scripts are disabled; provide system FFmpeg and, for OCR, Tesseract. Normal installs without that flag can run native downloads/builds. The lock does not freeze every future consumer install; see [DEPENDENCIES.md](DEPENDENCIES.md).

Do not install `npm:whatsapp-pi` expecting this fork. This migration changes the entry, online flag and state root; `/whatsapp`, group/history flags and existing messaging/history tool names remain unchanged.

After an approved installation is enabled, start Pi:
```bash
pi
```

1. Open `/whatsapp` and choose **Connect / Reconnect WhatsApp**.
   - QR appears only on first pair or after logoff.

2. Add the chat you will use with Pi to **Allowed Contacts** or **Allowed Groups**.

3. Send a message from that allowed chat to Pi.
   - Pi replies in same thread.
   - Use **Recents** only to browse history or reply manually.

After first pairing, you can start Pi with auto-connect enabled:
```bash
pi --whatsapp-ng-online
```

### Headless services and switchback

The renamed `scripts/install-whatsapp-ng-service.sh` targets this maintained source, not upstream. It remains an unqualified installer; inspect it and finish explicit state migration before enabling a service. Scripts/systemd templates require a source checkout and are not in the candidate tarball. The qualified Linux CLI/RPC container scope does not certify these installers or systemd deployment.

An existing installation may still use the legacy service name. Check it before switching; these commands are manual instructions, not an automatic service migration:

```bash
systemctl --user status whatsapp-pi.service
# Stop/disable the legacy service before migrating or enabling the new one:
systemctl --user disable --now whatsapp-pi.service
```

To switch back, stop this candidate and any same-profile processes first, then restore only the previously recorded package/source configuration. Preserve auth and the new archive; do not select Logoff or delete storage to change package names. Older code/old recents will omit post-migration records from its view. This is not a lossless data downgrade, and there is no automatic rollback.

## Development / Testing

For operator-led live testing, use the [prerelease acceptance walkthrough](tests/manual/prerelease-acceptance.md). It separates automated evidence, small approved live batches, platform checks and final-package verification.

The source repository is [jagaliano/whatsapp-ng](https://github.com/jagaliano/whatsapp-ng). Use Node 26.x and Pi 1.4.0. Source checks have run on macOS; earlier Linux package tests used Pi 1.3.0 and do not establish support for the updated package. Windows remains unverified.

**Install dependencies:**
```bash
git clone https://github.com/jagaliano/whatsapp-ng.git
cd whatsapp-ng
git checkout chore/fork-release-readiness
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
```

**Run the declared checks:**

```bash
npm test
npm run lint
npm run typecheck
```

**Run the extension:**

**Linux/macOS:**
```bash
pi -e whatsapp-ng.ts
```

**Windows (PowerShell):**
```powershell
./scripts/launch-pi.ps1
```

For verbose mode (shows Baileys trace logs and audio timing logs for debugging):
```bash
pi -e whatsapp-ng.ts --verbose
```

To test startup auto-connect locally after you have already paired WhatsApp:
```bash
pi -e whatsapp-ng.ts --whatsapp-ng-online
```

## How It Works

- Pi processes **incoming** messages only from allowed contacts or allowed groups.
- **Recents** is history browser, not trigger.
- **Send Message** and `send_wa_message` are outbound only.
- If you message yourself, WhatsApp may show sent/read ticks, but that does not guarantee Pi will treat it as a trigger.

### Trusted Chats and Reply Routing

All allowed chats share the **same Pi model context**. Allow only mutually trusted people/groups; correct reply routing is not conversation privacy isolation.

Incoming prompts include an opaque request marker. It identifies an exact extension-submitted input in a bounded, memory-only registry; it is not a routing command. Pi's normal user-input policies still run. Ownership activates only when matching content is consumed, not when a chat message arrives.

Automatic replies wait until tool results are available. They never reuse a stale WhatsApp destination for terminal-only work. Combined inputs from different chats, unknown input, or policy/runtime-transformed content (including changed image bytes) fail closed: an agent must use an explicit known recipient rather than guess. Verified PN/LID aliases do not replace the original transport address of a reply.

An admitted batch and its pending preparation retain an account/auth scope and session generation. Account changes, logout or explicit stop discard stale unsubmitted work rather than submitting it through a new account. Same-account reconnects preserve admitted batch work; mapping results and callbacks from obsolete sockets are ignored. These guards do not recall a send that has already started.

Every eligible batch item is considered. History/append events and request-ID-bearing resends do not trigger ordinary agent work. A delayed normal `notify` event without a request ID can still trigger work. Replay protection is bounded to 5,000 entries/24 hours, with retained processing outcomes persisted in the selected account archive. Unfinished outcomes become interrupted on restart and are never automatically reissued; eviction ends that protection. There is no durable agent-job replay, and a crash during handoff can lose a request. Retry manually by sending a fresh WhatsApp message, not by automatically resending an uncertain outbound send.

Ordinary incoming text ending in `π` is accepted. The legacy branding filter applies only to own-direction messages; registered outgoing IDs provide additional echo protection.

Full message keys and permitted raw content are cached in memory for at most 500 messages/24 hours, or earlier protocol expiry. Reactions require an unambiguous retained target; optional `fromMe`/`participant` hints disambiguate stored keys. Missing targets return an error rather than inventing a group participant or message direction. View-once payloads are excluded from this new cache; these limits do not erase existing Pi transcripts, logs, or downloaded media.

A successful socket send means **accepted**, not delivered/read by the recipient. An undefined result or transport failure after transmission starts returns `delivery: "unknown"` with the stable message ID when available. Do not resend automatically; the first send may still arrive.

## LLM-Callable Tools

The extension registers the following tools that the Pi agent can call:

| Tool | Direction | Description |
| --- | --- | --- |
| `send_wa_message` | outbound | Send text to a known recipient, or omit `jid` for the uniquely owned current conversation. Idle manual calls retain last-conversation/operator fallback. |
| `send_wa_media` | outbound | Explicit local document/image/audio/voice-note/video sending with validation, bounded conversion and optional native quote. |
| `send_reaction` | outbound | React to a retained, unambiguous message key; optional `fromMe`/`participant` hints and compound emoji are supported. |
| `list_wa_conversations` | read-only | List recent conversations from the local recents store. Supports `onlyIncoming`, `onlyAllowed`, and `limit`. |
| `get_wa_conversation_history` | read-only | Get the most recent messages with a given `senderNumber` (accepts `+E164`, raw digits, or a JID). Supports `limit`. |
| `check_wa_new_messages` | read-only | List conversations whose most recent message is incoming (i.e. waiting for a reply). Supports `sinceTimestamp` (ms epoch) and local `scope`. |
| `request_wa_history` | explicit network / local status | `{mode:"request",jid,count?}` requests at most 100 older messages for an allowed/bound chat; `{mode:"status",requestId?}` reads retained status locally. |
| `configure_wa_stt` | configuration | Set `sttEndpoint`, `sttModel` and `sttEnv` for remote audio transcription. Pass the key's environment-variable name, never its value. |

The three inbox read tools use the selected local archive projection. They never fetch network history or mark messages as read. Defaults remain 20 items; `scope` selects a known local profile/account or `legacy-unassigned`. `list_wa_conversations` returns available scope IDs. `get_wa_conversation_history` also accepts an opaque `cursor` and returns `nextCursor` for older local pages, including equal-timestamp records.

## Sending Files and Native Replies

`send_wa_media` requires `path` and `type` (`document`, `image`, `audio`, or `video`). It accepts optional `jid`, `caption`, `voiceNote` (audio only), and `quote`. Like text sends, an omitted recipient requires unique current WhatsApp ownership during an agent run.

```json
{"path":"reports/example.pdf","type":"document","jid":"15550000001@s.whatsapp.net","caption":"Requested report"}
```

- Files must resolve under the current Pi workspace (`ctx.cwd`) or the extension's `whatsapp-medias` directory. Symlink escapes, ancestor replacement, URLs/base64, empty/nonregular files, credential/auth folders, `.env*`, private-key names and detected private-key headers are rejected. Opened descriptor identity, non-symlink ancestry and file stability are checked before and after copying; nonblocking open rejects FIFO replacement without wedging a worker. This is an egress policy, not an OS sandbox or general secret scanner.
- The application limit is **25 MiB**, checked on the source, bounded snapshot copy and converted output. Only owned temporary snapshots are removed; originals are never edited or deleted. Local paths inside Baileys' payload refer to these snapshots and are streamed from disk. Tool results contain metadata, not attachment bytes.
- Documents include PDF, XLSX, Markdown and other regular files with filename/MIME metadata (unknown extensions use `application/octet-stream`). Images support JPEG and PNG signatures.
- Images, audio and video require FFmpeg for bounded thumbnail generation or codec inspection, even when payload conversion is unnecessary. Resolution uses `FFMPEG_PATH`, otherwise the system executable on `PATH`. No FFmpeg binary, bundled fallback or FFmpeg downloader is supplied; users install and maintain their own build.
- MP3, AAC-in-MP4 and Ogg/Opus audio send directly when compatible. WAV/FLAC and other supported binary audio containers convert to AAC/M4A. `voiceNote: true` sends Ogg/Opus with the PTT flag, converting when necessary. Audio captions are rejected instead of silently dropped.
- Compatible MP4/H.264/yuv420p with optional AAC audio sends directly. Other supported MP4/MOV, AVI or Matroska/WebM video converts to MP4/H.264/AAC. Text playlists and network input protocols are not accepted. Codec support depends on the installed FFmpeg build.
- Probe, conversion and thumbnail generation share a **60-second budget**. Duration and JPEG thumbnails are prepared explicitly so Baileys does not recreate plaintext in a shared temp directory or launch an unbounded thumbnail child. PTT waveform data is explicitly unavailable instead of invoking Baileys' unowned audio decoder. Abort/timeout terminates the child, escalates to a forced kill if necessary, and waits for child exit before cleanup. Baileys receives `mediaUploadTimeoutMs: 60000`; it has no caller abort signal.
- Before transmission starts, abort prevents sending. After it starts, caller abort/timeout returns `delivery: "unknown"` without blind retry. The snapshot remains owned until the underlying consumer settles; late acceptance updates the in-memory outcome and records one successful recent entry. Already-started sends cannot be recalled.
- Mentioning a path in ordinary assistant text never triggers an upload. There is no TTS, GIF/sticker or album support in this change.

Both `send_wa_message` and `send_wa_media` accept an optional native quote:

```json
{"message":"Reply to the selected message","jid":"15550000001@s.whatsapp.net","quote":{"messageId":"OBSERVED_MESSAGE_ID","conversationJid":"15550000001@s.whatsapp.net","fromMe":false}}
```

Own-message group quotes whose observed author is a LID are explicitly unavailable with Baileys rc14, which would otherwise rewrite that author to the account's phone JID. Incoming LID-author quotes and ordinary incoming/own PN quotes have native serialization coverage.

Quote targets must be real, unambiguous messages retained in the current account's canonical chat. Add `participant` when needed for a group target. The original transport key is preserved, and configured send-number overrides cannot redirect a quote to another chat. Missing, deleted, unsupported or evicted targets fail explicitly; a requested quote is never silently omitted.

The history/detail/reply UI sends native quotes and displays unavailable targets. Full raw retry payloads remain memory-only within **500 messages/24 hours**, or earlier protocol expiry. Supported text/media quotes can instead use a retained secret-free projection after restart. Legacy recents, deleted/expired records and another account's local history view cannot manufacture a quote.

## Local Archive, History and Lifecycle

New ignored live senders retain at most 20 memory-only summary previews for 24 hours, scoped to the current account. Their content is not admitted to the new durable/quotable archive or raw retry cache.

The authoritative archive is under `~/.pi/agent/extensions/whatsapp-ng/archive/`. Each relative auth-directory profile has a random storage-profile ID and a last-verified account marker. Offline reads use that known account without a socket. A different login opens a separate partition before ingestion; an empty new account never falls back to someone else's legacy history. `/whatsapp > Local history scope` selects another known account or the legacy view locally without changing the live ingestion account. Recents remain available while disconnected.

Legacy `recents/recents.json` is not attributed to the next login. A one-time read-only `legacy-unassigned` import preserves existing labels/time/direction and an untouched `recents.json.pre-archive-backup`. The original recents file is not rewritten by the archive-backed projection. Legacy missing keys/content stay unknown and cannot supply quote/retry payloads.

New records preserve exact visible text, emoji/newlines, observed keys, millisecond timestamps, quote links and lifecycle metadata. Persistent quote projections allow only original visible text/caption/filename/MIME and message identity. Media keys, download/direct URLs, raw context, thumbnails, attachment bytes, auth and app-state secrets are excluded. View-once content is excluded, and disappearing expiry wins over archive retention. This does not erase existing Pi transcripts, logs or downloaded files.

Retention is **1,000 records per conversation, 30 days maximum age and 100 MiB per account partition including control metadata**. Serialized mutations use a single writer and same-directory atomic replacement, with owner-only files/backups (`0600`) and directories (`0700`) where supported. Concurrent writers for one partition are unsupported and rejected with a lock. Stale locks are reclaimed only when the recorded PID no longer exists. Corrupt/future-version stores and filesystem failures produce explicit degraded state, never an automatic reset. Stop other writers, preserve originals and investigate permissions/schema before recovery. Do not delete or replace an archive while a writer is running.

History network work requires an explicit `request_wa_history` call, a connected allowed/bound chat and a complete retained oldest-message anchor. Each request asks for 1–100 messages, with one active request per chat. Results start pending; a returned request ID is not returned history. Imported messages never trigger Pi prompts, document parsing, transcription or attachment downloads. Broader initial history sync is opt-in via `--whatsapp-history-full`; the default remains `syncFullHistory: false`, and authorization/retention limits still apply.

Correlation uses the installed Baileys fields: `peerDataRequestSessionId`, `syncType`, `progress`, `chunkOrder`, and upsert `requestId`. Native rc14 deliberately omits `isLatest` for on-demand chunks. Only an exact matching peer request ID with on-demand progress `100` completes that request. Global `messaging-history.status`, even explicit completion, has no request ID and cannot complete every pending request. After 60 seconds without correlated completion, status becomes unknown; disconnect/restart interrupts pending work without resubmission. Retained status lasts at most 24 hours/100 requests. Late authorized chunks may still import, but cannot bypass expiry, admission floors or account guards. WhatsApp/device availability can prevent full history retrieval.

Receipts, edits, revokes, local removals and participant reactions update the same records without ordinary agent prompts. Send acceptance is separate from server/delivery/read/playback observations. Group receipts remain per participant; missing/privacy-suppressed receipts stay unknown. The detail view and local tools expose observed status, edited/deleted markers, reactions and incomplete knowledge. Before-base updates are bounded to 500 entries/24 hours; losing required events is reported as incomplete rather than promising unlimited convergence.

Up to 5,000 content-free tombstones protect deletions for the accepted history window plus a day. Before protective metadata is evicted, monotonic conversation admission floors (or a conservative account-wide floor under byte pressure) reject covered older content on every ingest path, including delayed live notifications. Local chat deletion advances its floor to the observation time. Increasing retention does not lower a floor. Pressure can therefore reduce available history; it does not silently allow deleted content to resurrect. No outbound edit/delete/admin tool is added.

**Rollback:** stop the extension, preserve the new archive, and restore the old code and preserved old recents snapshot only after explicitly acknowledging that old code will not display post-migration messages. This is not a lossless downgrade and there is no automatic downgrade exporter. Leave the new archive untouched for recovery/re-upgrade. No real rollback or auth migration is performed by automated tests.

## WhatsApp Numbers and JIDs

- Contacts use phone format in UI: `+5511999999999`
- Internally, contacts map to JIDs like `5511999999999@s.whatsapp.net`
- Groups use JIDs like `120363012345@g.us`
- Recents may show normalized values from WhatsApp, so use **Print Contact** / **Print Group JID** and aliases to avoid confusion.

## Commands

- `/whatsapp` - Open the WhatsApp management menu

### Main Menu Options
- **Connect / Reconnect WhatsApp** - Start WhatsApp connection using saved credentials when available; QR code appears only if pairing is required
- **Disconnect WhatsApp** - Stop WhatsApp connection
- **Logoff (Delete Session)** - Reset the current authentication profile; configuration and conversation archives remain
- **Recents** - Open recent conversations, view history, and reply
- **Allowed Contacts** - Manage contacts that can interact with Pi
- **Allowed Groups** - Manage WhatsApp groups that can interact with Pi

### Allowed Contacts Management
- **Add Contact** - Add a new contact to the allowed contacts list (format: +5511999999999)
- **Select a contact** - Open a submenu with **History**, **Send Message**, **Print Contact**, **Add Alias**, **Remove Alias**, **Add Number**, **Remove Number**, **Remove Contact**, and **Back**
- **Back** - Return to main menu

### Allowed Groups Management
- **Add Group** - Add a WhatsApp group JID to the allowed groups list (format: 120363012345@g.us)
- **Select a group** - Open a submenu with **History**, **Send Message**, **Print Group JID**, **Add Alias**, **Remove Alias**, **Remove Group**, and **Back**

### Recents Management
- **History** - Open full message history for that conversation
- **Send Message** - Send a new message without Pi suffix
- **Reply** - Open message detail, then press `R` to reply
- **Allow Contact / Allow Group** - Move a recent sender into the appropriate allowed list
- **Remove Alias** - Clear saved alias for that sender
- **Back** - Return to main menu

### WhatsApp Chat Commands
Send these commands directly in WhatsApp to control the agent session:
- **`/compact`** - Compact the current Pi session context
- **`/abort`** - Abort the current Pi agent operation

## Project Structure

```
src/
├── services/        # Core services (WhatsApp, Session, Recents, Media)
└── ui/              # Menu handlers and TUI views

tests/
└── unit/            # Unit tests
```

## Support and attribution

Report ordinary non-sensitive bugs to [whatsapp-ng issues](https://github.com/jagaliano/whatsapp-ng/issues). Use [private vulnerability reporting](SECURITY.md) for security concerns. Support is owner-led and best effort, with no SLA. Do not attach real credentials or private conversation data.

History availability and delivery/read receipts depend on WhatsApp, device availability and privacy settings. A successful socket send does not prove recipient delivery or rendering. The unofficial transport can break when WhatsApp changes its protocol or account policies.

Licensed under [MIT](LICENSE), retaining attribution to Rapha Castelloes and fork contributions by José Antonio Galiano Sandoval. See [LICENSING.md](LICENSING.md) for the accepted upstream licensing basis. This does not imply upstream maintainer endorsement.

## Specifications and decision records

See the [development records](specs/README.md) for design decisions, migration details and historical validation results. Those records describe the software versions tested at the time.

## Notes

- `--whatsapp-ng-online` auto-connects when credentials already exist.
- `--whatsapp-group <jid>` binds Pi to one WhatsApp group.
- FFmpeg and PDF/OCR tools run locally. Audio uses local Whisper.cpp or the configured remote STT service; images can be forwarded to Pi's vision model. Migrating from the old data directory requires the explicit full-state move described above.
- Normalized history is under `~/.pi/agent/extensions/whatsapp-ng/archive/`; the old recents file is a legacy migration input, not a parallel authority. See the archive section above.
- Session state, allow lists, and startup reconnects are persisted locally.
