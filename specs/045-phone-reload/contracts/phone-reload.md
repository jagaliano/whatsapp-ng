# Contract: Phone `/reload`

## Phone command
- Input: `/reload` (no arguments; arguments → `phone.usage`).
- Authority: owner-only (`phone.denied` otherwise); private chat only (`phone.reload.privateOnly` in any group, including group-only mode; checked via `SessionManager.isGroupJid`).
- Response: confirmation menu `phone.reload.title` with options Reload / Cancel; standard menu instruction.
- Selection results:
  | Case | Reply | Reload |
  |---|---|---|
  | Cancel | `phone.cancelled` | no |
  | Expired / replayed / superseded | `phone.reload.expired` (if frame current) | no |
  | Busy or pending messages | `phone.busy` | no |
  | WhatsApp not connected / account changed | `phone.reload.notConnected` (if possible) | no |
  | Accepted | `phone.reload.started` | yes |
- Post-reload: `phone.reload.ready` once on success; `phone.reload.failed` at most once, best effort.

## Internal gateway
- `/whatsapp --internal control-reload <uuid>` — accepted only with a matching unexpired in-memory ticket; manual invocation → terminal warning, no effect.

## Help
- `phone.help.cmd.reload` listed under "WhatsApp and process", owner-only.

## i18n keys (en, pt-BR, es, fr)
`phone.help.cmd.reload`, `phone.reload.title`, `phone.reload.confirm`, `phone.reload.privateOnly`, `phone.reload.started`, `phone.reload.expired`, `phone.reload.notConnected`, `phone.reload.ready`, `phone.reload.failed`.
`phone.reload.ready` must say WhatsApp reconnected after reload and must not claim that all extensions loaded.
