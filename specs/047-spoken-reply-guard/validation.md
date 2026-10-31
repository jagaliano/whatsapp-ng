# Validation — 2026-10-31

Scope: source checkout on macOS x86_64, Node v26.13.0/npm 11.20.0 and existing Pi SDK 1.4.0 development cohort. Disposable HOME/agent directories, allow-listed credential-free environments, external-network guards and synthetic socket/model boundaries; no real session transcript, account, provider or native speech inference was used.

## Test-first evidence

- Before runtime changes, `npm test -- --maxWorkers=2 tests/unit/final-output.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts` failed 17 new cases: ten missing-query cases and seven entrypoint guard expectations. Existing compatibility cases remained green.
- `npm test -- --maxWorkers=2 tests/unit/phone-control.rpc.test.ts -t spoken-guard` failed because the actual production entry accepted the text tool call. The fixture runs real Pi with `--no-extensions -e whatsapp-ng.ts`, synthetic transport/provider and temporary configuration; it is not a replay of the private reported session.
- An additional actual-MessageSender preflight test failed when a different chat gained a verified owning-chat alias during archive await. After that check was added, two separate regressions exposed the final service-resolved transport recipient not reaching the guard. The trusted predicate now receives that optional argument; existing zero-argument predicates remain compatible. Each failing baseline preceded its corresponding production change.

## Final results

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2 tests/unit/final-output.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/message.sender.test.ts` | 180 passed/three files. |
| `npm test -- --maxWorkers=2 tests/unit/phone-control.rpc.test.ts -t spoken-guard` | One passed; fourteen other cases deliberately filtered here, then included in the full suite. Zero external network attempts. |
| `npm test -- --maxWorkers=2` | 1536 passed/84 files; no skips. |
| `npm run lint` | Exit 0; includes the changed TypeScript RPC fixture. |
| `npm run typecheck` | Exit 0; production entry/source scope, not standalone test typechecking. |
| `git diff --check` and changed Markdown link/anchor checks | Passed; including incoming links. |

Coverage includes Voice/Both/audio-Mirror refusal before send/history/synthesis effects, one later normal spoken final, explicit JID/PN/LID/quote and gateway checks, late identity/final-transport fencing, disabled/unapproved/text/non-audio/group boundaries, captured policy revocation, terminal/idle/manual and other-chat compatibility. Existing router/send tests retain accepted/in-flight/unknown deduplication and no speculative resend behavior. The real-Pi fixture deliberately uses a code-bearing final answer to exercise complete-text fallback without calling a speech provider; entrypoint unit tests independently prove the eligible voice path.

## Limits and delivery

The unrelated pre-existing ROADMAP.md bytes remain unchanged. At the implementation-validation checkpoint, no dependencies, version, settings, consent, real state, Git index/commits/remotes, release artifacts or automation had changed. No independent subagent review, fresh audit/package qualification or Linux/Windows/live-client check ran; those are outside this source-only change. The ignored 039 plan remains untouched and its historical record gap is not waived.

The owner subsequently authorized local main commits for these changes and the existing roadmap proposal. Its Edge-probe statements were not rerun or independently verified here; committing the unchanged proposal is not a new diagnosis or retry implementation. New commit-only record edits are documentation, not another runtime validation run. Actual commit hashes belong to local Git receipts rather than invented pre-commit completion checkboxes.

Changes are not installed/published or proven live. Reload/restart of a Pi instance loading this checkout is an operator action; the published 1.1.1 package remains unchanged.
