---
title: "whatsapp-ng maintenance and release readiness"
type: maintenance
status: active
date: 2026-10-22
baseline: d415f0ba7f392b15d5b635f5b3aa9f62ab58c25c
---

# whatsapp-ng maintenance and release-readiness plan

**Updated:** 2026-10-22

**Baseline:** `d415f0b` on `main` in the new repository; original source branch `feat/baileys-conversation-fidelity` remains unchanged.

**Decision:** continue the existing codebase as `jagaliano/whatsapp-ng`, with npm candidate name `whatsapp-ng`; do not migrate to another extension or Baileys fork.

**Execution status:** M0 completed and independently source-reviewed. The owner subsequently authorized committing/pushing its documentation and continuing with M1. M0 was committed/pushed as `911cecd`. Safe M1 preparation and parent validation are implemented, but the owner has accepted upstream's MIT declaration and LICENSE has been added; M1 still awaits npm-account verification; M2 implementation, exact-model review and separate M1/M2 commit/push are completed (`f90be5a`, `759a47f`); M3–M5 remain separately gated. See section 13 for the approved M2 decisions. This numbered plan and [tasks](tasks.md) are the canonical repository artifacts; the ignored root strategy is only a navigation pointer. The later approval permits M0 documentation publication, not npm publication or stable promotion.

## 1. Direction and boundaries

Continue this extension, retain the currently installed `baileys@7.0.0-rc14` transport as the starting baseline, and prepare a clearly identified maintained release. Reusing our tested identity, routing, media and archive work is a lower-risk starting point than replacing it without a demonstrated benefit.

There are two distinct fork decisions:

- **Extension ownership:** maintain our continuation of `RaphaCastelloes/whatsapp-pi` in `jagaliano/whatsapp-ng`. Preserve `jagaliano/whatsapp-pi` and its upstream PRs as the original contribution lane.
- **Transport ownership:** continue consuming Baileys. Do not take on a private protocol fork or a bundle of third-party patches by default. A reproducible transport defect can justify a separately reviewed patch later.

This is **maintenance of Phases 1–3**, not Phase 4. Phase 4 remains undefined, unscheduled and unauthorized. New capabilities require a concrete use case and their own scope/approval; the existence of an upstream PR is not a product requirement.

The owner approved the public `whatsapp-ng` repository/local checkout, then separately authorized **M0 implementation followed by an independent `openai-codex/gpt-6.1-sol` review**. M0 creates the maintenance branch, prepares the tracked decision record and documents selected policies. It does **not** authorize runtime/package/dependency changes, new commits/pushes, license assertions, npm publication, GitHub security/settings changes, live WhatsApp operations, auth migration or rollback. The owner subsequently approved M0 commit/push and M1 implementation. M1 may change the approved package/documentation/host-peer metadata and establish the selected private reporting channel; it cannot invent a license grant or bypass publication rights. M2–M5 remain separately gated.

## 2. Verified starting point

Evidence was refreshed on 2026-10-22. Counts and package versions are snapshots, not guarantees about future upstream activity.

| Area | Current evidence | Consequence |
|---|---|---|
| Foundation | `948f539`, upstream [PR 14](https://github.com/RaphaCastelloes/whatsapp-pi/pull/14), open | Batch intake, identity, full keys and response ownership are already in our baseline. |
| Media/native replies | `875ad9e`, upstream [PR 15](https://github.com/RaphaCastelloes/whatsapp-pi/pull/15), open | Existing bounded send/preparation and native-quote paths must be preserved. |
| Conversation fidelity | `d415f0b`, upstream [PR 16](https://github.com/RaphaCastelloes/whatsapp-pi/pull/16), open | Persistence, explicit history requests and lifecycle reconciliation are implemented, not an unfinished future phase. |
| Automated baseline | 397 tests across 43 files; lint, typecheck and whitespace checks passed in the implementation/publication session | A starting regression baseline, not proof for future dependency/donor changes. No build script is declared. |
| Live validation | Phase 2: 11 sends and operator-confirmed rendering/playback. Phase 3: 3 accepted sends, offline restart and native quote stanza after reconnect | Phase 3 successful backfill import and live receipt reconciliation remain unverified. Its request timed out as unknown, with 0 imports. |
| Source/publication | Local manifest is `1.0.71`; npm currently reports `whatsapp-pi@1.0.70`. Upstream repository is not archived; reported push date is 2026-10-04 | There is a distribution gap. This is not proof that the maintainer has abandoned the project or that existing users do not matter. |
| License | `package.json` declares MIT; no tracked `LICENSE`/`COPYING` file; GitHub reports no detected upstream license | Resolve provenance/notices before redistribution under our package identity. Do not invent copyright ownership. |
| Dependency policy | Manifest declares `baileys: ^7.0.0-rc14`; installed version is rc14. `package-lock.json` is ignored | The transport is not exactly pinned, and a clean install is not fully reproducible merely because this workstation passes. |
| PDF dependency path | Installed LiteParse 1.5.3 uses `sharp@0.34.5`; installed Baileys separately uses `sharp@0.35.5` | [Issue 10](https://github.com/RaphaCastelloes/whatsapp-pi/issues/10) needs a current security assessment. Removing one dependency path does not remove all `sharp`. |

Repository bootstrap: [jagaliano/whatsapp-ng](https://github.com/jagaliano/whatsapp-ng) is public, with local checkout `~/workspace/whatsapp-ng`. `origin` points to the new repository, `upstream` to `RaphaCastelloes/whatsapp-pi`, and `legacy-fork` to `jagaliano/whatsapp-pi`. No existing npm package named `whatsapp-ng` was found when checked; that does not reserve the name or establish publishing rights. The runtime manifest still says `whatsapp-pi@1.0.71` until M1 is authorized. Only reachable published Git history was cloned; no ignored auth, recents, caches or dependencies were copied.

Detailed test/review/live evidence is in [the Phase 1–3 plan](../036-baileys-capability-roadmap/plan.md). Those earlier reviews are source reviews, not proof that every platform, device or transport event works live.

## 3. Invariants for every maintenance slice

- Preserve allowlists/group binding, canonical PN/LID identity, complete keys, account/profile isolation, response ownership, stable send IDs, cancellation/unknown-delivery semantics and quote revalidation.
- Keep one authoritative normalized archive, separate memory-only raw retry data, bounded retention, protocol expiry, deletion/admission protection and truthful degraded/unknown states.
- Preserve shared Pi context as an explicit trusted-user limitation. Routing isolation is not context isolation.
- Keep `pi.extensions` pointing at `./whatsapp-pi.ts` and the default storage root at `~/.pi/agent/extensions/whatsapp-pi`. Preserve relative auth profiles and archive profile/account markers.
- A different npm/repository name does not itself require QR re-pairing. Losing or changing auth state without a valid migration can. This plan does not rename or migrate storage.
- Do not run the old installation and the maintained package simultaneously against the same auth profile. An archive-writer lock is not proof of transport/socket exclusivity.
- Never copy real credentials, recents, messages, logs or downloaded business files into fixtures, tarballs, issues or public evidence. Tests use temporary synthetic data.
- Do not rewrite published history or automatically merge upstream/donor changes. Attribute adopted work and keep upstream PRs open unless the owner decides otherwise.

## 4. Ordered implementation milestones

Milestone IDs are independent of the feature roadmap's U1–U10. Start in order. Each slice needs explicit implementation authorization; high-risk operations have additional gates below. Completed deliverables and evidence should be recorded here as work actually finishes, not checked off in advance.

Serialize M1/M2 manifest and dependency-file edits; keep packaging, transport pinning and runtime migrations in separately reviewed commits when committing is authorized. Only read-only licensing/dependency research may overlap. Freeze the M3 candidate commit after both M1 and M2 are final; later code/manifest/dependency edits invalidate the affected artifact evidence and require a new candidate.

### M0. Establish the maintenance lane and release decisions

**Depends on:** prior strategy review and explicit M0 authorization, both received.

**Scope:** repository/release decisions, no dependency or transport changes.

1. Completed locally: `chore/fork-release-readiness` was created from `main` at `d415f0b`. `main` and `origin/main` remain at the original baseline. The reviewed M0 documentation was later committed/pushed as `911cecd`; The later M1 packaging checkpoint was committed as `f90be5a` and followed by M2 `759a47f`; both were pushed under the owner's later approval. The old repository and its published upstream feature branches are untouched.
2. Completed locally: this canonical numbered plan and `tasks.md` record the baseline, remotes, existing PR links, supported-use-case boundaries and known live gaps. README links to this record. The reviewed M0 files were committed/pushed as `911cecd` after separate approval; later M1 work is not covered by that commit approval. No ignored root file is the sole authority.
3. Record the integration policy for the new `main`: reviewed maintenance work promotes there, while the old fork and upstream feature PR branches remain intact. The new repository's initial default-branch bootstrap was explicitly approved; this does not authorize changing the old repository's default branch or rewriting history. We need not wait for upstream merges to maintain our line.
4. Approved: npm candidate `whatsapp-ng`, first prerelease `1.1.0-rc.1`, published only under `next` if M1–M5 pass and publication is explicitly approved. Stable `1.1.0`/`latest` is a separate later decision. No existing npm package was found at the M0 lookup, but registration eligibility and publishing rights remain M1 gates. A different package name does not automatically update existing `whatsapp-pi` installations.
5. Approved: GitHub owner `jagaliano` is the initial maintainer; non-sensitive bugs go to the new repository's issues, best effort with no SLA. M1 must establish a private security-reporting channel before npm release. Initial qualification targets are macOS and Linux with Node 26.x / Pi 1.3.0, not yet certified artifact support; Windows is best effort/unverified. See the decision/matrix record below.

**Deliverable:** reviewed maintenance-lane and release-decision record, with unresolved choices visible.

**Done when:** baseline, ownership, candidate identity, branch policy and supported test matrix are explicit; no published branch has been rewritten. Legal, dependency and release gates remain open for later milestones.

### M1. Resolve licensing, package identity and host integration

**Depends on:** M0.

**Scope:** a packaging/documentation slice; no bundled PDF major upgrade or protocol patch.

1. Record upstream's MIT declaration and the owner's accepted licensing basis. Include MIT terms, the supplied 2026 owner notice and yearless upstream attribution; preserve history and relevant third-party notices. The owner has decided not to wait for issue #17; it is advisory, not a license gate.
2. Verify the chosen npm name/scope and account permissions without exposing tokens. Update package name/version, repository, homepage and issue destinations to the maintained line, while crediting/linking upstream.
3. Verify Pi's current host-provided dependency contract before changing TypeBox declarations. [Issue 12](https://github.com/RaphaCastelloes/whatsapp-pi/issues/12) proposes a wildcard peer plus a development dependency. Confirm this against the targeted host/loader and an actual packaged install; do not treat a donor manifest as self-validating.
4. Keep storage/auth/archive identities unchanged. Document removal or disabling of the prior extension before enabling the maintained package, including persistent/headless services and how to return to the prior installation safely.
5. Update README/changelog/support policy: maintained fork, divergence, installation source, shared-context limitations, unofficial transport risk, and known experimental history/receipt behavior. Verify referenced installation/build/service resources are included in the artifact or clearly external prerequisites.

**Deliverable:** license/provenance resolution and coherent fork packaging/install metadata.

**Done when:** legal redistribution basis and package rights are recorded; targeted Pi loader registers the packaged extension without duplicate host-module warnings; no unintended auth/profile path change or duplicate installation is introduced. Publication still waits for M2–M5.

### M2. Make dependency changes deliberate and resolve security findings

**Depends on:** M0; coordinate manifest changes with M1.

**Scope:** separate, reviewable slices for reproducibility and each runtime dependency change.

1. Propose an exact transport pin to `7.0.0-rc14` for the initial candidate. Record resolved dependencies and the tested Pi host/SDK, Node, OS, FFmpeg and Whisper setup. Review the drifting SDK `latest` declaration too; do not silently upgrade it.
2. Agree on a clean-checkout lockfile policy for maintainer/CI reproduction. The repo currently ignores `package-lock.json`; changing that policy or committing a lockfile requires owner approval. Use `npm ci` only once the agreed lockfile exists. Exact direct pins alone do not freeze transitive dependencies or all future consumer installs.
3. Run a fresh dependency/security assessment, separating actual installed paths from stale reports. Inventory native binary downloads/build scripts and licenses. Disposition high/critical findings with evidence and an effective fix/mitigation; generic audit suppression is not a release gate.
4. Evaluate the smallest safe remediation for the LiteParse/`sharp` finding. LiteParse 2.15.1 metadata currently declares only `commander`, but a major upgrade is a **runtime migration**, not packaging-only work. Validate imports, PDF extraction, OCR on/off, errors, resource cleanup and supported platforms with representative synthetic PDF fixtures. Re-audit the complete tree afterward; Baileys' separate `sharp` path remains relevant.
5. Inspect whether legacy native packages/build scripts are actually needed before proposing removals. No bulk dependency cleanup, `npm audit fix --force` or replacement transport is authorized by this plan.

**Deliverable:** approved dependency/lock policy, resolved candidate tree, security dispositions and focused compatibility tests.

**Done when:** a clean candidate environment can reproduce the maintainer checks; no known high/critical finding lacks an accepted effective disposition; runtime dependency changes have their own review/test evidence. Document the limits of consumer transitive-version reproducibility.

### M3. Validate the actual distributable in isolation

**Depends on:** M1 and M2.

**Scope:** candidate artifact, install and regression checks, without live credentials.

1. Inspect `npm pack --dry-run` output, then build a local candidate tarball. Confirm entry/source/runtime resources and license notices are present, and credentials, local archives, caches, logs, drafts and test artifacts are absent.
2. Install that tarball through the targeted Pi package loader in a temporary environment. Test installation, extension discovery, schema/peer resolution and removal/reinstall. Do not use source-tree success as evidence for the installed artifact.
3. Run the common validation gate in section 5, including native Baileys/FFmpeg contracts. Test whichever OS/Node/Pi versions we intend to claim; narrow unsupported/unverified claims rather than assuming this macOS host proves Linux/Windows support.
4. Exercise synthetic old-recents import, disconnected reads, same-account restart, account/profile changes, auth/config/archive permissions, corruption/degraded recovery and quote/retention behavior. Use only the isolated test profile. Never touch a production profile or use production data as migration fixtures.
5. Check duplicate extension loading and same-profile second-process behavior. Distinguish archive locking from transport takeover. If the candidate can silently steal/reuse a live session or corrupt shared state, open a dedicated blocking reliability slice before release; a donor instance-lock patch is only a candidate, not assumed protection.
6. Add or document a minimal repeatable maintainer/CI check using the agreed dependency policy and existing scripts. Do not add new test frameworks or unrelated abstractions.

**Deliverable:** tarball inventory and clean-install/compatibility report tied to an exact candidate commit and artifact.

**Done when:** the distributable, not just the checkout, loads correctly; its dependency/peer behavior and data isolation are validated; discovered release-blocking defects are resolved. Any fixture/native/platform coverage gaps are explicit.

### M4. Close live gaps or keep the candidate explicitly experimental

**Depends on:** M3 and **fresh explicit approval** for the exact account, recipient, operations and possible connection takeover. Saved auth availability is not permission to use it. Before the candidate/harness accesses an approved real auth profile, confirm the previous extension and every same-profile headless service/process are stopped or disabled. Do not rely on the archive lock to prevent a second socket connection.

1. Use only generated non-sensitive fixtures and an approved harness. Record the artifact/version/device scope. Never copy auth into the repo or public reports; preserve normal credential refresh and disconnect without logout.
2. Confirm representative text/media/native-quote behavior from the installed candidate. Distinguish socket acceptance, recipient delivery, physical client rendering and playback.
3. Attempt a small explicitly authorized backfill with an observed anchor. Verify exact request correlation, an actually imported record and its local visibility after restart. A pending ID or unknown timeout does **not** count as successful import.
4. Observe at least one genuine delivery/read lifecycle event where the approved client/privacy settings permit it, and verify the intended record changes. Do not claim group/per-participant coverage from a direct-chat observation. Remote edit/delete tests require their own explicit authorization.
5. Record success, unsupported/device-limited results and failures separately. Bounded unknown outcomes can be correct behavior without proving successful backfill/receipt integration.

**Deliverable:** private evidence summary with sanitized public conclusions.

**Done when:** successful live backfill import and representative receipt reconciliation are demonstrated, **or** those capabilities remain explicitly experimental/unverified and the first distribution stays a prerelease. The latter is not permission to claim production validation. Any later stable promotion with exclusions needs an explicit supported-feature contract and owner approval. New actual data-loss/session/identity defects block release regardless of labels.

### M5. Publish a reviewed prerelease, then decide stable promotion

**Depends on:** M0–M3 complete, M4 evidence/disposition recorded, and **separate publication approval**.

1. Review the exact candidate commit, version, package contents, dependency provenance, install instructions, license notices, known limitations and changelog. Re-run gates after any code/manifest/dependency change; tie the evidence to the final artifact rather than a different checkout.
2. With explicit authorization, publish a prerelease under a non-default tag such as `next`. Do not overwrite another package's identity or move the stable/default tag automatically.
3. Verify installation of that registry artifact in a clean Pi environment, without using real credentials for the install smoke. Record the maintainer's issue/support route and a practical observation period before promotion.
4. Stable promotion requires a separate owner decision, no unresolved release-blocking defects, accepted compatibility/security evidence, a clear supported-feature contract and explicit treatment of M4's live gaps.
5. Rollback guidance must distinguish package rollback from data rollback. Preserve the new archive; older code/old recents will omit post-migration records in the old view. Do not promise lossless downgrade or make destructive state changes an automatic recovery action.

**Deliverable:** identified prerelease artifact and verification/release notes; later stable decision recorded separately.

**Done when:** the approved registry artifact installs as tested, default-tag changes are deliberate, and support/rollback limitations are visible. If publication rights/license remain unresolved, stop before publishing rather than finding a workaround.

## 5. Common validation gate

For each implementation slice, record the exact commit, dependency tree and environment. Run:

```sh
npm test
npm run lint
npm run typecheck
git diff --check
```

Use temporary `HOME` and `PI_CODING_AGENT_DIR` for tests and this credential-free startup smoke. Do not run with `--whatsapp-pi-online`:

```sh
pi --mode rpc --no-session --no-extensions --no-skills \
  --no-prompt-templates --no-themes -e ./whatsapp-pi.ts
```

Require an actual successful `get_state` RPC response, not just a process that stays alive. Artifact installation also gets its own smoke using the installed entry. There is no declared build command.

The native suites include `native-quote.contract.test.ts`, `native-media.contract.test.ts`, `native-archive-quote.contract.test.ts` and `outgoing-media.conversion.test.ts`. Verify native cases actually ran rather than being skipped because of missing tools. Add focused fixtures for each change and use an independent read-only review for sensitive runtime, identity/auth, persistence and dependency changes. Tests do not replace authorized live checks of protocol behavior.

The 397-test baseline is historical evidence for `d415f0b`, not a fixed target count or a claim that proposed updates have passed. No tests, upgrades, packaging operations or live sessions are executed merely by approving the direction in this document.

## 6. Selective donor/backlog policy

Other forks and upstream proposals are **sources to inspect**, not replacement baselines or a mandatory merge queue. After baseline release blockers are understood, prioritize reproducible defects by impact. A blocking defect can interrupt M1–M5; optional features cannot.

| Candidate | Classification / treatment |
|---|---|
| [PR 11: own-LID self-chat](https://github.com/RaphaCastelloes/whatsapp-pi/pull/11) | Correctness candidate. Reproduce against `d415f0b` or the current maintenance candidate. If still broken, port the minimal fix/test while preserving canonical resolution, send overrides, stable IDs, quotes and ownership. Old conflict counts are not current evidence. |
| [Issue 12: TypeBox peers](https://github.com/RaphaCastelloes/whatsapp-pi/issues/12) | M1 host integration. Verify the targeted loader and packaged artifact before adopting any donor declaration. |
| [Issue 10: LiteParse/Sharp](https://github.com/RaphaCastelloes/whatsapp-pi/issues/10) | M2 security/runtime migration, not a blind packaging bump. |
| `bamer` instance-lock work | Reliability candidate if duplicate-process/session takeover is reproduced. Inspect pre-connect enforcement and recovery/lock ownership; archive locking alone is insufficient. |
| `pp14z` auth backup/shutdown/reconnect work | High-risk candidate only for a reproduced defect. Review write ordering, process ownership and failure recovery using synthetic auth fixtures. No bulk cherry-pick or credentials migration. |
| `lwyxzm` host dependency fix | Packaging candidate, subject to M1 tests. Additional document-send tools may duplicate current media support; compare contracts before adding them. |
| `lwyxzm` active-run steering | Do not adopt automatically. It changes consumed-input attribution and can invalidate response ownership; requires its own approved design/characterization if ever needed. |
| [PR 9: brand settings](https://github.com/RaphaCastelloes/whatsapp-pi/pull/9), [issue 13: thinking indicator](https://github.com/RaphaCastelloes/whatsapp-pi/issues/13) | Optional UX/product work, not required to publish the maintained baseline. Keep deferred. If requested later, define requirements; never replace the shared send pipeline to add branding or presence. |

For each adopted change: name the source commit/author and applicable license, demonstrate the current failure, preserve attribution, port the smallest coherent change, run focused and full gates, then obtain the required review/operational approval. Do not estimate safety from a patch's line count or a third party's success report.

### Transport patches are an escalation, not a starting task

The earlier draft listed Baileys PRs 2711, 2743, 2763, 2765, 2820 and 2722. They remain **unvalidated leads** here, not an approved patchset; their current state and applicability must be refreshed before use.

A transport patch requires a minimal reproduction demonstrating that the defect is below the extension boundary, full-source security/compatibility review, a native contract regression and appropriately authorized live verification. Signal/decryption/session/app-state changes receive extra scrutiny. Test typed edit reconciliation separately from encrypted-edit decoding; success in one does not prove the other.

Only then decide how to consume a reviewed fix: compatible upstream release, narrowly scoped patch, or a separate transport branch. Record exact immutable commit/artifact provenance and dependency/build requirements. Do not prescribe a rebasable private Baileys fork or `patch-package` until there is an actual patch and a reviewed distribution method. A breaking upstream refactor triggers evaluation, not automatic abandonment of monitoring.

## 7. Alternatives and reconsideration triggers

- **Another extension fork:** reconsider only if it offers a verified, maintained capability we need at materially lower total migration/support risk. Compare routing, auth/storage, privacy, lifecycle and packaging contracts, not README claims alone.
- **Another Baileys fork:** require demonstrated fixes/security/maintenance advantage and compatible live behavior. Missing identifiers in one source file do not prove absence of LID support throughout a fork. SDK types/builders for albums/buttons/events likewise do not prove client rendering, account availability or complete feature support.
- **Browser-based transports:** assess session model, resource requirements, platform support and current licenses before migration. Do not describe Open-WA as simply a wrapper around whatsapp-web.js; current Open-WA metadata shows its own driver packages, including Puppeteer and Lightpanda. No migration is selected here.
- **Official API:** reconsider if the product becomes a business/compliance integration. It is a product/operating-model decision, not a drop-in personal-account transport replacement.
- **New extension/daemon:** reconsider only with an approved change in product shape such as independent multi-account service operation, not to work around an unresponsive publish channel.

All unofficial personal-account transports retain platform-policy, account-restriction and protocol-change risks. Changing forks does not eliminate them. Revisit this strategy when actual maintenance capacity, a demonstrated incompatibility or product requirements change. Upstream response latency and download counts alone do not settle that decision.

## 8. Immediate next action and open gates

**Current gate:** M0 implementation and independent review are complete on `chore/fork-release-readiness`; separate commit/push and M1 implementation approval have now been received. The M0 record was published as `911cecd`. M2 review and approved M1/M2 commit/push are complete. The owner subsequently authorized a bounded installed-candidate/live probe, recorded in section 14. Remaining M3–M5 implementation/release work must not start automatically. The owner has accepted upstream MIT and added notices; the remaining M1 gate is npm-account/registration verification. Publication still requires the later qualification and approval gates. Do not start Phase 4 or patch Baileys. Upstream PR merges are not a prerequisite.

M0 decisions are recorded below. Remaining implementation gates include:

- M1: npm registration/publishing-account verification remains open; owner-accepted MIT, package metadata and private security channel are implemented.
- M2: dependency/security remediation and owner-approved lockfile/reproducibility policy.
- M3: actual artifact qualification, including Linux and architecture/patch-version evidence.
- M4: separately authorized live backfill/receipt verification or truthful experimental disposition.
- M5: separately authorized prerelease publication and later stable-promotion decision.

Then execute **M1 → M2 → M3 → M4 → M5**, keeping each manifest/runtime change separately reviewable. Licensing investigation and dependency/security diagnosis may proceed in parallel, but no prerelease escapes the stated gates. A verified critical defect takes priority over this ordering; optional donor features stay deferred.

## 9. Verification and independent review record

**Parent verification for this update:** read current source/manifest/storage and existing Phase 1–3 evidence; queried GitHub repository/PR/issue metadata, npm extension/Open-WA/LiteParse metadata, and the installed LiteParse/Baileys `sharp` paths. GitHub reports no detected upstream license; npm reports MIT metadata. Those are evidence inputs, not a legal determination. Old download/star/LOC/conflict counts and assumptions of total LID/feature coverage were deliberately removed.

**Execution distinction:** the earlier strategy review and approved repository bootstrap are historical. Current M0 created only the local maintenance branch and documentation/decision record. No package/dependency/runtime/global settings change, dependency installation, new commit/push, GitHub security-setting change, package packing/install/publication, production migration or live WhatsApp operation was performed. The earlier 397-test and live results remain explicitly dated baseline evidence. Remote metadata/package versions must be refreshed before their implementation milestones.

**Independent review:** Anthropic Claude Sonnet 5.5, exact registry ID `anthropic/claude-sonnet-5-5`, medium thinking. `pi-subagents` 0.80.0 and model availability were checked before dispatch; actual run status confirmed the requested provider/model despite the reviewer's different configured default. No provider/model fallback was used. Run `06d0f243-c8cf-4929-a775-a1ce164dcc14` reviewed the full strategy plus `package.json` and `src/services/storage-path.ts`; it did not independently re-query remote metadata, re-run tests or inspect every related source file.

Initial verdict: **OK with notes**, no P0/P1 findings. Two actionable P2 clarifications were applied: serialize manifest/lockfile edits and freeze the candidate after M1/M2; explicitly stop prior same-profile installs/services before live use. M3's synthetic profile and auth/config/archive permission checks were made explicit too. The remaining note requires no correction: M0 selects candidate identity/policy, M1 verifies rights and legal gates before any publication. The same retained Sonnet 5.5 reviewer re-checked the clarifications in run `a70e0675-50f4-4f15-b444-9c83a5f7294a`: final verdict **OK**, **“No issues found.”** No new contradictions were found.

The prior parent document checks belong to that earlier strategy revision. Current M0 checks and the requested Codex review are recorded separately below; no runtime test result is inferred from documentation validation.

## 10. Approved M0 decision and qualification record

The owner selected the release, target matrix and support policies through explicit questions on 2026-10-22. These are planning decisions, not performed M1–M5 operations.

| ID | Decision | Boundary / next gate |
|---|---|---|
| D1 | Continue `jagaliano/whatsapp-ng` from full commit `d415f0ba7f392b15d5b635f5b3aa9f62ab58c25c` | No rewrite, transport-fork migration or Phase 4. Original attribution/history retained. |
| D2 | Work on `chore/fork-release-readiness`; new default branch remains `main` | Reviewed, explicitly authorized commits/PRs promote to `main`. Never rewrite the three upstream feature PRs. Original M0 implementation stopped before commit/push; later explicit owner approval now permits publishing its reviewed documentation. |
| D3 | `origin` = new repo; `upstream` = RaphaCastelloes/whatsapp-pi; `legacy-fork` = jagaliano/whatsapp-pi | Use old remotes for inspection by policy, not as implicit push targets. No remote mutation/technical push-block claim. |
| D4 | npm candidate `whatsapp-ng`; initial prerelease `1.1.0-rc.1` tagged `next` | M1 verifies name/rights and implements metadata. M5 requires separate publication approval. No name reservation is claimed. |
| D5 | Stable candidate `1.1.0`, default tag `latest` only by later approval | Not an automatic consequence of a passing prerelease; M4 limitations must be dispositioned. |
| D6 | Initial maintainer `jagaliano`; [ordinary issues](https://github.com/jagaliano/whatsapp-ng/issues), best effort, no SLA | Original authors retain attribution; maintaining the fork is not ownership of all inherited copyright. Sensitive reports must not include credentials/private messages in public issues. |
| D7 | Establish GitHub private vulnerability reporting or an approved equivalent in M1, before npm release | Policy selected, channel not enabled/verified by M0. Do not advertise a working private-report route until implemented. |
| D8 | Canonical plan/tasks live in `specs/037-maintained-fork-readiness/`, with README navigation | Prepared and Git-indexed during M0; documentation publication was subsequently approved separately. Root `FORK-STRATEGY.md` stays an ignored convenience pointer. |
| D9 | macOS and Linux qualification targets, Node 26.x / Pi 1.3.0 | Architecture and exact Node/OS patch combinations must be recorded by M3. Only demonstrated combinations can become artifact-supported claims. Windows remains best effort/unverified. |
| D10 | Keep current entry, storage/auth/profile/archives and actual manifest unchanged in M0 | `whatsapp-pi.ts`, `~/.pi/agent/extensions/whatsapp-pi`, and current `whatsapp-pi@1.0.71` are intentional until their separately gated work. |

### Qualification targets versus existing observations

| OS | Node / Pi target | Existing observation | Release qualification status |
|---|---|---|---|
| macOS | Node 26.x / Pi 1.3.0 | Current host reports Node v26.12.0 and Pi 1.3.0. Earlier source-checkout tests/startup/live evidence exists for Phases 1–3. | Installed `whatsapp-ng` artifact not qualified; exact OS/architecture/patch results required in M3. |
| Linux | Node 26.x / Pi 1.3.0 | No Linux run supplied for this baseline. Existing Linux instructions are not test evidence. | M3 qualification required before supported-artifact claims. |
| Windows | No initial qualification commitment | No Windows run supplied. Existing inherited instructions are not certification. | Best effort/unverified; no stable support promise. |

**Historical M0 snapshot (before M1):** the inherited README/manifest still described the upstream package and broader prerequisites. The M0 status notice identified that distinction, and no dependencies were installed in the new checkout at that time. M1 later changed the packaging/docs and installed approved local validation dependencies, as section 11 records. The old checkout's evidence is not a new clean-install result.

### M0 implementation evidence and completion boundary

- Local branch created from the exact `d415f0b` baseline. New `main`/`origin/main` and the old repository's feature branch remain unchanged.
- GitHub reports the new repository public, default branch `main`, with ordinary issues enabled. npm lookup found no existing `whatsapp-ng` package; registration/publishing rights are still unverified.
- Prepared this canonical plan, its tasks and a minimal README status/navigation notice. No license text or package/dependency/storage/runtime edits.
- Safely inspected only relevant model/subagent policy fields: no auth files, tokens or global configuration edits. Registry lists `openai-codex/gpt-6.1-sol`; `pi-subagents` 0.80.0 is installed. The configured reviewer default differs, so the requested provider/model must be explicitly overridden and confirmed from runtime.
- Parent document/source/index validation passed: M0–M5 order/gates, D1–D10, selected policies, relative links, whitespace, exact baseline and unchanged runtime/package/storage/gitignore/old-repo state. Only README plus this numbered plan/tasks are staged; `git diff --cached --check` passed. New `main`/`origin/main` remain at `d415f0b`.
- Runtime test/lint/typecheck/startup were not rerun: M0 changes only documentation and no dependency installation was authorized/performed. The 397-test result remains prior source-checkout evidence, not a new artifact qualification.
- Independent requested Codex review completed: run `5f322a94-441f-47f1-807a-fcb82edfd142`, actual runtime confirmed **`openai-codex/gpt-6.1-sol`**, medium thinking, with no provider/model fallback. Verdict: **OK**, **“No issues found.”** The reviewer inspected the documentation and relevant source read-only; it performed no commands/tests, remote checks or live operations. Branch/index state and historical evidence were parent-supplied, not independently reproduced.
- Parent final checks additionally verified document anchors, staged content safety and the exact three-file documentation scope. No code/package/configuration side effects were introduced. M0 is ready for the separate owner commit/push decision, not an operational release approval.

M0 completion means the local branch and reviewed, staged decision record are ready for owner approval to commit/push. It does not mean the decisions are implemented in package metadata, published publicly, or that any M1–M5 release gate has passed.

## 11. M1 preparation and validation checkpoint

**Historical M1 checkpoint before M2 authorization:** technical preparation/parent checks implemented; **M1 is not complete** because npm-account rights remain unresolved. The owner-accepted MIT basis resolves the earlier licensing gate. At that checkpoint, no M1 commit, npm publication, live operation or M2 upgrade had been authorized/performed. The later M2 implementation and reviewed commit/push approval is recorded in section 13. M0 documentation alone was committed/pushed as `911cecd`.

### Scope and requirement trace

| Requirement | Preparation / evidence | Gate |
|---|---|---|
| R1 identity | `whatsapp-ng@1.1.0-rc.1`, new repository/issue/homepage metadata, original `author: Rapha` retained, fork maintainer credited | Implemented, unreleased. |
| R2 host peers | Legacy SDK/TUI/TypeBox imports are wildcard peers, not runtime dependencies; dev copies retained | Pi 1.3.0 aliases verified; packed entry registers without host-peer warnings. |
| R3 compatibility | Entry, runtime source, flags/commands/tools, auth/storage and scripts unchanged | Source-boundary checks passed. |
| R4 publication safety | `private: true`; planned `publishConfig.tag: next`; inherited MIT metadata documented in `LICENSING.md` | MIT basis accepted by owner; LICENSE includes supplied 2026 owner notice and yearless upstream attribution. npm account verification remains open. |
| R5 reporting | GitHub private vulnerability reporting enabled and GET-verified `enabled: true`; `SECURITY.md` documents route and best-effort support | Implemented setting; no real report or credentials submitted. |
| R6 install/support docs | Maintained-fork README, source/future npm distinction, old-resource stop/disable and switchback guidance, external build prerequisites, unchanged storage names | Legacy systemd installer explicitly still installs upstream; it is not advertised as a fork installer. Linux/Windows qualification not claimed. |
| R7 checks | 5 manifest/license regressions added; 402 tests/44 files, lint/typecheck and refreshed actual-packed-entry loader/RPC passed | Earlier results below; accepted-license rerun in section 12. M3 clean-install/platform certification remains pending. |
| R8 boundaries | User approved local validation install without lifecycles; no runtime/global auth/configuration changes | M1 changes not committed/pushed; remote actions are the approved new-repo private-report setting and the later owner-requested upstream license inquiry. |

### Provenance and validation setup

- Upstream commit `49adbc3` and registry `whatsapp-pi@1.0.70` consistently declare MIT/Rapha. Published tarball bytes matched the registry SHA-512 integrity; no license/notice file or README license text was present. The Git history inspected supplied no license file. The owner subsequently accepted the declared MIT license as the basis for this continuation, superseding the earlier decision to wait for clarification. LICENSE now includes MIT terms, the supplied 2026 owner notice and yearless Rapha attribution. See `LICENSING.md`; [upstream issue #17](https://github.com/RaphaCastelloes/whatsapp-pi/issues/17) remains advisory. No upstream confirmation or unverified year range is claimed.
- `npm whoami --json` failed authentication/verification. No login, token lookup or credential modification was attempted. An unclaimed-name lookup is not registration or proof of publishing rights.
- The new root had no baseline lockfile. With explicit permission, generated an **ignored local validation lock** from the old checkout's installed-tree lock, adjusted root metadata and installed with `npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund`. This does not adopt/commit a lockfile policy.
- Verified retained baseline versions: Baileys 7.0.0-rc14, LiteParse 1.5.3, legacy SDK/TUI 0.73.1 and TypeBox 0.27.12. No PDF major or transport upgrade. SDK `latest`, transitive/deprecation/security assessment and a durable lock policy remain M2 work.
- Host: Darwin x86_64, Node v26.12.0, npm 12.2.0, Pi 1.3.0, system FFmpeg 9.0.2. Dependency lifecycle scripts were disabled; native/media tests used system `ffmpeg` on PATH. An initial forced `FFMPEG_PATH` run failed a fixture expecting the command name; removing that validation override produced the passing full rerun, without altering runtime or existing tests.

### Earlier parent-run results (before accepted-license update)

- `npm test`: **401 passed across 44 files**; real native Baileys/media/quote and codec suites ran.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed with temporary `HOME` and `PI_CODING_AGENT_DIR`.
- `npm pack --dry-run --ignore-scripts --json` and local `npm pack --ignore-scripts`: **34 entries**, with source/entry, README, security/licensing/changelog included; no credentials, auth/archive data, caches, tests or scripts/vendor payloads. Missing scripts/binaries are explicitly external/source-checkout prerequisites, not claimed bundled resources.
- Pre-inquiry candidate tarball SHA-1: `d0bff2073ffed6af0c31112ddf5c539873c73e21`. It was generated locally, not published. The later inquiry changes packaged licensing documentation; its refreshed artifact check is recorded below.
- Extracted the actual tarball into a temporary consumer and linked only its production dependencies to the validated local tree. **No physical host-peer copies** were present in the consumer. Pi's actual resource loader registered **7 tools and 1 command**, with **0 errors/0 warnings**.
- Isolated Pi RPC against that packed entry returned successful `get_state`, with temporary HOME/agent directory, no ambient extensions/MCP, no auth or auto-connect flag.
- This preliminary loader check **reuses validated dependencies**; it is not a fully independent clean install, registry artifact, Linux certification, complete native installation or M4 live validation. Full M3 gates remain open.
- Historical documentation-only inquiry follow-up (licensing wait superseded by the later owner decision below): posted and read-back-verified [upstream issue #17](https://github.com/RaphaCastelloes/whatsapp-pi/issues/17), updated licensing status/tasks, and generated a refreshed 34-entry local tarball (SHA-1 `86c25d0c2c8d1bcbfad04747b61ca5e9f452d947`). Refreshed actual packed-entry loader again registered 7 tools/1 command with 0 errors/warnings, and isolated RPC `get_state` passed. Same reused-production-dependency limitation applies. Links/whitespace and unchanged runtime/HEAD checks passed; full test/lint/typecheck were not rerun for this documentation-only follow-up. The earlier 401-test result is historical evidence, not a new run. No final `LICENSE`, npm login/publication or commit/push occurred; T008 awaits upstream clarification and T009 remains unresolved.

### Complexity tracking and next gate

No constitutional deviation: packaging metadata/docs and a small typed manifest test only; no new runtime class, abstraction, framework or `any`. Existing OOP/service boundaries are untouched. Sensitive module-resolution behavior received an actual host-loader check. Independent read-only review used the retained exact `openai-codex/gpt-6.1-sol` model (runtime verified), run `70adfdc6-e2a5-494e-aa01-fbb0c606edfa`. Verdict: **OK with notes** for technical preparation; all five constitutional principles were confirmed. One P2 historical/current-state ambiguity was corrected by explicitly labeling the M0 snapshot and using past tense. No commands, tests, network checks or artifact executions were performed by the reviewer; parent evidence was not independently reproduced. This is not M1 completion or publication approval.

To close M1: verify the npm publishing account/name eligibility without exposing credentials. The owner-accepted MIT basis has closed the earlier licensing gate. Any resulting content/package change must be revalidated. Do not remove the private guard, publish npm, run live accounts, start M3 or publish automatically. The later owner approval in section 13 permits reviewed M1/M2 commits and push.

## 12. Owner-accepted MIT licensing decision

The owner instructed this continuation to rely on upstream's declared MIT license rather than wait for clarification. This supersedes the earlier licensing wait without claiming an upstream response or relying on another fork's choices.

- Added standard MIT terms in LICENSE with the supplied `2026 José Antonio Galiano Sandoval` notice and yearless `Rapha Castelloes` attribution. No unverified upstream year range is asserted.
- Updated packaged licensing/security/changelog/README and M1 requirements/tasks: T008 is satisfied on this recorded basis; issue #17 is advisory. Third-party licenses/notices remain applicable.
- Added a focused license regression; baseline failed with ENOENT before LICENSE was added. Parent review confirms the typed test and documentation-only license addition introduce no constitutional deviation or runtime/module-boundary changes.
- npm account verification, publication approval and later qualification gates are unchanged. No login/token changes, commits, publication, live operations or M2 work are authorized by this decision.
- Validation rerun: `npm test` passed **402 tests across 44 files**; `npm run lint`, `npm run typecheck` and `git diff --check` passed with temporary HOME/agent directory and system FFmpeg on PATH. No build script is declared.
- Refreshed local tarball: **35 entries**, SHA-1 `e86bcd585aea738d26f85392d15f84212cf71911`. LICENSE is included automatically and matches source byte-for-byte; packaged document links resolve. Private guard and runtime/source boundary are unchanged, with no credentials/state/caches/tests bundled.
- Refreshed actual-packed-entry loader registered **7 tools/1 command, 0 errors/warnings**; isolated RPC `get_state` passed. Production dependencies were linked to the validated local tree, with no consumer host-peer copies. This is still preliminary reused-dependency evidence, not M3 independent clean-install/platform certification. No further independent review was dispatched for this license-text/typed-test update; the earlier packaging review remains historical.

## 13. Authorized M2 dependency/security slice

The owner authorized implementation, independent `openai-codex/gpt-6.1-sol` review, then commit/push. In two explicit decisions the owner approved tracking the root npm lockfile and the scoped LiteParse/native, dev-SDK and existing-test-tooling migrations. M2 depends on M0 and coordinates with M1; the still-open npm-account check does not prevent this non-publishing work. M3–M5/live operations remain separately gated.

### Scope and decisions

- Track package-lock.json; remove only its ignore rule. Maintainer reproduction uses `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund`, followed by existing test/lint/typecheck scripts. No global/npm auth configuration change. Retain other direct ranges under the committed lock rather than perform unrelated upgrades.
- Pin Baileys `7.0.0-rc14`. Pin LiteParse `2.15.1`; remove the vulnerable 1.5.3/Sharp dependency path through that migration, not a forced override. No transport patches.
- Keep production legacy imports and wildcard host peers. Dev aliases point to the actual Pi 1.3.0 SDK/TUI and TypeBox 1.3.27; explicitly declare the matching test-only pi-ai dependency. Pin Vitest/coverage 5.0.5 and its required Vite peer 8.3.5, with Node 26 types 26.6.5. This replaces stale/vulnerable dev copies, not the runtime host.
- LiteParse 2 loads native code on import. Move that import and construction inside the PDF-only fallback boundary so unsupported/missing optional binaries cannot disable unrelated traffic. Allocate/close a parser per PDF; retain saved bytes and 1200-character previews. Set `numWorkers: 1` and a one-process pool, with local OCR, nonfatal OCR failure and a 60-second **parse-only** pool deadline. Library initialization is not covered by that deadline; no total-operation guarantee is claimed.
- Preserve active FFmpeg-static/Whisper paths rather than remove imported dependencies wholesale. Disabled install scripts mean the downloaded FFmpeg binary is absent; system FFmpeg is the tested path. OCR is now local Tesseract, not the prior JavaScript OCR/model-download stack. These are explicit external prerequisites.
- Preserve the tested M1 file checkpoint for a separate packaging commit after the requested review, then commit M2 deltas/lock separately. Only push `origin/chore/fork-release-readiness`; do not publish npm, open a PR, touch old repositories or use live credentials.

### Characterization and regression evidence

- Six focused pre-implementation failures demonstrated missing exact pins/dev aliases, eager PDF initialization, failed-native startup escaping fallback, and absent parser cleanup.
- The SDK/test-tooling migration exposed constructor-arrow mocks and a previously transitive/undeclared pi-ai import. Only those fixture seams were adjusted; production routing assertions are retained.
- The modern SDK no longer uses the old test assignment to `agent.streamFn`. Initial compatibility attempts reached OpenAI with the synthetic fixture key and received 401s; no real credentials/messages were used. The fixture now intercepts the canonical ModelRuntime stream method, explicitly disables catalog networking, blocks fetch and asserts both stream invocation count and zero fetch calls. Text/image ownership, policy transformation and blocking pass against actual Pi 1.3.0.
- Synthetic PDF contracts exercise real native text extraction, OCR off/on, corrupt input recovery, saved bytes/preview/fallback, and actual pool-child reaping after success/failure. No business documents, auth or account data are fixtures. Tesseract-dependent OCR may be skipped when unavailable, which must be disclosed rather than counted as validation.

### Parent validation checkpoint before independent review

- Fresh `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund` regenerated node_modules (358 packages); the committed-candidate lock SHA-256 remained `c8e7dcad6fc0bb31473052bd3d747bec4fe89d8cd9b3e7a740db3efd8d23c9a4`.
- `npm test`: **414 passed/45 files**, including actual local Tesseract OCR and native worker cleanup after success/failure; no skipped OCR test. `npm run lint`, `npm run typecheck`, `git diff --check`: exit 0. Temporary HOME/agent directory, system FFmpeg, no real auth/account fixtures.
- Full and production-only `npm audit`: **0 vulnerabilities**, compared with 16 initial findings. No overrides, audit exclusions or forced audit fix. This is a dated registry assessment, not a scan of every embedded/system native library.
- `DEPENDENCIES.md` records exact dependency/native-tool setup, declared licenses (including inherited GPL components), seven optional PDF platform variants, disabled install scripts/external downloads, consumer lock limits and M3/M4 qualification boundaries. FFmpeg-static/Whisper remain used and were not deleted as unrelated cleanup.
- Deprecation warnings for unchanged eslint/node-domexception are recorded, not mistaken for resolved/ignored security advisories. Linux/Windows and Whisper model/CLI transcription remain unverified.

- Refreshed local artifact: **36 entries**, SHA-1 `6fa8e2164c2c570b08ffa270a248cab87c21e02a`; includes LICENSE/DEPENDENCIES.md, excludes root lock/state/caches/tests/scripts/vendor. Actual packed-entry loader registered **7 tools/1 command, 0 errors/warnings** with no consumer host-peer copies. Isolated Pi RPC `get_state` passed. Production dependencies were linked from the clean-ci tree: this is preliminary module evidence, not M3 managed installation or all-platform certification.
- Review prerequisites refreshed: installed pi-subagents 0.80.0, registry lists exact `openai-codex/gpt-6.1-sol`, and configured reviewer is read-only. Its default differs, so the requested retained model must be confirmed from the actual run; no fallback is allowed.

### Independent review and final discovery correction

- Exact `openai-codex/gpt-6.1-sol` run `d8d367a8-a31d-4b23-a3e3-fefc1ffc55c4` returned **OK with notes**, with no P0/P1 findings. It confirmed the five constitutional principles, PDF boundary/cleanup, native contracts, SDK assertions and pinned graph. Its P2 identified stale M1-only restrictions in the current spec/gate; these were qualified/updated, and section 11 was explicitly labeled historical.
- Focused run `8dc3e7fc-5b21-4e1e-a6bc-ee01ae9a1b4c` returned **OK**, **No issues found**, and read all ten M1 checkpoint files after they were extracted into individually readable files. Snapshot byte equality and command/artifact results remain parent-verified; the reviewer ran no commands/tests/network. No fallback was used.
- A final rerun discovered that the untracked review checkpoint's copied manifest test was included by default globbing, producing an inappropriate 419/46 count. That is not the accepted project-test result. Vitest now explicitly includes only `tests/**/*.test.ts`; actual `vitest list --filesOnly` lists 45 owned test files, and the rerun passed **414/45**, lint/typecheck/whitespace. The final test-discovery correction received exact-model focused review in run `fa6b0aaa-e1eb-4c37-a5de-3d5399013d74`: **OK**, **No issues found**. Actual runtime again confirmed `openai-codex/gpt-6.1-sol`, medium thinking. Source-only coverage limits remain; no application test/assertion was removed.

No publication certificate is implied; npm-account and M3–M5 gates remain open.

### Delivery receipt

- `f90be5a6a3cbcf6b91e4b6e1f56b8939058f3b69`: reviewed historical M1 packaging checkpoint, 10 whole files. Index blobs were verified byte-for-byte against the independently reviewed snapshot; final M2 working files were not swapped or rewritten.
- `759a47f2e060e6a3f5078807154e5a335320b5e5`: reviewed M2 dependency/runtime/test/documentation delta, 19 files including the explicitly approved lockfile. Staged contents passed safety, lock consistency and whitespace checks.
- Normal fast-forward push to `origin/chore/fork-release-readiness` succeeded; remote ref was verified equal to `759a47f`. No force push, main/default-branch update, old-repository mutation, PR or npm publication occurred.
- This documentation-only receipt records the already completed delivery, without changing the tested code, dependency lock or loader-tested package bytes. M2 is complete for this scoped host/candidate; later artifact/platform/live/publication work still requires approval.

## 14. Subsequent approved installed-candidate/live probe

After M2 delivery the owner requested another complete check run and live testing. The recipient was corrected and explicitly confirmed; the owner approved the default saved session, generated media/native replies, receipt observation, a history request capped at three, normal credential refresh and safe disconnect, and confirmed prior same-profile connections/services stopped. This was a bounded validation approval, not npm publication or an unbounded M3/M4 implementation mandate.

See [the sanitized validation report](validation.md). Fresh repository checks passed **414 tests/45 files**, lint/typecheck/whitespace, and zero-finding full/production audits. Unlike the M2 symlinked-dependency probe, the exact 36-entry tarball was actually installed with its production dependencies in a fresh temporary consumer (92 packages, no physical host peers), audited at zero and loaded with seven tools/one command and zero warnings. Installed storage classes passed synthetic isolation/restart/corruption/permissions probes.

Seven generated live send calls returned success and six replies carried native quote stanzas. Downloading/decrypting the generated sent PDF through the actual incoming-media pipeline produced its expected preview. Offline restart, restored quoting, archive privacy and safe disconnect/auth retention passed. No real credentials were copied into the consumer; configuration/archive/logs/media were isolated.

The history request concluded **unknown with 0 imports**; no delivery/read receipts were observed. The owner did not confirm client receipt/rendering/playback when asked. These are not silently promoted to passing delivery/history tests, and transport return values are not a server-ack/client-delivery certificate. No automatic resend was attempted. The probe is service-level, not a complete agent-mediated inbound conversation or group receipt test.

No source fix was required. This evidence-only update leaves runtime/lock/package bytes unchanged. Full M3 managed-install/removal/exclusivity/platform qualification, M4 backfill/receipt/client gaps, the M1 npm-account check and M5 publication remain open; the candidate stays private/unpublished. The existing single-profile process rule remains mandatory, and later live operations require fresh approval.

### Continued M4 diagnosis

The owner then requested continued M4 work. Read-only saved-session identity comparison established that the prior approved recipient was the linked sender itself. This is self-chat evidence, not independent recipient receipt validation. No credentials were printed/copied/written and no new socket was opened. The installed rc14 history-call arguments match count/key/millisecond expectations; no source defect is demonstrated by the unknown result alone.

The next targeted scope requires a distinct approved recipient and client-ready window, or the owner's explicit experimental/unverified prerelease disposition. Self-chat media playback can be confirmed separately but cannot establish two-account receipts/backfill. No full media batch was resent and M4 is not marked complete. See [the validation follow-up](validation.md#m4-follow-up-test-topology).
