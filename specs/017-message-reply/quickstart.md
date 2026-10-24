# Quickstart: Message Detail Reply

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Purpose
Verify that a user can open a message detail view, choose Reply, compose a message, and send it to the correct conversation.

## Prerequisites
- Existing WhatsApp-NG feature branch checked out.
- Dependencies installed.
- A conversation with at least one readable message available in the detail view.

## Validation Steps

1. **Run automated checks**
   ```bash
   npm test
   npm run typecheck
   ```

2. **Open the message detail view**
   - Launch Pi with WhatsApp-NG enabled.
   - Open `/whatsapp`.
   - Navigate to a conversation and open a specific message in the detail view.

3. **Start the reply flow**
   - Choose Reply from the message detail view.
   - Confirm the reply composer opens with the original message context still visible or clearly identified.

4. **Compose and send**
   - Enter a valid reply message.
   - Send the reply.
   - Confirm the reply is delivered to the same conversation as the selected message.

5. **Cancel behavior**
   - Open Reply again.
   - Cancel or exit without sending.
   - Confirm no message is sent and the user returns to the detail view.

## Expected Results
- Reply can be started directly from the message detail view.
- The user can see which message they are replying to.
- Empty replies are blocked.
- Canceling returns the user safely to the detail view.

## Notes for Testing
- Use a long message or one with special characters to confirm the context remains clear.
- Verify the target conversation matches the original selected message.
