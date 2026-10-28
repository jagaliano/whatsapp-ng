# C4 settings, Off and diagnostic privacy

## Implemented scope

Work stays in `whatsapp-ng-release`, preserving earlier increments and the owner-deferred C3 image test.

- `/whatsapp` now groups existing views into Connection, Chats / Owner, Replies, Voice, Groups and Advanced. Contact/history/detail navigation is reused, including offline access. Advanced exposes the existing explicit Logoff separately from non-destructive Off and shows a fixed log policy, not file contents.
- Terminal **Connection → Turn WhatsApp off** requires confirmation and shares the phone `/off` lifecycle. It withdraws outbound send/media/reaction tools, aborts current shared Pi work, retires known queued WhatsApp inputs, cancels speech/reports/optional output and closes the existing transport normally. Unrelated tools, local history/status/config, login and archives remain. Network history requests still fail while Off.
- Off remains process/session-local rather than a new global preference. Existing profile-keyed withdrawal evidence survives session replacement/reload; a small process-local tool-name map now also preserves exactly which outbound tools were active. Terminal Connect restores only those tools, never an originally inactive reaction tool. Fresh processes keep existing explicit CLI startup behavior.
- Startup retries are cancelled and epoch-fenced on deliberate Off, explicit Connect, replacement and shutdown. Re-enabling cannot revive an old delayed auto-connect attempt or withdrawn answer. Existing validated preference snapshots/persistence remain authoritative; no preference schema, auth/archive layout or session-entry default restoration is added.
- The extension, transport and sender now share the bounded metadata logger implementation. New records use `whatsapp-ng.runtime.log`, best-effort **5 MiB active + one rotated `.1` backup**, **8 KiB per record**, and owner-only new files. Rotation replaces the older runtime backup explicitly; historical `whatsapp-ng.log` and unrelated files are untouched. Unexpected symlink/non-file or oversized existing log targets are left intact rather than repaired/truncated. This is best-effort diagnostic rotation, not a cross-process storage quota or encryption-at-rest claim.
- Incoming request/system bodies, speech, captions, caller names/filenames and raw native error/argument payloads are no longer diagnostic messages. Ordinary error notices remain visible without payload dumps. Verbose cannot enable Baileys protocol traces. The existing narrow known-libsignal-noise filter covers auth/socket construction and synchronous socket end, without blanket-muting ordinary application errors. Shared Pi context/history, archives and downloaded media retain their separate existing content policies; old data is not retroactively redacted.

## Executed evidence

Commands ran with temporary HOME/agent roots, `PI_OFFLINE=1`, and a minimal environment without inherited credentials. No real settings/auth files, current owner's process or live destinations were used.

- Baseline: the four initial focused suites produced **13 failing / 91 passing** tests. Failures exercised missing grouped menus, shared terminal Off, body logging, private/bounded logging and console handling. Receipt: `.pi/cache/c4/baseline-results.json`.
- Final focused command: `npm test -- tests/unit/whatsapp-ng.logger.test.ts tests/unit/menu.handler.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/whatsapp.service.console-filter.test.ts tests/unit/audio.service.test.ts tests/unit/incoming-media.service.test.ts tests/unit/message.sender.test.ts tests/unit/whatsapp-command.router.test.ts --maxWorkers=2 --reporter=json --outputFile=.pi/cache/c4/focused-results.json` → **211 passed**, no failures/skips.
- Full command: `npm test -- --maxWorkers=2 --reporter=json --outputFile=.pi/cache/c4/full-results.json` → **1101 passed / 78 files**, no failures/skips. An initial full attempt exposed an incomplete new test fixture's recipient resolver; the fixture was corrected to use the intended preserved transport path, then the complete suite passed. No production workaround was added for that test issue.
- `npm run lint`, `npm run typecheck`, `git diff --check` → exit **0**. Active LSP checks covered 16 changed source/test paths. Two newly introduced inferred-project mock-call warnings were corrected with typed mocks; the changed test's re-probe was clean. The initial push-only probe could not confirm cleanliness for 12 paths; 21 auxiliary structural/style findings in the existing WhatsApp service were not a new correctness verdict or a reason for unrelated refactoring. Repository lint/typecheck are the decisive compiler/static checks, not an empty session cache.
- `npm pack --dry-run --offline --ignore-scripts --json` → exit **0**, **56 intended files**, including the small settings view; no tests/cache/auth/runtime payload. Contents check only, not a newly qualified tarball or consumer install. Manifest and lockfile digests match the pre-C4 snapshot.

The full suite contains **eight actual production-source `pi -e` RPC scenarios**, with synthetic WhatsApp transport/provider streams and blocked network. The new settings scenario uses the real grouped UI and public lifecycle APIs:

1. Hold an active WhatsApp request before provider inference and queue another admitted group input.
2. Confirm terminal Off, then release the held fixture. Neither withdrawn input reaches a usable provider request; local read/status tools remain and outbound tools disappear.
3. Replace the session and reload the extension. Off remains in effect, with no extra socket construction.
4. Read Advanced's fixed privacy policy, explicitly Connect and restore only previously active send/media tools. An initially inactive reaction tool stays inactive.
5. Submit fresh group work: exactly one ordinary fixture provider request and its fresh answer succeed; old work is not replayed. Saved owner/attachment preferences survive. New diagnostic files are `0600` and exclude the request/answer markers; the historical log fixture remains byte-identical. Network attempts: **0**.

Additional unit coverage checks speech cancellation without stale text fallback, local versus network history behavior while Off, cancelled/refused confirmation, startup-retry cancellation, safe incoming media diagnostics, error-payload exclusion, private rotation, oversized entry bounds, symlink refusal, historical preservation, and ordinary errors during startup/after socket end. Earlier controls, group/self-chat, image/terminal projection, native speech/media, storage/migration and persistence suites remain green.

## Subsequent independent review

At the owner's request, one fresh read-only **`anthropic/claude-sonnet-5-5`, high thinking** review completed as run `d2721203-60cf-4083-bfcb-ce9f2cf4a29c`. Runtime metadata confirms that model/thinking and completed state. No fallback or implementation authority was granted. The 146 frozen public inputs and matching checkout files were unchanged through review. Full local report: `.pi/cache/c4-review/report.md`.

**Verdict: OK with notes; no P0/P1/P2 findings in the inspected scope.** At that review checkpoint, three P3 notes remained unmodified. The subsequent owner-requested correction below addresses the first two; the third remains unproven:

- Connection offers Off even when already Off, so confirming it can unnecessarily abort new terminal work (`src/ui/whatsapp-settings.view.ts:10`, `whatsapp-ng.ts:255`). The confirmation already warns about shared abort. Consider hiding the entry or making repeated Off idempotent.
- Two-level navigation retains a state snapshot; a concurrent phone Off/reconnect can leave stale options until the existing guard expires the menu (`src/ui/menu.handler.ts:49`, `src/ui/whatsapp-settings.view.ts:16`). Reopening works; no data effect was identified.
- Startup captures its retry epoch after initialization awaits (`whatsapp-ng.ts:515,630`). A teardown during that window might allow a later start. The reviewer explicitly rated this **low-confidence/unproven**, noting possible lifecycle serialization; it is not a demonstrated race.

Optional/pre-existing observations, including the post-start `setVerboseMode(true)` filter-restoration branch, remain separate from C4 findings. The reviewer executed no tests/live operations, had exact before-bytes for eleven files and scoped static inspection for the other five, and did not independently validate the parent's test receipts. This is a bounded code review, not live-client/all-platform acceptance. No fixes or second review were performed as part of the review request.

## Subsequent correction of the two concrete notes

The owner requested review and correction of the two concrete C4 notes. The low-confidence startup-epoch concern is separate and was not silently treated as proven or changed.

### Confirmed causes and fixes

- **Repeated Off:** the Connection menu always offered Off, and the shared hook unconditionally reset routing/speech and called `ctx.abort()`. A later terminal task could therefore be aborted without a new enabled-to-Off transition. Off is now hidden when disabled; the shared hook returns immediately if already deliberately Off, including while the first shutdown awaits settlement. A fresh Connect permits the next legitimate Off transition. A temporary transport disconnect alone still permits the first deliberate Off and its warned shared abort.
- **Stale navigation:** the controller captured status/enabled once before both dialog levels, and Back reused the same arrays/title. It could offer an obsolete Connect action; an actual phone Off also invalidated the captured scope and led to confusing expiry. Navigation now reads fresh state before each render, again between category/action selection and before accepting an action. Unavailable choices are discarded. Scope expiry closes the dialog with a clear reopen notice, including after Off confirmation; it does not renew the old account/session authority or apply the action. The Connect handler separately checks current transport/enabled state.

### Correction evidence

All commands used a temporary HOME/agent directory, `PI_OFFLINE=1`, and a minimal environment without inherited credentials. Production files were snapshotted under `.pi/cache/c4-corrections/before/` so unrelated earlier work remains intact.

- `python3 .pi/cache/c4-corrections/run-gates.py baseline`: **10 failing / 104 passing** initial unit tests, for the two described causes, before production edits.
- `python3 .pi/cache/c4-corrections/run-gates.py native`: actual production-entry **`pi -e`** RPC first failed because Off remained offered after Off/reload. After correcting only Off, the same scenario independently failed because a phone Off still left the old Connection submenu open. Receipts: `native-before-results.json` and `native-navigation-before-results.json`. The other eight cases were intentionally filtered in these baseline native runs.
- `python3 .pi/cache/c4-corrections/run-gates.py focused`: **176 passed / 4 files**, including all nine production-entry RPC cases and the corrected settings case, with no failures/skips; lint/typecheck passed.
- A positive regression was then added to protect first-time Off during an ordinary disconnected transport. The first full run exposed a missing getter in that new test mock; only the fixture was corrected to use its existing status getter, with no production workaround.
- Final `python3 .pi/cache/c4-corrections/run-gates.py full`: **1148 passed / 79 files**, zero failures/skips. The helper ran `npm test -- --maxWorkers=2 --reporter=json --outputFile=<cache>/full-results.json`, `npm run lint`, and `npm run typecheck`; all exit **0**. Exact arrays and receipts are retained in the correction cache.
- The maintained native settings scenario now verifies that Off is absent after session replacement/reload, then explicitly Connects, completes fresh work, holds the real root dialog open, invokes owner phone Off and observes a clean reopen notice with no obsolete submenu. Existing owner/preferences/log preservation assertions and **zero network attempts** remain intact.
- `npm pack --dry-run --offline --ignore-scripts --json`: **57 intended files**, no tests/runtime/cache payload; manifest/lockfile bytes match the correction baseline. `git diff --check` passed and nothing was staged. No build ran because the repository defines no build script.

No new independent review verdict, live operator reload, actual account/settings mutation or voice/message/provider check is claimed for these corrections. No dependency change, install/audit, cross-platform/consumer qualification, Git delivery or publication was performed. The original frozen reviewer report is preserved; the third startup note and owner-deferred C3 image test remain separate.

## Limits and handoff

The implementation checkpoint above preceded the subsequently requested independent review. No actual owner settings changes, automatic reload/restart, live WhatsApp sends, external provider requests, Git staging/commit/push or publication occurred. No build script exists; no build was run. Dependencies are unchanged, so no install, new audit, clean consumer install or Linux/Windows qualification was performed. Prior live/review results remain separately dated and scoped.

C4's native/source checks pass; real desktop/phone behavior is not newly attested. If the owner wants a manual check, use the existing instance's normal lifecycle, not a competing auth connection: inspect the six categories and offline history, confirm Off only when aborting shared work is acceptable, then explicitly Connect and send a fresh harmless request. Do not infer acceptance of already-issued side effects or replay stopped work. The separately deferred C3 automatic-image live test remains **OPEN**; its current menu path is Replies → Optional outputs. Nothing schedules or resumes that test automatically.

## Owner live feedback

After the walkthrough, an incoming WhatsApp request asked for exactly `C4-A` and the assistant returned `C4-A`. The owner then reported: “ok everything seem fine”. Record this as owner-reported basic C4 smoke-test acceptance, not independently instrumented step-by-step evidence. No defect was reported. Individual Off/reload/reconnect transitions, the `C4-C` client result, optional busy cancellation and log-content/permission checks were not separately documented here; do not infer those detailed results from the general acknowledgement. The owner-deferred C3 automatic-image test remains OPEN. No additional test, settings mutation, reload, send or publication is authorized by this feedback.
