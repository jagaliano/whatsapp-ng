# Tasks: whatsapp-ng maintenance and release readiness

**Baseline:** `d415f0b`

**Branch:** `chore/fork-release-readiness`

**Canonical decisions/gates:** [plan.md](plan.md)

**Status:** M0 published as `911cecd`; M1 packaging committed as `f90be5a`; M2 implemented, independently reviewed, validated and pushed as `759a47f`. The M1 npm-account check remains open; M3–M5 require separate authorization.

**Scope:** M1/M2 implementation, exact Codex review, then separate commits/push are authorized. The later bounded installed-candidate/live validation was separately approved and is recorded below. Remaining M3–M5 work and npm publication need separate authorization. Phase 4 is undefined/deferred.

## M0: maintenance lane and decisions

- [x] T001 Verify the new repository, exact baseline/remotes and unchanged published branches.
- [x] T002 Create the local maintenance branch from `main` at `d415f0b`.
- [x] T003 Record selected `whatsapp-ng` identity, `1.1.0-rc.1`/`next` prerelease and separately approved `1.1.0`/`latest` promotion.
- [x] T004 Record owner-led best-effort support, private-channel implementation gate, macOS/Linux Node26/Pi1.3 targets and unverified-platform boundaries.
- [x] T005 Promote the canonical numbered plan/tasks and README status pointer; preserve ignored root strategy as navigation only.
- [x] T006 Validate documentation/index, exact baseline and unchanged runtime/package/storage/old-repo state; stage only M0 documentation.
- [x] T007 Run requested read-only `openai-codex/gpt-6.1-sol` review after configuration/registry verification; resolve findings and record evidence.

M0 is local and review-ready only after T006–T007. No commit, push or PR is authorized by these checkboxes. The owner has now supplied that separate approval for this decision record and for M1 work, not for npm publication.

## M1: licensing accepted, npm-account gate still open

- [x] T008 Record owner acceptance of upstream's declared MIT license; add LICENSE with the supplied 2026 owner notice and yearless Rapha attribution. [Upstream issue #17](https://github.com/RaphaCastelloes/whatsapp-pi/issues/17) is advisory, not a blocker. `LICENSING.md` records the decision without claiming upstream confirmation.
- [ ] T009 Verify npm account/registration rights. Name lookup found no package, but account verification failed; no login or credential edits attempted.
- [x] T010 Prepare fork identity/version/URLs, retained author and private publish guard with selected future `next` tag.
- [x] T011 Declare host wildcard peers and development copies; verify official host aliases and retained baseline dependency versions.
- [x] T012 Enable and verify private GitHub vulnerability reporting; document safe private reporting and best-effort support.
- [x] T013 Update maintained-fork attribution, install/switchback/resource guidance, licensing-status document and unreleased changelog.
- [x] T014 Add 5 manifest/license tests; rerun 402 tests/44 files, lint, typecheck and whitespace checks in isolation after adding LICENSE.
- [x] T015 Inspect/pack refreshed 35-entry local artifact, verify LICENSE/source equality and document links; actual packed-entry loader/RPC: 7 tools, 1 command, no errors/peer warnings. Reused-dependency limitations remain explicit.
- [x] T016 Obtain independent packaging review and resolve notes. Exact Codex reviewer returned OK with notes; historical M0 paragraph corrected, constitution checks confirmed. Source-only, no independently rerun commands.
- [ ] T017 Close M1 after remaining npm-account verification (T009) and any resulting revalidation. T008's licensing gate is resolved. Keep private guard and no-publication boundary.

The preparation checkboxes did not authorize publication. The owner subsequently approved scoped M2 work and reviewed M1/M2 commit/push; npm publication and live operations remain unauthorized. See [the execution checkpoint](plan.md#11-m1-preparation-and-validation-checkpoint).

## M2: authorized dependency/security work

- [x] T018 Record owner approval of committed lockfile, scoped major migrations, exact-model review and subsequent commit/push; preserve the M1 checkpoint for separate reviewable commits.
- [x] T019 Capture baseline audit/native inventory and six failing pin/lazy-initialization/cleanup regressions.
- [x] T020 Pin rc14; migrate LiteParse 2.15.1, actual-host development aliases and patched existing test tooling. Keep wildcard host peers and runtime/storage identities.
- [x] T021 Add native synthetic PDF/OCR/error/worker-reaping contracts and adapt only the SDK/Vitest fixture seams required by the migration.
- [x] T022 Reproduce via script-disabled npm ci; 414 tests/45 files, lint/typecheck/whitespace passed with unchanged lock bytes. Full and production audits reported zero findings.
- [x] T023 Inspect 36-entry refreshed artifact/isolated loader and complete dependency/native-tool and reproducibility evidence. Reused-clean-ci dependency limits remain explicit.
- [x] T024 Run exact openai-codex/gpt-6.1-sol independent read-only review; correct stale authorization wording, recheck extracted M1 checkpoint and test discovery. Final verdict OK/No issues found; commands/evidence remain parent-verified.
- [x] T025 Safety-check/stage explicit M1/M2 scope; created separate reviewed commits `f90be5a` and `759a47f`, pushed and verified `origin/chore/fork-release-readiness`. No npm publication or PR.

## Approved post-M2 installed/live validation

- [x] T026 Rerun all repository checks: 414 tests/45 files, lint/typecheck/whitespace, full and production audits zero.
- [x] T027 Install the actual tarball and production dependencies in a temporary consumer; verify loader and synthetic offline restart, raw-data absence, account partitions, 0600 archive and corrupt-store preservation.
- [x] T028 Perform the explicitly approved seven generated sends, six native quotes, generated-PDF network parse, restart and one history request capped at three; disconnect safely without logout. Transport calls succeeded, but history remained unknown with zero imports and receipts were not observed.
- [x] T029 Ask for client confirmation and record the lack of confirmation without claiming delivery/rendering/playback. Preserve private detailed results outside Git; commit only [sanitized evidence](validation.md).
- [ ] T030 Close remaining managed-install/platform/exclusivity and successful live backfill/receipt/client gaps under fresh scope, or preserve explicit prerelease/unverified limits. No full M3/M4 completion or npm release is claimed.
- [x] T031 Diagnose M4 topology without reconnecting: read-only saved-session metadata confirms the earlier recipient was the sender account (self-chat). Record the limited evidence and avoid speculative receipt/protocol fixes or another full media batch.
- [x] T032 Obtain a distinct approved recipient and fresh same-profile exclusivity confirmation for the bounded follow-up; physical-client playback confirmation remains separate.
- [x] T033 Run exactly two generated text calls and one history request capped at three. Record API acceptance/native quote, unknown/zero-import history, absent exposed receipt events, archive/offline checks and safe shutdown; retain the subsequent owner-reported unreadable placeholder as an unresolved client result.
- [x] T034 Record owner-led Logoff/unlink/QR relinking and read-only verification of maintained-package selection/auth presence. Do not claim that metadata alone proves recovery or that the agent performed an auth reset.
- [x] T035 Under fresh one-text approval, record the definite zero-attempt disconnected result, later readiness confirmation, one accepted send via the existing extension (one attempt), and the owner's explicit recipient-side normal readability confirmation. No competing harness/additional history/media send; full M4 remains open.

## Later milestones: scoped validation recorded; remaining M3–M5 gates open

- [ ] M1 Resolve licensing/provenance, npm rights, actual fork metadata, private security channel and Pi host packaging.
- [x] M2 Implement owner-approved lock policy and scoped dependency/security migrations; clean reproduction, exact-model review and commit/push completed. Platform/native limits remain explicit.
- [ ] M3 Qualify the actual distributable and targeted environments using synthetic data, including process/account isolation.
- [ ] M4 Perform freshly authorized live verification or keep the unverified capabilities explicitly experimental.
- [ ] M5 Publish only with separate approval; verify prerelease installation and make stable promotion a later decision.

See [the plan](plan.md#4-ordered-implementation-milestones) for each prerequisite, deliverable and completion gate. External metadata, license findings and npm availability must be refreshed at their implementation gates.
