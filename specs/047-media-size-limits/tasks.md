---
description: "Task list for 047 Configurable Media Transfer Size Limits"
---

# Tasks: Configurable Media Transfer Size Limits

**Input**: Design documents from `specs/047-media-size-limits/` ([plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/media-limits.md](contracts/media-limits.md), [quickstart.md](quickstart.md))

**Tests**: Required. The spec's validation section and repository rules (failing regression first) mandate test tasks. Write each test task before its implementation task and confirm it fails.

**Format**: `[ID] [P?] [Story] Description`. `[P]` = different files, no dependency on incomplete tasks.

**Global constraints for every task**: synthetic data and isolated `HOME`/`PI_CODING_AGENT_DIR` only; no real account, provider upload, model download, speech server or live transfer; no new dependencies; strict TypeScript, `.js` local import suffixes; no edits outside listed files without reason.

## Phase 1: Setup

- [X] T001 Create shared size helpers in `src/services/media-limits.ts`: `MIB = 1_048_576`, `DEFAULT_MEDIA_LIMIT_MIB = 25`, `MAX_MEDIA_LIMIT_MIB = 512`, `PROCESSING_CEILING_BYTES = 25 * MIB`, `AUDIO_TRANSFER_MAX_BYTES = 25 * MIB`, type `MediaLimits { inboundBytes; outboundBytes }`, `validateMediaLimits(raw: unknown): MediaLimits` (absent object/field → 25; any present non-integer/out-of-range/wrong-type → throw) and `parseMediaLimitInput(text): number | undefined` accepting only `^[1-9][0-9]{0,2}$` ≤ 512
- [X] T002 [P] Unit tests for T001 in `tests/unit/media-limits.test.ts`: absent, partial, valid, malformed (`0`, `513`, `1.5`, `"25"`, `null`, array, extra-type field), and input strings `0`, `513`, `1.5`, `+5`, `25MiB`, ` 25`, `025`, `1`, `512`
- [X] T003 [P] Create synthetic large-media test helpers in `tests/fixtures/large-media.ts`: seeded deterministic chunk generator (no full-file allocation), rolling SHA-256 comparator over files/streams, AES-256-CBC encrypter producing Baileys-compatible ciphertext stream from `mediaKey` (via Baileys `getMediaKeys`), mocked `fetch` returning a `ReadableStream` with configurable chunk size, truncation, excess and delay, and a disk-failure (`ENOSPC`) and `unlink`-failure injector

## Phase 2: Foundational (blocks all stories)

- [X] T004 Failing tests for persistence in `tests/unit/session.manager.media-limits.test.ts`: defaults when absent; `setMediaLimit('inbound', 512, rev, current)` persists only inbound; reload preserves both; unrelated setters (`setGroupReplies`, `setOptionalOutputs`, `setReplyReporting`, speech) preserve `mediaLimits`; stale revision, `current() === false`, unreadable config and injected write failure leave memory and disk unchanged; malformed saved field → `getMediaLimits()` throws
- [X] T005 Implement `storedMediaLimits`, `mediaLimitsRevision`, `getMediaLimits()`, `getMediaLimitsRevision()`, `setMediaLimit(direction, mib, expectedRevision, current)` in `src/services/session.manager.ts`, loading `config.mediaLimits` beside `optionalOutputs` (~line 186) and adding a trailing `mediaLimits` parameter to `writeConfig` (~line 418) preserved by every existing caller; follow the `setOptionalOutputs` pattern
- [X] T006 [P] Failing tests then implement `TransferSlots` in `src/services/transfer-slots.ts` (+ `tests/unit/transfer-slots.test.ts`): separate inbound/outbound pools of capacity 1, `tryAcquire(): (() => void) | undefined`, idempotent release, release after throw
- [X] T007 [P] Add i18n keys in all four locales in `src/i18n.ts`: large receipt (location, actual MiB + bytes, processing skipped), oversize, busy, interrupted with reasons (`deadline`, `cancelled`, `truncated`, `sizeMismatch`, `failed`, `disk`), cleanup failure (leftover location; not a receipt), limits unavailable/repair guidance, outbound too large naming the menu path, preparation timeout, menu title/help/labels/input prompt/invalid input/raise warning/confirm/cancel; extend `tests/unit/terminal-menu-i18n.test.ts` key-parity coverage

**Checkpoint**: limits persist; slots and copy exist.

## Phase 3: User Story 2 — Receive and store large files (P1) 🎯 MVP part A

**Goal**: Streamed, bounded, authority-checked inbound storage with typed outcomes.
**Independent test**: inbound 512 MiB synthetic document stored byte-identically with SC-002 accounting; +1 byte refused; partials cleaned.

### Tests (write first, must fail)

- [X] T008 [P] [US2] `tests/unit/inbound-media-transfer.test.ts`: exact limit / +1 byte at 1, 25, 512 MiB (512 via size-only stream without content retention); declared over limit → no fetch call; absent declaration → large class (slot + 600 s deadline); understated declaration → `sizeMismatch` at first byte past declared, even when that byte is mid-chunk; overstated (short) → `truncated`; chunk crossing the limit → `oversize`; saved byte count equals actual bytes
- [X] T009 [P] [US2] Same file: deadlines (fake timers) 60 s small / 600 s large, slow-but-progressing large transfer completes within deadline; cancellation signal, `isCurrent()` false mid-stream and before publication → `interrupted`, partial removed, no final file; `ENOSPC` → `interrupted:disk`; injected `unlink` failure → `cleanupFailed` with leftover path, no `stored`; busy when slot held; slot released in every outcome; completed files keep existing name pattern and `0o600`/dir `0o700`; published file never appears under final name before completion
- [X] T010 [US2] SC-002 instrumentation in `tests/unit/inbound-media-transfer.memory.test.ts` per research R3: real Baileys `downloadContentFromMessage` over T003 mocked fetch; at each chunk/write-completion sample, assert Σ(mock source enqueued bytes + `readableLength`/`writableLength` of decrypt Transform and `Readable.fromWeb` stream + Baileys `remainingBytes` carry estimate + live decrypt-output copies + app outstanding write buffer) ≤ 16,777,216; separately assert `pulled − written` bounded (backpressure only); assert no `Buffer.concat` of transfer data (spy) and no allocation ≥ file size; after publication/refusal assert all instrumented streams destroyed/closed and counters zero **before** the processing hook is invoked. Record undici internal body buffering as an uncovered class-B gap in test output/description. Heap/RSS informational only

### Implementation

- [X] T011 [US2] Implement `InboundMediaTransfer` in `src/services/inbound-media-transfer.ts` per data-model state machine and plan D2 (declared normalization, large/small class, slot, deadline timer destroying the stream, per-chunk `isCurrent`/signal/limit/declared checks, one outstanding `FileHandle.write`, partial `.<final>.partial` `wx 0o600`, `isCurrent()` before `rename`, single `unlink` attempt, typed `InboundOutcome`, slot release in `finally`, streams destroyed and references dropped before returning)
- [X] T012 [US2] Refactor `src/services/incoming-media.service.ts` to use `InboundMediaTransfer` for image/video/document with injected `{ limits: MediaLimits | Error; isCurrent; signal? }`; remove `downloadMessage` buffering for non-audio; keep document dir `process.cwd()/.pi-data/whatsapp/documents` and media dir; malformed limits → limits-unavailable notice without download; audio path unchanged
- [X] T013 [US2] Apply fixed 25 MiB processing ceiling in `src/services/incoming-media.service.ts`: stored > 25 MiB → large receipt (location, actual size, caption, processing skipped), no PDF parse, no image read-back/base64/vision; stored ≤ 25 MiB (including unknown-size) → read back from file and run existing PDF preview / image path with unchanged text; ≤ 25 MiB receipt text unchanged (declared size or 0, KB/MB)
- [X] T014 [US2] Quoted images in `whatsapp-ng.ts` (~lines 839-850) and service: limit `min(inbound, 25 MiB)`, known-oversized declaration → no download; unknown/small keep existing repeated-download behavior (no dedup)
- [X] T015 [US2] Wire per-message `isCurrent` (runtime id + session context + `admissionCurrent()`) and limits capture into non-audio `incomingMediaService.process` calls in `whatsapp-ng.ts`; recheck before handoff; if authority lost after publication, keep file unreported (FR-031); produce bounded notices for oversize/busy/interrupted/cleanupFailed; no automatic sender reply
- [X] T016 [P] [US2] Extend `tests/unit/incoming-media.service.test.ts` and `tests/unit/incoming-pdf.contract.test.ts`: 40 MiB PDF/image stored without parser/vision calls (spies); 10 MiB PDF/image unchanged text and optional-parser fallback; unknown-size file finishing 10 MiB processed as before; video storage-only; repeated quote of oversized image → zero fetches; small quoted image re-downloads as today

**Checkpoint**: US2 independently testable.

## Phase 4: User Story 1 — Explicitly send large documents (P1) 🎯 MVP part B

**Goal**: Captured outbound limit, bounded snapshot copy, large caller wait, slot held to settlement.
**Independent test**: 512 MiB synthetic document prepared and accepted by simulated transport, byte-identical, SC-002 accounting, +1 byte refused.

### Tests (write first)

- [X] T017 [P] [US1] `tests/unit/outgoing-media.service.test.ts` / `outgoing-media.filesystem.test.ts`: limit applies to source, snapshot and converted output for document/image/video; audio fixed 25 MiB even with outbound 512; TTS 8 MiB unchanged; exact/+1 at 1, 25, 512 MiB (512 via sparse file where supported, else skipped with reason); snapshot copy 5 min deadline (injected) → preparation-timeout error and temp dir removed; `ENOSPC` → temp removed, original untouched; existing path/credential/format checks unchanged
- [X] T018 [P] [US1] `tests/unit/send-wa-media.tool.test.ts`: `sendTimeoutMs` 600 000 for > 25 MiB and 60 000 otherwise; second large send while first unsettled → busy; caller timeout → `delivery: 'unknown'`, no resend, slot and snapshot held until mocked `sendMessage` settles, then disposed and released; pre-transmission failure releases slot; Off / session replacement / cancel before transmission → nothing sent; quote/recipient checks unchanged; malformed limits → non-audio refused with repair guidance, audio still sent; mentioned path without tool call → no upload
- [X] T019 [US1] SC-002 outbound instrumentation in `tests/unit/outgoing-media.memory.test.ts`: snapshot copy (64 KiB buffer) then real Baileys `encryptedStream` on the snapshot with an injected slow counting upload consumer; aggregate Σ(app buffer + `fs.ReadStream.readableLength` + encrypt write-stream `writableLength` + live cipher-output copies + consumer queue) ≤ 16,777,216 at each sample; backpressure check separate; decrypted output hash equals source; record `https.request`/socket buffering in `uploadWithNodeHttp` as uncovered class-B gap

### Implementation

- [X] T020 [US1] `src/services/outgoing-media.service.ts`: options `maxBytes` (non-audio, captured) and `prepareTimeoutMs` (default 300 000); `type === 'audio'` uses `min(maxBytes option if supplied by TTS, AUDIO_TRANSFER_MAX_BYTES)` so TTS 8 MiB stays; deadline check in `copySnapshot` loop; conversion deadline still 60 s starting after copy
- [X] T021 [US1] `whatsapp-ng.ts` `send_wa_media` (~985-1030): capture `getMediaLimits()` (refuse non-audio on throw); `stat` source size for large check before preparation; acquire outbound slot or busy; pass captured limit to `OutgoingMediaService`; `sendTimeoutMs` by size; release slot after `dispose` in `onSettled`, or in pre-transmission catch; never on caller timeout
- [X] T022 [US1] Update `send_wa_media` description/prompt snippet in `whatsapp-ng.ts`: configurable non-audio limit (default 25, max 512 MiB), audio 25 MiB, acceptance ≠ delivery; no interpolated runtime value

**Checkpoint**: US1 + US2 = MVP.

## Phase 5: User Story 3 — Configure limits (P2)

**Goal**: Terminal Advanced → Media limits with confirmation on inbound increases > 25 MiB.
**Independent test**: set inbound 512 / outbound 100, reload, unrelated save; invalid/stale/cancelled inputs change nothing.

- [X] T023 [P] [US3] Failing tests `tests/unit/media-limits-settings.view.test.ts`: view shows both values, range, audio exclusion, 25 MiB processing ceiling, disk/temp notes; malformed/unreadable shows repair notice and no edit; invalid inputs rejected; inbound 25→100 and 100→200 require confirm, cancel/expiry → unchanged; decrease and outbound changes no confirm; stale revision/expired authority → unchanged; Back never saves
- [X] T024 [US3] Implement `src/ui/media-limits-settings.view.ts` following `src/ui/optional-output-settings.view.ts` captured-authority pattern
- [X] T025 [US3] Add Advanced entry in `src/ui/whatsapp-settings.view.ts` (~line 78) and routing in `src/ui/menu.handler.ts`; extend `tests/unit/settings-navigation.test.ts` and `tests/unit/menu.handler.test.ts`
- [ ] T026 [US3] (partial: RPC production-entry path covered; manual `pi` session NOT run) Production-entry check: extend `tests/unit/whatsapp-ng.extension.test.ts` (or existing RPC fixture `tests/fixtures/phone-control-rpc.extension.ts` pattern) to reach Advanced → Media limits with isolated synthetic state; manual `pi --no-extensions -e ./whatsapp-ng.ts` in disposable HOME recorded separately

## Phase 6: User Story 4 — Audio and automatic-output budgets unchanged (P2)

- [X] T027 [P] [US4] Failing tests in `tests/unit/optional-output.service.test.ts`: outbound 5 MiB → 6 MiB tool image skipped without consuming count/bytes/hash slot and not retried; 4-image / 25 MiB aggregate unchanged at outbound 512; malformed limits → no tool-image forwarding
- [X] T028 [US4] Implement in `src/services/optional-output.service.ts`: capture `outboundBytes` in `noteInput` admission; per-block `bytes.length > outboundBytes → continue` before reservation; pass limit to `prepareImage` wiring in `whatsapp-ng.ts` (~line 245)
- [X] T029 [P] [US4] Regression tests with both limits 512: incoming voice note > 25 MiB refused (`tests/unit/audio.service.test.ts` or nearest), remote STT 25 MiB (`tests/unit/remote-stt*.test.ts`), TTS 8 MiB, explicit outgoing audio > 25 MiB refused; audio sent as document follows document rules and is not transcribed

## Phase 7: User Story 5 — Interrupted and revoked lifecycle work (P3)

- [X] T030 [P] [US5] Integration tests in `tests/unit/media-lifecycle.test.ts` using slow mocked streams: explicit Off, session/account replacement and chat revocation during inbound download → no handoff, partial removed; revocation after publish before handoff → file kept unreported; outbound cancel/Off/session change before transmission → nothing sent; after transmission start → delivery-unknown, no resend, snapshot held to settlement; limit lowered mid-transfer → captured limit applies, no receipts/originals deleted
- [X] T031 [US5] Fix any gaps found by T030 in `whatsapp-ng.ts` / `src/services/inbound-media-transfer.ts` only

## Phase 8: Large-file suite and polish

- [X] T032 Opt-in labelled suite `tests/unit/media-large.test.ts` (`describe.skipIf(!process.env.WHATSAPP_NG_LARGE_MEDIA)`): full 536,870,912-byte inbound (real Baileys decrypt, mocked fetch) and outbound (snapshot + real `encryptedStream`, mocked upload) with incremental fixtures, byte-identical hashes, R3 aggregate accounting, release-before-processing assertion; 536,870,913 refused both ways; report tier (app-only vs real Baileys with network mocked) and uncovered class-B buffering. Must be run and reported before claiming completion
- [X] T033 [P] Docs: `README.md` capability summary; `docs/reference.md` limits, menu, deadlines, caps/busy, ordering and same-batch delay up to 10 min / 60 s, storage locations (documents under process cwd), Git/indexer exposure, no retention, kept-unreported files, cleanup-failure leftovers, disk ≈ 2 extra copies, tmpfs, memory classes A/B/C, transport-internal host fallback, acceptance ≠ delivery, decoder/OCR memory not bounded; `SECURITY.md` resource/storage disclosures; `CHANGELOG.md` entry
- [X] T034 Run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`, opt-in `WHATSAPP_NG_LARGE_MEDIA=1 npx vitest run tests/unit/media-large.test.ts`; check changed Markdown links; record commands, results, skips (native tools, sparse files) and evidence tiers in `specs/047-media-size-limits/quickstart.md` notes or handoff

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. T005 depends on T001/T004; T011 on T003/T006/T001.
- US2 (Phase 3) and US1 (Phase 4) independent after Phase 2; together form the MVP.
- US3 depends on T005, T007. US4 on T005, T020. US5 on US1 + US2.
- T032 after T011, T020; T034 last.

## Parallel Examples

- Phase 1: T002 ‖ T003.
- Phase 2: T006 ‖ T007 (after T004/T005 started).
- US2 tests: T008 ‖ T009 ‖ T016; US1 tests: T017 ‖ T018.
- US3 T023 ‖ US4 T027 ‖ T029.

## Implementation Strategy

1. MVP: Phases 1-4 (persistence + inbound + outbound); validate SC-001–SC-004a, SC-008 at Tier 2.
2. Add US3 menu, then US4 regressions, then US5 lifecycle.
3. Run T032 opt-in suite and T034 gate; report SC-002 as verified only for measured classes, with class-B gaps stated.

## Status notes (2026-11-13 reconciliation, revised 2026-11-14 after review)

- T010/T019/T032: SC-002 is verified only for measured simulated-transport stages. Each figure separates measured queues from estimated in-loop chunks. Network-library JS buffering (undici body, `https.request`/socket) is uncovered, not excluded; an end-to-end 16 MiB guarantee is not proven. The earlier 72 KiB outbound "peak" was the snapshot-stage allocation total, not an encryption-stage measurement, and is withdrawn.
- T026: left open. The production-entry RPC path in `tests/unit/phone-control.rpc.test.ts` is covered; the manual `pi --no-extensions -e ./whatsapp-ng.ts` session was not run.
- T030/T031: review found two gaps, fixed with failing regressions first: (1) outbound admission now happens inside preparation, from the opened file's size, before any snapshot exists; unadmitted work is capped at 25 MiB; (2) inbound transfers poll authority so a stalled download stops on Off, session replacement or revocation. Entry-handler tests now cover stalled session replacement and the FR-031 keep-unreported race.
- T034: rerun after the review fixes; see [quickstart.md](quickstart.md#review-fixes-2026-11-14).
- Operator live WhatsApp acceptance: not run (not authorized).
- 2026-11-14 P2 (Opus 5.5 review): a send admitted as small now gets a distinct admission-cap message when it grows or converts past 25 MiB. The earlier remap to "configured outbound limit" was removed. FR-023 and the docs are amended. No dynamic slot promotion.
