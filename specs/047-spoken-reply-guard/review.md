# Independent Opus review and dispositions — 2026-10-31

Reviewed `6102a20..7c6d446` (19 changed paths, 166 curated public supporting files). Native `anthropic/claude-opus-5-5`, high thinking, was confirmed in the completed run metadata; no model/provider fallback. Fresh read-only tools were read/grep/find/ls, with no extensions, edits, tests, network, real state or child delegation. Verdict: **OK with notes**, including one introduced medium-severity compatibility issue to correct.

Coverage: full task/manifest/diff and final-output/router source; bounded reads of entrypoint/lifecycle/tools, sender, service/policy/archive/formatting owners and Edge failure paths. Other test suites, release tooling, historical records, reported live probes and runtime behavior were not independently verified. Test-pass counts remain parent command evidence, not reviewer assertions.

| Finding | Disposition |
| --- | --- |
| F1 — legacy caption/tool-only attachment already covers a spoken final, but the guard refuses the explicit explanation and recommends a suppressed normal final | Confirmed. New matrix covers Voice/Both/audio-Mirror, legacy/default delivery and accepted/unknown/failed attachments, plus a pending attachment. Seven cases failed before correction. Require `router.canFinalize(snapshot)` alongside captured speech protection; preserve router coverage/no-resend rules and clarify legacy prompt guidance. The same targeted run then passed 19 cases. |
| N1 — late currentness rejection is not the early zero-attempt/no-history guidance error | Confirmed documentation gap, not a new sender-ordering defect. Document existing currentness error/preflight count and possible failed archive intent. Strengthen actual-sender tests to assert the attempt/error, intent registration and failed outcome without a socket call; do not rewrite outcomes or remove history. |
| N2 — other-chat sends in protected frames also retain owning-input admission through preflight | Accept the conservative fence. Add a paused/revoked-admission preflight case and disclose the condition rather than weakening authority checks. |
| N3 — roadmap Edge diagnosis/probe provenance was too categorical; generic errors did not cover every cancellation/unavailable case | Clarify dated owner-supplied observations, no independently established cause and the distinct explicit-send suppression path. Describe worker failure/exit precisely. Proposed retries remain unimplemented. |

## Focused correction verification

A second fresh native `anthropic/claude-opus-5-5`/high pass reviewed the correction diff and a separate frozen 170-file public snapshot; completed metadata again confirmed the exact model. Verdict: **OK with notes; no material introduced issue**. It verified F1 and N1/N2/N3 against the router, entry/tool/admission paths, sender, Edge errors, changed tests/docs and narrow lock delta. It did not run tests, verify registry hashes/audit counts or re-review other suites, the RPC fixture body or release tooling.

- Follow-up documentation note: Minimatch remediation also depends on lint-tooling releases, not Pi alone. Corrected SECURITY.md accordingly.
- Pre-existing optional hardening: explicit legacy-covered explanations retain the pre-guard admission timing (initial ownership check, without the new protected-frame late predicate). Kept outside this compatibility correction rather than expanding runtime scope; no claim that it was repaired.

The initial source-preserving roadmap commit remains historical evidence; the later owner request explicitly authorizes correcting review notes for 1.1.2. Existing 039 ignored-record gaps, live/native/platform limits and separate publication gates are not waived. The release also found a newly reported dependency advisory; its separately authorized targeted remediation and fresh audits are recorded in [048](../048-release-1.1.2/plan.md), not claimed as part of this original source review.
