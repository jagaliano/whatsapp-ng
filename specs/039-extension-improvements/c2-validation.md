# C2 group and self-chat behavior

Work in `/Users/jagaliano/workspace/whatsapp-ng-release`; preserve all earlier A/B/C1 work. Baseline: 1018 tests/75 files. Public source and manifest snapshots are local under `.pi/cache/c2/`. The previous LICENSE read returned `MIT License`; that alone is not owner confirmation that C1 stats rendered on the client.

## Implementation contract

- Global `groupReplies` preference: `mode` is `mentions-or-replies` (new default), `mentions`, `replies` or `all`; `context` defaults false. Validate defensive snapshots and guard atomic commits/revisions using the existing settings queue. Add an explicit terminal Group replies setting; enabling preceding text requires confirmation. Preserve malformed stored data and unrelated settings rather than silently opting in.
- Apply automatic group policy after verified phone controls, before any media download. Actual Baileys context mention/reply fields and authenticated socket own PN/LID identity determine addressing, never rendered text. Owner commands/poll handling and group-only binding remain intact.
- Only verified self-chat own-direction messages trigger automatic replies; other own-direction messages may still carry explicit authorized controls but never become automatic tasks. Keep registered outgoing echo, history/import/replay exclusions; do not drop genuinely manual self text merely for ending in the legacy Pi suffix.
- Optional preceding context: live plain text only, at most 20 messages/group, 2000 characters/message, 30-minute expiry, 50 groups and one account/runtime lifetime. Clear after use, settings changes, pause/admission revision, disable, account/session reset. No media download to fill context; context cannot confer author/owner authority. A single unref'd expiry timer clears idle buffers; reset cancels it. Included context becomes normal Pi/model history, so buffer clearing is not history erasure.
- Group text/audio referencing an image may reuse only an existing same-chat, participant/direction-matched, unexpired quote projection/raw image through the existing media service. Never download a supplied quoted payload or invent missing/expired/view-once media.
- Existing Voice settings already distinguish enabled/paused chats. Make phone status explicitly show automatic-reply pause state. A stale queued admission must abort before model execution rather than merely suppressing its reply; never replay backlog on re-enable.

## Reproduction and corrections

- Seven selected initial regressions failed in the existing persistence, intake, production-hook and router suites. Command/result receipt: `.pi/cache/c2/baseline-command.json` and `baseline-results.json`.
- A maintained actual production-entry `pi -e` RPC case reproduced stale queued group admission: consume a direct anchor, queue a group mention, commit **Replies only** through real terminal UI, then release dispatch. Before correction a second usable fixture-provider call occurred (expected 1, observed 2). Receipt: `native-baseline-command.json`, `native-baseline-results.json`. The first harness attempt had a test-variable shadowing error; that was corrected before this meaningful baseline and is preserved separately, not counted as a product finding.
- `ConversationRouter.isRetiredInput()` now permanently withdraws a stale/throwing admission predicate before native inference and retains hash-only protection until consumption/abort, preserving existing combined capacity. The RPC case now observes only the anchor's usable provider call; a fresh valid group reply afterwards works. Existing Pi history is not deleted.
- Parent checks corrected a missing-export test mock, a protocol image type name and one root-menu expected-options snapshot. Additional cases cover transport-only self aliases before the legacy suffix filter, actual cached-image privacy boundaries, idle expiry and context timer cancellation. These are parent corrections, not an independent reviewer verdict.

## Final executed gates

All commands ran in `/Users/jagaliano/workspace/whatsapp-ng-release` with temporary HOME/agent directories, a minimal environment without inherited credentials and `PI_OFFLINE=1`.

- `npm test -- tests/unit/group-message.policy.test.ts tests/unit/session.manager.test.ts tests/unit/whatsapp.service.intake.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/whatsapp-ng.extension.test.ts tests/unit/conversation-router.service.test.ts tests/unit/menu.handler.test.ts tests/unit/phone-control.rpc.test.ts --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c2/complete-focused-results.json` → **257 passed**, exit **0**.
- `npm test -- --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c2/complete-full-results.json` → **1049 passed / 76 files**, no failures/skips, exit **0**.
- `npm run lint`, `npm run typecheck`, `git diff --check` → exit **0**.
- `npm pack --dry-run --offline --ignore-scripts --json` → exit **0**, **53 files**, no test/cache/runtime payload. This is a contents dry run, not a newly qualified tarball or clean install.
- `package.json` and `package-lock.json` match the pre-C2 digests. No build script is declared; no build was run. New dependency audit, clean install and platform qualification were not requested or performed.

Five actual source-entry RPC scenarios use only synthetic transport/model streams, fresh generated auth fixtures and blocked network. The new group case proves stale admission is aborted and fresh group work recovers; the self-LID case accepts manual `π` text and injects a registered echo before send completion without starting another model turn. Existing control, poll, stats, Off/reload/replacement cases remain green. Unit tests cover all four trigger modes, non-text context exclusion, explicit context confirmation, cache bounds/expiry/scope/pause, retained image versus spoofed/missing/foreign/deleted/expired/view-once quotes, and guarded preference round-trip preserving stats/pauses.

At that offline checkpoint no independent review had been performed. A subsequent exact Sonnet 5.5 review and parent corrections are recorded in [the C2/C3 disposition](c2-c3-review.md). The offline implementation did not mutate real account/settings, reload the owner process, perform live WhatsApp/speech-provider tests, commit, push or publish. Source and test snapshots/receipts remain local under `.pi/cache/c2/`. The later owner-operated live follow-up is recorded separately below.

## Owner-controlled live check — PASSED for group mention/reply

The owner initially deferred the live check, then performed it in the configured test group using another participant/account:

1. A native mention of the Pi-linked account asked `what is 6 x 7`; the assistant answered `42` in the group.
2. A native reply to the assistant's `42 π` message asked `What is 7x7`; the assistant answered `49` in the same group.
3. The owner explicitly confirmed: “OK C2 live tested and working.. You can record it”.

This closes the previously deferred live gate for the tested group mention/reply flow, with owner-confirmed client acceptance. Actual requests and answers were observed in this session; this is not inferred solely from API acceptance or synthetic tests. Real participant identifiers are deliberately omitted from this public record.

No ordinary-unaddressed-message negative result, alternate modes, optional preceding context, quoted-image handling, pause/re-enable, self-chat echo behavior, other clients/groups, exact duplicate-transmission telemetry or platform coverage is claimed live-verified by this follow-up. Those remain supported by the separately scoped offline evidence or need separately approved live checks. No additional test, reminder, send, reload or settings mutation is scheduled automatically.
