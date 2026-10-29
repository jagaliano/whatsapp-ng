# Stable promotion plan

Implements [requirements](spec.md); [tasks](tasks.md) track this source checkpoint. The existing release guide supplied the version/publication procedure before the metadata bump; this per-release record is written during promotion, not represented as a new pre-implementation runtime design.

1. Verify clean source, public version absence and an authenticated listed maintainer. Initial npm E401 stopped work before any publication; the operator explicitly approved interactive npm login and completed browser authentication locally. No credentials/OTPs were read or copied by the agent.
2. Run `npm run release:version -- 1.1.0` on clean source, selecting `latest` without Git tagging or dependency upgrades. Update current docs and changelog; retain dated RC2/discovery evidence and known risks.
3. Check version/lock agreement, unchanged runtime/dependency graph, changed Markdown links and whitespace; secret-scan the explicit candidate. Commit/push the coherent release source using the existing main workflow, without rewriting history or creating release tags.
4. Run clean-commit `npm run release:prepare` (isolated full tests/lint/typecheck, production audit, pack/integrity and publish dry-run). Review fresh full-tree audit scope. Validate the exact stable tarball through secret/member checks and lifecycle-disabled isolated consumer/Pi RPC startup, not repacking. Verify main CI.
5. Use `npm run release:publish -- --confirm 1.1.0 --tag latest` in the supervised terminal for normal npm authentication/2FA. Record an attempt before one actual publish. On failure/unknown outcome, inspect the registry and retained attempt rather than retrying automatically.
6. Check public version/integrity/tags against the prepared receipt. Install the exact published registry version in an isolated consumer if publication succeeds. Record completion locally without changing the already-qualified tracked source.

## Evidence and boundaries

The prior [RC2 evidence](../040-rc2-publication-readiness/validation.md) remains dated. Stable results bind the new commit and artifact in `.pi/cache/releases/prepared.json`; publication attempt metadata and local stable qualification records hold actual post-commit outcomes. These are local receipts, not shipped public test scripts or proof of all-platform/live acceptance. Do not amend tracked documentation after preparation without preparing again.

## Pre-commit checks

The promotion diff changes only version/channel metadata and documentation; runtime/tests/scripts and the dependency graph match the qualified RC2 source. On October 29, 2026, isolated release/workflow/manifest tests passed **90/90**; lint/typecheck and whitespace passed. Production audit returned zero findings; full-tree audit retained the known one high/one moderate SDK/Undici findings. Changed Markdown validation covered 9 files/59 relative links with no failures; the 11-file candidate secret scan passed. These results do not substitute for the clean-commit full suite and artifact/registry qualification below.

## Complexity Tracking

No new runtime abstractions, dependency versions, provider integrations or storage/authentication behavior. This is explicit maintainer promotion with normal browser authentication, not an indexing fix or waiver of integrity/production-audit gates. Broader Windows/Linux artifact/live acceptance is not claimed; the prior risk disclosures remain applicable.
