# Stable promotion plan

Historical promotion record, written during release integration using the existing release procedure. See [requirements](spec.md) and [tasks](tasks.md). These steps do not authorize another publication.

1. Verify clean source, public version absence and an authenticated listed maintainer. Initial npm E401 stopped work before any publication; the operator explicitly approved interactive npm login and completed browser authentication locally. No credentials/OTPs were read or copied by the agent.
2. Run `npm run release:version -- 1.1.0` on clean source, selecting `latest` without Git tagging or dependency upgrades. Update current docs and changelog; retain dated RC2/discovery evidence and known risks.
3. Check version/lock agreement, unchanged runtime/dependency graph, changed Markdown links and whitespace; secret-scan the explicit candidate. Commit/push the coherent release source using the existing main workflow, without rewriting history or creating release tags.
4. Run clean-commit `npm run release:prepare` (isolated full tests/lint/typecheck, production audit, pack/integrity and publish dry-run). Review fresh full-tree audit scope. Validate the exact stable tarball through secret/member checks and lifecycle-disabled isolated consumer/Pi RPC startup, not repacking. Verify main CI.
5. Use `npm run release:publish -- --confirm 1.1.0 --tag latest` in the supervised terminal for normal npm authentication/2FA. Record an attempt before one actual publish. On failure/unknown outcome, inspect the registry and retained attempt rather than retrying automatically.
6. Check public version/integrity/tags against the prepared receipt. Install the exact published registry version in an isolated consumer if publication succeeds. Record completion locally without changing the already-qualified tracked source.

## Evidence and boundaries

Keep [RC2 evidence](../040-rc2-publication-readiness/validation.md) dated. Stable commit/artifact identity belongs to `.pi/cache/releases/prepared.json`; local attempt/qualification receipts hold post-commit outcomes. They are not shipped scripts or all-platform/live proof. Tracked edits require preparation again.

## Pre-commit checks

October 29, 2026 checkpoint: metadata/docs-only diff; runtime/tests/scripts/dependencies matched RC2. Isolated release/workflow/manifest tests **90/90**, lint/typecheck/whitespace passed; production audit zero, full-tree audit one high/one moderate SDK/Undici findings. Markdown: 9 files/59 links passed; 11-file candidate secret scan passed. This did not replace clean-commit full-suite/artifact/registry qualification.

## Complexity Tracking

No new runtime abstraction, dependency/provider or storage/auth change. Promotion was explicitly approved, not an indexing remedy or integrity/audit waiver. Prior risks and broader platform/live limits remain.
