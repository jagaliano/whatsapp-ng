# Data Model: Configurable Media Transfer Size Limits

## MediaLimits (persisted preference)

Stored in the existing `config.json` (owned by `SessionManager`) as one optional object.

| Field | Type | Rule |
|-------|------|------|
| `mediaLimits` | object, optional | Absent → both directions 25 |
| `mediaLimits.inboundMiB` | integer, optional | 1–512 inclusive; absent → 25 |
| `mediaLimits.outboundMiB` | integer, optional | 1–512 inclusive; absent → 25 |

States: **absent** (defaults), **valid**, **malformed** (present but not an object, extra-type field, non-integer, out of range), **unavailable** (configuration unreadable). Malformed/unavailable → `getMediaLimits()` throws; non-audio transfers in the affected direction(s) are refused with repair guidance. A malformed field makes the whole object malformed (both directions refused) — the simplest rule that never raises access.

Revision: `mediaLimitsRevision` increments on each successful save. A setter writes the full object with the other direction preserved (absent stays absent). Bytes = MiB × 1,048,576.

## TransferSlot

| Field | Type | Notes |
|-------|------|-------|
| direction | `'inbound' \| 'outbound'` | separate pools, capacity 1 each |
| held | boolean | |

Acquire: inbound when declared > 25 MiB or declared size unusable; outbound when non-audio source size > 25 MiB. Release: inbound when owned local work ends (stored, refused, interrupted, cleanup attempted); outbound in send settlement (`onSettled`) after snapshot disposal, or on failure before transmission. Never on caller timeout.

## InboundTransfer (in-memory, per message)

| Field | Notes |
|-------|-------|
| kind | `image \| video \| document` |
| limitBytes | captured at admission (`inboundMiB`, or `min(inbound, 25 MiB)` for quoted images) |
| declaredBytes | number or `undefined` (absent/non-finite/≤0 → undefined) |
| class | `large` if declared > 25 MiB or undefined; else `small` |
| deadlineMs | 600,000 (large) / 60,000 (small) |
| receivedBytes | running count |
| partialPath / finalPath | private partial name, then existing destination name |
| isCurrent | captured authority callback |

Transitions:

```text
admitted ─(declared > limit)──────────────────────────► refused:oversize
admitted ─(large & slot busy)─────────────────────────► refused:busy
admitted → downloading
downloading ─(received > limit)───────────────────────► refused:oversize        ┐
downloading ─(received > declared)────────────────────► interrupted:sizeMismatch │ partial removed
downloading ─(deadline / cancel / !isCurrent / error)─► interrupted              │ (or cleanupFailed)
downloading ─(end; declared && received < declared)───► interrupted:truncated    ┘
downloading ─(end; !isCurrent before publish)─────────► interrupted (partial removed)
downloading ─(end; ok)─► published ─(isCurrent at handoff)─► reported
                                   └(authority lost)──────► kept-unreported (FR-031)
```

## InboundOutcome (assistant notice payload)

| Outcome | Fields shown to assistant (bounded, metadata only) |
|---------|----------------------------------------------------|
| `stored` (> 25 MiB) | file name/kind, MIME, saved location, actual size (MiB, 1 decimal + bytes), caption, "automatic processing skipped" |
| `stored` (≤ 25 MiB) | existing text unchanged |
| `oversize` | kind, file name, declared or received size, captured limit (MiB) |
| `busy` | kind, file name, "another large transfer in progress" |
| `interrupted` | kind, file name, reason (`deadline`, `cancelled`, `truncated`, `sizeMismatch`, `failed`, `disk`) |
| `cleanupFailed` | kind, leftover location, underlying outcome; not a receipt |

Caption and file name are truncated to existing bounds; no file content.

## OutboundTransfer

| Field | Notes |
|-------|-------|
| type | `document \| image \| video` (audio unchanged at 25 MiB) |
| limitBytes | captured outbound limit |
| sourceBytes / snapshotBytes / convertedBytes | each checked against limitBytes |
| prepareDeadlineMs | 300,000 for snapshot copy (conversion keeps 60,000) |
| callerWaitMs | 600,000 if size > 25 MiB else 60,000, from transmission start |
| slot | held until settlement for large sends |

Outcome semantics unchanged: `success`, `failed` (before transmission), `delivery: 'unknown'` (after transmission start; no resend).
