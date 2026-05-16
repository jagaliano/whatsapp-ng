# Data Model: QR Connect Welcome Message

## Runtime State: WhatsAppService

This feature introduces one new ephemeral field on `WhatsAppService`. No persistent storage changes.

### New Field

- **`qrWasShown: boolean`** — Tracks whether a QR code was displayed to the operator in the current session lifecycle. Defaults to `false`. Set to `true` when Baileys fires a `qr` event; reset to `false` immediately after being consumed in the connection-open handler.

### State Transitions

| Trigger | `qrWasShown` value |
|---------|--------------------|
| Service instantiated | `false` |
| Baileys fires `qr` event (`handlePairingQr` called) | `true` |
| `handleConnectionOpen` executes with `qrWasShown = true` | `false` (consumed and reset) |
| `handleConnectionOpen` executes with `qrWasShown = false` (reconnect / credential-restore) | `false` (unchanged) |
| `cleanupSocket()` called (socket replaced or stopped) | `false` is preserved — flag resets only on consume, not on cleanup |

### Validation Rules

- When `qrWasShown` is `true` at connection-open time, the system MUST: reset the flag, print the confirmation, and dispatch the welcome message.
- When `qrWasShown` is `false` at connection-open time, the system MUST skip both the print and the welcome send.
- `qrWasShown` is never persisted and is always `false` on a fresh process start.

## No Persistent Storage Changes

- `config.json` — unchanged.
- Auth state files — unchanged.
- `recents.json` — unchanged.

## Conceptual Entities (new)

- **QR Pairing Event**: Modelled via `qrWasShown = true`. Represents a connection-open event that was directly preceded by the operator scanning a QR code in this process lifetime.
- **Self-Message**: A WhatsApp message whose sender JID and recipient JID are both the operator's own `XXXXXXX@s.whatsapp.net` JID. Sent once per QR pairing event.
