# Tasks

- [x] T001 Add failing synthetic regressions for registry presence outcomes (absent, present, non-`E404` failure, blank success) in `tests/unit/release-script.test.ts`.
- [x] T002 Implement the `E404`-only presence check and conditional dry-run in `scripts/release.mjs` `prepare`; record the decision in the receipt.
- [x] T003 Document the conditional dry-run in `docs/releases.md` and the changelog.
- [x] T004 Run the affected suite, full `npm test -- --maxWorkers=2`, lint, typecheck and `git diff --check`.
- [ ] T005 Observe the prepare-only workflow run for the already-published `1.1.5` tag as real-world confirmation; CI on the correction commit is the other half of the evidence.
