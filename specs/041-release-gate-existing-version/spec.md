# Release preparation after a version is published

`npm run release:prepare` currently dry-run publishes the manifest version. npm refuses that dry-run once the version exists on the registry (`You cannot publish over the previously published versions`), so every CI run after a successful release fails inside the documented prepare step. This record covers making the prepare gate accurate instead of weakening publication safety.

## Requirements

- Determine registry presence of the exact manifest version with `npm view <name>@<version> version --json` against the pinned public registry, before the dry-run.
- Structured `E404` means the version is absent: run the existing `npm publish --dry-run`, and keep the current integrity comparison against the prepared tarball.
- A successful structured response means the version is already published: skip only the dry-run. Every other gate stays mandatory — clean worktree/index including untracked files, package/lock/channel identity, test/lint/typecheck in the isolated environment, production audit, pack shape and allowed/required file set, artifact integrity, and the unchanged HEAD/source recheck.
- Never infer absence from anything but `E404`. Authentication failures, network errors, malformed JSON and blank successful output abort preparation without a receipt, matching the publication path.
- Record the decision in the prepared receipt so a skipped dry-run is auditable rather than invisible, and keep the receipt compatible with the existing publication validation.
- Publication behaviour is unchanged: it still requires its own `E404` absence proof, still refuses an already-published version, still writes one attempt marker and never retries automatically.
- A push or tag event at a commit whose version is already public must be able to run validate/prepare-only pipelines successfully.

## Acceptance

- Regression-first synthetic coverage, using the existing mocked release-command fixture: existing version skips the dry-run and records it in the receipt; absent version still runs exactly one dry-run; a non-`E404` registry error and a blank successful response each abort preparation without writing a receipt.
- `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck` and `git diff --check` pass; the release documentation describes the conditional dry-run.
- Observable real-world confirmation: the CI run for the correction itself, and the prepare-only workflow run for the already-published `1.1.5` tag, both reach success instead of failing on npm's immutability error.

## Out of scope

- Changing npm immutability, version identity, tag/channel rules, provenance/OIDC settings, or the one-shot publication guarantees.
- Republishing or mutating any existing registry version.
- Automatic tagging, GitHub releases, commits or pushes.
