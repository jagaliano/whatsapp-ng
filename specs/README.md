# Specifications and decision records

This directory is a design/history archive, not a list of features still waiting to be implemented. Use current source, tests and `package.json` for runtime/API truth. Historical checkboxes and dependency lists describe their original checkpoint; they are not the current release checklist.

Completed implementation and separately deferred live/platform acceptance are different statuses. A **frozen pre-publication checkpoint** intentionally preserves its original checkboxes; it is not the current implementation backlog or proof of later publication. Missing tracked planning records remain an explicit gap, not implied completion.

## Navigation

| Records | Status / use |
| --- | --- |
| 001–034 feature folders | Historical feature proposals, contracts and implementation notes. Retain for provenance; completion must be checked against current source/tests rather than inferred from the folder name or checkbox. |
| [035 storage-path migration](035-storage-path-migration/plan.md) | Historical storage design, superseded for current namespace operations by 038. Do not run its old migration instructions as current setup. |
| [036 capability roadmap](036-baileys-capability-roadmap/plan.md) | Phases 1–3 implementation complete within recorded validation limits. Historical design/review decisions retained; optional Phase 4 remains deferred, not implied authorization. |
| [037 maintained-fork readiness](037-maintained-fork-readiness/plan.md) | Historical maintenance/release governance: M1–M4 and prepare-only M5 complete within recorded scope; [validation](037-maintained-fork-readiness/validation.md). Later publication/promotion decisions have separate records below. |
| [038 namespace migration](038-whatsapp-ng-namespace/plan.md) | Independent namespace and guarded whole-state migration; [validation and review dispositions](038-whatsapp-ng-namespace/validation.md). Real migration is verified offline; post-rename live connectivity is not certified. |
| [039 extension improvements](039-extension-improvements/) | Dated phone-control, speech, group, output and settings validation/review records. Its local plan is not tracked; do not present private receipts as public reproducible artifacts. |
| [040 RC2 publication readiness](040-rc2-publication-readiness/plan.md) | Frozen pre-publication checkpoint: RC2 preparation and auto-connect/navigation/discovery evidence before its source was promoted to stable 1.1.0. |
| [041 stable 1.1.0](041-stable-1.1.0/plan.md) | Frozen pre-publication checkpoint for explicitly approved stable/latest promotion. Post-commit outcomes require original receipts; unchanged risk/acceptance limits and no standing release authority. |
| [042 speech-provider introduction](042-speech-provider-introduction/plan.md) | Documentation-only overview of independent transcription/speech providers and protocol compatibility; no runtime or provider validation. |
| [043 managed CrispASR](043-managed-crispasr/plan.md) | Implementation and local macOS STT/TTS/combined acceptance complete with the [owner-accepted auxiliary-resource exception](043-managed-crispasr/review.md#owner-disposition--2026-10-30-utc); broader platform/WhatsApp acceptance remains open. No further native or release authority. |
| [044 server-default voice](044-server-default-voice/plan.md) | Explicit OpenAI-compatible built-in/startup voice selection; [validation and native-inference exclusions](044-server-default-voice/validation.md). No saved-setting mutation or download authorization. |
| [045 documentation cleanup](045-documentation-cleanup/plan.md) | Concise current guides and plans 038 onward; examples checked without native effects, historical evidence preserved. |
| [046 release 1.1.1](046-release-1.1.1/plan.md) | Frozen pre-publication checkpoint for the authorized main/version-only-lock/isolated-consumer release; original receipts hold post-commit outcomes, not unchecked implementation work. |
| [047 spoken-reply guard](047-spoken-reply-guard/plan.md) | Protect eligible spoken finals; preserve legacy explicit explanations and existing safety. [Opus review/dispositions](047-spoken-reply-guard/review.md). |
| [048 release 1.1.2](048-release-1.1.2/plan.md) | Frozen pre-publication/requalification checkpoint for Opus corrections, a narrow dependency-security exception and exact-artifact gates; post-commit outcomes require original receipts. |
| [049 spoken separators](049-spoken-separators/plan.md) | Remove standalone Unicode decorative rules from speech only; preserve original answers and safety. [Opus review/dispositions](049-spoken-separators/review.md); no live pronunciation claim. |
| [050 release 1.1.3](050-release-1.1.3/plan.md) | Frozen pre-publication checkpoint for later authorized review/corrections/release of 049; post-commit outcomes require original receipts and live/platform limits remain. |
| [051 plan status reconciliation](051-plan-status-reconciliation/plan.md) | Documentation-only reconciliation of completed work, deferred acceptance and frozen release checkpoints; historical evidence and the 039 planning gap remain explicit. |

## Cleanup policy

- Keep current release gates, validation evidence, review findings and migration/recovery decisions.
- Use [ROADMAP.md](../ROADMAP.md) for current/proposed work. Record 037 preserves historical maintenance/release governance; it does not replace the current roadmap or per-change plans.
- A sensible later consolidation is to archive 001–035 in a dedicated historical subtree, with a manifest and updated incoming links. Do not mass-move/delete them as part of a transcription bug fix: existing guides, templates and other plans refer to these paths.
- Separate an evidence-preserving archive change from code changes so broken links, obsolete instructions and retained context can be reviewed independently.
- Never add credentials, real message dumps, machine-local handoff files or `.pi/cache` evidence to this public history.
