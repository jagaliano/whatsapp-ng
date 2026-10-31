# Operating reference

Practical details for [whatsapp-ng](../README.md): speech configuration, sending files, history, diagnostics and migration. For setup, start with the [README](../README.md#install-and-connect).

## Speech configuration

FFmpeg converts incoming audio to 16 kHz mono WAV before transcription. Remote STT takes precedence when configured; otherwise the extension uses local transcription.

### Local transcription

| Setting | Meaning |
| --- | --- |
| `WHISPER_CLI_PATH` | Explicit Whisper.cpp-compatible executable. Otherwise discovery searches `PATH`. |
| `WHISPER_MODEL_PATH` | Existing GGML model file. An invalid explicit path fails without downloading a substitute. |
| `WHISPER_LANGUAGE` | Local recognition language; defaults to `auto`. |
| `CRISPASR_CLI_PATH` | Takes precedence over `WHISPER_CLI_PATH` when nonempty. |
| `CRISPASR_MODEL_PATH`, `CRISPASR_LANGUAGE` | Take precedence over the corresponding `WHISPER_*` settings for local backends. |
| `FFMPEG_PATH` | Explicit FFmpeg executable; otherwise uses `PATH`. |

Without an explicit CLI path, discovery searches all `PATH` directories for `whisper-cli` before `crispasr`. An explicit path is authoritative even if invalid. Set variables in the environment that launches Pi and restart it; `/reload` cannot import changed shell exports.

Without a model override, missing `ggml-base.bin` downloads into `whisper/models/` under the extension data root. The **CLI path** uses private temporary files and atomic publication for downloads. Local CLI preparation and transcription share a 10-minute budget; cancellation/session changes abort preparation and terminate the child before scratch cleanup. Both local backends run CPU-only.

The included `whisper-cpp-node` addon supplies an alternative native backend on compatible **macOS/Windows** builds, not Linux, and still needs a model. It is used only when no CLI is available and neither explicit CLI path is set. Its model downloader writes directly to the final file and lacks the CLI's atomic-publication, cancellation and timeout guarantees; interruption can leave a partial model. Its in-process transcription also lacks the CLI child-termination guarantee. Supply an existing model to avoid this downloader.

See [CrispASR setup](crispasr.md) for CLI/server configuration, language behavior and its licensing requirements.

### Remote speech endpoints

`configure_wa_stt` requires a current verified local terminal/RPC request or the configured transport-verified owner, not merely an allowed chat. Set `sttEndpoint`, `sttModel` and credential-variable **name** `sttEnv`; omitted fields are preserved and authorized `{}` selects local transcription. Owner/account/session changes, allow-list revocation or cancellation invalidate pending commits; failed writes preserve active settings and the prior file. Vision/Pi credentials are never substituted.

The client appends `/audio/transcriptions` to the base URL and posts multipart `file`, `model` and `response_format=json`, expecting a JSON `text` string. Optional `sttLanguage` sends a language code; unset/`auto` omits it for server detection. `null` or an empty string clears it without changing local language settings. Confirm that your chosen endpoint and model implement this API, not only OpenAI-compatible chat.

The remote STT client never initializes a local Whisper backend or downloads a model. An explicitly managed native server is a separate process and may automatically fetch auxiliary models/lexicons even with an existing primary-model path; see the [native download warning](crispasr.md#optional-managed-startup). Invalid configuration, missing credentials and provider errors fail without a backend fallback or automatic upload retry. Limits are 25 MiB input/upload, 1 MiB response, 60 seconds for conversion and 60 seconds for the remote request. Providers may impose stricter limits.

Both STT and TTS require HTTPS, except loopback HTTP (`127.0.0.0/8`, `[::1]`, `localhost`). Deliberately setting `WHATSAPP_NG_ALLOW_PLAIN_HTTP=1` in Pi's launch environment also permits non-loopback HTTP. **This sends audio/text and any Bearer key unencrypted and applies to both speech clients process-wide.** URL credentials, query strings, fragments and redirects remain forbidden.

Removing that opt-in makes saved LAN HTTP settings invalid without deleting them. Invalid saved TTS settings pause automatic replies, including text-only chats. Restore the intended environment and restart Pi to recover without erasing preferences. Voice Reset instead clears the backend, consent and chat overrides; it is not an endpoint-only repair.

Account/session changes prevent stale uploads before sending and best-effort abort in-flight requests. Already-uploaded content cannot be recalled. Private audio scratch files are cleaned on normal success/error, not abrupt process death; existing saved media is not deleted.

### Optional managed speech servers

`CRISPASR_STT_CMD` and `CRISPASR_TTS_CMD` optionally declare shell-free JSON launch descriptors in Pi's trusted process environment, not chat-editable settings. See the [descriptor format and examples](crispasr.md#optional-managed-startup). Unset/blank variables leave that service unmanaged.

- **Selection:** connected WhatsApp starts only the matching numeric-loopback endpoint/API model/protocol. Roles have separate ports/lifetimes; chat settings cannot retarget trusted commands. Startup defaults to 180 seconds, maximum 300; request budgets are unchanged. Preparing TTS while disabled grants no consent or inference request. Native warmup follows launch flags (`--no-warmup` in the guide).
- **Proof:** each role holds an exclusive lease under `managed-speech/`. Every admission requires a live owned child, OS listener-PID proof and matching health/backend/loaded-model metadata. Foreign listeners, unknown locks and mismatches fail closed without adoption, killing or provider fallback.
- **Failure:** transient startup probes wait within budget; transient request admission refuses only that request, without upload/retry/restart. Confirmed ownership/model/backend loss retires the role. Startup failures remain failed across messages/settings toggles; fix the cause, then Off/Connect or use a fresh runtime. Malformed descriptors refuse numeric-loopback selections for that role; see the guide's recovery rules. Environment changes require restarting Pi, not `/reload`.
- **Lifecycle:** Off, disconnect, committed session replacement, reload/shutdown and relevant backend changes retire owned processes and requests. `/stop` or a canceled switch retains the connected server. Replacement/shutdown fences new startup before draining. Parent IPC loss/SIGHUP triggers a watchdog: three seconds TERM, two KILL, owned non-daemonized process group only.
- **Platforms:** macOS uses `lsof`, Linux procfs; Windows management is refused without changing manually operated endpoints. Daemonizing wrappers, simultaneous watchdog/OS failure and damaged locks need operator inspection. This is cooperative ownership, not a hostile-same-user sandbox or all-platform/model qualification.

### Speech replies

Use terminal `/whatsapp` → **Voice** to choose the destination, voice, speed, default mode and chat overrides. Enabling speech requires destination-specific confirmation; groups require separate opt-in. STT configuration does not grant TTS consent. Changing endpoint/protocol invalidates prior approval. Choosing text-only everywhere revokes speech approval and disables spoken overrides.

`configure_wa_tts` accepts verified local requests or the configured verified owner. It preserves omitted fields, clears `null`/blank fields, and `{}` selects Edge while preserving Edge preferences and reply modes. It never grants consent, enables speech or synthesizes immediately.

| Remote TTS field | Meaning |
| --- | --- |
| `ttsEndpoint` | Complete speech endpoint URL, subject to the transport policy above. |
| `ttsModel` | Exact provider model. |
| `ttsEnv` | API-key environment-variable name. |
| `ttsVoice` | Provider voice identifier/reference, required unless server-default voice is explicitly selected. |
| `ttsUseServerVoice` | `true` omits `voice` for a server supporting a built-in/default voice; requires explicit `openai-compatible` protocol and no named voice. |
| `ttsProtocol` | `fish` or `openai-compatible`. |
| `ttsFormat` | `mp3`, `wav` or `opus`. |
| `ttsSpeed` | Speaking speed from 0.5 to 2. |

Fish requires an existing voice reference and a supported model header; no paid default voice is assumed. OpenAI-compatible/OpenRouter endpoints must support the requested speech API/model. Edge uses separate `edgeVoice`, `edgeLocale` and `edgeSpeed` preferences; its default is `en-US-AndrewMultilingualNeural` / `en-US`. It is an unofficial online service with no availability guarantee; failures do not silently switch providers.

Server-default voice is an explicit configuration choice, not a fallback for an invalid/missing voice. Selecting it clears an inherited named voice; selecting a named voice clears the inherited default choice. Changing endpoint/effective provider or model requires selecting server default again. `{}` resets it with the other remote fields. The server chooses the actual voice and language; no cloning-consent field is added, and destination/group speech approval remains separate. See the [Chatterbox built-in voice example](crispasr.md#built-in-server-voice).

Preparation permits one active job, five pending, 2,000 spoken Unicode characters, 8 MiB audio and a 180-second synthesis budget including queue wait. This is an upper bound, not a guarantee that maximum-length replies complete. Edge retains separate 60-second connection/inactivity limits; output uses the separately bounded FFmpeg/Ogg-Opus voice-note path. STT deadlines are unchanged.

Speech uses a plain-text copy; displayed/saved answers stay unchanged:
- Remove balanced emphasis, headings, bullets and quote escapes. Ordinary quotes/approximation tildes remain; heading candidates above 1,024 characters stay literal.
- Voice/audio Mirror retains complete text if a Markdown link would lose its HTTP(S) destination. Voice + text may speak labels only after the full text is accepted; failed/unknown text is not retried or omitted. URL-shaped labels keep their addresses.
- Inline labels up to 80 characters (`config.json`, `/whatsapp`, `--verbose`, `Voice settings`) are eligible. Command-like multiword snippets, fences, tables, ambiguous/unclosed code and overlong answers retain complete text.
- Bound input before parsing and cleaned speech to 2,000 characters. No summarization, truncation, fetching or extra model call.

A definite pre-transmission voice failure can fall back to the full text once. Voice + text does not resend its text. Unknown delivery never triggers another voice send or speculative text fallback. Already-issued uploads cannot be recalled; their snapshots remain owned until settlement.

The preview shows the recipient and fixed public phrase before confirmation. It sends one voice note, not a conversation excerpt, and does not enable ongoing speech. Pausing a chat invalidates queued automatic replies; re-enabling does not replay them. Malformed saved preferences require explicit repair rather than silent reset.

## Files and native replies

`send_wa_media` requires a local `path` and `type` (`document`, `image`, `audio` or `video`). Optional fields are `jid`, `caption`, `voiceNote` (audio only) and `quote`.

```json
{"path":"reports/example.pdf","type":"document","jid":"15550000001@s.whatsapp.net","caption":"Requested report"}
```

- Files must resolve under Pi's current workspace or the extension's `whatsapp-medias` directory. URLs/base64, symlink escapes, nonregular/empty files and credential-like paths are rejected. This upload policy is not an OS sandbox or a general secret scanner.
- The source, private snapshot and converted output must each fit the 25 MiB budget. Only owned temporary snapshots are removed; user originals remain untouched.
- Documents preserve filename/MIME metadata, with `application/octet-stream` for unknown extensions. Images support JPEG and PNG signatures.
- Images/audio/video require system FFmpeg for preparation or inspection. Compatible MP3, AAC-in-MP4 and Ogg/Opus audio send directly; other supported audio converts to AAC/M4A. Voice notes use Ogg/Opus with the PTT flag. Audio captions are rejected.
- Compatible MP4/H.264/yuv420p with optional AAC audio sends directly. Other supported MP4/MOV, AVI and Matroska/WebM containers convert to MP4/H.264/AAC. Codec availability depends on your FFmpeg build. Text playlists and network inputs are rejected.
- Probe, conversion and thumbnails share a 60-second budget. Cancellation terminates and awaits owned subprocesses before cleanup. Baileys receives a 60-second media-upload timeout but has no caller abort signal.

Before transmission, an abort prevents sending. After transmission starts, failure/abort can return `delivery: "unknown"`: it may still arrive, so do not automatically retry. Snapshots remain alive until the underlying consumer settles. Mentioning a path in an answer never uploads it.

Text and media support native quotes:

```json
{"message":"Reply to the selected message","jid":"15550000001@s.whatsapp.net","quote":{"messageId":"OBSERVED_MESSAGE_ID","conversationJid":"15550000001@s.whatsapp.net","fromMe":false}}
```

Targets must be retained, unambiguous messages from the same account/chat. Supply the observed group `participant` when needed. Missing, expired, deleted, unsupported or cross-chat targets fail rather than silently dropping the quote. Own-message group quotes with LID authors are unavailable with Baileys rc14; it would rewrite the author incorrectly.

Raw retry payloads remain memory-only for at most 500 messages/24 hours or earlier protocol expiry. Supported secret-free quote projections can survive restart. Legacy history and another account's records cannot manufacture quote payloads.

## Routing and optional output

All allowed chats share Pi's context. Replies use the uniquely owned consumed input, never merely the latest arriving chat. Ambiguous mixed-chat, unknown or transformed input fails closed; an explicit known recipient is required instead of guessing. Verified PN/LID aliases do not replace a reply's original transport address.

Automatic replies wait for tool results. Attachments do not suppress the final explanation by default; **Replies → Reply delivery** also offers legacy **Caption/tool only** behavior. An accepted, in-flight or uncertain explicit text send to the owning chat suppresses an automatic duplicate. Progress updates do not.

While the owning automatic final remains eligible, `send_wa_message` refuses owning-chat text (including explicit JIDs and native quotes) if the captured approved policy requests Voice, Voice + text or verified audio-Mirror. This early zero-attempt error directs the model to its normal final answer without synthesis, send coverage or outgoing history. An accepted, in-flight or uncertain attachment that already covers the final in legacy caption/tool-only mode still permits an explicit text explanation; otherwise that explanation would be lost.

Canonical aliases, gateway destinations and the actual transport recipient are rechecked. A late pre-transmission denial uses the sender's existing currentness error, may count a preflight attempt and may retain a failed archive intent; it is not the early zero-attempt guidance error. Other-chat sends remain available, but in protected frames also require the owning input's admission to stay current through preflight. Captured speech policy stays stable; consent/admission revocation still fences delivery. Terminal/idle/manual replies, text-only policies, non-audio Mirror and groups without speech opt-in remain available. Select Text mode for intentional model-issued same-chat quoted text. Normal speech-to-text fallback and unknown-delivery protections are unchanged.

Optional reporting is off by default:

- **Final stats:** elapsed time and observed tool success/failure counts, without arguments, results, reasoning or costs.
- **File paths:** up to 20 safe workspace-relative labels observed in successful `write`/`edit` calls. This is not a Git diff or complete change inventory.
- **Interim text:** completed tool-bearing assistant messages, at most four messages of 4 KiB each, not token deltas.
- **Live activity:** one coalesced tool-name/status message per owned input, without tool-result bodies.

Terminal **Replies → Optional outputs** separately enables approved tools' inline image results (up to four images/25 MiB aggregate per input) or future positively identified terminal/RPC final answers to the consented private owner. No arbitrary path discovery, screenshots or thinking streams are forwarded. Enabling midway never exports existing work or history.

Allowed groups default to real WhatsApp mentions or replies to the authenticated account. Displayed `@number` text alone is not a mention. Other trigger modes and optional preceding text context are selected in terminal **Groups** settings. Context is off by default; when enabled it holds at most 20 live text messages per group, 2,000 characters each, for 30 minutes across at most 50 groups. Included text enters normal Pi context; it cannot grant owner authority.

## History and storage

The data root is `~/.pi/agent/extensions/whatsapp-ng/`; archives are under `archive/`. Offline scope selection uses a stored profile/account marker. A different authenticated account selects a different partition. **Advanced → Local history scope** changes only the local view, not the live ingestion account.

Legacy recents import once into read-only `legacy-unassigned`, preserving an untouched `recents.json.pre-archive-backup`. Missing message keys/content remain unknown. Ignored live senders retain only up to 20 memory-only summaries for 24 hours, not durable quote/retry content.

Archive retention is 1,000 records per conversation, 30 days and 100 MiB per account partition including control metadata. Stored projections preserve visible text, observed identities, safe media metadata, quote links and lifecycle state, excluding media keys, download URLs, raw context, thumbnails, attachment bytes and auth material. View-once content is excluded; disappearing expiry takes precedence. These rules do not erase Pi transcripts, old logs or downloads.

Writes are serialized and atomically replaced with private files/directories. A writer lock rejects concurrent writers; archive stale-lock reclamation requires the recorded PID to be absent. Corrupt/future-version stores and filesystem failures degrade explicitly without resetting data. Preserve originals and investigate before recovery; never replace an archive while a writer is running.

Local inbox reads never access the socket and support known local `scope` IDs. `list_wa_conversations` and `get_wa_conversation_history` default to, and cap at, 20 entries; `check_wa_new_messages` returns all matching conversations. History pagination uses opaque `cursor` / `nextCursor` values. Explicit network backfill requires an allowed connected chat and a complete oldest-message anchor. Requests ask for 1–100 messages, one active request per chat. A request ID means pending work, not returned history.

Only an exactly correlated on-demand completion finishes a request. After 60 seconds without completion, status becomes unknown; disconnect/restart interrupts requests without resubmitting them. Status retention is 24 hours/100 requests. Authorized late chunks may import, but cannot bypass account, expiry or deletion protections. `--whatsapp-history-full` opts into broader initial sync; default sync remains limited. Imported messages never trigger Pi work or media processing.

Receipts, edits, revokes, removals and reactions update the same records. Acceptance is distinct from observed delivery/read/playback; missing receipts remain unknown and group receipts remain per participant. Before-base updates are bounded to 500 entries/24 hours, with incomplete knowledge reported after eviction.

Content-free deletion markers and persisted admission floors prevent covered deleted content from reappearing through delayed notifications/backfill. Pressure may reduce available history rather than silently remove that protection. Increasing retention never lowers a floor. No outbound edit/delete/admin tools are provided.

Replay protection is bounded to 5,000 entries/24 hours. Interrupted agent handoffs are not replayed on restart and can lose a request; retry manually with a fresh incoming message, not by resending uncertain outbound work. Raw-cache/archive limits are not durable job guarantees.

## PDF previews and OCR

PDF previews use LiteParse and its matching native package, loaded only when needed. Tesseract plus the required language data enables local OCR; PDFs with readable text do not need it. Parser failures retain the saved document and show a fallback notice. The 60-second deadline covers parsing, not native initialization.

Check languages with `tesseract --list-langs`. Use `eng`, `spa` or other installed language data as needed. Tesseract accepts images; LiteParse renders PDF pages before OCR. Neither path requires an OCR server.

To run the generated-image and scanned-PDF checks from a source checkout:

```bash
npm test -- tests/unit/tesseract.contract.test.ts tests/unit/incoming-pdf.contract.test.ts --maxWorkers=2
```

Tool-dependent tests can skip when binaries are absent; inspect the result rather than treating a skip as a successful OCR check.

## Startup connection preference

Terminal **Connection → Auto-connect on startup** persists a profile-wide `autoConnect` boolean in `~/.pi/agent/extensions/whatsapp-ng/config.json`, independently of connection status and Pi session entries. Missing, malformed or unreadable values do not enable automatic connection; only `true` does. Unrelated saves preserve malformed values until an explicit preference selection replaces them.

The preference applies to every **TUI/RPC session using that profile**, across workspaces, including reload and new sessions. Print/JSON sessions do not implicitly connect; an explicit `--whatsapp-ng-online` still requests connection in any mode, even with a saved `false`. Saved credentials are required. Without them, startup asks for manual Connect/QR pairing; it does not reset rejected credentials or start pairing. An occupied or unverified stale transport lock makes preference-based startup skip with one info notice and no retries. Explicit flag startup retains its existing retry policy.

Saving a preference does not immediately connect/disconnect or change an already-started connection attempt; disabling it is not Turn WhatsApp off. Explicit Off takes precedence through reload/session replacement in the **current process only**, not other Pi processes. A fresh TUI/RPC process follows the shared preference; disable it and omit the online flag to start disconnected. The setting is terminal/RPC-only and is not a new phone/model configuration tool. It does not enable speech, polls or unknown chats.

Cooperating writers and startup temp cleanup use private `config.json.lock`, waiting about two seconds before refusing an occupied lock:
- Refresh on-disk `autoConnect` during initialization and under the write lock. Unrelated/stale-instance saves preserve newer choices; stale explicit selections are rejected. Update memory only after atomic write success.
- This protects auto-connect, not every setting or noncooperating/manual writer. Never steal/delete a lock on timeout.
- Retained locks block writes/temp cleanup, not readable allow-list/owner/settings loading or auth metadata reconciliation; startup reports the lock distinctly.
- Failed preference re-reads disable auto-connect without dropping loaded reply settings or overwriting invalid data. A successful later read restores the preference. Release errors neither hide the original failure nor misreport a completed commit.
- After a crash, inspect ownership before explicit recovery; never remove another process's lock or active temp files.

## Off and diagnostics

**Connection → Turn WhatsApp off** and owner `/off` require confirmation. They stop shared Pi work, withdraw known queued WhatsApp input, cancel pending speech/reporting/forwarding and close transport without deleting login/history/preferences. Local history/configuration/status remain available; network history requests are blocked. Off survives session replacement/reload in that process. Terminal Connect restores previously active outbound tools without replaying old work; a fresh process follows its saved auto-connect preference and startup flags.

Already-issued effects cannot be recalled. Off does not purge unrelated Pi follow-ups or prior context. Numbered phone menus expire after five minutes, bind the verified owner/chat/session, and require quoted numeric replies in groups. Native polls require explicit experimental opt-in. Stop/abort does not constitute a durable queue purge.

Diagnostics rotate `whatsapp-ng.runtime.log` at 5 MiB with one `.1` backup. New files are private (`0600`); logs contain extension metadata, not message bodies, transcripts, media, raw errors or protocol-key traces. `--verbose` does not enable Baileys protocol logging. Historical `whatsapp-ng.log` is untouched and may contain older private content. **Advanced → Privacy and logs** explains the policy without reading logs.

## Migration and recovery

Stop **every owning Pi process and service**, not just the WhatsApp connection, before moving an older installation. Preserve its state. Do not run competing clients, copy credentials, or delete auth/history to switch packages.

Disable or remove the old extension/package before starting the new one; do not delete its data. For a Pi-managed installation, check `pi list` and disable the old resource through `pi config`, or remove its exact source with `pi remove <source>`. Check project-local installations too.

With the new package installed and enabled, supply the actual old root explicitly:

```bash
pi --whatsapp-ng-migrate-from "/absolute/path/to/old-data-root"
```

From a source checkout, use its entry instead:

```bash
pi --no-extensions -e ./whatsapp-ng.ts --whatsapp-ng-migrate-from "/absolute/path/to/old-data-root"
```

The new destination must not exist, even empty. Migration checks locks and directory identity, then atomically renames the entire root on the same filesystem. Settings, default/group auth, media, archive identities and relative profile bindings move together; credentials are not copied, merged or regenerated. There is no automatic old-root probing or cross-filesystem copy fallback.

Private migration requests/locks live beside the root. Interrupted moves resume only when directory identity proves the destination is the original source. Unknown metadata, symlinks, runtime locks and destination/log conflicts fail closed. Remove the migration flag after completion. Session replacement/reload does not replay migration; a failed attempt requires a fresh process and explicit recovery if a stale migration lock remains.

Each canonical auth directory has sibling `.transport-lock` and `.auth-profile.json` controls. The transport lease protects cooperating local clients before auth/socket work and through pending credential I/O. Old clients ignoring it, copied profiles and distributed filesystems are outside that protection.

Do not delete locks merely because a PID looks dead. Stop all owners and establish that none remains before explicitly removing a single stale transport lock. Interrupted/malformed profile metadata requires separate investigation of preserved originals, not a reset. Logout resets the current profile and prevents automatic resurrection from old originals; initialized profiles are never merged and group auth never borrows default credentials.

Storage/auth directories use `0700`; config, credentials, controls and new archives use `0600`. Additional Baileys key files can have umask-derived modes inside the private auth directory. Permissions are not encryption.

Switchback requires stopping this instance and restoring the previous package/source configuration deliberately. Preserve the new archive: old code and its old recents snapshot will omit post-migration messages. There is no lossless automatic downgrade/exporter.

### Historical identifiers

Legacy project identifier: `whatsapp-pi`. These names explain links in old design records; they are not installation targets.

| Historical label | Original name/path | Current counterpart |
| --- | --- | --- |
| `<legacy-entrypoint>` | `whatsapp-pi.ts` | `whatsapp-ng.ts` |
| Legacy online flag | `--whatsapp-pi-online` | `--whatsapp-ng-online` |
| `<legacy-current-data-root>` | `~/.pi/agent/extensions/whatsapp-pi` | `~/.pi/agent/extensions/whatsapp-ng` |
| `<legacy-previous-data-root>` | `~/.pi/agent/extension/whatsapp-pi` | Explicit migration source only |
| `<legacy-original-data-root>` | `~/.pi/whatsapp-pi` | Explicit migration source only |

The [licensing record](../LICENSING.md) retains attribution and the accepted license basis; [design records](../specs/README.md) retain dated decisions and validation. They are not additional setup steps.
