# Data Model Update: Blocked Numbers

## Entities

### AllowList (Modified)
- `numbers`: string[] (E.164)
- **Constraint**: Must NOT contain any number present in `BlockList`.

### BlockList (New)
- `numbers`: string[] (E.164)
- **Constraint**: Must NOT contain any number present in `AllowList`.

## State Transitions (New Actions)

- **Blocked** -> **Allowed** (Action: Unblock and Allow)
- **Unknown** -> **Blocked** (Action: Block Number)
- **Allowed** -> **Blocked** (Action: Block Number)

## Implementation Notes
- Migration method: `unblockAndAllow(number: string): Promise<void>`
- Storage: Persistent in `config.json`.
