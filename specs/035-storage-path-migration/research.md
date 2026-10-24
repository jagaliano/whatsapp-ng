# Research: Migrate Extension Storage Path

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Decision 1: Canonical storage root
- **Decision**: Use `<legacy-previous-data-root>` as the only canonical runtime storage root.
- **Rationale**: Matches the user-requested extension folder and keeps all local persistence under one predictable home.
- **Alternatives considered**: Keep mixed paths; add config toggle; move only some files.

## Decision 2: Legacy compatibility
- **Decision**: Read legacy data from `<legacy-original-data-root>` during startup and migrate it automatically when needed.
- **Rationale**: Preserves existing installs and avoids manual file moves.
- **Alternatives considered**: Require manual migration; delete legacy data; fail startup until files are moved.

## Decision 3: Migration strategy
- **Decision**: Preserve data first, then switch writes to new location after the new root is usable.
- **Rationale**: Minimizes risk of data loss and supports rollback-friendly startup behavior.
- **Alternatives considered**: In-place rename only; one-time hard cutover; copy-on-demand per file.

## Decision 4: Scope of change
- **Decision**: Update every code path that resolves local persistence paths: auth state, config, recents, logs, and any local storage helpers.
- **Rationale**: Partial migration would leave split storage and inconsistent runtime behavior.
- **Alternatives considered**: Update only recents or only auth state; leave logs on legacy path.

## Decision 5: Test approach
- **Decision**: Use unit tests for path resolution and migration logic, plus filesystem-backed tests for data preservation.
- **Rationale**: Verifies behavior without relying on manual inspection.
- **Alternatives considered**: Manual verification only; snapshot tests; end-to-end-only coverage.
