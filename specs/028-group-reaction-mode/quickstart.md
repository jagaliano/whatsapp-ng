# Quickstart: Allowed Group Reaction Mode

## Goal
Validate that allowed groups can switch between active and passive reply behavior.

## Manual Flow
1. Open the app and connect WhatsApp.
2. Go to **Allowed Groups**.
3. Open an existing allowed group.
4. Open **Reaction Mode** and set it to **passive**.
5. Send a group message without mentioning the agent.
6. Confirm the agent does not reply.
7. Send a group message with an @ mention to the agent.
8. Confirm the agent replies.
9. Change the same group to **active** from **Reaction Mode**.
10. Send a normal group message.
11. Confirm the agent replies again.

## Verification
- Existing allowed groups should behave as active by default.
- Mode changes should persist after restart.
- Non-allowed groups should still be ignored.
