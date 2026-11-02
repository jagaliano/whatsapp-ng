# Release 1.1.4 checkpoint

Derived from [plan](plan.md); requirements: [spec](spec.md).

**Record status:** Frozen pre-publication checkpoint. Checkboxes describe this source commit, not later npm/CI outcomes. Original local release receipts and registry verification own post-commit evidence; this record does not authorize re-preparation, publication retries or additional changes.

- [x] V001 Owner approved 1.1.4 stable/latest, direct `main` commits/push and version-only lock metadata.
- [x] V002 Verify reviewed 052/053 scope, staging, hooks and source hashes; commit coherent UI changes as `df91db0`.
- [x] V003 Run clean-tree `npm run release:version -- 1.1.4`; verify package version and the lock's top/root package versions are the only semantic JSON changes. Update changelog/index/release records.
- [ ] V004 Commit validated release metadata, then prepare exact clean-source artifact and retain integrity/source/command receipts.
- [ ] V005 Complete isolated exact-artifact consumer/Pi qualification and inspect fresh audits without broadening inherited risk claims.
- [ ] V006 Push main normally, verify exact remote commit and CI; restore ordinary owner npm authentication if needed.
- [ ] V007 Publish prepared bytes once after all gates; verify registry version/integrity/tags and exact registry consumer startup. Unknown outcomes stop without retry.

## Pre-commit evidence

- Source implementation gate: 1623 tests / 86 files, no skips; lint/typecheck pass, actual-entry UI/owner RPC on repository Pi 1.4.0 and global Pi 1.5.0 passes. Opus final review was OK with notes; three navigation/expiry notes were corrected after failing regressions, focused re-review returned OK. These are source/fixture results, not artifact/live certification; see [053 evidence](../053-consistent-settings-menus/tasks.md).
- Reviewed public-candidate scan: no Gitleaks findings. Staged check identified one extra EOF blank line in a new review record; removed it before commit without runtime/test changes. No active repository Git hooks or unrelated staged files.
- Metadata checks: `npm test -- tests/unit/release-script.test.ts tests/unit/release-workflow.test.ts --maxWorkers=2` passed 84 tests in two files under a disposable credential-free HOME/agent directory. Release-record Markdown links and staged whitespace/privacy are checked before commit; fresh full artifact preparation remains separate.
- Version command succeeded on clean `df91db0`. Structured comparison confirms no graph, integrity, direct dependency, peer or publish-channel change. Stable channel remains `latest`.
- Public registry preflight returned latest 1.1.3 and next 1.1.0-rc.1. Authentication preflight returned **E401 Unauthorized**; this is not a publication attempt. Ordinary owner login is required before publishing. No credentials or npm logs were read, no attempt marker created and no retry/fallback authorized by this failure.

Fresh prepared-artifact/production-audit/consumer/CI/npm outcomes are not asserted here. No new real provider/model, broader platform qualification or owner-process reload was performed. Existing [dependency risk](../../DEPENDENCIES.md) and [security/live limitations](../../SECURITY.md) remain in effect. No dependency upgrade, Git tag, GitHub release or automation activation is part of this request.
