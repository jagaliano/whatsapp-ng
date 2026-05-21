# Research: Reaction Message Support

**Purpose**: Document technical research for implementing WhatsApp reaction message handling
**Created**: 2026-05-20
**Feature**: Reaction Message Support

## Decision: Implementation Approach

**Decision**: Extend `incoming-message.resolver.ts` with reaction message detection following the existing pattern for audio/image/document messages.

**Rationale**: 
- Consistent with existing codebase architecture
- Minimal changes required (single service + i18n + tests)
- Leverages established Baileys library structure
- No external dependencies needed

**Alternatives considered**:
- Creating a separate reaction service (rejected: over-engineering for simple message type detection)
- Treating reactions as system messages (rejected: reactions have distinct semantics from protocol messages)
- Adding persistent storage for reactions (rejected: YAGNI - reactions are display-only context)

## Baileys ReactionMessage Structure

Based on the Baileys library documentation and codebase analysis:

### Receiving

```typescript
interface ReactionMessage {
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
    };
    text: string;  // Emoji or empty if reaction removed
    senderTimestampMs: number;
}
```

### Sending

Baileys supports sending reactions via the `sendMessage` method with a `react` property:

```typescript
socket.sendMessage(jid, {
    react: {
        text: "👍",  // Emoji to send (or empty string to remove)
        key: {
            remoteJid: jid,
            id: messageId,
            fromMe: false  // false for reacting to others' messages
        }
    }
});
```

**Reference**: Baileys README documents reaction support in the "Send Messages" section.

## Existing Pattern Analysis

The `incoming-message.resolver.ts` uses a discriminated union pattern:

1. **Type Union**: `IncomingResolution` with `kind` discriminator
2. **Extraction Function**: `extractIncomingText` that checks message type fields
3. **i18n Integration**: Uses `t()` function for localized display text
4. **Return Format**: `{ kind, text, [typeSpecificData] }`

Example from codebase (audio messages):
```typescript
if (resolved?.audioMessage) {
    return {
        kind: 'audio',
        text: t('incoming.media.audio'),
        audioMessage: resolved.audioMessage
    };
}
```

## i18n Pattern

Current structure in `src/i18n.ts`:
- Fallback (English) defines all keys
- `pt-BR` and `es` provide translations
- Pattern: `"incoming.media.{type}": "[Localized Text]"`

## Testing Pattern

Current tests in `tests/unit/incoming-message.resolver.test.ts`:
- Use vitest with `describe`, `it`, `expect`
- Reset i18n before each test
- Test input/output pairs for `extractIncomingText`

## Conclusion

Implementation is straightforward:
1. Add `reaction` kind to `IncomingResolution` union
2. Add conditional check for `resolved?.reactionMessage` 
3. Add i18n strings for reaction display text
4. Add unit tests following existing pattern

No additional research needed. Proceeding to Phase 1 design artifacts.
