# Data Model: Autonomous Answer Forwarding

## OptionalOutputs (persisted, `config.json`)

| Field | Type | Rule |
|---|---|---|
| imageTools | string[] | Unchanged |
| terminal | { ownerJid, accountScope }? | Unchanged; owner-only |
| autonomous | AutonomousConsent? | New; absent = Off (default) |

### AutonomousConsent

| Field | Type | Rule |
|---|---|---|
| kind | `'owner' \| 'group'` | Required |
| jid | string | owner: `^\d+@(s\.whatsapp\.net\|lid)$` equal to ownerJid; group: `^\d+(-\d+)?@g\.us$` |
| ownerJid | string | Required for both kinds; owner at consent time |
| accountScope | string | Required for both kinds; 1–256 chars |

Validation: unknown keys or invalid values throw → existing invalid-settings handling (nothing forwarded). Writes via `SessionManager.setOptionalOutputs` with expected revision.

## Routing (runtime)

- Epoch source gains `autonomous`; `controlOrigin` is unchanged (`'terminal' | 'whatsapp' | 'unknown'`; autonomous turns stay `'unknown'` so owner authorization refuses them). A separate `isAutonomous(snapshot)` query accepts only known-start runs whose inputs are custom or exactly proven extension-origin user messages (approved amendment, research R1c). The start type must match the first consumed input; any terminal, WhatsApp or unproven input latches ineligibility for the entire run.
- Run-start marker: `'custom' | 'user' | undefined` set in `before_agent_start`, cleared at `agent_end`/reset.
- Latest input proof: `{ digest, scope, expiresAt, source: 'terminal' | 'extension' }`, one slot, five-minute TTL, replaced by every input event and consumed once. Extension proof is never recorded for known pending/withdrawn WhatsApp content. Exact text/image matching is required; transformed, superseded, expired, wrong-scope or reset proofs cannot authorize forwarding.

## State transitions (consent)

```text
Off --enable--> owner (default) --choose group + disclosure--> group
owner|group --disable--> Off
owner|group --owner/account change--> stale (treated as Off; no egress)
group --removed from allowed / paused / not the bound group in group-only mode--> ineligible (no egress until restored)
owner|group --destination changed or consent withdrawn mid-turn--> no egress for that turn to either destination; no replay
```
