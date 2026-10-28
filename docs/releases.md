# Local release commands

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
npm view whatsapp-ng dist-tags --json --registry=https://registry.npmjs.org
```

Compare the registry integrity to the prepared receipt, confirm `next` points to the intended candidate, and explicitly inspect `latest` as well. Do not assume the first publication leaves `latest` absent or changes it in a particular way; any tag correction requires an explicit operator decision. Install that exact registry artifact in a fresh isolated consumer/Pi environment without real WhatsApp state. A published prerelease is not proof of all-platform compatibility or client rendering.

Only then create/push an annotated `v<version>` Git tag at the receipt's exact commit and create a GitHub prerelease through separately authorized Git/GitHub actions. The local commands do not do those steps, silently merge branches, repeat unknown sends or change WhatsApp authentication/history. Keep stable promotion separate; verify existing registry tags rather than assuming the first publish's default-tag behavior.
