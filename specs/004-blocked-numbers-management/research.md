# Research: Blocked Numbers Management

## Decision: Atomic Migration
- **Selected**: Unified `unblockAndAllow` method in `SessionManager`.
- **Rationale**: By combining the removal from the block list and addition to the allowed list into a single `async` method, we ensure that the state is never inconsistent between the two lists. The `saveConfig()` call will happen only once at the end of the operation.
- **Alternatives considered**: Separate `remove` and `add` calls in the UI layer. Rejected as it risks partial failure (e.g., number removed from block but not added to allow).

## Decision: Menu Interaction
- **Selected**: `ctx.ui.select` for the Blocked Numbers list, followed by a `ctx.ui.confirm` for the action.
- **Rationale**: Standard Pi TUI pattern. Selecting a number opens a sub-menu or a direct confirmation dialog to avoid accidental unblocks.
- **Alternatives considered**: Direct unblock on selection. Rejected for safety.

## Decision: Mutual Exclusivity Enforcement
- **Selected**: Validation check in both `addNumber` (Allowed) and `blockNumber` (Blocked) methods.
- **Rationale**: Ensures that adding to one list always removes from the other, regardless of which UI action triggered the update.
