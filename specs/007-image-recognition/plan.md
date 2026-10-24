# Implementation Plan - Image Recognition Support

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


Enable the Pi Agent to "see" images sent via WhatsApp by downloading and forwarding them as base64 attachments.

## User Review Required

> [!IMPORTANT]
> The agent must be using a model that supports vision (e.g., Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro).

- Does the current model in use support image input? (Handled by Pi, but worth noting)
- Are there any size limits for base64 images in Pi's `sendUserMessage`? (Usually handled by Pi)

## Proposed Changes

### Integration

#### [whatsapp-ng.ts](../../whatsapp-ng.ts)
- Update `setMessageCallback` to detect `imageMessage`.
- Implement image downloading using `@whiskeysockets/baileys`.
- Forward images to Pi using `pi.sendUserMessage` with content array format.

## Verification Plan

### Automated Tests
- N/A (requires real WhatsApp interaction or heavy mocking of Baileys socket)

### Manual Verification
1. Start `whatsapp-ng` extension.
2. Send an image to the paired WhatsApp account.
3. Verify the agent receives the image and can describe its content.
4. Verify captions are also forwarded.
