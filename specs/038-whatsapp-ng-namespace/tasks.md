# Tasks

- [x] N001 Snapshot pending release-preparation documentation and record authorized namespace/migration scope.
- [x] N002 Rename current source/files/metadata/scripts/UI/tests; audit historical references and README attribution/mapping.
- [x] N003 Write failing synthetic migration/startup/config-preservation regressions.
- [x] N004 Implement explicit guarded full-root atomic migration and crash recovery.
- [x] N005 Gate initialization and namespace shutdown/session metadata; prevent constructor writes before migration.
- [x] N006 Run full/native/source/static/actual isolated entry/package/ownership/Linux checks.
- [x] N007 Exact reviewer preflight/dispatch; confirm actual model and record initial findings (BLOCK; remediation/re-review remains N008).
- [x] N008 Add failing regressions for findings, correct and retest/re-review.
- [x] N009 Coordinate the authorized cold-process handoff and real atomic migration; verify state preservation offline. The [validation record](validation.md#status) confirms the completed move and offline verification, not live connectivity.

## Deferred acceptance — not migration implementation

- [ ] N009-live Obtain separate bounded authorization for post-migration live connection/client verification and record only observed results. This is the unperformed live portion of the original N009, not a new migration or standing execution permission.

Qualification, exact-model review and completed handoff dispositions: [validation record](validation.md). The guarded launcher passed 12 fixtures and exact-model review; full-process exit, cold-start move and offline post-verification subsequently passed. Preserve those results and private-state boundaries; do not repeat the migration, force termination or infer live acceptance from offline evidence.

No publication or unapproved Git delivery is authorized by this record.
