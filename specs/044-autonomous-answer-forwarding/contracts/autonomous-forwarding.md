# Contract: Autonomous Answer Forwarding

## Terminal settings (Replies → Optional outputs)

- New entry: **Background answers: Off | Owner | <group>**.
- Choices: `Off`, `Owner's private chat`, `Allowed group…` (lists allowed groups), `Back`.
- Enabling from Off with no other choice selects the owner. Missing verified owner → warning, no change.
- Group: confirm dialog stating all members can see background results, which may contain workspace or sensitive data; decline → unchanged.
- Revision/owner checks before save (existing pattern). Localized in en, pt-BR, es, fr.

## Runtime

| Input | Outcome |
|---|---|
| Known run-start role matches first input; all inputs custom or exactly proven extension-origin user messages; consent current; within limits | One text send to destination |
| Any WhatsApp request in the turn | Existing routing only |
| Terminal input | Not autonomous; existing owner-only terminal forwarding still applies when separately enabled |
| Live-session cron / other sendUserMessage wake-up with fresh exact host extension proof | Autonomous; same consent/limits; control origin remains unknown |
| Terminal/WhatsApp mixed with background, missing/transformed/superseded/expired proof or unknown start | No autonomous forwarding; existing routing unchanged |
| Cron headless or RPC-resume fallback | Not covered by extension provenance; existing terminal/RPC policy unchanged |
| > 64 KiB | Local + notice |
| Off / disconnected / stale session / owner change / group removed or paused | Local |
| Unknown delivery | No retry, notice |
