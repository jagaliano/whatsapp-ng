# Owner-guidance tasks

Derived from [plan.md](plan.md).

- [x] O052-1: inspect denial/authorization/navigation/owner chooser and mirrored tests; confirm stale guidance without real-state inspection.
- [x] O052-2: reproduce phone/localized/native-entry guidance failures with synthetic regressions before production edits.
- [x] O052-3: correct navigation copy and public guidance while preserving verified-owner and speech-consent behavior.
- [x] O052-4: run affected/native-entry/full isolated checks and static documentation validation; record results and remaining operator scope.

## Subsequently authorized review

- [x] O052-5: complete one fresh native `anthropic/claude-opus-5-5`/high read-only review, verify actual model/completion and unchanged hashes, inspect findings and report scope/limits without Git or live operations.

## Evidence and limits

Before production edits, isolated `npm test -- --maxWorkers=2 tests/unit/owner-menu-guidance.test.ts tests/unit/whatsapp-command.router.test.ts --reporter=json --outputFile=<local-report>` failed **10 cases**, with 77 passing: eight locale/navigation-copy cases and two denied voice commands. The selected production-entry command `npm test -- --maxWorkers=2 tests/unit/phone-control.rpc.test.ts --testNamePattern=owner-guidance --reporter=json --outputFile=<local-report>` separately failed the stale route assertion; 15 unrelated modes were filtered, not unavailable-platform skips. Parent checked the JSON failures were the expected route mismatch, not RPC startup failures.

## Post-correction source validation — 2026-11-02 UTC

Platform: Darwin x86_64, Node v26.13.0, existing Pi 1.4.0 development cohort. The local helper runs commands with disposable HOME/USERPROFILE/APPDATA/LOCALAPPDATA and `PI_CODING_AGENT_DIR`, an allow-listed credential-free environment, `PI_OFFLINE=1` and English locale. `PI_OFFLINE` is not a network sandbox: existing provider/socket mocks and production-entry RPC guards isolate account/provider boundaries; synthetic loopback server tests remain allowed.

- `python3 .pi/cache/052-owner-menu-guidance/run-checks.py baseline` and `native-baseline` invoked the failing npm commands above before production edits. These private local helpers/JSON reports are not shipped reproducible scripts.
- `python3 .pi/cache/052-owner-menu-guidance/run-checks.py focused` ran `npm test -- --maxWorkers=2 tests/unit/owner-menu-guidance.test.ts tests/unit/whatsapp-command.router.test.ts tests/unit/owner-authorization.service.test.ts tests/unit/menu.handler.test.ts tests/unit/voice-settings.view.test.ts tests/unit/phone-control.rpc.test.ts --reporter=json --outputFile=<local-report>`: **197 passed across six files**, zero failures/skips. All 16 production-entry RPC modes ran, including the new unset-owner denial and actual Chats / Owner → Owner navigation, unchanged owner/speech settings, no model work and zero guarded network attempts.
- `python3 .pi/cache/052-owner-menu-guidance/run-checks.py full` ran `npm test -- --maxWorkers=2 --reporter=json --outputFile=<local-report>`: **1,589 passed across 85 files**, zero failures/skips, followed by `npm run lint` and `npm run typecheck`, both exit 0. Typecheck covers production source/entry; lint and actual-entry loading cover the changed TypeScript fixture. No build script exists.
- `python3 -` static assertions passed for all 12 intended changed/new files, including six Markdown files and **41 relative paths/anchors**. Production changes were verified string-only; authorization, entry, menu/settings logic and dependency files are unchanged. `git diff --check` exited 0. Candidate-scoped `gitleaks dir --redact=100 --no-banner --report-format=json --report-path=<local-report> <isolated-candidate>` exited 0 with zero findings; not a whole-history/real-state scan. External URL availability was not checked.

No actual saved owner, current chat's verified identity mapping or speech approval was inspected or changed. At that implementation checkpoint, no new independent review, audit/install, model download, real account/provider call, owning-Pi reload, staging/commit/push or release operation ran. The subsequent review request is tracked separately above. Live reload/owner selection and a phone retry remain operator-controlled; no claim of recipient/client acceptance, native speech accuracy or new Linux/Windows qualification follows from these fixtures. The copy fix does not diagnose or bypass an actual owner-identity mismatch.

## Independent review — 2026-11-02 UTC

Native `anthropic/claude-opus-5-5`/high run `c6d4d151-5cee-4b3a-866b-88dd3be7cc3c` completed: **OK with notes; no blocking issue**. Parent verified the completed native model/high status, actual assistant-model metadata, read/grep-only tool calls and all 12 frozen public-file hashes unchanged through review. No fallback, nested delegation, reviewer writes/commands/network or real-state access occurred.

Parent verified these optional notes against current source; they remain unapplied because this request was review-only:

- F1 (low, high confidence): the phone router's otherwise-English denial hardcodes the final `Owner` submenu label. Non-English terminals display `Proprietário`, `Propietario` or `Propriétaire`; the localized authorization and welcome messages are correct, but this phone denial remains English. A follow-up could resolve the submenu label at send time and add a non-English router regression without changing the generic denial policy.
- F2/F3 (test advisories): locale tests derive expectations from the same translation function and do not independently prove that each locale loaded; add literal localized-label assertions. Root `Voice` guidance is correct but its occurrence in authorization copy is not explicitly tested.
- F4 (test advisory): the RPC case starts with default/unapproved speech settings, so its unchanged-preferences comparison is weaker than seeding explicit preferences. The route, unset owner/no automatic appointment, no-model and zero-network assertions remain useful; the unit `/voice text` case independently protects denial without mutation.
- F5 (clarity advisory): directly connect spoken `/voice` modes with enabled speech and destination/group approval in the new paragraph if desired. The preceding reference paragraph already documents those requirements, so parent treats this as optional clarity, not absent policy or a blocker.
- Pre-existing low-severity wording outside the 12-file diff: `configure_wa_tts`'s tool description in `whatsapp-ng.ts` mentions `Voice` and then `Owner` without the grouped Owner path. No runtime/tool-description change was applied during this review. Historical changelog wording remains historical.

Coverage: the reviewer fully read the phone router, navigation function, OwnerAuthorization, new locale test, fixture extension and 052 records; RPC/router test regions, owner chooser, entry wiring and reference were sampled. Changed i18n keys/labels and the changelog/index were searched or diff-reviewed, not fully audited. SessionManager, package/config and unrelated tests were not deeply reviewed. Parent command results, hashes, source behavior, actual saved-owner identity, native speech, registry/live/client/platform outcomes were not independently reproduced by the reviewer. The earlier test/lint/typecheck results remain parent-run evidence; they were not rerun for this review-receipt-only addition. No commit, push, live reload or real settings change was authorized or performed.
