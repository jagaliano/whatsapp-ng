# Tasks: whatsapp-ng maintenance and release readiness

**Baseline:** `d415f0b`

**Branch:** `chore/fork-release-readiness`

**Canonical decisions/gates:** [plan.md](plan.md)

**Status:** M0, M2 and reviewed M4 live evidence are complete. M1's packaging/license/loader work and npm account-readiness gate are complete; the documentation/artifact refresh passed the final checks below. M3 is now complete for the qualified private artifact/environments below. Prior M4 media/history evidence remains historical; the separately approved final-runtime saved-session/readability refresh now passes. M1–M4 are complete for the documented scope; Git delivery and M5 publication remain open. The package remains private/unpublished.

**Scope:** M1/M2 implementation, exact Codex review, then separate commits/push are authorized. The later bounded installed-candidate/live validation was separately approved and is recorded below. The owner now authorizes M3 qualification, its reproduced guarded-profile reliability slice and disposable Linux image/test-package downloads. M5 publication remains separately gated. The owner approved the M1 closure Git commit/push only: no npm package creation/registration/publication until prerequisite migration/readiness work is finished and release is separately approved. Keep `private: true`. Phase 4 is undefined/deferred.

## M0: maintenance lane and decisions

- [x] T001 Verify the new repository, exact baseline/remotes and unchanged published branches.
- [x] T002 Create the local maintenance branch from `main` at `d415f0b`.
- [x] T003 Record selected `whatsapp-ng` identity, `1.1.0-rc.1`/`next` prerelease and separately approved `1.1.0`/`latest` promotion.
- [x] T004 Record owner-led best-effort support, private-channel implementation gate, macOS/Linux Node26/Pi1.3 targets and unverified-platform boundaries.
- [x] T005 Promote the canonical numbered plan/tasks and README status pointer; preserve ignored root strategy as navigation only.
- [x] T006 Validate documentation/index, exact baseline and unchanged runtime/package/storage/old-repo state; stage only M0 documentation.
- [x] T007 Run requested read-only `openai-codex/gpt-6.1-sol` review after configuration/registry verification; resolve findings and record evidence.

M0 is local and review-ready only after T006–T007. No commit, push or PR is authorized by these checkboxes. The owner has now supplied that separate approval for this decision record and for M1 work, not for npm publication.

## M1: licensing and pre-publication account readiness verified

- [x] T008 Record owner acceptance of upstream's declared MIT license; add LICENSE with the supplied 2026 owner notice and yearless Rapha attribution. [Upstream issue #17](https://github.com/RaphaCastelloes/whatsapp-pi/issues/17) is advisory, not a blocker. `LICENSING.md` records the decision without claiming upstream confirmation.
- [x] T009 After the owner performs local browser login, verify public-registry identity `jagaliano`, verified email and 2FA `auth-and-writes`. Current package lookup returns E404. This closes account readiness, not name reservation, ownership or guaranteed first-create permission; registration/publication stays in M5. No agent credential edit or publication.
- [x] T010 Prepare fork identity/version/URLs, retained author and private publish guard with selected future `next` tag.
- [x] T011 Declare host wildcard peers and development copies; verify official host aliases and retained baseline dependency versions.
- [x] T012 Enable and verify private GitHub vulnerability reporting; document safe private reporting and best-effort support.
- [x] T013 Update maintained-fork attribution, install/switchback/resource guidance, licensing-status document and unreleased changelog.
- [x] T014 Add 5 manifest/license tests; rerun 402 tests/44 files, lint, typecheck and whitespace checks in isolation after adding LICENSE.
- [x] T015 Inspect/pack refreshed 35-entry local artifact, verify LICENSE/source equality and document links; actual packed-entry loader/RPC: 7 tools, 1 command, no errors/peer warnings. Reused-dependency limitations remain explicit.
- [x] T016 Obtain independent packaging review and resolve notes. Exact Codex reviewer returned OK with notes; historical M0 paragraph corrected, constitution checks confirmed. Source-only, no independently rerun commands.
- [x] T017 Close M1 after fresh 414 tests/45 files, lint/typecheck/whitespace and document/link/safety checks. The 36-entry documentation-refreshed tarball preserves all 30 runtime/manifest files byte-for-byte and `private: true`/`next`. T008/T009 are resolved; first package creation still needs fresh registry checks and explicit M5 approval.

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
- [x] T030 Close remaining M3 managed-install/platform/exclusivity qualification. Later T036–T039 close the separately approved M4 live-evidence scope, not M3 or npm release.
- [x] T031 Diagnose M4 topology without reconnecting: read-only saved-session metadata confirms the earlier recipient was the sender account (self-chat). Record the limited evidence and avoid speculative receipt/protocol fixes or another full media batch.
- [x] T032 Obtain a distinct approved recipient and fresh same-profile exclusivity confirmation for the bounded follow-up; physical-client playback confirmation remains separate.
- [x] T033 Run exactly two generated text calls and one history request capped at three. Record API acceptance/native quote, unknown/zero-import history, absent exposed receipt events, archive/offline checks and safe shutdown; retain the subsequent owner-reported unreadable placeholder as an unresolved client result.
- [x] T034 Record owner-led Logoff/unlink/QR relinking and read-only verification of maintained-package selection/auth presence. Do not claim that metadata alone proves recovery or that the agent performed an auth reset.
- [x] T035 Under fresh one-text approval, record the definite zero-attempt disconnected result, later readiness confirmation, one accepted send via the existing extension (one attempt), and the owner's explicit recipient-side normal readability confirmation. No competing harness/additional history/media send in that checkpoint; final M4 continuation is recorded below.

- [x] T036 Refresh the owning Pi without another auth reset/competing connection; verify restored quote/tool availability and that 30 local runtime/manifest files match the installed candidate.
- [x] T037 Send exactly four generated media/native replies once each; obtain explicit PDF/image/audio/video and quoted-text client confirmation. Verify persisted direct-chat READ (4), voice PLAYED (5), quote anchors, 0600 and secret-field exclusion.
- [x] T038 Respect the zero-fetch authorization denial. After the owner accepts incoming-agent access and manually allowlists the trusted account, make exactly one actual count-three fetch; require exact-ID explicit ON_DEMAND/100% completion and two distinct new imported records.
- [x] T039 Reopen actual imported records/complete request in a fresh offline `ArchiveFiles.readScope` process without auth/writer/socket. Repeat full isolated 414/45 native/test/lint/typecheck/audit/startup checks; do not equate the reader restart with a post-fetch full-Pi restart.
- [x] T040 Complete current model/config/cwd/lazy/provider preflight and requested read-only exact-model review. Run `b0a6e796-31b4-4a11-9ab7-5d54a9ebdc68` returned OK/No issues found; actual child metadata confirmed openai-codex/gpt-6.1-sol, medium thinking, correct cwd and no fallback. Final tests/docs/safety/artifact checks passed; reviewed closure is ready for the standing scoped commit/push approval, not npm publication.

## Authorized M3 qualification

- [x] T041 Reproduce same-profile transport duplication through two actual isolated Pi RPC processes with the real extension entry, synthetic Baileys and blocked networking. Baseline: 2 auth-opening/socket-constructing processes, zero network attempts; no live credentials accessed.
- [x] T042 Obtain owner approval for the dedicated guarded-profile fix and disposable Linux qualification; document M3-R1 scope and unchanged no-publication/auth boundaries.
- [x] T043 Capture failing ownership/start-stop/auth-I/O regressions; implement canonical ownership, serialized lifecycle and retired-auth fencing. Final real two-Pi synthetic RPC fixture rejects the competitor before native auth/socket work; zero networking and no leaked lock.
- [x] T044 Complete synthetic permissions/migration/restart/account/profile/retention/corruption checks and guarded connect-time adoption. Preserve offline config/history and metadata discovery, original legacy bytes and explicit recovery; no initialized-profile merge, copied control files or implicit re-adoption after reset. Validate pinned credential shapes before native loading.
- [x] T045 Freeze the 38-entry private tarball (`78257d468111fbff53f17d99e986741143a0380e`); actual Pi-managed install/discovery/remove/reinstall, peer/schema and real RPC startup passed on both qualified platforms.
- [x] T046 Run final full/native checks: 466 tests/49 files per platform, lint/typecheck exit 0, zero source full/production and consumer audit findings; installed-artifact native auth smoke/private modes passed. Linux had zero host mounts; no real auth was accessed.
- [x] T047 Complete exact-model/config/provider/cwd preflight and source review. Initial P1 credential-shape blocker gained failing regressions and was fixed; focused exact Codex review returned OK/No issues found. Actual child metadata verified; record separate new-runtime live/Git/publication gates.
- [x] T048 Obtain owner selection of guarded connect-time legacy-auth adoption and record the M3-R2 behavioral/security boundary before implementation.

## Milestones: M1–M4 qualified; Git delivery and M5 remain gated

- [x] M1 Licensing/packaging/loader work, pre-publication npm account readiness and documentation/artifact refresh verified (T008–T017). No name reservation, package ownership or publication is claimed.
- [x] M2 Implement owner-approved lock policy and scoped dependency/security migrations; clean reproduction, exact-model review and commit/push completed. Platform/native limits remain explicit.
- [x] M3 Qualify the actual distributable on macOS x86_64 and Linux amd64 using synthetic data, including process/account isolation.
- [x] M4 Historical media/history live evidence and exact-model review completed (T036–T040), followed by final-runtime bounded saved-session/readability revalidation (T049). Scope limits remain explicit.
- [x] T049 Obtain fresh approval and complete final-artifact saved-session connect/stop/reconnect: exactly two one-attempt texts; owner confirms both readable and the archive-restored native quote visible. Auth ownership/context fences, isolated offline records/0600/secret exclusion and configuration byte-preservation passed. Setup failures and contact recovery remain documented; observed statuses were SERVER_ACK (2), not new READ/PLAYED coverage. No reset/logout/media/history fetch or uncertain resend.
- [ ] M5 Publish only with separate approval; verify prerelease installation and make stable promotion a later decision. The latest owner instruction authorizes Git commit/push only and explicitly prohibits publication.

See [the plan](plan.md#4-ordered-implementation-milestones) for each prerequisite, deliverable and completion gate. External metadata, license findings and npm availability must be refreshed at their implementation gates.
