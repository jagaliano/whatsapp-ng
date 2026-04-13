# Quickstart: Localize System Messages to en-US

## Verification Steps

### 1. Agent Notification
- Send a message from WhatsApp to the bot.
- Verify the agent receives: `Message from [Name] (+[Number]): [Text]`.

### 2. Audio Transcription
- Send an audio message from WhatsApp.
- Verify the agent receives: `[Transcribed Audio]: [Content]`.

### 3. Command Responses
- Trigger `/compact` from WhatsApp.
- Verify the response: `Session compacted successfully! ✅`.
- Trigger `/abort` from WhatsApp.
- Verify the response: `Aborted! ✅`.

### 4. TUI Notifications
- Check `session_start` notification in Pi TUI.
- Verify: `WhatsApp: Session reset via /new is now fully supported.` (Already in English, but verify others like pdftotext warning).
