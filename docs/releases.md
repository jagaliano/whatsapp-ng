# Releases: local commands and GitHub automation

These commands run from a **source checkout**, not the installed extension. They use Node/npm/Git without another npm dependency. They never create commits or Git tags, push branches, create GitHub releases or promote distribution tags automatically. Preparing a release does not authorize publication.

## 1. Choose the version

The first public candidate is already `1.1.0-rc.1`; **do not bump it merely to publish RC1**.

For a later candidate, start from a clean working tree and give the complete intended version:

```bash
npm run release:version -- 1.1.0-rc.2
```

This delegates to `npm version` with lifecycle scripts and automatic Git tagging disabled. It synchronizes `package.json` and `package-lock.json`, rejects same/older versions, and selects `next` for prereleases. No dependency upgrade or publication is performed. The resulting edits are deliberately left uncommitted.

A stable target must be explicit, for example `npm run release:version -- 1.1.0`; that changes `publishConfig.tag` to `latest`. Do not select a stable version until its acceptance/promotion decision is made. Build metadata is not supported by these local commands. Packaging tests validate SemVer, lockfile agreement and the version's channel rather than hardcoding RC1.

Update `CHANGELOG.md` with the release's user-visible changes and review the version/lockfile diff. Run the normal checks, then commit and push through the normal reviewed Git workflow. Commit the desired changes on the intended release branch before preparing an artifact. No default/main branch or merge is selected by these commands.

## 2. Prepare without publishing

```bash
npm run release:prepare
```

Preparation requires a clean Git worktree and index, including non-ignored untracked files. The repository-root check uses Git's relative path rather than comparing Windows/POSIX path spellings. It:

1. Checks package/lock identity, versions and distribution channel.
2. Runs `npm run test -- --maxWorkers=2`, `npm run lint` and `npm run typecheck` with a temporary HOME/Pi agent directory, `PI_OFFLINE=1` and no inherited credential variables. `PI_OFFLINE` is not a general network sandbox; fixtures and any separately required network guards remain responsible for their own isolation.
3. Runs `npm audit --omit=dev --json` against the public npm registry. Findings or audit/network failures stop preparation.
4. Packs with lifecycle scripts disabled into a fresh private `.pi/cache/releases/<version>-<unique-id>/` directory. It rejects untracked/unexpected files and requires the runtime entry, Edge worker, license and operating/release guides.
5. Hashes the tarball, performs an explicit `npm publish --dry-run` under the intended tag, compares integrity and rechecks clean source/unchanged HEAD.
6. Writes `.pi/cache/releases/prepared.json` with package version, Git commit, tag, registry, artifact path and SHA-512 integrity.

No real `npm publish` occurs. A new prepare attempt invalidates the previous prepared receipt before running checks; a failed preparation cannot leave that receipt ready to publish. Completed tarballs are preserved, not overwritten.

**Separate acceptance gates:** this is a repeatable baseline, not a replacement for source/artifact secret scans, full-tree/installed-host dependency assessment, isolated consumer/Pi startup, supported-platform qualification or approved live-client checks. In particular, a clean production audit excludes host-supplied peers and does not clear the documented SDK/Undici findings. Refresh and review the checks relevant to the actual release; record any deferred scope explicitly. No build command runs because this project loads TypeScript source directly and declares no build script.

## 3. Publish only after approval

The following is a **real publication command**, not part of preparation. Run it only after explicit release approval and acceptance of the recorded limits:

```bash
npm run release:publish -- --confirm 1.1.0-rc.1 --tag next
```

Use the actual prepared version. For a separately approved stable version, both its version and `--tag latest` must match. The command:

- Requires the exact prepared Git commit, a clean tree, matching package/lock/version/channel and an unchanged checksummed tarball. Any intervening commit—including documentation—requires preparation again.
- Targets `https://registry.npmjs.org` explicitly. Verifies that the exact immutable version is absent and that npm authentication works. Only npm's structured `E404` from stdout or stderr permits proceeding; conflicting structured codes, authorization, network or malformed responses stop it. Raw diagnostic text is never interpreted as absence proof or echoed. Absence does not prove first-publish rights or reserve a name.
- Records `.pi/cache/releases/publish-<version>.attempt.json` with an initially unknown outcome **before** invoking `npm publish` once. Publishes the prepared tarball—not the mutable checkout—with lifecycle scripts disabled and the explicit public/tag settings.
- Allows npm's normal terminal authentication/2FA flow. It does not read, store, rotate or change credentials, and never accepts an API-key value as a release argument.

**Never automatically retry a failed or interrupted publication.** It may already have reached npm. The attempt marker blocks another invocation in this checkout, even after preparing again. It is not a cross-clone or registry-wide lock; npm's immutable version identity remains the registry backstop. Check the registry version, integrity and tag first. Retain the marker as evidence; only after establishing a definite pre-publication failure may an operator explicitly preserve it aside and authorize a new attempt. A successful npm command is recorded, but registry verification is still required.

## 4. Verify and announce

After a successful authorized publication:

```bash
npm view whatsapp-ng@1.1.0-rc.1 version dist.integrity --json --registry=https://registry.npmjs.org
npm view whatsapp-ng@1.1.0-rc.1 dist-tags --json --registry=https://registry.npmjs.org
```

Compare the registry integrity to the prepared receipt, confirm `next` points to the intended candidate, and explicitly inspect `latest` as well. Do not assume the first publication leaves `latest` absent or changes it in a particular way; any tag correction requires an explicit operator decision. Install that exact registry artifact in a fresh isolated consumer/Pi environment without real WhatsApp state. A published prerelease is not proof of all-platform compatibility or client rendering.

For the manual publication path above, only then create/push an annotated `v<version>` Git tag at the receipt's exact commit and create a GitHub prerelease through separately authorized Git/GitHub actions. The later automated path below deliberately uses a tag to request publication **before** npm publication; a Git tag alone is never evidence that publication succeeded. The local commands do not create tags/releases, silently merge branches, repeat unknown sends or change WhatsApp authentication/history. Keep stable promotion separate; verify existing registry tags rather than assuming the first publish's default-tag behavior.

## 5. GitHub automation (prepared, default off)

Two workflows are provided:

- `.github/workflows/ci.yml` validates pull requests into `main`, pushes to `main`, and manual CI runs. It installs the locked dependencies with lifecycle scripts disabled, installs FFmpeg/Tesseract on an ephemeral Ubuntu runner, and runs the same preparation/validation path. It has read-only repository permission and no npm publication or OIDC permission.
- `.github/workflows/publish.yml` runs only on pushed `v*` tags in `jagaliano/whatsapp-ng`. Its unprivileged job checks the exact tag/version, resolves the event/tag to the checkout commit, requires ancestry on `origin/main`, then validates and uploads one tarball/receipt. Tags that do not exactly match the manifest are refused.

The workflows pin official actions by commit SHA, Node 26.12.1 and npm 11.20.0. Dependencies/system tools are installed only on the disposable GitHub runner, not the operator's workstation. No version bump, Git commit/tag, main merge or GitHub release is automatic. The CI runner is not a universal platform/live-acceptance matrix, and production auditing still does not clear the known host/development SDK findings.

### Bootstrap RC1 before enabling OIDC

[npm requires a package to already exist](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites) before configuring trusted publishing. While `whatsapp-ng` is unpublished, complete the separately approved **manual RC1** process above. Do not add an automation token merely to bypass this bootstrap requirement.

Keep the repository variable `NPM_PUBLISH_ENABLED` **unset or `false`** during bootstrap. If a release tag is pushed in this state, the workflow can prepare an artifact, but the real publish job is skipped. A disabled publish job does not mean the version was published. No npm/GitHub settings are changed merely by adding these workflow files.

### Required external setup (operator actions, not performed by these files)

After the first package publication, and before a subsequent automated release:

1. Protect `main` and release-tag creation/updates/deletion through the repository's rulesets. Require review and successful validation appropriate to the release; do not assume that a version-shaped tag grants release authority by itself.
2. Create the GitHub environment **`npm-publish`**, configure **required reviewers** and allow only the intended `v*` release tags to deploy. Merely naming an environment in YAML does not configure approval protection. A sole maintainer must either permit their own explicit review or appoint another available reviewer; enabling self-review prevention without another approver will block releases.
3. In npm's package settings, add a GitHub trusted publisher with **owner `jagaliano`**, **repository `whatsapp-ng`**, **workflow filename `publish.yml`** (filename only), and **environment `npm-publish`**. Explicitly permit **direct `npm publish`**; current npm configurations can otherwise be stage-only. No dist-tag mutation permission is needed by this workflow. Use a GitHub-hosted runner, not a self-hosted one.
4. Do **not** add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to this workflow/environment. The publisher job has `id-token: write` and uses npm's native OIDC authentication with provenance. It deliberately does not use `npm whoami` as an OIDC permission check. Token-fallback environment variables are rejected by the script.
5. Only after checking those protections and the npm binding, set the repository Actions variable **`NPM_PUBLISH_ENABLED=true`**. This is the explicit activation gate, not a secret. Set up npm trust near the next authorized release: current npm documentation says a new configuration expires if its first successful publish does not occur within two days. A dry-run cannot prove that trust or approval protection is configured correctly.

See the official [npm trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/) and [GitHub environment setup](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments). These settings, a first publish and any release-tag push require separate operator authorization.

### Later authorized release flow

1. Bump the version explicitly, update the changelog, validate/review, and land the exact source on `main`. Prereleases derive `next`; a separately approved stable version derives `latest`.
2. Deliberately create/push `v<manifest-version>` at the approved commit. For example, **after** bumping/landing RC2 and authorizing its release:

   ```bash
   git tag -a v1.1.0-rc.2 -m "whatsapp-ng 1.1.0-rc.2"
   git push origin v1.1.0-rc.2
   ```

3. The read-only prepare job produces the candidate and receipt. Review the run and approve the protected `npm-publish` deployment only when the candidate and separate acceptance/risk decisions are acceptable.
4. The publisher downloads **only that prepare job's artifact ID**, checks its commit/version/tag/integrity against the tag event and checkout, and publishes those bytes without repacking or installing project dependencies in the OIDC job. The internal `release:check-tag` and `release:publish-ci` commands refuse foreign workflows, non-tag events, detached non-main ancestry, disabled publication and token fallback.
5. The script requires npm 11.5.1 or newer, an existing published `next` or `latest` version and an absent target version, records an attempt before one publish, requests provenance, and verifies the resulting version/integrity and selected npm tag. Explicit selectors support prerelease-only packages without assuming that `latest` exists. It reports both `next` and `latest` without mutating extra tags. Attempt metadata is uploaded even on ordinary job failure; a hard runner shutdown may prevent that upload.
6. Verify the exact registry artifact in an isolated consumer/Pi environment. Create the GitHub prerelease/release only as a separate deliberate announcement; this workflow has no `contents: write` permission and does not create it.

**No automatic retry:** all versions share non-cancelling publication concurrency. Workflow reruns (`GITHUB_RUN_ATTEMPT > 1`) cannot publish, and the script independently enforces this. A cancelled/timed-out/failed publish may already have reached npm. Check the registry and retained candidate/attempt evidence before any separately authorized recovery. Do not delete/recreate tags, mint a new token, edit a receipt or rerun jobs to bypass an uncertain outcome. A new runner/clone does not inherit a local attempt marker, so registry inspection remains mandatory. The workflow is not an exactly-once delivery guarantee or an automatic stable-promotion service.
