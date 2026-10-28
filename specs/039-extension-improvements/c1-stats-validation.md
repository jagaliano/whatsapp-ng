# C1.1 optional final stats

Checkout: `/Users/jagaliano/workspace/whatsapp-ng-release`. This slice implements final elapsed/tool-count metadata only; interim text, file lists, live activity and other C increments remain deferred.

## Behavior and boundaries

- Default off. Explicit shared preference in terminal `/whatsapp` → Reply delivery, or the verified owner's `/replies` menu. New requests only; disabling/re-enabling or selecting a stale menu cannot revive old reporting work. Existing config, speech, login and history are preserved.
- Latch enablement, revision and monotonic time at the first consumed input, before the assistant frame. Then bind the owning reply epoch and native cancellation signal, not `lastRemoteJid`. Observe only public Pi tool IDs and successful/failed completion flags. No arguments, results, tool names, paths, reasoning, token/cost estimates or content are reported.
- One separate progress-purpose text after an accepted automatic final. Elapsed time is monotonic, rounded to 0.1 seconds, from first consumed Pi input to final acceptance; earlier queue/media preparation is excluded. Stats are not spoken.
- No report for terminal/ambiguous input, explicit-text/legacy suppression, cancelled/failed/unknown finals, aborted/provider-error work or withdrawn retry epochs. Reporting errors cannot fail the answer and never cause an automatic retry. Already-issued network effects cannot be recalled.
- Track at most 500 unique tool IDs per native run. Repeated IDs, overflow or unfinished starts mark counts partial. Eight combined reply/send slots bound optional work. Unknown/thrown sends retain capacity until actual sender settlement, including across resets; detached metadata never holds Pi completion open.
- Existing account/runtime/admission, allowed-chat, deliberate Off and pre-transmission guards remain authoritative. Stats preference revisions fence both pending sends and settings commits. No new socket, auth owner, dependency or parallel upload path.

## Executed candidate evidence

All test invocations used a temporary HOME/agent directory, minimal environment and `PI_OFFLINE=1`; no real account data or live provider request.

1. Failing baseline: `npm test -- tests/unit/session.manager.test.ts tests/unit/whatsapp-ng.message-end.test.ts -t 'final stats' --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c1-stats/baseline-results.json` → exit **1**, three expected failures and one passing negative case.
2. Initial focused implementation: **161 passed**, lint/typecheck exit **0**. Follow-on focused native/settlement tests: **71 passed**, lint/typecheck exit **0**.
3. Review candidate: `npm test -- tests/unit/run-report.service.test.ts tests/unit/session.manager.test.ts tests/unit/menu.handler.test.ts tests/unit/whatsapp-command.router.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/pi-routing.compatibility.test.ts --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c1-stats/candidate-focused-results.json` → exit **0**, **166 passed**. Includes real SDK successful/failed `read` execution with mocked provider transport, terminal isolation, production-entry hook wiring, scope/reset/revision rejection, guarded persistence and pending-send capacity retained until actual settlement.

The native SDK fixture exercises actual Pi event dispatch and real built-in read behavior on temporary synthetic files; it does not prove WhatsApp client rendering or production account delivery. Existing production-entry RPC tests are part of the final full-suite gate, not a new live connection.

## Independent review and correction

One fresh read-only review, exact `openai-codex/gpt-6.1-sol` with **high** thinking, run `3fcecdec-db70-47d7-8aff-4c0465f2d866`: **BLOCK on one introduced P2**, no other concrete P0–P3 findings. The report and preflight/source snapshots are retained under `.pi/cache/c1-stats/review/`. The reviewer executed no tests or edits; the frozen source remained unchanged. Its verdict applies to the pre-correction candidate, not the final source.

The finding was valid: enabling or cycling stats after input consumption but before the first assistant frame caused existing input to use the newer preference. Eligibility/revision now latch synchronously at consumption and remain mandatory during later capture/transmission. Missing consumption evidence declines the epoch rather than inferring new eligibility. The known snapshot still supplies account/chat/admission guards at assistant capture.

Before correction, `npm test -- tests/unit/run-report.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/pi-routing.compatibility.test.ts tests/unit/phone-control.rpc.test.ts -t 'consum|retroactively apply|fences \(stats\)' --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c1-stats/review-baseline-results.json` failed with **seven expected failures** and three passing cases. The same selected command with `review-fixed-results.json` passed **10/10** after correction. `npm run lint` and `npm run typecheck` also exited **0**.

Coverage separates disabled consumption → enable, enabled consumption → disable/re-enable, and fresh consumption after enablement. The native SDK holds a public user `message_start` handler while a real local extension command updates the fixture preference. The maintained RPC fixture additionally runs the **actual production `pi -e` entry**, holds dispatch after production consumption, commits the real terminal Reply delivery setting through bounded synthetic UI responses, then verifies no old report and exactly one fresh-input report. Transport and model stream are synthetic; two local fixture model turns occur, with **zero network attempts**. No real user permission prompt or account is involved. The original seven failures include this production-entry reproduction, not merely a substitute handler.

This completes the requested one-review → correction → test sequence. **No second independent OK verdict is claimed.**

## Final gates

Executed after correction, in isolated HOME/agent context with a credential-free environment:

- `npm test -- --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c1-stats/full-results.json` → exit **0**, **1018 passed / 75 files; zero failures/skips**. Includes real SDK tool/final dispatch and three actual production-entry RPC scenarios covering controls, native self-LID polls, replacement/reload/Off and the stats opt-in race.
- `npm run lint`, `npm run typecheck`, `git diff --check` → exit **0**.
- `npm pack --dry-run --offline --ignore-scripts --json` → exit **0**, **52 files**, including the reporter and existing Edge worker, no runtime/test/cache payloads. This is not a newly qualified tarball or clean consumer install.
- Manifest and lock digests match the pre-C1 baseline. No build script is declared, so no build was run. No new dependency audit, platform qualification or clean install was requested/performed; previous results retain their dates.

Detailed command receipts, source snapshots and redacted synthetic RPC evidence are under `.pi/cache/c1-stats/`. No commit, push, publication, live owner process reload, real settings/account mutation or live WhatsApp/speech-provider request was performed.

## Bounded owner check — pending

The offline review/correction/test sequence is complete. The owner now reloads the existing configured updated source without starting a competing instance and explicitly enables final stats. In the approved self-chat, send one harmless task requiring one known read of a public repository file. Observe the normal final answer followed by one stats text, with plausible elapsed time and the actual observed read count. Confirm no raw path, arguments/results, duplicate answer, spoken stats or unrelated terminal output. API acceptance alone is not client visibility. Keep the remaining C1 features deferred and record only what the owner actually confirms.
