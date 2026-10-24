# Implementation plan

1. Snapshot pending prepare-only M5 work; preserve it and mark its artifact superseded for the renamed runtime.
2. Mechanically rename current identifiers/files, then manually review migration/security/history references. Historical documents point to README's legacy mapping instead of changing historical claims. Keep legal notices and dependencies intact.
3. Add `StateMigrationService`: explicit generic roots, private durable request, exclusive sibling ownership, metadata-only safety validation, atomic move, optional derived legacy-root log rename and identity-checked recovery. No auth-content parsing/copying.
4. Integrate pending/requested migration before session initialization; lazy filesystem initialization in logger/audio; guard settings/auth/archives/tools while migration is pending. Remove implicit old-root lookup; namespace Pi saved state and shutdown hooks.
5. Write migration/entry/identity failing fixtures, implement, run all declared checks and actual isolated Pi startup/package/ownership checks. Use only synthetic HOME/data in tests.
6. Fresh preflight and one read-only exact `openai-codex/gpt-6.1-sol` reviewer. Inspect actual model metadata. Remediate findings and repeat affected/full gates plus focused review.
7. Queue the owner-authorized real full-state migration only after gates pass. Current process must exit before automatic fresh-start move; do not move its active archive. Preserve contact settings/auth/archive identity, then perform bounded operator-confirmed live verification.

Implementation, final dual-platform/package checks and exact-model review corrections are recorded in the [validation and handoff record](validation.md). Real state still requires the explicit cold-process handoff.

No dependencies/frameworks/protocol changes; retain private publication guard. A real process handoff is a safety boundary, not permission for forced termination or automatic credential reset.
