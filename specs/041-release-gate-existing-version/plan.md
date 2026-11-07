# Implementation plan

**Record status:** scoped correction with regression-first tests. Publication, tagging and Git delivery remain separate operator actions.

**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

1. Add failing synthetic fixtures in `tests/unit/release-script.test.ts` for the four registry outcomes (absent, present, non-`E404` failure, blank success), asserting the dry-run count, receipt contents and receipt absence.
2. In `scripts/release.mjs` `prepare`, resolve version presence through the existing `npm`/`npmJson` helpers and error-code classification already used by `publish`, immediately before the dry-run. Keep the E404-only rule; rethrow anything else.
3. Run the dry-run only when absent. Add the recorded decision to the receipt without changing the fields publication validates, and keep the attempt-marker path untouched.
4. Update [docs/releases.md](../../docs/releases.md) step 5 and the changelog; the receipt field and the conditional dry-run are documented behaviour, not an internal detail.
5. Validate with the affected suite, then the full declared checks. Observe CI on the correction commit and the prepare-only workflow run for the already-published `1.1.5` tag as real-world confirmation.

## Constraints and complexity tracking

- No dependency, protocol or registry-policy change; the script keeps using the pinned registry and structured npm output only.
- The prepare gate is intentionally weaker for exactly one case — a version that already exists cannot be dry-run published by npm at all. That gap is compensated by recording it in the receipt and keeping every structural, audit and integrity gate, and by publication re-proving absence independently.
- No change to retry semantics: a skipped dry-run never authorizes publication and never creates an attempt marker.
