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

Resolved direct/native selections were Baileys 7.0.0-rc14, LiteParse 2.15.1 and the macOS LiteParse optional package 2.15.1. The actual Pi resource loader registered seven tools and `/whatsapp` with zero errors/warnings.

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

The final evidence qualifies one direct chat on macOS / Node 26.12.0, not production stability, group/per-participant receipts, large-history behavior, every device/privacy setting or a complete agent-mediated inbound conversation. Earlier unknown/unreadable outcomes remain recorded; relinking preceded fresh readability but does not diagnose the old failure or repair old placeholders. Client confirmation and observed protocol/storage results are reported separately.

The package remains private/unpublished. At M4 closure, M1 npm-account readiness, remaining M3 managed-install/removal/exclusivity/platform qualification and M5 publication/stable promotion remained separately gated. Subsequent M1 account verification is recorded in plan section 16. This paragraph describes the historical M4 checkpoint; subsequent M3 work is recorded below. M4 live evidence and its review do not attest new runtime bytes or authorize publication.

## M3 qualification closure — 2026-10-23

The owner authorized a dedicated guarded-profile reliability slice, guarded connect-time legacy-auth adoption and disposable Linux image/dependency downloads. All M3 auth/history data were synthetic. No real profile was migrated/reset/reloaded, no real WhatsApp socket/send/fetch was started, and no global configuration, credentials or host packages were edited. Temporary Pi installation settings were confined to synthetic HOME/agent directories. Public package-registry/image downloads and the authorized reviewer model calls are distinct from the network-blocked WhatsApp fixture.

### Reliability findings and corrections

- The original two-process actual Pi RPC reproduction constructed two transports for one synthetic profile. The fixed reproduction loads the real entry with `-e`, keeps both Pi processes alive, records exactly **one auth-opening/socket process**, explicitly rejects the competitor, attempts **zero networking**, and leaves **zero transport locks** after shutdown.
- The same real-Pi fixture originally copied legacy keys into the owned destination during the competitor's offline initialization. It now preserves the initialized destination without merging. Standalone synthetic probes also exposed copied process locks; offline migration now excludes auth/control entries.
- Auth adoption now requires destination/source ownership and a complete matching profile, uses private atomic staging, and retains legacy originals. Private non-secret metadata prevents re-adoption after reset and blocks interrupted/future states. Credential/key shapes are validated against pinned rc14 before native loading; validity of signatures/account ownership is not cryptographically certified.
- The actual pinned native store was characterized with an owned FIFO child: one rejected write can leave another write pending. One-key adapter calls and retired-scope fencing avoid that hidden fan-out. Fault fixtures cover adoption commit/final-marker/reset interruption and preserve explicit recovery state rather than guessing.

### Final platform/artifact checks

| Check | macOS | Linux amd64 |
|---|---|---|
| Runtime | Darwin, Node 26.12.0, Pi 1.3.0 | Disposable Node 26.12.1 / Pi 1.3.0 container; FFmpeg 5.1.9, Tesseract 5.3.0; zero host mounts |
| Repository/native tests | **466 passed / 49 files** | **466 passed / 49 files** |
| Declared checks | `npm run lint`, `npm run typecheck`, `git diff --check`: exit 0 | `npm run lint`, `npm run typecheck`: exit 0 |
| Actual private tarball | **38 entries**, source/manifest/doc bytes checked | Same actual tarball and source-byte checks |
| Pi-managed lifecycle | `pi install npm:whatsapp-ng@file:<local-tarball>`, `pi remove`, reinstall: exit 0 | Same lifecycle: exit 0 |
| Host/schema discovery | **7 tools / 1 command / 0 errors or warnings**; all tool schemas are objects; no physical host-peer shadow copies | Same checks passed |
| Automatic managed startup | Successful real RPC `get_state`, no explicit `-e`, online flag or auth creation | Same check passed |
| Installed native auth | Fresh unlinked native credentials generated/saved under the installed package, private 0700/0600, no socket; fixture removed afterward | Same check passed |
| Registry advisory audits | Source full/production and actual consumer: **0 vulnerabilities** | Source full/production and actual consumer: **0 vulnerabilities** |

Final local tarball SHA-1: **`78257d468111fbff53f17d99e986741143a0380e`**. `private: true` and the intended future `next` tag remain unchanged. The 38-entry package contains no tests, caches, auth, archives, dependency tree or service installer. No build script is declared. The first Linux payload lacked the `.gitignore` required by a manifest test; it was supplied and the entire final suite rerun, not skipped. No native/OCR suite was skipped in the final runs.

### Independent source review

Exact read-only `openai-codex/gpt-6.1-sol`, medium, first run `2dfbc244-b43d-4315-a04c-85269942c5c6` returned **BLOCK** for one P1: syntactically valid but incomplete credential objects could reach native loading. Two current/legacy failing regressions were captured before correction; valid fixtures now contain the full pinned structural schema, and actual fresh native credentials have positive save coverage. Focused run `d1bdddf4-bb29-436d-871d-c8a71e70af38` returned **OK — No issues found.** Actual child metadata confirms the exact provider/model, medium thinking and target cwd for both runs, without fallback. Reviewers edited nothing and ran no commands/tests; platform and package results above are parent-verified evidence, not independent execution claims.

### Remaining release boundaries

M3 is complete for this artifact and the stated local CLI/RPC environments, not production stability, Windows/ARM support, arbitrary Linux distributions, legacy systemd installers, distributed locking or old/uncooperative clients. The earlier unreadable-message cause remains undiagnosed; the migration fixture is not evidence of that cause. Existing M4 direct-chat results remain historical: the new auth/lifecycle runtime requires separately authorized bounded real-account revalidation before publication. M3 Git commit/push and all M5 npm package creation/registration/publication still require explicit approval. No commit, push or npm publication was performed by this closure.

## Final-runtime M4 refresh — attempts and recovery

The owner subsequently approved a saved-session check with at most two generated texts to the same separate recipient, one safe stop/reconnect, normal credential refresh and no reset/logout/media/history fetch. Other WhatsApp connections were disconnected. The exact installed final artifact was byte-checked against the 38-entry tarball and source.

Two controller attempts each constructed one socket but stopped at archive readiness before any send: **zero test texts**, no automatic reconnect/resend, authentication files retained, stable profile metadata and transport lease released. The first encountered the current Pi's still-live archive writer. The owner then approved an isolated test archive without taking over that lock. The second revealed invalid harness archive options: the required private `legacyPath` was missing. These are not evidence that the old unreadable-message issue was diagnosed or that the final client check passed.

The controller also omitted production's `SessionManager.ensureInitialized()` step, allowing status persistence to write default extension configuration. The agent disclosed this error and stopped testing. A saved session-state snapshot recovered all three original allowed contacts; the owner confirmed those were the only custom settings. Atomic restoration was verified against that snapshot, with mode 0600. Authentication files were not copied/reset/deleted for recovery; their presence alone is not a new client-readability proof.

The corrected controller initializes session state, suppresses production configuration writes, supplies a nonexistent private legacy-recents path, and waits for the actual processed connection-ready callback rather than persisted status. A no-network synthetic regression reproduced the configuration overwrite and missing-path degradation, then passed configuration-preservation, archive-writability, real-ready-event gating and mocked stop/reconnect/restored-quote assertions. It used no real user data or authentication.

At that checkpoint, no further live attempt had been made. The owner explicitly approved force-stop/resume instructions to avoid cached pre-upgrade authentication callbacks. The resumed process was verified offline: the old process had exited, all three restored contacts still matched, configuration mode was 0600 and no auth transport lease existed. The no-network fixture passed again before a new controlled run. These failed attempts and recovery are not erased by the subsequent success below.

## Final-runtime M4 completion

The owner resumed and requested continuation of the same bounded scope. The exact already-qualified installed artifact, source and 38-entry tarball were byte-checked again: SHA-1 **`78257d468111fbff53f17d99e986741143a0380e`**. Production code/dependencies were not changed. The harness used the real default saved credentials in place, normal refresh, a private test archive and the existing production account marker only as a read-only identity check. It did not take over or write the owning Pi's production archive.

| Final check | Observed result |
|---|---|
| Readiness | **2 actual processed connection-ready callbacks**; registered sender distinct from the approved recipient and matched the prior account marker. Persisted status alone was not accepted. |
| Sends | Exactly **2 generated text sends**, each API-accepted in **1 attempt**. No delivery-unknown result, unplanned reconnect, automatic resend, extra text, media or history fetch. |
| Safe stop/reconnect | Transport lease removed between connections; credentials retained; old context invalid while stopped and after reconnect; a fresh owner token under the same account scope. |
| Restored native reply | After reconnect the first text's archived safe quote was available, and the second actual native message contained that anchor. |
| Physical client | The owner explicitly confirmed **both labeled texts readable and the quoted text visible** on the separate recipient phone. This is operator evidence, separate from API acceptance. |
| Isolated persistence | After stop, a new read-only `ArchiveFiles` instance reopened **2 records**, the quote anchor, mode **0600**, and no transport-secret fields. This reader ran in the same controller process, not a new full-Pi restart. |
| Numeric status evidence | Both observed/persisted aggregate statuses were **SERVER_ACK (2)**. This is not a fresh READ/PLAYED or comprehensive receipt-event result; earlier direct-chat READ/PLAYED evidence remains historical. |
| Configuration preservation | Correct initialization loaded **3 allowed contacts**; **6 attempted configuration saves were suppressed**. The production configuration digest was unchanged, and a separate comparison again matched all restored contact data. No configuration backup containing keys was created. |
| Final cleanup | Safe stop completed; owned transport and isolated archive locks absent, saved credentials retained and profile metadata stable. The controller exited **0**. No pairing/reset/logout or credential copy. |

T049's final-runtime saved-session ownership/lifecycle/readability gate is complete. Together with the earlier approved media/history scope and reviewed M3 candidate, **M1–M4 are complete for the documented prerelease qualification scope**. The current two-text run does not newly qualify default-archive coexistence, Linux live accounts, media/backfill, group/per-participant receipts, old unreadable placeholders or full agent-mediated inbound behavior. No new production source review is claimed for these documentation-only receipts. The unchanged candidate retains prior M3 466/49-per-platform validation; the subsequent isolated Git-delivery preflight also reran `npm test` (466 passed/49 files, zero pending), `npm run lint`, `npm run typecheck` and `git diff --check`, all exit 0. No build script is declared. After this closure the owner explicitly authorized Git commit/push to the maintained repository and explicitly prohibited publication. npm package creation/publication and stable promotion remain separately gated; the package remains private/unpublished.
