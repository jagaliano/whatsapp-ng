# Data Model: Phone-Initiated Pi Reload

All entities are in memory only and contain no credentials or message content.

## ReloadTicket (router instance, `Map<uuid, …>`)
| Field | Type | Rule |
|---|---|---|
| frame | `Frame` | verified owner, private allowed chat (`!SessionManager.isGroupJid`), profile scope, operator revision; `current()` must hold |
| account | string | account scope captured at confirmation; WhatsApp must be `connected` on it |
| expires | number (ms) | now + 15 000; cleared on `reset()` and on a new ticket |

Lifecycle: created on menu confirmation → consumed (deleted) by gateway → reload or rejection.

## ReloadIntent (router instance, single slot)
| Field | Type |
|---|---|
| profile | auth state dir |
| account | account scope |
| sessionId | Pi session id |
| actor | verified owner id |
| chat | requesting private chat JID |
| expires | now + 30 000 |

Armed by the gateway immediately before `ctx.reload()`, only while WhatsApp is `connected` on `account`; cleared in `finally` if `ctx.reload()` rejects. Consumed by the next `session_shutdown`. Published only when `reason === 'reload'` and the intent is unexpired.

## ReloadHandoff (`globalThis.__whatsappNgReloadHandoffs: Map<profile, ReloadIntent>`)
- At most one entry per profile and at most 10 entries in total. Expired entries are pruned on write.
- Deleted before validation in `session_start`. Any non-`reload` start or shutdown discards the profile's entry.
- Validation: not expired, profile match, sessionId match, `owner(actor)`, `allowed(chat)`, private chat. Then `resume(current, account)` checks explicit Off, operator revision, runtime and account match.

State flow: `menu → ticket → gateway(idle ✓) → intent → shutdown(reload) → handoff → start(reload) → validate → resume → ack | refuse(silent/notify)`.
