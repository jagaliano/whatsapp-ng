# Contract: terminal navigation labels and hints

Applies to the terminal `/whatsapp` settings request only. Destinations, option order, eligibility and outcomes are the **baseline at `8f32898`** (spec Back-destination table). This contract changes only the exit **label** and adds hints.

## Exit labels

Each panel's last option is its exit. Its label key is fixed by the destination actually reopened. Callers pass the label into shared helpers where the destination depends on the caller.

| Panel (owner) | Destination | Exit key |
| --- | --- | --- |
| Root (`chooseWhatsAppSetting`) | close request | `menu.close` |
| Connection / Chats / Owner / Replies / Groups / Advanced panels | Root | `menu.back.main` |
| Auto-connect on startup (`MenuHandler.showSettings`) | Connection | `menu.back.connection` |
| Reply delivery | Replies | `menu.back.replies` |
| Optional outputs (`showOptionalOutputSettings`) | Replies | `menu.back.replies` |
| Automatic image tools | Optional outputs | `menu.back.optionalOutputs` |
| Owner (`showOwnerSettings`) | Chats / Owner | `menu.back.chatsOwner` |
| Allowed contacts (`manageAllowList`) | Chats / Owner | `menu.back.chatsOwner` |
| Allowed contact (`manageAllowedContact`) | Allowed contacts | `menu.back.allowedContacts` |
| Group replies (`manageGroupReplies`) | Groups | `menu.back.groups` |
| Allowed groups (`manageAllowedGroups`) | Groups | `menu.back.groups` |
| Allowed group (`manageAllowedGroup`) | Allowed groups | `menu.back.allowedGroups` |
| Local history scope | Advanced | `menu.back.advanced` |
| Recents (`manageRecents`) | captured parent | `menu.back.chatsOwner` or `menu.back.advanced` |
| Recent conversation (`manageRecentConversation`) | Recents | `menu.back.recents` |
| History (`showConversationHistoryForContact`) | caller | `menu.back.conversation` (from Recents), `menu.back.contact` (allowed contact), `menu.back.group` (allowed group) |
| Voice main (`showVoiceSettings`) | Root | `menu.back.main` |
| Invalid-voice repair | Root | `menu.back.main` |
| Advanced speech settings | Voice | `menu.back.voice` |
| Voice chat picker (`selectChat`) | caller | `menu.back.voice` (setup, chat settings), `menu.back.voiceAdvanced` (preview) |
| Chat-setup mode picker | chat picker | `menu.back.chatList` |
| Chat settings panel (`editChat`) | Voice | `menu.back.voice` |
| Chat settings mode picker | chat settings | `menu.back.chatSettings` |
| Speech backend | Advanced speech settings | `menu.back.voiceAdvanced` |
| Speech API protocol | Speech backend | `menu.back.voiceBackend` |
| Remote voice choice (`remoteVoice`) | caller | `menu.back.voiceProtocol` (backend setup), `menu.back.voiceAdvanced` (standalone) |
| Default reply mode (`chooseMode`) | Advanced speech settings | `menu.back.voiceAdvanced` |
| Remote audio format | Advanced speech settings | `menu.back.voiceAdvanced` |

Unchanged behavior that remains part of this contract:

- Message-detail close (Enter/Esc/Backspace) returns to History. The overlay hint is `message.detail.hint.replyOrClose` / `message.detail.hint.close` ([labels](labels.md#recents-history-and-message-detail)).
- An empty Recents or History list notifies and returns to its caller. It shows no exit label.
- Confirmation No/Esc keeps caller-specific behavior. Confirmations get no hint.
- Settings expiry closes the request with `menu.expired`. Back never renews authority.

## Esc hint

- Inside a settings request, every `select`, `input` and `editor` title is rendered as `<title>\n<menu.hint.esc>` by the scoped dialogs in `withSettingsRequest`.
- `confirm` and `custom` titles are never changed.
- Esc on a hinted dialog closes the request (baseline). The hint text says only that.

## Identity rules

1. Fixed option labels within one panel are pairwise distinct in en, pt-BR, es and fr.
2. All labels shown by `chooseWhatsAppSetting` category panels are distinct across categories in each locale, because `MenuHandler.showSettings` matches actions by label only. Root category labels and `menu.close` are distinct.
3. No exit label equals any other fixed label in its panel. Exit labels never contain user data.
4. A localized label invokes exactly the action of its English counterpart. Root categories keep the `SettingsCategory` identifiers internally.
5. Dynamic entries (contacts, groups, chats, tools, history scopes) keep their baseline rendering, except that the recents group prefix `[Group]` becomes `menu.recents.groupPrefix`.
