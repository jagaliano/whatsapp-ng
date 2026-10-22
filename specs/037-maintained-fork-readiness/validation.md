# Installed-candidate and controlled live validation

## Scope and authorization

The owner requested fresh repository checks and live testing after M2 delivery. The recipient was explicitly confirmed against a mismatched digit in the request. The owner approved the default saved linked-device session, generated text/media/native replies, receipt observation, a history request capped at three messages, normal credential refresh and disconnect without logout. The owner confirmed prior same-profile connections/services were stopped.

No recipient number, account identifier, message/request IDs, credentials, raw archive, downloaded private content or logs are included here. Detailed results remain in the private temporary harness workspace. No remote message edit/delete, global configuration change or npm publication was performed.

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

This establishes operator-confirmed readability for one fresh outbound text after relinking, not a diagnosed root cause, repaired older placeholders, media playback, protocol receipt persistence or successful history import. No source fix, additional test message, history request, media send or automated auth reset was performed for this recovery check. Full M3/M4 and publication gates remain open.

## Remaining boundaries

This is an installed-package, service-level live probe on the current Darwin x86_64 / Node 26.12.0 host, not a production certificate, group/participant receipt test, complete agent-mediated conversation test or full M3/M4 closure. Successful live history import and receipt reconciliation remain unverified. Client rendering/playback must not be inferred from send success or quote metadata.

The package remains private/unpublished. M1 npm-account verification, remaining M3 qualification, M4 live gaps and M5 publication/stable promotion remain separately gated. No source fix was needed; only this sanitized evidence and the canonical progress record are committed by the follow-up.
