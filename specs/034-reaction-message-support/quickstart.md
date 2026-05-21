# Quickstart: Testing Reaction Messages

**Purpose**: Quick reference for testing the reaction message feature
**Created**: 2026-05-20
**Feature**: Reaction Message Support

## Manual Testing Steps

### Test 1: Basic Emoji Reaction

1. Start the WhatsApp-Pi extension:
   ```
   /whatsapp-connect
   ```

2. Have a contact send you a message

3. Have the contact react to that message with 👍 emoji

4. **Expected Result**: You should see:
   ```
   Message from [Contact Name]: 👍 Reacted to message
   ```
   Instead of:
   ```
   Message from [Contact Name]: [Unsupported Message Type: reactionMessage]
   ```

### Test 2: Different Emojis

1. Have the contact react with various emojis:
   - ❤️ (heart)
   - 😂 (laugh)
   - 😮 (surprised)
   - 😢 (sad)
   - 🙏 (pray)

2. **Expected Result**: Each reaction displays as:
   ```
   {emoji} Reacted to message
   ```

### Test 3: Removed Reaction

1. Have the contact add a reaction to a message

2. Have the contact remove that reaction (tap the reaction again in WhatsApp)

3. **Expected Result**: You should see:
   ```
   Message from [Contact Name]: Removed reaction
   ```

### Test 4: Group Chat Reactions

1. In a group chat, have multiple contacts react to the same message

2. **Expected Result**: Each reaction displays individually with the contact's name:
   ```
   Message from Contact A: 👍 Reacted to message
   Message from Contact B: ❤️ Reacted to message
   ```

---

## Testing Agent-Initiated Reactions (Sending)

### Test 5: Agent Sends Reaction

1. Have a contact send you a message

2. Ask the agent to react to that message:
   ```
   "Please react to that message with 👍"
   ```

3. **Expected Result**: 
   - Agent confirms it sent a reaction
   - The 👍 reaction appears on the original message in WhatsApp
   - Contact can see the reaction

### Test 6: Agent Sends Different Emojis

1. Ask the agent to send various reactions:
   - "React with ❤️"
   - "React with 😂"
   - "React with 🙏"

2. **Expected Result**: Each emoji appears correctly on the message

### Test 7: Agent Rejects Invalid Emoji

1. Ask the agent: "React with 'hello'"

2. **Expected Result**: Agent returns an error indicating invalid emoji

## Automated Testing

Run the unit tests:

```bash
npm test -- tests/unit/incoming-message.resolver.test.ts
```

Expected test cases:
- `extracts reaction messages with emoji`
- `handles removed reactions`

## Troubleshooting

### Reaction still shows as "[Unsupported Message Type: reactionMessage]"

**Cause**: The reaction message handler isn't being triggered

**Check**:
1. Verify `src/services/incoming-message.resolver.ts` has the reaction check
2. Ensure the file was saved and the extension was reloaded
3. Check logs for any errors in message processing

### Emoji not displaying correctly

**Cause**: Terminal encoding or font issues

**Check**:
1. Ensure your terminal supports Unicode emojis
2. Verify the reaction `text` field contains the correct emoji

## Verification Checklist

### Display
- [ ] 👍 reaction displays as "👍 Reacted to message"
- [ ] ❤️ reaction displays as "❤️ Reacted to message"  
- [ ] Removed reaction displays as "Removed reaction"
- [ ] No "[Unsupported Message Type: reactionMessage]" appears

### Sending
- [ ] Agent can send 👍 reaction to a message
- [ ] Agent can send ❤️ reaction to a message
- [ ] Agent can send 😂 reaction to a message
- [ ] Invalid emoji returns error (does not crash)
- [ ] Reaction appears on correct message in WhatsApp

### Tests
- [ ] Unit tests pass for incoming-message.resolver
- [ ] Unit tests pass for reaction.sender
