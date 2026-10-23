# Specification: maintained-fork release readiness

**Baseline:** `d415f0b`; M0 documentation published as `911cecd`.

**Scope:** M0 decisions, M1 packaging and owner-authorized M2 dependency/security changes, exact Codex review, then commit/push. Later owner-approved installed-candidate/live probes and standalone M4 completion are recorded in [validation.md](validation.md). M4 live evidence and requested exact-model closure review are complete for the stated host/direct-chat scope; M1 pre-publication account readiness is now verified; remaining M3/M5 gates are not closed.

**Status:** M1 packaging, accepted MIT and pre-publication npm account readiness are verified. First name registration/publication remains unperformed and separately gated in M5; no package ownership/reservation is claimed. M2 implementation passed clean npm ci, 414 tests/45 files, lint/typecheck and zero-finding full/production audits; independent exact-model review and focused rechecks returned OK. Reviewed M1/M2 commits `f90be5a` and `759a47f` were pushed to the maintenance branch. No npm publication.

## Requirements

- **R1 Identity:** Prepare `whatsapp-ng@1.1.0-rc.1` metadata for `jagaliano/whatsapp-ng`, preserving original author/history. The intended prerelease tag is `next`, not automatic `latest`.
- **R2 Host integration:** Declare imported Pi-provided legacy packages as wildcard peers, not runtime dependencies. Keep development copies needed for checks. Verify the actual host aliases and packaged loader, not just TypeScript compilation.
- **R3 Compatibility:** Preserve `whatsapp-pi.ts`, existing command/tool/flag contracts and default storage/auth/profile/account identity. No transport patch or storage/identity rewrite. M1 excludes PDF major migration; the later owner-approved M2 LiteParse migration is governed by R10–R11.
- **R4 Publication safety:** Keep `private: true` pending npm registration/account verification and release approval. The owner accepts upstream's declared MIT license as the basis; ship MIT terms with the supplied 2026 owner notice and yearless Rapha attribution. Upstream issue #17 is advisory, not a licensing blocker. No npm publication in M1.
- **R5 Reporting:** Enable and verify the selected private GitHub vulnerability-reporting route. Ordinary issues/support remain best effort with no SLA; never solicit real auth/private content.
- **R6 Installation:** Clearly distinguish unpublished source/candidate use from a future registry command. Require prior same-profile extension/services to stop; document package switchback without auth deletion or lossless-downgrade promises. Mark legacy service installers and unbundled resources accurately.
- **R7 Evidence:** Add focused manifest regression coverage, run declared checks, and perform a preliminary isolated loader check on packed files. Record exact dependency/native-tool setup and limitations. M1 is not M3 clean-install/platform certification or M4 live validation.
- **R8 Boundaries:** No global configuration/login/token edits, real credential migration, unapproved live WhatsApp operations or changes to old repositories. The owner authorized scoped M2 migrations, script-disabled local installs, a committed lockfile, exact-model review and subsequent M1/M2 commit/push. No npm publication.

## Authorized M2 requirements

- **R9 Reproduction:** Track the approved root npm lock; reproduce with npm ci using the documented peer/script flags. Record consumer/system-binary limits.
- **R10 Dependencies:** Pin rc14 and reviewed LiteParse 2.15.1, align dev aliases to the actual Pi 1.3.0 host and use patched existing test tooling. No protocol patch or unrelated bulk cleanup.
- **R11 PDF migration:** Native import must be PDF-only and fail back to saved documents; preserve bounded text previews. Test real synthetic text, OCR off/on, corrupt input and actual worker cleanup. The parse-only deadline is not an initialization/total deadline.
- **R12 Security:** Refresh full/production audits and inventory native binaries, lifecycle downloads and declared licenses. Do not suppress high/critical findings or equate registry audit zero with native-code certification.
- **R13 Review/publication:** Obtain the requested read-only openai-codex/gpt-6.1-sol review, address findings, then commit separately reviewable M1/M2 changes and push only the maintenance branch. M2 alone does not authorize PR/npm publication/live operations; the later explicitly approved bounded validation is documented separately.

## Acceptance and completion

Metadata/peer/docs/security preparations may be implemented while R4's external gates remain blocked, but **M1 must not be marked complete** until the plan's remaining npm-account/rights and loader criteria are satisfied. The owner-accepted MIT basis satisfies the license criterion. The npm account-readiness check now verifies authenticated identity, verified email and write-protecting 2FA, with a current public-name lookup; it does not reserve an uncreated package or guarantee the registry's first-create decision. Existing loader evidence and the documentation refresh checks are recorded in the plan. Candidate publication must remain mechanically blocked until remaining qualification and explicit M5 approval are satisfied.

The official Pi 1.3.0 package guidance supplies host peers and suppresses peer installation for managed packages. Its installed loader maps the legacy `@mariozechner/*` and `@sinclair/typebox` imports used here. Runtime/module behavior must still be observed in the isolated artifact check.

Initial qualification targets remain macOS/Linux, Node 26.x / Pi 1.3.0. Windows remains unverified. Owner-approved M4 now demonstrates representative media/native-quote client behavior, persisted direct-chat READ/PLAYED updates and a correlated two-record backfill visible in a fresh offline reader. This is not group/per-participant, large-history, other-device or full agent-mediated inbound coverage; earlier unreadability and its undiagnosed cause remain recorded. Requested read-only openai-codex/gpt-6.1-sol closure review returned OK/No issues found; actual model/medium thinking were confirmed from child metadata. Previous 397-test source-checkout evidence is not a new artifact result.

See [plan.md](plan.md) for staged gates, decisions and execution evidence, and [tasks.md](tasks.md) for the corresponding work items.
