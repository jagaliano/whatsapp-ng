# RC2 integration tasks

Derived from [plan.md](plan.md). Checkboxes describe the tracked checkpoint, not future publication authority.

- [x] R040-1: inspect existing runtime/docs/release contracts and preserve the RC2 manifest/dependency graph.
- [x] R040-2: reproduce public registry/search/Pi discovery and distinguish search ranking from publication availability.
- [x] R040-3: correct release-facing version/evidence/startup guidance without rewriting historical acceptance.
- [x] R040-4: run final isolated tests/lint/typecheck, links/whitespace and candidate-content safety checks; record exact scope/results before commit and recheck the final staged snapshot.
- [ ] R040-5: commit the reviewed integration source and documentation using explicit staging.

## After the tracked checkpoint is committed

Run clean-commit `npm run release:prepare`, inspect/scan the exact tarball and validate isolated consumer/Pi startup. Record actual outcomes, artifact hash/commit and the authorized normal push in local completion evidence; a tracked task checkbox is not a substitute for that receipt. Do not modify tracked files merely to check a box after preparation, because doing so changes the source that the receipt qualifies.

Actual npm publication, release tags, registry-tag edits, automation activation and broader live/platform acceptance remain separately authorized operations.
