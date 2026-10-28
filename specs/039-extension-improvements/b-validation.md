# Increment B validation — October 26, 2026

Implementation checkout: `/Users/jagaliano/workspace/whatsapp-ng-release`. Scope: phone controls and menus; see the [current command reference](../../README.md#phone-controls). Existing Increment A, Edge, packaging and documentation work was preserved. Increment C was not started.

## Delivered

- Exact phone commands before media/model processing; verified actor/participant ownership for mutations, allowed-chat read-only help/status, shared-session disclosure and idle/pending guards.
- Exact authenticated model selection, supported thinking levels, observed compaction callbacks, stop/abort, a one-use real command-context session gateway, cancellation recovery, approved voice/reply preferences and confirmed Off/quit.
- Numbered menus first, optional native single-choice polls through the existing admitted intake, frozen scope/actor/options, quoted group numeric replies, 50-menu/five-minute bounds and expiry erasure of extension-owned poll secrets. Poll payloads bypass the general retry cache/archive; no uncertain-send retry.
- Pending and withdrawn inputs share 500 reserved slots. Withdrawn hashes never age/count-evict; exact native consumption releases a slot only after synchronous public abort succeeds. Hash-only evidence survives factory recreation. Saturation refuses new admission rather than restoring old execution eligibility.
- Off is process-local and auth-profile-bound, survives real session replacement/reload, suppresses auto-connect and withdraws outbound tools. Terminal Connect alone clears that intent. Local history/config remains available; network history is guarded. Fresh-process startup still follows explicit startup flags.
- Speech consent/group opt-in stays terminal-owned. Phone `/replies` exposes attachment-final policy only; stats/progress/activity remain unimplemented. The relaxed all-allowed-chats mutation policy is not enabled.

## Independent review and corrections

Exact actual model/thinking verified from both child session logs: `openai-codex/gpt-6.1-sol`, **high**, no fallback. `pi-subagents` 0.83.0; fresh public snapshots, no ambient extensions. Tool logs show read/search calls plus framework-added `contact_supervisor` progress updates only; no writer, shell, execution, delivery or agent-spawn calls. Frozen source digests are unchanged by both reviews.

- R1 `da637571-a8bc-4b4d-8624-2086cd632476`: **BLOCK**, P2 retirement eviction/expiry could revive retained Pi follow-ups; P3 explicit relative/home/UNC paths were not fully redacted.
- Parent additionally reproduced Off reactivation across native `new_session` without any model/network activity.
- Executed nine failing correction regressions before fixes. Added combined-capacity, expired-pending, abort-success/failure, factory-recreation, path-output and Off replacement/reload coverage. Initial fixture-only missing mock API/ctx errors were corrected before full validation.
- Focused R2 `0160a1f9-f530-4628-8716-0689deb7af87`: **OK**, no actionable findings; both R1 findings closed and Off lifecycle fix verified statically.
- Setup preflight initially rejected literal `[]` agent-list syntax; native launch separately rejected an unsupported option before spawning. Each was corrected and retried once in the same mode; neither launched a child or selected a fallback.

Reports/metadata are retained locally under `.pi/cache/b/review/`, `.pi/cache/b/review-corrections/` and `.pi/cache/b/review-metadata.json`. Reviewers did not execute tests; command evidence below is the parent's.

## Final commands and results

Credential-variable-free environment, isolated HOME/agent directory, `PI_OFFLINE=1`, two Vitest workers:

- `npm test -- --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/b/final-full-results.json`: **976 passed / 74 files, 0 failures, 0 skips**.
- `npm run lint`: exit **0**.
- `npm run typecheck`: exit **0**.
- `git diff --check`: exit **0**.
- `npm pack --dry-run --offline --ignore-scripts --json`: exit **0**, **51 files**, no test/cache payloads.
- `npm pack --offline --ignore-scripts --json --pack-destination /Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/b/package`: exit **0**, **51 files**, every packaged byte equals source. SHA-1 `30b21345df4d6754392735a067eb3cfc41621134`; SHA-256 `27157053825bd1494cabbcec6373fa8cfb86ea75feb9bcb9719e9b54f3f351d2`.
- Source startup: `pi --mode rpc --no-session --no-extensions --no-skills --no-prompt-templates --provider openai --model gpt-4o-mini -e /Users/jagaliano/workspace/whatsapp-ng-release/whatsapp-ng.ts`.
- Packaged startup: `pi --mode rpc --no-session --no-extensions --no-skills --no-prompt-templates --provider openai --model gpt-4o-mini -e /Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/b/package/extracted-27157053825b/package/whatsapp-ng.ts`.
- Both startup commands: exit **0**, registered WhatsApp command, two session replacements/six responses each, zero network attempts/model prompts/speech requests. Packaged checks reuse installed dependencies via a temporary artifact-directory symlink, not a new clean install.

The full suite includes actual production-entry Pi RPC against a mocked socket and freshly generated synthetic credentials: forged token rejection, cancelled/new session IDs, saved-state successor reconnect, and Off across both `new_session` and public `ctx.reload()`. Exactly two socket constructions cover initial plus the approved phone successor; Off adds none. The separate native queue test proves an already-aborted signal at provider entry, not zero SDK method entry or removal of old history/context.

Final runtime hashes match the focused review snapshot. `package.json` and `package-lock.json` match the pre-B baseline, including the pre-existing `private: false`; no publication guard or dependency was changed. The Git index remains untouched.

## Limits and deliberate skips

No real WhatsApp connection/send, live process reload, speech-provider request, production config/auth/history mutation, logout, commit, push or publication. New auth writes were generated temporary fixtures only. No new production audit, clean consumer install, Linux/Windows qualification, human poll-client compatibility or live command acceptance is claimed. Prior audit/live-speech evidence remains separately dated. No build command exists in the manifest; this is a source-loaded TypeScript extension.
