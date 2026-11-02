# Release 1.1.4

## Authorization and scope

On 2026-11-02 the owner requested version **1.1.4**, commit, push and npm publication, then explicitly approved committing on `main` and the required version-only `package-lock.json` exception. This stable release targets npm `latest`; it does not authorize a Git tag, GitHub release, automation activation, dependency upgrade, real-settings mutation or owning-Pi reload.

Ship the reviewed [owner guidance](../052-owner-menu-guidance/spec.md) and [consistent settings menus](../053-consistent-settings-menus/spec.md). Source is committed as `df91db0`; Opus proposal/full/focused review coverage and limits remain in [053 review](../053-consistent-settings-menus/review.md).

## Requirements

- Preserve the reviewed runtime/tests and unrelated work. Keep package/lock identity synchronized at 1.1.4 with no dependency-resolution changes.
- Commit release metadata, then qualify clean committed source using the [guarded release commands](../../docs/releases.md). Fresh source checks, production audit, tar membership/byte/integrity/privacy checks and isolated consumer/Pi startup are separate gates.
- Push `origin/main` normally and verify the exact remote commit/CI. Never force, rewrite history or create a release tag to bypass a gate.
- Use normal owner npm authentication. An observed `npm whoami` E401 is an authentication failure, not permission to inspect credentials, mint a token or publish through another route. Stop for ordinary owner login before real publication.
- Publish the exact prepared tarball once, using the required `--confirm 1.1.4 --tag latest` contract. No automatic retry after an uncertain attempt. Verify registry identity, integrity and tags; do not mutate `next` independently.
- Preserve inherited dependency/native/platform/live limitations. No new provider, model, Windows/Linux or real WhatsApp qualification is implied by this patch version.

## Evidence boundaries

This is a pre-publication decision/checkpoint record. Post-commit artifact, CI, publication and registry-install outcomes live in the original local receipts; check registry state instead of inferring publication from this version or its task checkboxes. Changing source/records after preparation requires a new preparation, never receipt editing.
