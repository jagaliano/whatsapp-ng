# Installed-candidate and controlled live validation

## Scope and authorization

The owner requested fresh repository checks and live testing after M2 delivery. The recipient was explicitly confirmed against a mismatched digit in the request. The owner approved the default saved linked-device session, generated text/media/native replies, receipt observation, a history request capped at three messages, normal credential refresh and disconnect without logout. The owner confirmed prior same-profile connections/services were stopped.

No recipient number, account identifier, message/request IDs, credentials, raw archive, downloaded private content or logs are included here. Detailed results remain in the private temporary harness workspace. No remote message edit/delete, agent-initiated global configuration/auth reset or npm publication was performed. Later operator changes and separately approved live scopes are attributed below.

## Candidate and repository checks

- Source checkpoint: `1f8034bb0ab5fa4ffb6000b0aaf0e1f78a3160e4`; this evidence-only follow-up does not change the tested runtime or package payload.
- Actual `whatsapp-ng@1.1.0-rc.1` tarball SHA-1: `6fa8e2164c2c570b08ffa270a248cab87c21e02a`.
- Fresh `npm test`: **414 passed across 45 files**. No skipped OCR/native contract was reported.
- `npm run lint`, `npm run typecheck`, `git diff --check`: exit 0. No build script is declared.
- Fresh full-tree and production-only npm audits: **0 vulnerabilities**. These are registry-advisory results, not a complete embedded/system native-library audit.
- Temporary HOME/agent directory for repository checks; system FFmpeg and Tesseract were used, not production data.

## Actual installation and synthetic isolation

Unlike M2's preliminary linked-dependency probe, this run installed the local tarball and its dependencies into a fresh temporary consumer using `npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund`. It installed 92 production packages and no physical copies of the three host peers. Its own production audit reported zero findings.

Resolved direct/native selections were Baileys 7.0.0-rc14, LiteParse 2.15.1 and the Darwin x64 LiteParse optional package 2.15.1. The actual Pi resource loader registered seven tools and `/whatsapp` with zero errors/warnings.

Checks against the installed package's actual storage classes passed:

- Synthetic archive persisted and was readable after offline restart.
- Raw retry data was not persisted.
- Switching synthetic accounts selected an empty separate partition.
- Archive files had mode 0600.
- A synthetic corrupt store remained degraded and unchanged after flush.

These preflight checks accessed no real auth. They do not complete Pi-managed install/remove/reinstall, duplicate-process transport protection, every migration case or Linux/Windows qualification. M3 remains partially qualified, not closed.

## Controlled live service results

The harness loaded services from the actually installed package, used an isolated config/archive/media/log workspace and accessed the approved saved auth directory in place. Credentials were not copied into the consumer. The connected account matched the saved session. Only one harness connection was active at a time.

| Check | Observed result |
|---|---|
| Generated sends | Seven send calls returned success: text anchor, text reply, PDF, image, beep voice note, short video and post-restart reply. This is transport API acceptance, not client delivery/read confirmation. |
| Native quotes | All six intended replies contained the anchor's native quote stanza. |
| PDF network round-trip | The harness downloaded/decrypted its own generated sent PDF through the actual incoming-media pipeline and confirmed the expected native text preview. This is not a contact-originated or agent-mediated inbound-turn test. |
| Restart | Safe disconnect and offline re-open preserved the anchor and secret-free quote projection, with no raw retry data. A reply using the restored quote succeeded after reconnect. |
| Archive safety | Mode 0600 and absence of media-key/URL/direct-path/thumbnail/context fields in the archived projection were verified. |
| Explicit history | One request capped at three messages was submitted; final status **unknown**, with **0 imported messages**. Successful backfill is not demonstrated. |
| Delivery/read receipts | None observed for the test messages. This neither proves delivery nor proves nondelivery. |
| Client rendering/playback | Asked explicitly; the owner did not confirm receipt/checking. Receipt, PDF/image opening, quote rendering and audio/video playback remain unverified on a physical client. |
| Shutdown | Disconnected without logout; saved credentials remained present. No automatic message retry was performed after the completed run. |

## M4 follow-up: test topology

The owner subsequently requested continued M4 work. A read-only check of saved-session identity metadata confirmed that the approved test recipient is the linked sender account: the prior run was **self-chat**, not an independent two-account recipient test. Only booleans were output; no connection was opened, credentials written or credential contents disclosed.

Self-chat transport success does not establish independent recipient delivery/read behavior. The absent receipts are not treated as a demonstrated reconciliation bug. The installed rc14 history-call mapping was inspected and matches the expected count/key/millisecond arguments; there is no evidence yet for a speculative protocol/source fix.

Next useful scope is either a freshly approved separate recipient and client-ready window for receipt/history observation, or the plan's explicit experimental/unverified prerelease disposition. The earlier media can be checked in the client's self-chat, but playback confirmation would still not prove independent receipt or successful backfill. No full-batch resend was started.

## M4 separate-recipient follow-up

The owner approved a distinct recipient, confirmed other same-profile connections were stopped, and limited this follow-up to two generated texts and one history request capped at three. The installed-candidate harness verified a distinct account, made exactly two text send calls with one attempt each, and submitted exactly one bounded history request. Both text calls returned API success and the second contained the intended native quote.

During the bounded observation window, Baileys' public event emitter exposed no matching delivery/read/status updates, history sets or recipient reply. History ended **unknown / 0 imported**. This does not establish that no wire-level event or delivery occurred. The accepted outgoing projections survived offline reopening unchanged; archive mode 0600 and secret-field exclusion passed. The harness disconnected without logout and retained saved auth.

The owner subsequently reported the client placeholder **“Waiting for this message”**. The affected device and whether ordinary chats were also affected were not established before the owner chose to reset/relink. Accordingly, API acceptance was not treated as successful client readability or full M4 closure. No extra harness sends, retries or speculative source/auth fixes followed that report. Unstructured dependency stdout was withheld from chat/Git and removed from the private generated capture; reporting uses sanitized projections only.

## Post-relink single-text recovery check

The owner reports switching to the maintained local package, using **Logoff (Delete Session)**, unlinking the old device and completing fresh QR linking. A read-only check confirmed the maintained package source in Pi settings and presence of saved auth. These checks alone did not prove a working connection or recovery.

With separate approval for one fresh text through the existing newly linked extension, the first tool invocation returned **WhatsApp not connected / attempts: 0**; nothing was sent and no second connection or harness was started. After the owner confirmed the existing connection ready, one `send_wa_message` invocation returned **success / attempts: 1**. The owner explicitly confirmed that this new text was **readable normally on the recipient's phone**.

This establishes operator-confirmed readability for one fresh outbound text after relinking, not a diagnosed root cause, repaired older placeholders, media playback, protocol receipt persistence or successful history import. No source fix, additional test message, history request, media send or automated auth reset was performed for this recovery check. At that checkpoint, full M3/M4 and publication gates remained open.

## Final M4 live-evidence completion

The owner explicitly requested completion of M4, chose the remaining live checks rather than an experimental-only disposition, and approved at most four generated media/native replies and one actual history fetch capped at three. The owning Pi disconnected, reloaded and reconnected without another logoff/unlink or competing socket. The new tools were verified before use, and the previously readable text remained quoteable across reload.

This completion run used the Pi-managed **local maintained checkout**, not a new tarball installation. All **30 runtime/manifest files** were byte-identical to the previously installed candidate with tarball SHA-1 `6fa8e2164c2c570b08ffa270a248cab87c21e02a`. Installed-candidate loader/storage/RPC checks were repeated separately with temporary HOME/agent directories and no real auth. This distinction does not close M3's managed-install/platform gaps.

| Check | Final observed result |
|---|---|
| Generated media | Exactly four calls: one-page PDF, blue PNG, one-second voice note and one-second video; each returned success in **one attempt**. Voice was converted to Ogg/Opus. No extra test text or media retry. |
| Physical client | The owner confirmed all four attachments open/play normally and all four native quoted replies display the intended text anchor. |
| Persisted lifecycle | The readable text and document/image/video records reached **READ (4)**; the voice note reached **PLAYED (5)**. Disk reads verified the intended records and all four quote-anchor references. This is direct-chat evidence, not group/per-participant coverage. |
| Authorization guard | The first post-reload history invocation was denied before any fetch. The agent did not change policy or bypass the guard. After the incoming-agent/shared-context implications were explained, the owner explicitly accepted this trusted account and added it through Allowed Contacts. |
| Correlated backfill | After that operator change, exactly **one actual fetch**, capped at **3**, completed for the returned request ID: **ON_DEMAND (6), explicit completion, progress 100%, 2 imported records**. Local status queries caused no extra fetch. |
| Actual new records | Comparison against the pre-fetch scoped-key baseline found **2 distinct new records**, rather than counting only a pending ID or duplicates. They had no live-processing entries. |
| Fresh offline reader | A separate newly started process used the real `ArchiveFiles.readScope` historical-view API to reopen those two records and the persisted correlated complete request. It did not initialize/activate a writer, acquire a lock, access auth or start a socket. This is an offline reader restart, not a second full-Pi restart after the fetch. |
| Archive safety | Mode **0600** and absence of media-key/URL/direct-path/thumbnail/context fields passed again. Private identifiers, message bodies, account markers and raw diagnostics remain outside this report/Git. |
| Connection ownership | The completion run used only the existing owner-controlled connection. No additional harness/socket, automated auth reset, remote edits/deletes or logout was performed; the active Pi connection remains under the owner's control. |

M4's direct-chat live-evidence criteria are now satisfied for this host and tested scope under the owner's separately approved standalone validation work. This does not waive the normal M3 prerequisite for release or authorize M5. The requested independent exact-model closure review is complete; its result is recorded below and is not inferred from live outcomes.

### Final verification checkpoint

Fresh isolated checks at source checkpoint `7ba53de`: **414 tests / 45 files, zero pending**, including actual native quote/media/archive and conversion cases; lint/typecheck/whitespace passed. Full and production audits reported **zero findings**. Installed candidate registered **7 tools / 1 command / zero warnings**; synthetic offline/partition/corruption/0600 checks and actual successful RPC `get_state` passed without real auth or an online flag. No build script is declared. No M4 runtime, dependency, schema or storage-path modification was necessary.

### Independent closure review

Read-only run `b0a6e796-31b4-4a11-9ab7-5d54a9ebdc68` returned **OK — No issues found.** It reviewed the complete M4 documentation range from `1f8034b` through the closure working tree, relevant history/archive/media/lifecycle source/tests and sanitized parent verification summaries. It ran no commands/tests/live operations and changed no files; those verification results remain parent-supplied evidence.

Before dispatch, the parent checked installed pi-subagents 0.81.0, actual model availability, the writable absolute target directory, absent current/target project settings, effective global settings and relevant lazy/provider configuration. The configured reviewer default differed, so the per-run fully qualified model/thinking override was explicit. A foreground native child inherited the active provider registry without ambient extensions. Metadata-only inspection of the completed child session independently confirmed actual **`openai-codex/gpt-6.1-sol`**, **medium** thinking and the intended project cwd. No global configuration edit, provider/model fallback or competing WhatsApp session was used.

The final full gate passed after drafting the closure; receipt-only updates then passed document/link/safety/whitespace and unchanged-artifact checks. No runtime fix or newly skipped test was required. M4 is complete for this reviewed live-evidence scope, not an overall release certificate.

## Remaining boundaries

The final evidence qualifies one direct chat on Darwin x86_64 / Node 26.12.0, not production stability, group/per-participant receipts, large-history behavior, every device/privacy setting or a complete agent-mediated inbound conversation. Earlier unknown/unreadable outcomes remain recorded; relinking preceded fresh readability but does not diagnose the old failure or repair old placeholders. Client confirmation and observed protocol/storage results are reported separately.

The package remains private/unpublished. M1 npm-account rights, remaining M3 managed-install/removal/exclusivity/platform qualification and M5 publication/stable promotion remain separately gated. M4 live evidence and independent closure review are complete in the stated scope. No source fix or publication authorization is implied.
