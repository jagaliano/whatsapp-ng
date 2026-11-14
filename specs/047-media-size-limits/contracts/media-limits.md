# Contracts: Media Limits

## 1. Configuration (`config.json`)

```json
{ "mediaLimits": { "inboundMiB": 512, "outboundMiB": 100 } }
```

- Optional object; optional integer fields 1–512. Absent → 25. Anything else → malformed (both directions refused for non-audio, repair guidance names the `mediaLimits` field). Unrelated fields preserved on every save.

## 2. SessionManager surface

| Member | Contract |
|--------|----------|
| `getMediaLimits(): { inboundBytes: number; outboundBytes: number }` | Throws when configuration is unreadable or `mediaLimits` malformed |
| `getMediaLimitsRevision(): number` | Monotonic per process |
| `setMediaLimit(direction, mib, expectedRevision, current)` | Validates 1–512 integer; rejects unreadable config, stale revision or `current() === false`; atomic write; memory updated only after a successful write |

## 3. Terminal menu (`/whatsapp` → Advanced → Media limits)

- View lists: inbound value, outbound value (MiB), range `1–512 MiB`, audio exclusion (25 MiB audio, 25 MiB remote transcription, 8 MiB generated speech), fixed 25 MiB automatic-processing ceiling, disk/temp-storage notes, Back.
- Malformed/unreadable: view shows the repair notice instead of values; no edit.
- Edit: text input; accepted only if it matches `^[1-9][0-9]{0,2}$` and ≤ 512. Otherwise localized error, no change.
- Inbound increase to a value > 25 (including from a value already > 25): warning + explicit confirm/cancel select. Cancel, expiry or stale authority → unchanged.
- Uses existing captured-authority/revision pattern; Back never saves.

## 4. Tool descriptions

`send_wa_media` description states "non-audio files up to the configured outbound limit (default 25 MiB, max 512 MiB); audio and voice notes up to 25 MiB". No startup value is interpolated.

## 5. `send_wa_media` result

Unchanged JSON shape (`success`, `delivery`, `messageId`, `error`, `attempts`, `media`). New refusal error strings (localized): outbound too large (names limit and the menu path), busy (large transfer in progress), media limits unavailable (repair guidance), preparation timeout.

## 6. Assistant notices (inbound)

Prefix text appended in the routed message, bounded and localized; see `data-model.md#inboundoutcome-assistant-notice-payload`. No automatic WhatsApp reply to the sender for any refusal.
