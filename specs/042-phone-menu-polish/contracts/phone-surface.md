# Contract: Phone command surface

Invariant across all locales (verified by tests):

| Command | Args accepted | Auth | Menu options (order → action value) |
|---|---|---|---|
| /help | none | any allowed | — |
| /status | none | any allowed | — |
| /stop, /abort | none | owner | — |
| /compact [focus] | text | owner | — |
| /model [id or search] | exact id selects; else menu | owner | models (≤10) → `provider/id`; Previous/Next → `page:n` |
| /think [level] | level | owner | supported levels → level |
| /voice [mode] | text\|voice\|both\|mirror | owner | text, voice, both, mirror |
| /replies | none | owner | explain, caption, stats:on, stats:off, `report:changedFiles:on`/`off`, `report:interimText:on`/`off`, `report:liveActivity:on`/`off` |
| /new, /off, /quit | none → menu | owner | cancel, confirm |

## Presentation contract
- Menu text = `title` \n [`body`] \n numbered options \n instruction.
- Instruction states: reply with number; 5-minute expiry; (groups only) quote the menu; ordinary text cancels.
- Exactly one current marker per mutually exclusive choice when known; independent reporting toggles show their state.
- Fixed titles and labels are short (≤120, untruncated in every locale); dynamic model labels retain the existing privacy/display cap and full action identifier; shared-session guidance for `/think`, `/model`, `/new`, `/off`, `/quit` is in the body.
- `/replies` body contains the full disclosure (+ invalid-settings note when applicable), unabridged; it must fit the 1,000-character body limit in every locale and is never truncated.
- `/status`: heading "Shared Pi and WhatsApp" (WhatsApp, Pi, model, thinking, context, replies delivery, final stats) then "This chat" (automatic replies, voice mode).
- `/help`: groups "Information", "Shared Pi session" (incl. `/replies`), "This chat" (`/voice`), "WhatsApp and process"; one line per command; owner-only rule; expiry; this chat mode.
