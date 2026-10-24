# Data Model: Migrate Extension Storage Path

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Entities

### StorageRoot
Represents the active local home for WhatsApp-NG persistence.

**Fields**
- `path`: Canonical directory path used by runtime
- `status`: `active | migrating | unavailable`
- `createdAt`: Timestamp when root became usable
- `source`: `new | legacy | recovered`

**Rules**
- Must point to `<legacy-previous-data-root>` when active.
- Must be created automatically if missing.

### LegacyStorageRoot
Represents the old local home used by earlier installs.

**Fields**
- `path`: `<legacy-original-data-root>`
- `hasReadableData`: boolean
- `lastSeenAt`: Timestamp of last successful read

**Rules**
- Read-only during migration.
- Used only as fallback input for upgrade.

### MigratedDataSet
Represents preserved user data after migration.

**Fields**
- `authState`: WhatsApp session files
- `config`: Allowed contacts, groups, ignored numbers, settings
- `recents`: Conversation summaries and message history
- `logs`: Runtime log output

**Rules**
- Existing content must remain available after migration.
- New writes must go to active storage root.

## Relationships
- `StorageRoot` may be initialized from `LegacyStorageRoot`.
- `MigratedDataSet` belongs to exactly one active `StorageRoot`.
- Services resolve paths through `StorageRoot`, not through hardcoded literals.

## State Transitions
- `uninitialized` → `migrating` when legacy data is detected.
- `migrating` → `active` when new root is usable and data is preserved.
- `migrating` → `unavailable` when storage cannot be created or read safely.
- `active` remains stable for normal runtime writes.
