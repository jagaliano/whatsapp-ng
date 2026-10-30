# Releases: local commands and GitHub automation

Run from a source checkout. Versioning, preparation, publication, Git delivery and automation activation require separate authorization. These scripts do not create commits/tags, push branches or create GitHub releases. Use `package.json` for the checkout version; query npm for published versions/tags.

## 1. Choose the version

For an approved future bump, start clean and replace `NEW_VERSION` with a complete SemVer greater than the manifest:

```bash
npm run release:version -- NEW_VERSION
```

The command synchronizes package/lock versions with lifecycle scripts and Git tagging disabled. Prereleases select `next`; an explicitly approved stable version selects `latest`. Same/older versions and build metadata are rejected. No dependency upgrade or publication occurs; edits remain uncommitted.

Update the changelog, review/validate the diff, then commit/push only through the separately authorized Git workflow. Preparation requires the intended release source already committed. The [1.1.0 promotion plan](../specs/041-stable-1.1.0/plan.md) is historical, not permission to republish that version or repair indexing with another release.

## 2. Prepare without publishing

```bash
npm run release:prepare
```

Requires a clean worktree/index, including non-ignored untracked files. Preparation:
1. Checks repository root, package/lock identity, version and channel.
2. Runs `npm run test -- --maxWorkers=2`, lint and typecheck in a disposable HOME/agent directory without inherited credentials. `PI_OFFLINE=1` is not a network sandbox; fixtures/guards still own isolation.
3. Runs `npm audit --omit=dev --json` against public npm; findings or audit/network failure stop preparation.
4. Packs with lifecycle scripts disabled into private `.pi/cache/releases/<version>-<unique-id>/`, checking required runtime/workers, licences/guides and unexpected files.
5. Hashes the tarball, runs `npm publish --dry-run` under the intended tag, checks integrity and rechecks unchanged clean source/HEAD.
6. Writes `.pi/cache/releases/prepared.json`: version, commit, tag, registry, artifact path and SHA-512 integrity.

No real publication occurs. A new attempt invalidates the prior prepared receipt before checks; completed tarballs are retained. Any source commit/edit—including documentation—requires preparation again.

Preparation does not replace secret scans, host/full-tree dependency assessment, isolated consumer/Pi startup, platform checks or approved live-client acceptance. A production audit excludes host peers and cannot clear SDK findings. Record deferred scope explicitly. There is no build step: the package loads TypeScript source.

## 3. Publish only after approval

**Real publication:** replace both placeholders with the exact approved prepared version/channel:

```bash
npm run release:publish -- --confirm PREPARED_VERSION --tag PREPARED_TAG
```

The command requires matching clean source/commit, package/lock/channel and checksummed tarball. It targets `https://registry.npmjs.org`, checks authentication and requires structured npm `E404` to establish version absence. Conflicting/auth/network/malformed results stop it; raw errors are neither absence proof nor echoed. Absence does not reserve a name or prove publication rights.

Before one `npm publish`, it records `.pi/cache/releases/publish-<version>.attempt.json` with an unknown outcome. It publishes the prepared bytes with lifecycle scripts disabled and explicit public/tag settings, using normal terminal authentication/2FA. It does not accept key values or change credentials.

**Never automatically retry an interrupted/failed publication.** It may have reached npm. The local attempt marker blocks another invocation, even after preparation; npm's immutable version identity is the registry backstop, not an exactly-once guarantee across clones. Inspect version, integrity, tags and retained evidence. Only a proven pre-publication failure plus new operator approval permits preserving the marker aside and trying again. Do not edit receipts to bypass uncertainty.

## 4. Verify and announce

Replace `PUBLISHED_VERSION` with the approved version:

```bash
npm view whatsapp-ng@PUBLISHED_VERSION version dist.integrity --json --registry=https://registry.npmjs.org
npm view whatsapp-ng@PUBLISHED_VERSION dist-tags --json --registry=https://registry.npmjs.org
```

Compare integrity to the receipt, verify the intended tag and inspect both `latest`/`next`. Tag corrections need approval; do not infer first-publish tag behavior. Install that exact artifact in a disposable consumer/Pi environment without real WhatsApp state. Registry success does not establish platform/client compatibility.

For manual releases, create/push an annotated tag at the receipt's exact commit and announce a GitHub release/prerelease only when separately authorized. The automated path below uses a tag **before** npm publication; a Git tag alone proves no publication. Local release commands do not create announcements, merge branches or change WhatsApp state.

## 5. GitHub automation (prepared, default off)

- [CI](../.github/workflows/ci.yml): PRs/pushes to `main` and manual runs; lifecycle-disabled locked install, runner-only FFmpeg/Tesseract and preparation checks. Read-only repository permission; no publish/OIDC permission.
- [Publish](../.github/workflows/publish.yml): pushed `v*` tags in `jagaliano/whatsapp-ng`; exact tag/version/event-commit and `origin/main` ancestry checks, then one candidate/receipt. Foreign or mismatched events fail closed.

Actions and Node/npm versions are pinned in those files. Dependencies/system tools are installed on disposable runners, not the workstation. No automatic version bump, commit, tag, merge or GitHub release; runner checks are not universal platform/live acceptance.

### Published-package prerequisite and OIDC activation

[npm requires an existing package](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites) before trusted publishing. Check exact registry availability, then verify trust, protected environment and publication approval. Package existence alone proves none of them.

Keep `NPM_PUBLISH_ENABLED` unset or `false` until setup is verified and explicitly authorized. Disabled workflows may prepare an artifact but skip publication. Do not add an automation token to bypass trust setup.

### Required external setup (operator actions, not performed by these files)

1. Protect `main` and release-tag creation/update/deletion with appropriate review/CI rules.
2. Create protected GitHub environment **`npm-publish`** with required reviewers and intended `v*` tag restrictions. Ensure an available approver; self-review prevention can block a sole maintainer.
3. Configure npm trust: owner `jagaliano`, repository `whatsapp-ng`, workflow `publish.yml`, environment `npm-publish`. Permit direct `npm publish`, not stage-only, using a GitHub-hosted runner. No dist-tag mutation permission is needed.
4. Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN`. The publisher uses native OIDC/provenance with `id-token: write`; scripts reject token fallback and do not use `npm whoami` as an OIDC check.
5. Only then authorize `NPM_PUBLISH_ENABLED=true`. New npm trust currently expires if unused for two days; configure it near the approved release. Dry-run cannot prove external trust/approval protection.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments). Setup changes and release-tag pushes are separate operator actions.

### Later authorized release flow

1. Explicitly bump, update the changelog, validate/review and land approved source on `main`. Prereleases use `next`; approved stable releases use `latest`.
2. Separately authorize creating/pushing `v<manifest-version>` at that commit. Do not push tags merely to test the workflow.
3. Review the prepare artifact/receipt, then approve the protected deployment only after acceptance/risk decisions.
4. The publisher downloads only that prepare job's artifact ID, verifies event/checkout/commit/version/tag/integrity and publishes without repacking or project dependency installation. Internal `release:check-tag`/`release:publish-ci` reject invalid workflows/events, non-main ancestry, disabled publication and token fallback.
5. Requires npm ≥11.5.1, an existing `next` or `latest` version and absent target version. Records one attempt, publishes with provenance and verifies version/integrity/selected tag. Both tags are reported, not independently mutated. Attempt metadata uploads on ordinary failure; hard runner termination may prevent upload.
6. Verify the exact registry artifact in an isolated consumer/Pi environment. GitHub announcement is separate; the workflow has no `contents: write` permission.

**No automatic retry:** publication concurrency does not cancel earlier runs; reruns (`GITHUB_RUN_ATTEMPT > 1`) cannot publish. A fresh runner lacks another runner's marker. Inspect registry/candidate/attempt evidence before approved recovery; never delete/recreate tags, mint tokens, edit receipts or rerun jobs to bypass unknown outcomes.

## Package discovery

Historical checks on **October 29, 2026**, before stable promotion:
- Both `latest`/`next` resolved RC1 with `pi-package` metadata; RC2 was unpublished.
- Broad npm search omitted the package; a maintainer-specific search found it with score zero.
- The [direct Pi page](https://pi.dev/packages/whatsapp-ng) worked while the [filtered catalog](https://pi.dev/packages?name=whatsapp-ng) showed no match.

Those observations concern search/indexing, not current publication state or a proven server-side cause. Use exact lookups/install selectors:

```bash
npm view whatsapp-ng@latest version dist-tags keywords --json --registry=https://registry.npmjs.org
pi install npm:whatsapp-ng@latest
```

Search output filtered with `grep` is not an exact-name existence check. Publishing, promoting or retagging is not an indexing remedy.
