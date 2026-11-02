# Release 1.1.4 plan

Requirements: [spec](spec.md). Checkpoint status: [tasks](tasks.md). This plan authorizes only the owner-approved release, not retries or later releases.

1. Verify the reviewed 052/053 source/hashes, explicit staging, hooks and privacy/whitespace checks. Commit the coherent UI work on approved `main`; preserve existing local history. This completed as `df91db0`.
2. From clean source run `npm run release:version -- 1.1.4`. Verify normalized JSON equality except package version and the two root lock-version fields, update changelog/index/this record, validate metadata and commit it separately. No package install or dependency-resolution refresh.
3. Run `npm run release:prepare` on the clean release commit: isolated full tests/lint/typecheck, fresh public production audit, allow-listed tarball/source bytes and integrity, dry-run and receipt. Also inspect full-tree risk separately without suppression/upgrades, scan the public candidate, and qualify the exact tarball with a lifecycle-disabled isolated consumer and network-guarded Pi startup/command/session replacement. Never use real state.
4. Push `origin/main` without force, verify exact remote HEAD and new-head CI. Do not create/push tags or alter automation. Complete safe preparation/delivery even if npm login needs owner action, but do not attempt real publication without normal authentication.
5. Recheck matching source/artifact/CI, current npm identity/rights, structured target-version absence and no attempt marker. Request ordinary owner `npm login` when E401 occurs; never read credential files or use alternative keys.
6. Invoke `npm run release:publish -- --confirm 1.1.4 --tag latest` once. Verify exact registry integrity/version/latest and report `next` without retagging it. Confirm a fresh exact registry artifact in a disposable consumer. Unknown outcomes stop for inspection, never automatic replay.

## Owner-approved preparation follow-up

The npm 12 pack-output failure and the explicitly selected compatibility fix have a separate [requirements/plan/task checkpoint](npm12-compatibility.md). Re-prepare the new committed source; do not reuse the failed candidate or manufacture its receipt.

## Complexity Tracking

No new release tooling, dependency or runtime abstraction. Use existing guarded release commands, synthetic startup fixtures and read-only registry/CI queries. The owner explicitly allowed only root lock version metadata; any graph change is a stop condition. Checkpoint records deliberately precede clean-source preparation; post-commit outcomes are retained locally so documentation edits cannot invalidate a prepared receipt.
