# Prerelease acceptance walkthrough

Use this guide with an operator, one independent test contact and, later, an explicitly approved test group. It is a scoped checklist, not exhaustive coverage of every supported feature, client or platform. Phone controls, speech consent/output, group trigger modes and optional projections need their own explicitly budgeted cases; see the current roadmap and operating reference. Calls, communities/admin operations, polls, stickers, GIFs and albums are not promised by this candidate.

**This checklist is not permission to send messages, upload files, change configuration or reset authentication. Approve each live batch first.** No live case below is marked passed merely because it appears here.

## Record the target and results

Record package version, source revision plus working-tree changes, Node/Pi/tool versions, OS, and whether the target is this checkout or an installed local tarball. Hash a tarball when testing an artifact. Source-only results do not qualify an installed release; repeat the core/live checks on the final packaged candidate before publication. Any later runtime/dependency change invalidates affected results.

Keep real JIDs, message/request IDs and screenshots in private operator notes, not committed documentation. Record one result per case **and per format/backend/platform variant**:

| Case / variant | Target build | Expected result | Actual result | Status / evidence |
| --- | --- | --- | --- | --- |
| Example: incoming scanned PDF | | Local OCR preview; original retained | | Not run |

Statuses: **Not run**, **Pass**, **Fail**, **Unavailable**, **Inconclusive**. An unavailable platform or missing receipt is not a pass. An explicit expected rejection can be a pass. Never paste credentials, raw auth/config files, full debug logs or private conversation dumps into a report.

Previous source validation: 585 tests/58 files passed with lint/typecheck, including real FFmpeg, Tesseract and LiteParse 2.17.0 fixtures. This is prior automated evidence, not completion of this live checklist. See [dependency/tool validation](../../DEPENDENCIES.md#native-tool-update-validation).

## Safe setup

1. Use generated non-sensitive content and a fresh Pi conversation. Allowed chats share one model context; they are not private sessions isolated from one another. All test participants must consent. Pause if unrelated allowed-chat activity enters the run.
2. Choose a separate recipient account, not self-chat. A second independent contact is needed for cross-chat routing tests. Use only observed/known transport JIDs; do not manufacture them from displayed phone numbers. A dedicated group must contain only consenting, mutually trusted testers.
3. Agree on each batch's maximum extension-originated messages, reactions, attachment uploads and network history requests. Incoming test prompts can cause automatic replies; those replies count toward the budget. Groq/remote-STT uploads need separate approval because audio leaves the machine and can incur charges.
4. Note existing non-secret settings: allowed-contact/group counts, aliases, send-number overrides, selected history scope, and STT endpoint/model/environment-variable **name**. Keep unrelated entries intact. Never record the API-key value.
5. Load changed dependencies/code in a fresh owning Pi process. Save work, use `/whatsapp > Connection > Turn WhatsApp off` only after approving its shared-work cancellation, and close the old process gracefully before starting another same-profile owner. Do not choose **Logoff (Delete Session)**, unlink the device, remove locks or delete data. This walkthrough does not authorize forced termination.
6. For checkout testing, after the prior owner exits, start from the repository:

   ```bash
   pi --no-extensions -e ./whatsapp-ng.ts
   ```

   This is a source run, not an installed-tarball run. Before launching it against a real profile, explicitly check **Connection > Auto-connect on startup** in the prior owning process and obtain approval to set it Disabled for a manual-connect batch; record and later restore the original value. Omitting the online flag alone does not prevent saved-preference startup. Alternatively use an isolated profile without touching the real saved preference. Do not launch a competing second instance.
7. Check `ffmpeg -version`, `whisper-cli --version`, `tesseract --version` and `tesseract --list-langs`. Installed commands alone do not prove conversion/transcription/OCR works. Keep models and provider credentials in the launching process's existing environment; do not download another model for a smoke test.
8. Run automated checks in an isolated HOME before live work. The following is for macOS/Linux shells and keeps test-generated state separate:

   ```bash
   TEST_HOME="$(mktemp -d)"
   env -i PATH="$PATH" HOME="$TEST_HOME" USERPROFILE="$TEST_HOME" \
     APPDATA="$TEST_HOME/AppData/Roaming" LOCALAPPDATA="$TEST_HOME/AppData/Local" \
     PI_CODING_AGENT_DIR="$TEST_HOME/agent" PI_OFFLINE=1 WHATSAPP_NG_LOCALE=en \
     npm test -- --maxWorkers=2
   npm run lint
   npm run typecheck
   npm audit --omit=dev
   npm audit
   npm pack --dry-run --ignore-scripts
   ```

   Inspect failures and skips. Full-tree SDK/host advisories remain separately tracked; do not use `npm audit fix --force` or change dependencies during acceptance. A dry run is not an installed-artifact test. Do not run a dependency reinstall while the owning Pi process is using that dependency directory.
9. Connect once through `/whatsapp > Connection > Connect WhatsApp`. Confirm actual connected/ready status and retained settings. If a saved profile unexpectedly requests pairing, stop and investigate rather than reset/re-pair it.

## Startup preference and navigation (RC2/source)

Approve these setting/lifecycle changes separately, close other same-profile owners and do not send messages merely to test startup. Record each result; API/socket fixtures are not physical-menu acceptance.

| Case | Operator action | Expected result |
| --- | --- | --- |
| Back navigation | Open Connection → Auto-connect on startup → Back, then Back again. | First returns to Connection, second to the main menu; no preference/transport change. |
| Enabled startup | Enable the preference, confirm the current connection is unchanged, close the owner gracefully, then start a fresh TUI without the online flag. | Existing credentials connect automatically; no manual Connect/QR or credential reset. |
| Disabled startup | Disable while connected, then start a fresh owner without the flag. | Saving does not immediately disconnect; fresh startup stays disconnected. |
| Process-local Off | With saved Enabled, explicitly turn Off and reload/replace the session in the same process. | Stays Off. Saving Enabled does not clear deliberate Off; explicit terminal Connect can restore it. |
| Flag distinction | In a separately approved fresh run, use the online flag with saved Disabled. | The explicit flag still requests connection. Restore the desired preference/launcher afterward. |

These source paths have automated production-entry RPC coverage. The operator reported saved startup works, but that does not mark every row or all packaged/platform variants passed.

## First live batch: text only

**Proposed budget: at most 3 extension-originated text messages to one approved contact. No attachment, reaction, history request, STT change or authentication change.** Confirm this budget and recipient before starting. Wait for each test to settle before continuing.

| Case | Operator action | Expected result |
| --- | --- | --- |
| Incoming text | From the independent contact's phone, send `QA-TEXT-01: Reply exactly QA-ACK-01`. | Pi receives the prompt and one reply appears on that phone in the correct chat. Configured branding may be present; no duplicate reply. |
| Explicit outbound tool | Ask Pi to call `send_wa_message` once with that contact's observed JID and body `QA-OUT-01`. | One readable message on the phone. Record API acceptance separately from physical receipt. |
| Terminal-only isolation | After previous work settles, type in the Pi terminal: `Reply only here with QA-TERMINAL-01. Do not call tools.` | Text appears in Pi, with no mirrored message to the previous WhatsApp contact. This is not a test of idle manual tool fallback. |
| Emoji/newlines/ordinary pi character | From the contact, send a two-line prompt containing `👨‍👩‍👧‍👦` and ending in `π`, asking for one short acknowledgement. | The incoming content is admitted without stripping visible content and produces at most one correctly addressed reply. |

Stop here and review all four results before approving more sends. Do not automatically repeat a successful or delivery-unknown transmission.

## Contacts, groups, routing and UI

These need fresh budgets and the named consenting contacts/groups. Modify only dedicated test entries; restore their original settings afterward.

| Case | Action | Expected result |
| --- | --- | --- |
| Access management | Exercise add/remove test contact, alias add/remove and contact printing in `/whatsapp`. | UI stays usable; only the chosen test entry changes. Revisit and restart later to check persistence. |
| Send-number override | If this feature is to be claimed, configure a test entry's override to another explicitly approved test destination, exercise it once, then restore it. | Delivery follows the configured route; unrelated entries do not change. No private/third-party destination is used. |
| Unallowed incoming | With approval, temporarily remove only a dedicated test sender, have it send a marker, then restore it. | No ordinary agent prompt or automatic reply. This does **not** imply all explicit outbound tools are allow-list restricted. |
| Recents/history UI | Open the test conversation, inspect details, return/back out, and send one approved UI message. | Correct conversation, readable content and exactly one UI send. Browsing does not trigger a new agent prompt. |
| Two-chat routing | Have approved contacts A and B send distinct prompts with overlapping processing; also submit a terminal-only prompt. | Unambiguous replies go only to their originating chat. Ambiguous ownership fails explicitly instead of choosing the last chat. No WhatsApp mirror for terminal-only work. Investigate unexpected suppression separately. |
| Group management | Add an approved test group using its known JID; exercise alias/printing/history, then restore settings. | Only that group changes; saved configuration survives restart. |
| Group text | A consenting group member sends a marker; approve one group reply. | Reply reaches that group, never a member's direct chat. |
| Disallowed group | In a dedicated group not allowed by this profile, send a marker. | No ordinary agent processing or automatic reply. |

Do not deliberately inject untrusted prompts into a group containing real collaborators. Pairing a separate group-auth profile is a different authentication test and belongs in a separately approved disposable setup.

## Incoming content

Prepare a small generated fixture pack locally before approval. Each listed format is a separate result; approve the automatic replies it can cause. For incoming audio, also approve any selected remote-STT upload. Never use private customer documents as test fixtures.

| Case / variants | What to send from the test phone | Expected result |
| --- | --- | --- |
| Images: PNG, JPEG | A generated image with a visible marker and a short caption. | Image and caption reach the agent correctly; optional model vision interpretation is distinguished from transport success. |
| Native-text PDF | PDF containing `QA PDF native text 42`. | Saved original plus readable extracted preview; one normal document prompt/reply, not duplicate processing. |
| Scanned PDF | Raster-only PDF containing `HELLO WORLD`, with no embedded text layer. | Local OCR extracts the marker; saved original remains available. |
| Documents: Markdown, CSV, XLSX | Small genuine files with distinct markers and captions. | Correct filename/type/location and saved bytes. Do not require spreadsheet/Markdown content extraction: automatic parsing is promised for PDF. |
| Malformed PDF | A generated invalid PDF, separately approved. | Saved-file fallback and explanatory notice; extension remains usable for the next valid message. |
| Voice note | A 3–5 second recording: `This is QA voice test. The number is forty-two.` | Selected backend produces a useful transcript in Pi and at most one correctly routed reply. Record the actual backend and observed words, not just a timing log. |
| Video | A short generated MP4 with caption. | Video is saved and its location/caption reaches Pi. No implied automatic video understanding or transcription. |

View-once and disappearing-content behavior is checked in isolated protocol fixtures below; do not solicit real ephemeral private media merely for acceptance.

## Outgoing attachments, native quotes and reactions

Use only explicitly approved paths under the workspace or WhatsApp media directory. Naming a path is **not** an instruction to upload it. Approve individual uploads and record both tool outcome and recipient-device behavior.

| Case / variants | Action | Expected result on recipient phone |
| --- | --- | --- |
| Documents: PDF, XLSX, Markdown | One `send_wa_media` document send per fixture. | Correct filename/caption; document opens and contains its marker. |
| Images: PNG, JPEG | One image send per fixture. | Correct image/caption/thumbnail; image opens. |
| Normal audio: MP3, WAV | Send as `type: "audio"`, without voice-note mode or caption. | Both play; WAV conversion works; normal audio is not mislabeled as a voice note. |
| Voice note: Ogg/Opus, converted WAV | Send as audio with `voiceNote: true`. | Voice-note presentation and audible playback; conversion works when needed. |
| Video: MP4, converted AVI | One send per fixture. | Correct thumbnail/caption, playable video and expected sound when the fixture includes it. |
| Incoming-target native quote | Reply to an observed retained incoming text, then a media message, using actual stored IDs. | WhatsApp renders a native quote pointing to the correct original, not just pasted text. |
| Own-target native quote | Quote an observed own-direction message in the same chat. | Native quote works when the target is eligible; record any documented unsupported identity case. |
| Group quote | Quote an observed group message with its real direction/participant context. | Correct group and author, or an explicit documented unavailable target; never a fabricated participant. Own LID-author group quotes are explicitly unsupported by the pinned transport. |
| UI native reply | Open Recents/history, select a retained target, press `R` and send one approved reply. | Native quote visible on phone; one send, correct chat. |
| Reaction | React to a retained message with a simple emoji and, separately, a compound emoji. Remove the reaction if approved. | Correct target; compound emoji preserved; history reflects observed changes. Each mutation counts against the reaction budget. |
| Unavailable quote/target | Use a synthetic nonexistent ID for an approved chat, without inventing an observed key. | Clear error, no silently unquoted message and no outbound transmission. |

API acceptance alone does not pass rendering, opening or playback. An uncertain outcome is recorded and investigated without automatic retry.

## Transcription backends and configuration

Record the original non-secret STT fields before any changes, approve each upload separately, then restore the originals. Do not change allow lists or unrelated settings when switching backends.

| Case | Setup/action | Expected result |
| --- | --- | --- |
| Remote STT | Keep/configure the approved endpoint (HTTPS or explicitly permitted HTTP), model and environment-variable name via `configure_wa_stt`; send one consented voice note. | Expected remote host/model used, useful transcript, no local Whisper initialization/model download. API-key value is never entered into tool parameters or evidence. |
| Partial configuration | After full setup, change only the model; separately try an invalid endpoint. | Omitted fields preserved; invalid updates rejected without overwriting working settings. |
| Local CLI | Pass `configure_wa_stt({})` through the config tool after approval; use installed CLI and an existing `WHISPER_MODEL_PATH`; send one short voice note. | Local CPU transcription; no remote upload or replacement-model download. Establish which backend actually ran. |
| Native Node addon | On a separate compatible host, use a controlled setup with no CLI discovered, or an isolated harness invoking the actual Node backend with an existing model and converted WAV. | Packaged native addon transcribes without installing `whisper-cli`. Do not count a CLI-produced transcript as native-addon evidence. |
| Missing CLI/addon/model or provider key; invalid endpoint; provider error | Exercise in a disposable environment with synthetic settings/fixtures, not by breaking the active user's tool paths or credentials. | Explicit error; no silent provider/model/backend substitution or credential leakage. |
| Settings persistence | Restore the approved original fields, finish work, disconnect and restart the same profile, then inspect non-secret settings. | STT choice, test aliases/overrides, contact/group counts and history selection behave as documented; no authentication reset. |

The Node addon is not available on every platform. On supported native platforms it packages its engine; a separate CLI installation is unnecessary. Forcing an invalid `WHISPER_CLI_PATH` does **not** test native fallback: an invalid explicit CLI is deliberately an error. Do not uninstall a working CLI to force this case.

## Local history, network history and lifecycle

| Case | Action | Expected result |
| --- | --- | --- |
| Local readers | Use `list_wa_conversations`, `get_wa_conversation_history` and `check_wa_new_messages` for the approved test chat. Exercise limits/filters. | Correct direction, visible text, emoji/newlines, IDs and observed status. `onlyIncoming`/new-message results depend on the latest direction, not whether a chat ever had an incoming message. |
| Pagination | Use an existing fixture-rich test history, then follow `nextCursor` when present. | Stable pages without omissions/duplicates. Do not create dozens of live messages solely to force pagination; seed isolated fixtures if needed. |
| Offline reader | Use confirmed Turn WhatsApp off safely and repeat local reads. | Retained history remains readable without reconnecting, fetching WhatsApp history or triggering agent work. |
| History scope | In seeded/disposable multi-account history, select a known scope and try a cursor from another scope. | Correct partition; mismatched cursor rejected; offline scope selection does not change live account identity. Do not expose unrelated real histories. |
| Explicit backfill | Only with separate approval, call `request_wa_history` once for the approved JID with `count: 3`; inspect retained status locally using its request ID. | Truthful pending/partial/complete/unknown status. Imported records do not trigger agent prompts, downloads, PDF parsing or transcription. No automatic request retry. Missing anchor/history is recorded, not bypassed. |
| Edit/revoke | The consenting sender edits and deletes newly generated test messages using their phone. | Local record shows observed edited/deleted state; no stale quote to deleted content and no new ordinary agent prompt for the lifecycle update. |
| Receipt/read/playback | Have the independent recipient receive, open and play approved fixtures, recording corresponding observed statuses. | Distinguish acceptance, delivery, read and played observations. Privacy-suppressed or unobserved statuses remain unknown. Do not infer a group-wide read from one member. |
| Restart/restored quote | Finish all sends; disconnect, exit gracefully, restart and read retained test records, then quote an eligible retained target once. | Saved login/settings/history survive and the native quote works without a raw-memory-cache dependency. No old agent jobs/history requests are reissued. |
| Cancellation | Test `/abort` and Pi cancellation with controlled generated work; use isolated transport fixtures for transmission-boundary assertions. | No stale reply into another run/account. If transmission already started, delivery may be unknown; never assume cancellation recalled the message. |
| Compaction | With separate operator approval in a disposable Pi conversation, send `/compact` from the test chat after work settles. | Session compaction completes without resetting WhatsApp auth/settings or breaking the next test message. Do not compact the engineering session merely for acceptance. |

A missing receipt or history chunk is not itself proof of an extension bug. Record the observation and keep the relevant claim unverified. Any false report of delivery, completion or unavailable content is a defect.

## Failure and privacy cases: isolated only

Do not induce these by corrupting real archives, deleting saved auth, changing the live account or interrupting a real file upload. Existing automated fixtures are the starting evidence; add a controlled reproduction for any missing case.

- Batch intake/replay, simultaneous preparation failure and duplicate suppression.
- Phone/LID aliases, late mapping, full group message keys and old-socket callbacks.
- Account/profile switches, retired auth operations, competing owners, credential validation and interrupted adoption/migration.
- Expired/view-once content, tombstones/admission floors, delayed edits/receipts, retention pressure and no resurrection of deleted text.
- Missing/oversized/nonregular files, URL/base64 inputs, symlinks/ancestor swaps/FIFOs, path boundaries and synthetic secret-file rejections. Never probe real `.env`, auth or private-key contents to test rejection.
- Missing FFmpeg/codecs, conversion timeout/cancellation, private snapshots and child-process cleanup.
- Local Whisper CLI timeout, abort/session change, stalled model-download responses and atomic model publication; use synthetic executables/HTTP streams, not new real downloads.
- Incoming image/video/document advertised-size and streamed-size limits, exact-boundary acceptance, private file permissions and same-timestamp filename uniqueness.
- Remote-STT HTTPS/loopback/explicit-cleartext policy, redirect/response/upload limits, redaction, timeout and session changes using intercepted requests. Include optional language present/omitted and loss-of-HTTP-opt-in refusal; preserve stored settings for repair. Do not deliberately leak a real key to a test endpoint.
- Corrupt/future-version archives, writer-lock conflicts and write failures: explicit degraded state with originals preserved.
- Logout/re-pair, destructive reset, retention expiry and migration recovery only in a separately authorized disposable profile. Do not reset the saved production login to complete a checklist.

## Platform and final-package repeat

Keep separate results for macOS CLI, compatible macOS native addon, Windows CLI/native addon and Linux CLI/native PDF/OCR. Test only platforms for which equipment/runners are available; record others as unavailable and narrow release claims accordingly. GUI menus require interactive checks, not just unit/RPC discovery.

When the candidate stops changing, use a clean temporary consumer for its locally packed tarball, with lifecycle scripts disabled and host-provided Pi peers. Do not publish to npm to perform this check. Verify dependency resolution and absence of a bundled FFmpeg package, then repeat startup, core text routing, inbound PDF/OCR/audio, outbound media/quotes and safe reconnect with the same scoped approvals. Keep this artifact's digest with its results; earlier package hashes do not qualify it.

## Stop conditions and release decision

Stop the live batch on a wrong recipient, unexpected duplicate/unknown send, private-data disclosure, unplanned settings/auth change, unstable connection or unexpected pairing prompt. Preserve safe metadata; do not blindly resend, reset auth or delete state. Stop affected processes gracefully if needed.

Before publication:

- Every release-blocking case has actual evidence, not a checked box copied from earlier results.
- Known unavailable/inconclusive features and platforms have explicit limits, not implied support.
- The final artifact is identified; affected checks were repeated after changes.
- Original non-secret configuration is restored; no pending automatic jobs or history requests are assumed durable.
- Dependency findings are resolved or explicitly dispositioned; production-only auditing is not host certification.
- Private publication guard and separate explicit publication approval remain in force. Completing this walkthrough does not authorize a commit, push, auth reset or npm publication.
