# npm 12 preparation compatibility

## Authorized follow-up — 2026-11-02

After `85cd71d` was committed and pushed, clean-source `release:prepare` completed isolated test/lint/typecheck gates and the production audit, then stopped at npm pack result parsing. It created no prepared receipt or 1.1.4 publication-attempt marker. Installed npm 12.2.1 returns a single package-keyed object; CI's pinned npm 11.20.0 returns the already-supported single-entry array. A separate dry-run reproduced the keyed shape without publishing.

The owner explicitly selected **fix npm 12 compatibility**, rather than installing another npm runner, and completed normal local npm login. A subsequent `npm whoami` verified `jagaliano`; the target-version lookup returned structured `E404`. Neither is a publication guarantee or permanent reservation. No credentials/npm logs were read and no alternate credential path was used.

## Requirements and plan

1. Add failing preparation regressions for the observed npm 12 keyed result. Retain npm 11 array coverage and explicitly reject empty, multi-package, foreign-key, bare-object and malformed results before receipt publication or a publish dry-run.
2. Normalize only npm pack's single expected package result. Preserve package/version/filename, member allow-list, source/HEAD, audit, integrity, auth/absence and no-retry gates. Do not normalize unrelated registry results or accept a guessed package key.
3. Run affected release/workflow tests and source lint/typecheck, inspect the small parser change, update release command documentation and commit/push this separately. No dependency, global npm or runtime UI change.
4. Repeat clean-source preparation and exact-artifact consumer/Pi/CI checks on the new commit. Keep the failed artifact unqualified; never manufacture/adopt a receipt for it. Only then publish once under the original owner authorization and verify registry evidence.

## Tasks and evidence

- [x] N001 Observe npm 12's package-keyed pack JSON, clean Git state and absent prepared/attempt markers; confirm ordinary owner login.
- [x] N002 Reproduce failing regressions before the parser fix, retain all existing release safety tests.
- [ ] N003 Implement/review the bounded compatibility fix and commit/push validated source.
- [ ] N004 Re-prepare and qualify the exact new candidate, verify new-head CI, then perform the originally approved one-shot publication.

The pre-fix focused regression run produced 10 failures / 79 name-filtered skips. After the bounded parser change, `npm test -- tests/unit/release-script.test.ts tests/unit/release-workflow.test.ts --maxWorkers=2` passes 94 tests in two files in a disposable credential-free HOME/agent directory. `npm run lint`, `npm run typecheck` and `git diff --check` pass. Existing source/identity/integrity/auth/E404/attempt-marker and npm 11 preparation tests remain passing. Parent inspection confirms the patch changes only pack-result selection before the existing checks; no independently delegated review of this release-tool patch is claimed.

This is another pre-publication source checkpoint. Later preparation/CI/npm outcomes remain in original local receipts; no successful publication is asserted here.

## Complexity Tracking

A small local result-shape check in the existing release coordinator is sufficient. No new dependency, abstraction, install, authentication method or release retry. Multi-package/unknown response forms fail closed rather than choosing the first candidate.
