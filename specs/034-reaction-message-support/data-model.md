# Data Model: Reaction Message Support

**Purpose**: Document data entities and type definitions for reaction message handling
**Created**: 2026-05-20
**Feature**: Reaction Message Support

## Entities

### ReactionMessage (Baileys Library Type)

Represents a WhatsApp reaction to a message.

**Attributes**:
- `key: MessageKey` - Reference to the message being reacted to
  - `remoteJid: string` - Chat JID (e.g., "123@s.whatsapp.net")
  - `fromMe: boolean` - Whether the reacted-to message was sent by the user
  - `id: string` - Message ID
- `text: string` - The emoji/text of the reaction (empty when removed)
- `senderTimestampMs: number` - Unix timestamp when reaction was sent

### SendReactionOptions (Interface)

Input parameters for sending a reaction.

**Attributes**:
- `jid: string` - Chat JID of the conversation (e.g., "123@s.whatsapp.net")
- `messageId: string` - ID of the message to react to
- `emoji: string` - Emoji to send (single Unicode emoji, or empty string to remove)

### SendReactionResult (Interface)

Return type for reaction sending operation.

**Attributes**:
- `success: boolean` - Whether the reaction was sent successfully
- `messageId?: string` - ID of the sent reaction message (if successful)
- `error?: string` - Error message (if failed)

### IncomingResolution (Extended Union Type)

The discriminated union type returned by `extractIncomingText`.

**New Variant Added**:
```typescript
{ 
    kind: 'reaction'; 
    text: string; 
    reactionMessage: any 
}
```

## Type Definitions

```typescript
// In src/services/incoming-message.resolver.ts
export type IncomingResolution =
    | { kind: 'text'; text: string }
    | { kind: 'audio'; text: string; audioMessage: any }
    | { kind: 'image'; text: string; imageMessage: any }
    | { kind: 'document'; text: string; documentMessage: any }
    | { kind: 'contact'; text: string }
    | { kind: 'location'; text: string }
    | { kind: 'system'; text: string }
    | { kind: 'reaction'; text: string; reactionMessage: any }  // NEW
    | { kind: 'unsupported'; text: string };
```

## Translation Keys

### Fallback (English)
- `"incoming.media.reaction": "{emoji} Reacted to message"`
- `"incoming.media.reactionRemoved": "Removed reaction"`

### pt-BR (Portuguese)
- `"incoming.media.reaction": "{emoji} Reagiu à mensagem"`
- `"incoming.media.reactionRemoved": "Reação removida"`

### es (Spanish)
- `"incoming.media.reaction": "{emoji} Reaccionó al mensaje"`
- `"incoming.media.reactionRemoved": "Reacción eliminada"`

## No Persistent Storage

Reaction messages are transient display events. They do not require:
- Database entities
- Persistent storage
- State management

Reactions are processed and displayed in real-time through the existing message handling flow.
