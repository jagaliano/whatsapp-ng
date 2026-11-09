# Data Model: WhatsApp Processing Reaction

Process-local, in memory, owned by `ProcessingIndicator`.

## IndicatorRecord

| Field | Type | Rule |
|---|---|---|
| id | string | JSON-encoded tuple `[remoteJid, id, fromMe, participant]` of the exact incoming key (unambiguous field boundaries) |
| key | WAMessageKey (copy) | Exact transport key; never rebuilt from digits |
| context | WhatsAppSessionContext | Captured at add; every egress requires `isSessionContextCurrent(context)` |
| adding / removing | boolean | Settlement flags; deferred cleanup is launched only after add settlement; unfinished work counts toward the cap |
| consumed | boolean | Distinguishes current-run records from queued records, including superseded ones |
| admissionCurrent | () => boolean | Captured admission authority, rechecked before each egress |
| state | `active` \| `superseded` \| `settled` (consumption tracked separately) | See transitions |

Invariants: at most one record per message; at most one add and one removal attempt; hard capacity of 500 live records enforced by `ProcessingIndicator` itself (verified 2026-11-07: the router's 500 cap counts only `pending + retiredInputs`, and consumed records leave `pending`, so the router does not bound indicator records). At capacity, `start` is a no-op with one metadata-only log; records are deleted on removal, discard, supersede-then-run-end or withdrawal.

## State transitions

```text
(none) --handOff--> active --consume(run)--> active (consumed=true) --agent_end--> settled (remove)
active --retired/expired/settleAll--> settled (remove)
active --explicit send_reaction or verified own non-⏳ reaction/removal (supersede)--> superseded (no further automatic egress; removal skipped)
any --discardAll / stale context--> settled (no egress)
```

## TerminalOutcome (spec entity)

Mapped to: `agent_end` (success, error, abort, ambiguity), retired-input abort, pending expiry, `settleAll` (session reset), `discardAll` (Off/logout/shutdown), stale context.
