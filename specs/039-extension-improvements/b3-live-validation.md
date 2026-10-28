# B3 native-poll correction and live gate

## Observed live failure

The owner explicitly confirmed: selecting a poll option does nothing; typing the corresponding number works. The self-chat poll screenshot shows a selected Next page vote. That proves rendering/client-side selection, not Pi action. The actual encrypted live packet was not captured. After the correction, the owner reported that a fresh native Next page selection displays page 2; this bounded navigation success is recorded below.

## Implemented correction

- Numbered menus are now the default. Both native poll emission and vote dispatch require local `--whatsapp-ng-native-polls` opt-in; no persistent settings/consent changes.
- Pinned `cleanMessage` leaves own-direction creation references with an implicit enclosing chat. Accept missing creation chat only inside the same verified actor/scope/current menu, matching active poll ID and explicit own creation direction; explicitly foreign chats remain rejected.
- Keep canonical actor authorization separate from raw cryptographic author identity. Try at most two creator/two voter identities, using only verified aliases or own connected-socket LID metadata. Aggregate by verified actor equivalence. At most four authenticated decryption attempts; existing payload/menu/key-lifetime bounds remain.
- Fixed terminal-only decryption warning contains no packet, key, JID, ID or content; rejected votes retain numbered fallback. Existing admitted intake remains the only listener path.

## Sequence and evidence

Checkout: `/Users/jagaliano/workspace/whatsapp-ng-release`. Pre-existing work and dependency manifests were preserved.

1. Executed **five failing baseline regressions**, including real production-entry `pi -e` RPC self-LID pagination; the existing direct flow passed.
2. Candidate focused run: **148 tests passed**, lint/typecheck passed. Tests include real Baileys generation/clean/decrypt helpers, implicit self references, LID/mixed authors, peer/group aliases, spoof rejection and fallback. Generated temporary credentials and mocked socket only; no real account data.
3. Exact `openai-codex/gpt-6.1-sol`, **high**, fresh read-only review `be9dea85-32ed-45f5-b787-b01705f75517`: **OK**, no introduced P0–P3 findings. No corrections requested. Report: `.pi/cache/b3-live/review/report.md`. No independent live qualification was implied.
4. Final `npm test -- --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/b3-live/full-results.json`: **984 passed / 74 files; zero failures/skips**. `npm run lint`, `npm run typecheck`, `git diff --check`: exit **0**.
5. `npm pack --dry-run --offline --ignore-scripts --json`: **51 files**. This is not a newly qualified tarball or clean install.
6. Actual isolated source startup: `pi --mode rpc --no-session --no-extensions --no-skills --no-prompt-templates --provider openai --model gpt-4o-mini -e /Users/jagaliano/workspace/whatsapp-ng-release/whatsapp-ng.ts --whatsapp-ng-native-polls`: exit **0**, six responses/two session replacements, zero network attempts/model prompts/speech requests, no real WhatsApp state. Full RPC tests additionally verify exactly one page-2 response from the encrypted vote and zero poll creations in default mode.

Detailed command receipts, test output and snapshots are local under `.pi/cache/b3-live/`. No build script exists. No new audit/platform/clean-install qualification, dependency change, live process reload, commit, push or publication was performed.

## Bounded live retest — self-chat navigation passed

Owner report after the requested fresh native vote: “Yes page 2 shows”. Read-only local history shows the fresh `/model`, a page-1 menu, then one retained page-2 response about 3.5 seconds later, with no typed-number message between the menus. Owner attestation establishes client visibility; local acceptance alone would not. This closes the reported navigation failure for this self-chat scenario.

The owner then confirmed a native thinking-level selection acknowledgement. Local history contains the new thinking menu followed by `Shared thinking level: high.` and the owner's confirmation; the selected existing preference was retained. Model selection, group/other-client behavior, duplicate-transmission count and provider/inference telemetry are not claimed verified. Native polls remain experimental opt-in. The procedure and pass criteria used were:

- Owner stops the current Pi normally and restarts the existing configured invocation with `--whatsapp-ng-native-polls`; do not start a competing instance or add a duplicate extension entry. Login/settings/archive remain untouched.
- In the approved self-chat, send a **fresh** `/model`. Select **Next page once in the new poll**, without typing its number. There is no separate Send button.
- Pass condition: exactly one new page-2 menu/action acknowledgement, no model selection or inference. Record what the owner actually observes; self-chat alone does not qualify other clients/groups.
- If nothing happens, keep numbered fallback, collect only redacted stage metadata and continue diagnosis. Do not claim the live gate closed or enable polls by default.

Bounded self-chat navigation and thinking acknowledgements are now owner-confirmed. The next implementation slice is C1.1 default-off final elapsed/tool-count stats; other C1 reporting features follow separately.
