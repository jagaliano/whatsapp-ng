# Tasks: whatsapp-ng maintenance and release readiness

**Baseline:** `d415f0b`

**Branch:** `chore/fork-release-readiness`

**Canonical decisions/gates:** [plan.md](plan.md)

**Status:** M0 complete and independently reviewed; the owner subsequently approved committing/pushing its documentation and starting M1.

**Scope:** M0 documentation publication and M1 implementation are authorized. M2–M5 and npm publication require separate authorization. Phase 4 is undefined/deferred.

## M0: maintenance lane and decisions

- [x] T001 Verify the new repository, exact baseline/remotes and unchanged published branches.
- [x] T002 Create the local maintenance branch from `main` at `d415f0b`.
- [x] T003 Record selected `whatsapp-ng` identity, `1.1.0-rc.1`/`next` prerelease and separately approved `1.1.0`/`latest` promotion.
- [x] T004 Record owner-led best-effort support, private-channel implementation gate, macOS/Linux Node26/Pi1.3 targets and unverified-platform boundaries.
- [x] T005 Promote the canonical numbered plan/tasks and README status pointer; preserve ignored root strategy as navigation only.
- [x] T006 Validate documentation/index, exact baseline and unchanged runtime/package/storage/old-repo state; stage only M0 documentation.
- [x] T007 Run requested read-only `openai-codex/gpt-6.1-sol` review after configuration/registry verification; resolve findings and record evidence.

M0 is local and review-ready only after T006–T007. No commit, push or PR is authorized by these checkboxes. The owner has now supplied that separate approval for this decision record and for M1 work, not for npm publication.

## Later milestones: M1 authorized, M2–M5 not authorized

- [ ] M1 Resolve licensing/provenance, npm rights, actual fork metadata, private security channel and Pi host packaging.
- [ ] M2 Approve reproducibility/lockfile policy and implement individually reviewed security/runtime dependency changes.
- [ ] M3 Qualify the actual distributable and targeted environments using synthetic data, including process/account isolation.
- [ ] M4 Perform freshly authorized live verification or keep the unverified capabilities explicitly experimental.
- [ ] M5 Publish only with separate approval; verify prerelease installation and make stable promotion a later decision.

See [the plan](plan.md#4-ordered-implementation-milestones) for each prerequisite, deliverable and completion gate. External metadata, license findings and npm availability must be refreshed at their implementation gates.
