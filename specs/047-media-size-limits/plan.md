# Implementation Plan: Configurable Media Transfer Size Limits

**Branch**: `main` (no feature branch; `setup-plan.sh` reported `047-media-size-limits` from `.specify/feature.json`) | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/047-media-size-limits/spec.md`

## Summary

Add two persisted per-direction non-audio size limits (default 25 MiB, max 512 MiB) and make large transfers safe: inbound non-audio downloads stream to a private partial file with captured limit, authority checks, deadlines, a 1-slot admission cap and explicit cleanup outcomes; files above a fixed 25 MiB ceiling are stored without automatic processing. Outbound reuses the existing snapshot path with the captured limit, a 5-minute copy bound, a 10-minute caller wait for large sends and a 1-slot cap held until transport settlement. Audio, STT, TTS and automatic-output aggregate budgets are unchanged. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict, ES modules), Node 26.x

**Primary Dependencies**: Pi 1.5.0 host (SDK/TUI/TypeBox peers), `baileys@7.0.0-rc14`, existing FFmpeg/LiteParse optional tools. No new dependencies.

**Storage**: `config.json` via `SessionManager`; documents in `process.cwd()/.pi-data/whatsapp/documents`; images/videos in extension media dir; outbound snapshots in `os.tmpdir()`; Baileys encrypted copy in its tmp dir.

**Testing**: Vitest (`tests/**/*.test.ts`), synthetic socket/fetch fixtures; opt-in labelled 512 MiB suite.

**Target Platform**: macOS/Linux/Windows hosts running Pi (platform qualification out of scope).

**Project Type**: Pi extension (single project).

**Performance Goals**: ≤ 16 MiB aggregate application-managed transfer buffers per active large transfer (SC-002); 512 MiB byte-identical transfer through simulated transport.

**Constraints**: Deadlines 10 min / 60 s inbound, 5 min snapshot copy, 10 min large caller wait; caps 1 inbound + 1 outbound large; existing 60 s conversion/thumbnail/PDF budgets unchanged.

**Scale/Scope**: Single operator process; ~6 source files, 4 locales, 4 docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-research | Post-design |
|-----------|--------------|-------------|
| I. OOP | Pass — new behavior lives in classes (`InboundMediaTransfer`, `TransferSlots`) behind existing services | Pass |
| II. Clean Code | Pass — typed outcomes replace thrown strings for refusals | Pass |
| III. SOLID | Pass — transfer streaming (SRP) separate from processing (`IncomingMediaService`); limits injected (DIP) | Pass |
| IV. TypeScript | Pass — new code typed; existing `any` message params narrowed only where touched | Pass |
| V. Simplicity | Pass — one streaming path for all non-audio sizes; no queue, no sweeper, no Baileys patch | Pass |
| Workflow | Pass — spec/plan under `specs/047-…`; tasks derived later | Pass |

No violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/047-media-size-limits/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/media-limits.md
├── checklists/requirements.md
└── tasks.md            # later, /speckit.tasks
```

### Source Code (repository root)

```text
whatsapp-ng.ts                         # wire limits, slots, authority callbacks, caller wait, tool description
src/services/
├── media-limits.ts                    # NEW: constants, validateMediaLimits, MiB/bytes helpers
├── transfer-slots.ts                  # NEW: per-direction capacity-1 admission
├── inbound-media-transfer.ts          # NEW: streamed download → partial → publish, typed outcomes
├── incoming-media.service.ts          # use transfer; 25 MiB processing ceiling; notices
├── outgoing-media.service.ts          # captured non-audio limit; audio fixed 25 MiB; copy deadline
├── optional-output.service.ts         # per-file outbound limit before reservation
└── session.manager.ts                 # mediaLimits load/get/set/revision; writeConfig field
src/ui/
├── media-limits-settings.view.ts      # NEW: Advanced → Media limits
├── whatsapp-settings.view.ts          # Advanced entry
└── menu.handler.ts                    # route entry
src/i18n.ts                            # en/pt/es/fr strings
tests/unit/                            # mirrored tests + opt-in media-large.test.ts
README.md, docs/reference.md, SECURITY.md, CHANGELOG.md
```

**Structure Decision**: Single project; follow existing service/view split.

## Design

### D1. Limits and persistence (FR-001–FR-007)

- `media-limits.ts`: `DEFAULT_MIB = 25`, `MAX_MIB = 512`, `PROCESSING_CEILING_BYTES = 25 MiB`, `validateMediaLimits(raw)` → `{ inboundBytes, outboundBytes }` or throws.
- `SessionManager`: `storedMediaLimits` raw, `getMediaLimits()` (throws on read failure/malformed), `getMediaLimitsRevision()`, `setMediaLimit(direction, mib, expectedRevision, current)` using `queueConfig` + atomic `writeConfig` (new trailing param, preserved by every other setter). Pattern: `session.manager.ts:247-290`.
- View: `media-limits-settings.view.ts` modelled on `optional-output-settings.view.ts` captured-authority pattern; inbound increase > 25 → confirm (FR-006a).

### D2. Inbound streaming transfer (FR-011–FR-019, FR-012a, FR-014a)

`InboundMediaTransfer.run({ message, type, kind, limitBytes, destination, isCurrent, signal }) → InboundOutcome`:

1. Normalize declared size; refuse if > limit.
2. Classify large/small; large → `TransferSlots.inbound.tryAcquire()` or `busy`.
3. `downloadContentFromMessage`; open partial `wx 0o600`; for each chunk: check `isCurrent`/signal/deadline, add to count, refuse at > limit or > declared, `await handle.write` (one outstanding write).
4. End: declared && received < declared → `truncated`; `isCurrent()` → rename to final name (publication) → `stored`.
5. Any failure: destroy stream, close, `unlink` partial once → original outcome or `cleanupFailed`. Release slot in `finally`.

`IncomingMediaService.process` gains an injected `{ limits, isCurrent }` per message (mirrors audio `isCurrent`). Before `stored` is returned, the transfer's streams are destroyed/closed and buffer references dropped. After `stored`: if size ≤ 25 MiB and eligible → existing PDF preview / image buffer (read back from file); else large notice. Quoted images use `min(inbound, 25 MiB)`. Caller (`whatsapp-ng.ts:839-856`) rechecks authority before handoff; on loss the published file is kept unreported.

### D3. Outbound (FR-023–FR-028)

- `OutgoingMediaService` options: `maxBytes` (non-audio, captured) and fixed `AUDIO_MAX_BYTES = 25 MiB` for `type === 'audio'`; TTS keeps passing its own `maxBytes` for audio. `copySnapshot` deadline 5 min via `prepareTimeoutMs`.
- `send_wa_media` (`whatsapp-ng.ts:985-1030`): capture limits (refuse if unavailable for non-audio); `stat`-based large check → `TransferSlots.outbound.tryAcquire()` or busy; `sendTimeoutMs = size > 25 MiB ? 600_000 : 60_000`; release slot in `onSettled` after `dispose`, or in the pre-transmission `catch`.
- `OptionalOutputService.noteInput` captures `outboundBytes` into the admission; `toolEnded` adds `bytes.length > outboundBytes → continue` before reservation; malformed limits → no image forwarding. `prepareImage` receives the same limit.

### D4. Notices and copy

New i18n keys (4 locales) for large receipt, oversize, busy, interrupted (with reason), cleanup failure, limits unavailable, menu labels/help/confirmation, preparation timeout. Small-file receipt keys unchanged.

### D5. Documentation

README capability summary; `docs/reference.md` limits, deadlines, caps, ordering/delay, storage locations (document dir under process cwd), disk/tmpfs, kept-unreported files, no retention; `SECURITY.md` resource/storage disclosures; `CHANGELOG.md` entry.

## Validation Strategy

Mirrors [quickstart.md](quickstart.md). SC-002 measurement per research R3 (stage-queue + duplicate-copy accounting; release before processing). Evidence tiers reported separately: source/static checks; simulated transport (app-only); real Baileys decrypt/encrypt with mocked network; native-tool tests (skips inspected); operator-confirmed live delivery (separately authorized, not part of this plan).

## Planning findings (not resolved by weakening)

1. **SC-002 feasibility is a static assessment pending tests**, not demonstrated compliance. Measurement sums live stage queues and duplicate copies across stages; `pulled − written` is kept only as a backpressure check (research R3).
2. **Owner-approved scope**: SC-002 covers the transfer phase; transfer buffers are released before eligible post-transfer processing; files finishing ≤ 25 MiB (including unknown-size) keep existing processing eligibility and budgets.
3. **Coverage gap, not exclusion**: undici body buffering and `https.request` writable buffering are in-process JS buffers that the mocked-network tests do not exercise; reported as uncovered. Only kernel/OS/native memory and RAM-backed temp files are excluded.
4. **Capability limitation**: large outbound images/videos still need FFmpeg thumbnail/conversion within the unchanged 60 s budget and may be refused; documents are the supported large path.
5. **Transport-internal upload-host fallback exists** in Baileys (`getWAUploadToServer` host loop); documented, not disabled, no new retries.

## Complexity Tracking

None.
