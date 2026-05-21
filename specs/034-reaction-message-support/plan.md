# Implementation Plan: Reaction Message Support

**Branch**: `034-reaction-message-support` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-reaction-message-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement full support for WhatsApp reaction messages (emoji reactions): both DISPLAYING reactions received from contacts and SENDING reactions from the agent. Currently, reactions display as "[Unsupported Message Type: reactionMessage]". This feature will:

1. **Display**: Detect `reactionMessage` types and show human-readable messages like "👍 Reacted to message"
2. **Send**: Provide a Pi tool/API for the agent to react to messages with emojis

The display implementation follows the existing pattern in `incoming-message.resolver.ts`. The sending functionality requires a new Pi tool following the pattern in `message.sender.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: @whiskeysockets/baileys (WhatsApp Web library), pi-agent-sdk (Pi extension API), pino (logging), qrcode-terminal  
**Storage**: N/A (reactions are transient display messages, no persistent storage needed)  
**Testing**: vitest (unit tests), existing test pattern in `tests/unit/incoming-message.resolver.test.ts`  
**Target Platform**: Node.js 20+ (Pi Code Agent extension)  
**Project Type**: Pi Code Agent extension (WhatsApp integration)  
**Performance Goals**: <10ms processing time per reaction message  
**Constraints**: Must maintain compatibility with existing IncomingResolution type union  
**Scale/Scope**: Single user instance, reaction volume proportional to normal message volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: The design uses the existing class/service pattern (IncomingMessageResolver with type unions)
- [x] **II. Clean Code**: Following established naming patterns (e.g., `reactionMessage` matching Baileys naming)
- [x] **III. SOLID**: Single Responsibility - message resolution is the sole purpose of the resolver service
- [x] **IV. TypeScript**: Strict typing maintained by adding `reaction` kind to IncomingResolution union
- [x] **V. Simplicity**: Minimal change - add one conditional check and one type variant

## Project Structure

### Documentation (this feature)

```text
specs/034-reaction-message-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── incoming-message.resolver.ts    # MODIFY: Add reaction message display handling
│   ├── message.sender.ts                 # REVIEW: Reference pattern for Pi tool
│   └── reaction.sender.ts              # NEW: Service for sending reactions
├── tools/
│   └── (or extension registration)       # NEW: Pi tool for send_reaction
├── i18n.ts                              # MODIFY: Add translation strings for reactions
└── models/
    └── whatsapp.types.ts                # REVIEW: Verify no changes needed

tests/
└── unit/
    ├── incoming-message.resolver.test.ts # MODIFY: Add reaction display tests
    └── reaction.sender.test.ts           # NEW: Tests for reaction sending
```

**Structure Decision**: Two-part implementation:

1. **Display** (following existing pattern in `incoming-message.resolver.ts`):
   - Add `{ kind: 'reaction'; text: string; reactionMessage: any }` to the `IncomingResolution` union
   - Add conditional check for `resolved?.reactionMessage` in `extractIncomingText`

2. **Send** (following Pi tool pattern like `message.sender.ts`):
   - Create `reaction.sender.ts` service with function to send reactions via Baileys
   - Register as Pi tool (following existing tool registration pattern)
   - Include emoji validation and error handling

## Complexity Tracking

Expanded scope from display-only to full bidirectional support:
- **New Service**: `ReactionSender` class for sending reactions (follows existing `MessageSender` pattern)
- **Pi Tool**: New `send_reaction` tool registration (follows existing tool pattern)
- **Tests**: Additional test file for reaction sender

Justification: Both features use established patterns from the codebase, minimizing architectural risk.

## Phase 0: Research Notes

No research phase needed. Technical approach is clear from existing codebase patterns:

1. **Reaction Message Structure**: Baileys provides `reactionMessage` with:
   - `key`: Message reference (`{ remoteJid, id, fromMe }`)
   - `text`: The emoji/text (empty string when reaction removed)
   - `senderTimestampMs`: Timestamp

2. **Implementation Pattern**: Follow existing message type handling:
   - Image messages: Check `resolved?.imageMessage`, return `{ kind: 'image', text, imageMessage }`
   - Audio messages: Check `resolved?.audioMessage`, return `{ kind: 'audio', text, audioMessage }`
   - **New**: Reaction messages: Check `resolved?.reactionMessage`, return `{ kind: 'reaction', text, reactionMessage }`

3. **i18n Pattern**: Add translation keys following existing structure:
   - `"incoming.media.reaction": "{emoji} Reacted to message"`
   - `"incoming.media.reactionRemoved": "Removed reaction"`
   - Provide translations in pt-BR and es locales

## Phase 1: Design Artifacts

### Data Model

No new entities or persistent storage needed. Reactions are processed as transient display messages. The existing `IncomingResolution` union type will be extended.

### Contracts

No external API changes. This is an internal display improvement.

### Quickstart

Testing reaction messages:
1. Connect WhatsApp with `/whatsapp`
2. Have a contact react to any message with an emoji (👍, ❤️, etc.)
3. Verify reaction appears as "👍 Reacted to message" instead of "[Unsupported Message Type: reactionMessage]"
4. Have contact remove the reaction
5. Verify "Removed reaction" message appears

### Implementation Details

**File: `src/services/incoming-message.resolver.ts`**

Changes needed:
1. Extend `IncomingResolution` type union:
```typescript
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

2. Add reaction handling in `extractIncomingText` function (before the unsupported fallback):
```typescript
if (resolved?.reactionMessage) {
    const emoji = resolved.reactionMessage.text;
    if (emoji) {
        return {
            kind: 'reaction',
            text: t('incoming.media.reaction', { emoji }),
            reactionMessage: resolved.reactionMessage
        };
    }
    return {
        kind: 'reaction',
        text: t('incoming.media.reactionRemoved'),
        reactionMessage: resolved.reactionMessage
    };
}
```

**File: `src/i18n.ts`**

Add translation strings (fallback + pt-BR + es):
```typescript
"incoming.media.reaction": "{emoji} Reacted to message",
"incoming.media.reactionRemoved": "Removed reaction",
```

**File: `tests/unit/incoming-message.resolver.test.ts`**

Add test cases:
```typescript
it('extracts reaction messages with emoji', () => {
    expect(extractIncomingText({ reactionMessage: { text: '👍', key: { remoteJid: '123@s.whatsapp.net', id: 'msg123' } } })).toEqual({
        kind: 'reaction',
        text: '👍 Reacted to message',
        reactionMessage: { text: '👍', key: { remoteJid: '123@s.whatsapp.net', id: 'msg123' } }
    });
});

it('handles removed reactions', () => {
    expect(extractIncomingText({ reactionMessage: { text: '', key: { remoteJid: '123@s.whatsapp.net', id: 'msg123' } } })).toEqual({
        kind: 'reaction',
        text: 'Removed reaction',
        reactionMessage: { text: '', key: { remoteJid: '123@s.whatsapp.net', id: 'msg123' } }
    });
});
```

**File: `src/services/reaction.sender.ts` (NEW)**

Create a new service following the pattern from `message.sender.ts`:

```typescript
import { WASocket } from 'baileys';
import { t } from '../i18n.js';

export interface SendReactionOptions {
    jid: string;
    messageId: string;
    emoji: string;
}

export interface SendReactionResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export class ReactionSender {
    constructor(private socket: WASocket | null) {}

    async sendReaction(options: SendReactionOptions): Promise<SendReactionResult> {
        if (!this.socket) {
            return { success: false, error: t('service.whatsapp.notConnected') };
        }

        // Validate emoji (must be single emoji or empty string to remove)
        if (!this.isValidEmoji(options.emoji)) {
            return { success: false, error: 'Invalid emoji' };
        }

        try {
            const result = await this.socket.sendMessage(options.jid, {
                react: {
                    text: options.emoji,
                    key: {
                        remoteJid: options.jid,
                        id: options.messageId,
                        fromMe: false
                    }
                }
            });

            return {
                success: true,
                messageId: result?.key?.id
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private isValidEmoji(emoji: string): boolean {
        // Allow empty string (removes reaction)
        if (emoji === '') return true;
        // Check if single emoji using regex
        const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
        return emojiRegex.test(emoji);
    }
}
```

**File: Pi Tool Registration**

Register the reaction sender as a Pi tool (following pattern in extension registration):

```typescript
// Tool schema (for Pi agent)
{
    name: 'send_reaction',
    description: 'Send an emoji reaction to a specific WhatsApp message',
    parameters: {
        type: 'object',
        properties: {
            jid: { type: 'string', description: 'Chat JID (e.g., 123@s.whatsapp.net)' },
            messageId: { type: 'string', description: 'ID of the message to react to' },
            emoji: { type: 'string', description: 'Emoji to react with (e.g., 👍, ❤️, 😂)' }
        },
        required: ['jid', 'messageId', 'emoji']
    }
}
```

**File: `tests/unit/reaction.sender.test.ts` (NEW)**

Create tests for reaction sending:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { ReactionSender } from '../../src/services/reaction.sender.ts';

describe('ReactionSender', () => {
    it('sends reaction successfully', async () => {
        const mockSocket = {
            sendMessage: vi.fn().mockResolvedValue({ key: { id: 'reaction123' } })
        };
        const sender = new ReactionSender(mockSocket as any);
        
        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: '👍'
        });
        
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('reaction123');
    });

    it('rejects invalid emoji', async () => {
        const sender = new ReactionSender({} as any);
        
        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: 'invalid'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid emoji');
    });

    it('returns error when not connected', async () => {
        const sender = new ReactionSender(null);
        
        const result = await sender.sendReaction({
            jid: '123@s.whatsapp.net',
            messageId: 'msg123',
            emoji: '👍'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('not connected');
    });
});
```

## Constitution Re-check Post-Design

- [x] **I. OOP**: Uses existing functional service pattern + new ReactionSender class
- [x] **II. Clean Code**: Clear separation of concerns (display vs. send)
- [x] **III. SOLID**: Each service has single responsibility; Open/Closed with type extension
- [x] **IV. TypeScript**: Strict typing with interfaces and discriminated unions
- [x] **V. Simplicity**: Uses established patterns throughout, no novel abstractions

Complexity expanded but justified: Sending reactions requires a new service class and Pi tool, following existing patterns from `MessageSender`. This is minimal additional complexity for full bidirectional reaction support.

All checks pass. Ready for task generation with `/speckit.tasks`.
