# Quickstart: Reliable Messaging

**Feature**: Refactor WhatsApp message sending

## For Developers

### Using the MessageSender

Instead of calling `whatsappService.sendMessage` directly, use the `MessageSender` for better reliability.

```typescript
const sender = new MessageSender(whatsappService);

const result = await sender.send({
    recipientJid: '123456789@s.whatsapp.net',
    text: 'Hello from Pi!'
});

if (result.success) {
    console.log(`Message sent with ID: ${result.messageId}`);
} else {
    console.error(`Failed to send message: ${result.error}`);
}
```

## Integration Points

- **WhatsAppService**: Must be passed to `MessageSender` to provide the active socket.
- **Error Handling**: Catch specific `WhatsAppError` types to handle different failure modes (e.g., unauthorized, invalid JID).

## Important Configuration Notes

### Using Your Own WhatsApp Number

If you're using your **own WhatsApp number** (not a separate bot number), you need to modify the message filtering logic in `WhatsAppService.handleIncomingMessages()`:

**Remove this check:**
```typescript
// Ignore messages sent by the bot itself
if (msg.key.fromMe) return;
```

**Why?** When using your own number, Pi sends messages from your account (marked with `π` symbol). The `fromMe` filter would block ALL your outgoing messages, including Pi's responses. The `π` symbol check is sufficient to prevent message loops.

**Keep this check:**
```typescript
// Ignore messages sent by Pi (marked with π)
const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
if (text.endsWith('π')) return;
```

This ensures Pi doesn't process its own sent messages while still allowing you to receive messages from others.
