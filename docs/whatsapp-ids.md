# WhatsApp identifiers (JIDs)

A **JID** (Jabber ID) identifies a WhatsApp chat or participant. Its suffix identifies its type; the digits before `@` are **not always a phone number**. Examples below use synthetic identifiers.

## Identifier types

| Type | Example | Used for |
| --- | --- | --- |
| Phone-number JID (PN) | `15550000001@s.whatsapp.net` | A person's direct conversation. The digits are the international phone number without `+`, spaces or punctuation. |
| Linked ID (LID) | `999999999@lid` | Another identifier for a person, including a direct conversation or group participant. It is **not** their phone number and is not specific to your own account. |
| Group JID | `120363000000001@g.us` | A WhatsApp group. The JID identifies the group, not its owner or creator. |
| Broadcast/status | `status@broadcast` | WhatsApp Status updates. Other broadcast-list identifiers also use `@broadcast`. |
| Newsletter/channel | `120363000000001@newsletter` | A WhatsApp channel. |

Some transport keys include a device suffix such as `15550000001:7@s.whatsapp.net`. whatsapp-ng normalizes that to the person JID; do not invent a device suffix when configuring a recipient.

## PN versus LID

One person can be represented by both a phone-number JID and a LID. WhatsApp supplies these identities through its protocol; they are not interchangeable digits that you can calculate from each other.

The transport may report an observed relationship in fields such as `remoteJid` / `remoteJidAlt`, or `participant` / `participantAlt`. For example, an incoming chat can have a LID as its primary address and a phone-number JID as its alternate address. whatsapp-ng records verified relationships for indexing and authorization, while preserving the original transport address for replies.

**Never turn the digits of a LID into `digits@s.whatsapp.net`.** That would manufacture a different, possibly unrelated recipient. A phone number remains useful only when WhatsApp actually supplies it or you already know it independently.

A self-chat can use either kind of person JID depending on what WhatsApp reports; `@lid` does not mean "self-chat".

## Finding an identifier

1. Send a message from the desired person, self-chat or group after connecting whatsapp-ng. Unknown groups do not need to be allow-listed merely to appear in local recents.
2. Use terminal **`/whatsapp` → Recents** to inspect the retained conversation. To authorize phone controls, choose **`/whatsapp` → Chats / Owner → Owner** and select that known conversation instead of typing its digits.
3. An agent can inspect local recents with the read-only `list_wa_conversations` tool. When a verified phone/LID relationship is available, history may be indexed under the phone identity even though the original incoming message used the LID.
4. For an allow-listed contact, **Allowed contacts → contact → Print number** prints its configured identifier. For an allow-listed group, **Allowed groups → group → Print group JID** prints the group JID. These are terminal diagnostics; do not paste private identifiers into issues or logs.

There is no supported phone command that prints an arbitrary chat's raw transport key. Avoid constructing an `@lid` JID from a phone number, or the reverse, from an allow-list entry.

## Using identifiers

- **Allowed contacts:** enter a known `+E164` phone number. An allow-list entry is not automatically the settings owner.
- **Owner:** select a known private conversation in the Owner menu, or enter a `+E164` phone number or a complete observed person JID ending in `@s.whatsapp.net` or `@lid`. This controls owner-only phone commands such as `/new`; it is not determined by the displayed contact name.
- **Allowed groups:** enter the observed complete `@g.us` JID. Group participants can separately have PN or LID identities.
- **Sending tools:** prefer the current conversation's implicit recipient. Otherwise pass a known complete chat JID; do not reconstruct one from displayed LID digits. Native quotes also need the retained message ID and conversation JID, plus the observed participant when required.
- **Ignored senders:** Status and other non-chat identifiers can appear in recents. `@broadcast` and `@newsletter` are not person or group destinations for ordinary owner/contact configuration.

If an owner-only command is denied, select the actual incoming conversation again in the Owner menu rather than editing `config.json` while Pi is running. The owner must also be allowed, and a verified alias must match the sender. The extension's configuration writer owns settings persistence.
