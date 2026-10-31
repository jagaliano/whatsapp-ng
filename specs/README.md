# Specifications and decision records

This directory is a design/history archive, not a list of features still waiting to be implemented. Use current source, tests and `package.json` for runtime/API truth. Historical checkboxes and dependency lists describe their original checkpoint; they are not the current release checklist.

## Navigation

| Records | Status / use |
| --- | --- |
| 001–034 feature folders | Historical feature proposals, contracts and implementation notes. Retain for provenance; completion must be checked against current source/tests rather than inferred from the folder name or checkbox. |
| [035 storage-path migration](035-storage-path-migration/plan.md) | Historical storage design, superseded for current namespace operations by 038. Do not run its old migration instructions as current setup. |
| [036 capability roadmap](036-baileys-capability-roadmap/plan.md) | Foundation, media/quotes and archive/history/lifecycle design and review decisions. Optional Phase 4 remains deferred; it is not implied authorization. |
| [037 maintained-fork readiness](037-maintained-fork-readiness/plan.md) | Maintenance/release governance; [validation](037-maintained-fork-readiness/validation.md). Earlier milestone evidence is dated and artifact-scoped. Publication/stable promotion remain separately gated. |
| [038 namespace migration](038-whatsapp-ng-namespace/plan.md) | Independent namespace and guarded whole-state migration; [validation and review dispositions](038-whatsapp-ng-namespace/validation.md). Real migration is verified offline; post-rename live connectivity is not certified. |
| [039 extension improvements](039-extension-improvements/) | Dated phone-control, speech, group, output and settings validation/review records. Its local plan is not tracked; do not present private receipts as public reproducible artifacts. |
| [040 RC2 publication readiness](040-rc2-publication-readiness/plan.md) | Dated RC2 preparation, auto-connect/navigation evidence and documentation/discovery corrections, before stable promotion. |
| [041 stable 1.1.0](041-stable-1.1.0/plan.md) | Explicit maintainer-approved stable/latest promotion of the prepared source, with fresh artifact/publication checks and unchanged risk/acceptance limits. No Git release tag or automation activation. |
| [042 speech-provider introduction](042-speech-provider-introduction/plan.md) | Documentation-only overview of independent transcription/speech providers and protocol compatibility; no runtime or provider validation. |
| [043 managed CrispASR](043-managed-crispasr/plan.md) | Opt-in connection-time server ownership/watchdog and request gates; [validation and remaining platform/live limits](043-managed-crispasr/validation.md). No installation, real-server or publication authorization. |
| [044 server-default voice](044-server-default-voice/plan.md) | Explicit OpenAI-compatible built-in/startup voice selection; [validation and native-inference exclusions](044-server-default-voice/validation.md). No saved-setting mutation or download authorization. |
| [045 documentation cleanup](045-documentation-cleanup/plan.md) | Concise current guides and plans 038 onward; examples checked without native effects, historical evidence preserved. |
| [046 release 1.1.1](046-release-1.1.1/plan.md) | Authorized main/version-only-lock/isolated-consumer release; exact artifact and one-shot publication gates. Local receipts hold post-commit outcomes. |
| [047 spoken-reply guard](047-spoken-reply-guard/plan.md) | Refuse model-issued owning-chat text during captured approved spoken turns; preserve manual/other-chat sends and existing finalization safety. |

## Cleanup policy

- Keep current release gates, validation evidence, review findings and migration/recovery decisions.
- Use [ROADMAP.md](../ROADMAP.md) for current/proposed work. Record 037 preserves historical maintenance/release governance; it does not replace the current roadmap or per-change plans.
- A sensible later consolidation is to archive 001–035 in a dedicated historical subtree, with a manifest and updated incoming links. Do not mass-move/delete them as part of a transcription bug fix: existing guides, templates and other plans refer to these paths.
- Separate an evidence-preserving archive change from code changes so broken links, obsolete instructions and retained context can be reviewed independently.
- Never add credentials, real message dumps, machine-local handoff files or `.pi/cache` evidence to this public history.
