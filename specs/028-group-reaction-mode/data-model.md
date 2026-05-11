# Data Model: Allowed Group Reaction Mode

## Entity: Allowed Group

Represents an allowed WhatsApp group managed by the user.

### Fields
- **number**: Group JID.
- **name**: Optional display alias.
- **reactionMode**: Group reaction behavior.

### Validation Rules
- `number` must be a valid group JID.
- `reactionMode` must be either `active` or `passive`.
- If `reactionMode` is missing in stored data, treat it as `active`.

### State Transitions
- `active` → `passive` when user selects passive mode.
- `passive` → `active` when user selects active mode.
- Missing mode → `active` on load.

## Entity: Reaction Mode

Defines when an allowed group can trigger an agent reply.

### Values
- **active**: reply to allowed group messages as current behavior.
- **passive**: reply only when the agent is directly mentioned with @.

### Relationships
- One reaction mode belongs to one allowed group.
- One allowed group has exactly one effective reaction mode at a time.
