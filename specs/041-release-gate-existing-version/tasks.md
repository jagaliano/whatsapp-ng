# Tasks

- [x] T001 Add failing synthetic regressions for registry presence outcomes (absent, present, non-`E404` failure, blank success) in `tests/unit/release-script.test.ts`.
- [x] T002 Implement the `E404`-only presence check and conditional dry-run in `scripts/release.mjs` `prepare`; record the decision in the receipt.
- [x] T003 Document the conditional dry-run in `docs/releases.md` and the changelog.
- [x] T004 Run the affected suite, full `npm test -- --maxWorkers=2`, lint, typecheck and `git diff --check`.
- [ ] T005 Observe the prepare-only workflow run for an already-published version as real-world confirmation. Push CI on the correction commit passed and logged the corrected path (`whatsapp-ng@1.1.5 is already published; skipping the publish dry-run`, run `42398256584`). The `v1.1.5` tag itself was cut at `7e1570a`, which predates this correction, so its prepare job still ran the old dry-run and failed on npm immutability (run `42398437941`, publish job disabled and skipped); that run is not evidence against the fix and cannot be repaired without moving a tag that must keep pointing at the published source. A tag cut after this correction is the remaining confirmation.
