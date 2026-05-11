# Research: Allowed Group Reaction Mode

## 1) Where to store reaction mode
- **Decision**: Store reaction mode on each allowed-group record in the existing local config file.
- **Rationale**: Allowed groups already persist there, so this keeps behavior stable and avoids a new storage layer.
- **Alternatives considered**: Separate settings file; derived default-only behavior.

## 2) How to detect passive-mode mentions
- **Decision**: Treat a group message as mentioned when the incoming message contains a direct mention for the agent in message context metadata.
- **Rationale**: Baileys supports mentions via message context metadata; this is the most reliable signal for @-mentions in group chat.
- **Alternatives considered**: Parsing plain text for `@`; using quoted replies as mention signal.

## 3) Where reaction branching belongs
- **Decision**: Keep group allow-list checks in `WhatsAppService`, group settings persistence in `SessionManager`, and menu controls in `MenuHandler`.
- **Rationale**: Matches current separation of concerns and keeps each class focused.
- **Alternatives considered**: Centralizing all behavior in the UI layer; duplicating checks in multiple services.

## 4) Default behavior for existing groups
- **Decision**: Default to active mode when no saved value exists.
- **Rationale**: Preserves current always-reply behavior and avoids breaking existing users.
- **Alternatives considered**: Defaulting to passive; forcing migration prompt.

## 5) UI placement
- **Decision**: Add reaction mode selection inside the existing Allowed Groups detail menu.
- **Rationale**: Users already manage group-level settings there, so the feature stays discoverable.
- **Alternatives considered**: Separate global settings screen; inline command-only configuration.
