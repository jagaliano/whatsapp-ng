# Specifications and decision records

This directory is a design/history archive, not a list of features still waiting to be implemented. Use current source, tests and `package.json` for runtime/API truth. Historical checkboxes and dependency lists describe their original checkpoint; they are not the current release checklist.

Completed implementation and separately deferred live/platform acceptance are different statuses. Missing tracked planning records remain an explicit gap, not implied completion.

Only new features and behaviour changes get a record here (see the [constitution](../.specify/memory/constitution.md#development-workflow)). Releases, documentation-only edits, dependency patches and small fixes belong in the [changelog](../CHANGELOG.md), not a new folder.

## Navigation

| Records | Status / use |
| --- | --- |
| 001–034 feature folders | Historical feature proposals, contracts and implementation notes. Retain for provenance; completion must be checked against current source/tests rather than inferred from the folder name or checkbox. |
| [035 storage-path migration](035-storage-path-migration/plan.md) | Historical storage design, superseded for current namespace operations by 038. Do not run its old migration instructions as current setup. |
| [036 capability roadmap](036-baileys-capability-roadmap/plan.md) | Phases 1–3 implementation complete within recorded validation limits. Historical design/review decisions retained; optional Phase 4 remains deferred, not implied authorization. |
| [037 maintained-fork readiness](037-maintained-fork-readiness/plan.md) | Historical maintenance/release governance: M1–M4 and prepare-only M5 complete within recorded scope; [validation](037-maintained-fork-readiness/validation.md). Later publication/promotion decisions have separate records below. |
| [038 namespace migration](038-whatsapp-ng-namespace/plan.md) | Independent namespace and guarded whole-state migration; [validation and review dispositions](038-whatsapp-ng-namespace/validation.md). Real migration is verified offline; post-rename live connectivity is not certified. |
| [039 extension improvements](039-extension-improvements/) | Dated phone-control, speech, group, output and settings validation/review records. Its local plan is not tracked; do not present private receipts as public reproducible artifacts. |
| [040 speech and settings 1.1.x](040-speech-and-settings/spec.md) | Consolidated feature record for 1.1.0–1.1.4: auto-connect/Back, managed CrispASR servers, server-default voice, spoken-reply guard, synthesis budget, speech separators, owner guidance, chat-first settings menus and npm 12 release tooling. Former per-release folders 040–054 were merged here on 2026-11-02; release history is in the [changelog](../CHANGELOG.md). |
| [041 release gate for published versions](041-release-gate-existing-version/spec.md) | `release:prepare` proves version absence with an `E404`-only lookup and records whether the publish dry-run ran, so a push or release tag at an already-published version no longer fails on npm immutability. Publication and tagging stay separate authorized actions. |

## Cleanup policy

- Keep current release gates, validation evidence, review findings and migration/recovery decisions.
- Use [ROADMAP.md](../ROADMAP.md) for current/proposed work. Record 037 preserves historical maintenance/release governance; it does not replace the current roadmap or per-feature records.
- A sensible later consolidation is to archive 001–035 in a dedicated historical subtree, with a manifest and updated incoming links. Do not mass-move/delete them as part of a transcription bug fix: existing guides, templates and other plans refer to these paths.
- Separate an evidence-preserving archive change from code changes so broken links, obsolete instructions and retained context can be reviewed independently.
- Never add credentials, real message dumps, machine-local handoff files or `.pi/cache` evidence to this public history.
