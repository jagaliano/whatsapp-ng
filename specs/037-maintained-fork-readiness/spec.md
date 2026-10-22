# Specification: maintained-fork release readiness

**Baseline:** `d415f0b`; M0 documentation published as `911cecd`.

**Scope:** M0 decisions and authorized M1 packaging. M2–M5 remain separate gates.

**Status:** M1 technical preparation and parent checks implemented (402 tests/44 files and preliminary packed-entry loader passed). The owner accepted the upstream MIT declaration and LICENSE has been added; npm-account verification remains open. No publication.

## Requirements

- **R1 Identity:** Prepare `whatsapp-ng@1.1.0-rc.1` metadata for `jagaliano/whatsapp-ng`, preserving original author/history. The intended prerelease tag is `next`, not automatic `latest`.
- **R2 Host integration:** Declare imported Pi-provided legacy packages as wildcard peers, not runtime dependencies. Keep development copies needed for checks. Verify the actual host aliases and packaged loader, not just TypeScript compilation.
- **R3 Compatibility:** Preserve `whatsapp-pi.ts`, existing command/tool/flag contracts and default storage/auth/profile/account identity. No transport patch, PDF major migration or runtime rewrite.
- **R4 Publication safety:** Keep `private: true` pending npm registration/account verification and release approval. The owner accepts upstream's declared MIT license as the basis; ship MIT terms with the supplied 2026 owner notice and yearless Rapha attribution. Upstream issue #17 is advisory, not a licensing blocker. No npm publication in M1.
- **R5 Reporting:** Enable and verify the selected private GitHub vulnerability-reporting route. Ordinary issues/support remain best effort with no SLA; never solicit real auth/private content.
- **R6 Installation:** Clearly distinguish unpublished source/candidate use from a future registry command. Require prior same-profile extension/services to stop; document package switchback without auth deletion or lossless-downgrade promises. Mark legacy service installers and unbundled resources accurately.
- **R7 Evidence:** Add focused manifest regression coverage, run declared checks, and perform a preliminary isolated loader check on packed files. Record exact dependency/native-tool setup and limitations. M1 is not M3 clean-install/platform certification or M4 live validation.
- **R8 Boundaries:** No global configuration/login/token edits, real credential migration, live WhatsApp operations, dependency-upgrade project, automatic M1 commit/push or change to old repositories. Local validation installs were separately approved without lifecycle scripts or lockfile publication.

## Acceptance and completion

Metadata/peer/docs/security preparations may be implemented while R4's external gates remain blocked, but **M1 must not be marked complete** until the plan's remaining npm-account/rights and loader criteria are satisfied. The owner-accepted MIT basis satisfies the license criterion. Candidate publication must remain mechanically blocked until the approved gate is cleared.

The official Pi 1.3.0 package guidance supplies host peers and suppresses peer installation for managed packages. Its installed loader maps the legacy `@mariozechner/*` and `@sinclair/typebox` imports used here. Runtime/module behavior must still be observed in the isolated artifact check.

Initial qualification targets remain macOS/Linux, Node 26.x / Pi 1.3.0. Windows and successful live backfill/receipt reconciliation are unverified. Previous 397-test source-checkout evidence is not a new artifact result.

See [plan.md](plan.md) for staged gates, decisions and execution evidence, and [tasks.md](tasks.md) for the corresponding work items.
