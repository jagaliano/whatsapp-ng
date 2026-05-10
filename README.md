<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp Logo" width="100">
</p>

# WhatsApp-Pi

A WhatsApp integration extension for the **[Pi Coding Agent](https://github.com/mariozechner/pi-coding-agent)**. 

[![GitHub](https://img.shields.io/badge/github-repo-black.svg?style=flat-square&logo=github)](https://github.com/RaphaCastelloes/whatsapp-pi)

Pi is a powerful agentic AI coding assistant that operates in your terminal. This extension allows you to chat and pair-program with your Pi agent directly through WhatsApp, featuring message filtering, allow-listing, recents/history browsing, message detail/reply, group-only binding, and reliable message delivery.

## Features

- **Manual WhatsApp Connection**: QR code-based authentication with session persistence
- **Allow List**: Control which numbers can interact with Pi
  - Add contacts with optional names for easy identification
  - View ignored numbers (not in allow list) and add them when needed
  - Manage aliases and print allowed numbers from the menu
- **Allowed Groups**: Control which WhatsApp groups can interact with Pi
  - Add group JIDs with optional aliases
  - Only groups in Allowed Groups are processed by the agent
- **Recents & History**: Browse recent conversations, inspect full message history, and reply from message detail view
- **Reliable Messaging**: Queue-based message sending with retry logic
- **TUI Integration**: Menu-driven interface for managing connections, contacts, and recent chats
- **Group-Only Mode**: Bind the agent to a single WhatsApp group with `--whatsapp-group`
- **Media Support**: 
  - **Vision Analysis**: Automatically forwards WhatsApp images to Pi for analysis.
  - **Audio Transcription**: Transcribes voice notes when Whisper is installed.
  - **Document Handling**: Downloads and stores documents (PDF, text) for agent access.

## Prerequisites

To enable audio transcription features:
```bash
python -m pip install -U openai-whisper
```

To enable PDF reading capabilities (required for the agent to process documents):
- **Linux**: `sudo apt-get install poppler-utils`
- **macOS**: `brew install poppler`
- **Windows**: Install `poppler` (e.g., via Scoop) and add to PATH.

## Quick Start

1. Install the extension:
```bash
pi install npm:whatsapp-pi
```

2. Start Pi (the extension will load automatically once installed):
```bash
pi
```

After connecting WhatsApp once from the menu and scanning the QR code, you can start Pi with auto-connect enabled:
```bash
pi --whatsapp-pi-online
```

3. Use the menu to connect WhatsApp and manage allowed numbers and groups

## Development / Testing

If you are developing or testing the extension locally, you can clone the repository from [GitHub](https://github.com/RaphaCastelloes/whatsapp-pi):

1. Clone and install dependencies:
```bash
git clone https://github.com/RaphaCastelloes/whatsapp-pi.git
cd whatsapp-pi
npm install
```

2. Run the extension:
```bash
pi -e whatsapp-pi.ts
```

For verbose mode (shows Baileys trace logs for debugging):
```bash
pi -e whatsapp-pi.ts --verbose
```

To test startup auto-connect locally after you have already paired WhatsApp:
```bash
pi -e whatsapp-pi.ts --whatsapp-pi-online
```

## Commands

- `/whatsapp` - Open the WhatsApp management menu

### Main Menu Options
- **Connect / Reconnect WhatsApp** - Start WhatsApp connection using saved credentials when available; QR code appears only if pairing is required
- **Disconnect WhatsApp** - Stop WhatsApp connection
- **Logoff (Delete Session)** - Remove all credentials and session data
- **Recents** - Open recent conversations, view history, and reply
- **Allowed Numbers** - Manage contacts that can interact with Pi
- **Allowed Groups** - Manage WhatsApp groups that can interact with Pi

### Allowed Numbers Management
- **Add Number** - Add a new contact to the allow list (format: +5511999999999)
- **Select a contact** - Open a submenu with **History**, **Send Message**, **Print Number**, alias actions, **Remove Number**, and **Back**
- **Back** - Return to main menu

### Allowed Groups Management
- **Add Group** - Add a WhatsApp group JID to the allowed groups list (format: 120363012345@g.us)
- **Select a group** - Open a submenu with **History**, **Send Message**, **Print Group JID**, alias actions, **Remove Group**, and **Back**
- **Back** - Return to main menu

### Recents Management
- **History** - Open full message history for that conversation
- **Send Message** - Send a new message without Pi suffix
- **Reply** - Open message detail, then press `R` to reply
- **Allow Number / Allow Group** - Move a recent sender into the appropriate allow list
- **Remove Alias** - Clear saved alias for that sender
- **Back** - Return to main menu

## Project Structure

```
src/
├── models/          # Type definitions
├── services/        # Core services (WhatsApp, Session, Recents, Media)
└── ui/              # Menu handlers and TUI views

tests/
└── unit/            # Unit tests
```

## Development

Run tests:
```bash
npm test
```

## Implementation Notes

### Recent Feature Updates (2026-05)

- **Auto-Connect Support**: Use the `--whatsapp-pi-online` flag to connect on startup when credentials already exist.
- **Group-Only Mode**: Use `--whatsapp-group <jid>` to bind Pi to a single WhatsApp group. The group must also be present in Allowed Groups.
- **Recents Store**: Recent conversations and message history are persisted in `~/.pi/whatsapp-pi/recents/recents.json`.
- **Message Detail / Reply**: Open a message from history to inspect full content and reply with `R`.
- **Media Support**: Images are forwarded for vision analysis, audio is transcribed with Whisper, and documents are saved under `./.pi-data/whatsapp/documents/`.
- **Session Handling**: Saved state, allow list, and startup reconnects are restored automatically when available.
- **Intelligent Message Filtering**: Messages ending with `π` are ignored to prevent bot loops.
- **Storage Management**: Persistent data lives under `.pi-data/` plus the recents store in the user home directory.
