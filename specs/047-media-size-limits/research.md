# Research: Configurable Media Transfer Size Limits

Static review of current source and the installed `baileys@7.0.0-rc14` (`node_modules/baileys/lib/Utils/messages-media.js`, `messages.js`) on 2026-11-13. These are static findings, not runtime or live-delivery evidence. No `NEEDS CLARIFICATION` items remain from the spec; this file records design decisions, the SC-002 feasibility analysis and the conflicts found.

## R1. Baseline paths

| Path | Current behavior | Source |
|------|------------------|--------|
| Inbound image/video/document | `downloadMessage` collects all chunks then `Buffer.concat`; saves with `writeFile`; 25 MiB constant; no deadline, no cancellation, no currentness checks during download | `src/services/incoming-media.service.ts:185-196` |
| Inbound document storage | `process.cwd()/.pi-data/whatsapp/documents`, `0o600`, `wx` | `incoming-media.service.ts:199-208` |
| Inbound PDF preview | `LiteParse.parse(buffer)`, 60 s parse timeout | `incoming-media.service.ts:144-166` |
| Inbound image to assistant | whole buffer → base64 in `RoutedContent` | `whatsapp-ng.ts:868-871` |
| Quoted image (text/audio group) | full download + new saved copy each time via `process({kind:'image'})` | `whatsapp-ng.ts:839-850` |
| Inbound authority | checked only after `process()` returns | `whatsapp-ng.ts:851-856` |
| Outbound snapshot | 64 KiB buffer copy into `mkdtemp(tmpdir())`; single `maxBytes` (25 MiB) for all types; no time bound on copy | `outgoing-media.service.ts:53,149-172` |
| Outbound conversion/thumbnail | shared 60 s deadline (`conversionTimeoutMs`), FFmpeg native decode | `outgoing-media.service.ts:121,236-263` |
| Explicit send | `sendTimeoutMs: 60_000` from transmission start; `mediaUploadTimeoutMs: 60_000`; `maxRetries: 1`; snapshot disposed in `onSettled` | `whatsapp-ng.ts:1000-1030`, `src/services/message.sender.ts:56-100` |
| Automatic tool images | ≤ 4 images, 25 MiB aggregate; size check precedes slot reservation | `src/services/optional-output.service.ts:98-109` |
| Audio / STT / TTS | 25 MiB audio download, 25 MiB remote STT, 8 MiB TTS | `audio.service.ts:65`, `remote-audio.transcriber.ts:6`, `tts-config.ts:5` |
| Settings persistence | raw `storedX` field, `getX()` throws on read failure/malformed, `setX(value, expectedRevision, current)` via `queueConfig` + atomic `writeConfig` | `src/services/session.manager.ts:240-290` |

## R2. Transport facts relevant to the design (Baileys rc14)

- **Download**: `downloadContentFromMessage` → `getHttpStream` (`fetch` + `Readable.fromWeb`) → decrypt `Transform` (default high-water marks). It accepts no `AbortSignal`; destroying the returned stream cancels the body locally. No MAC/length authentication is performed on the plaintext stream, so a short read cannot be distinguished from a legitimately short file except by comparison with the declared length.
- **Upload preparation**: `encryptedStream` reads the local file via `createReadStream`, writes an encrypted temp file in `getTmpFilesDirectory()` with `drain` backpressure. It saves an extra *original* copy only when Baileys must compute a thumbnail/duration itself; whatsapp-ng always supplies `jpegThumbnail` (image/video) and `seconds`/`waveform` (audio), so documents/images/videos produce **snapshot + encrypted copy** (two file-sized temp copies).
- **Upload**: on Node, `uploadWithNodeHttp` pipes a file `ReadStream` into `https.request` with `timeout: timeoutMs` — a socket **inactivity** timeout, not a wall-clock deadline. `getWAUploadToServer` loops over upload hosts and re-uploads on failure (**transport-internal host fallback exists**). Temp files are unlinked in a `finally` after upload settles.

Decision: keep using these entry points unchanged; no Baileys patches. Rationale: localized change (Constitution V). Alternatives rejected: forking/patching Baileys download to accept a signal (out of scope; local stream destroy suffices with the documented limitation).

## R3. SC-002 measurement plan and feasibility (16 MiB aggregate per active large transfer)

**Status**: static assessment pending tests. Nothing below is demonstrated compliance until the tests in `tasks.md` run and pass.

**Scope (owner-approved 2026-11-13)**: SC-002 covers the transfer phase only — from admission until publication (rename) or refusal. The transfer's buffers and streams are released (destroyed/closed, references dropped) before any eligible post-transfer processing starts. Files finishing ≤ 25 MiB, including unknown-size files admitted as large, keep existing processing eligibility and budgets, outside SC-002.

### Memory classes

| Class | Examples | SC-002 treatment |
|-------|----------|------------------|
| A. Application JS buffers | whatsapp-ng chunk references, the 64 KiB snapshot buffer, pending `FileHandle.write` buffers | **Counted and measured** |
| B. JS buffers owned by transport/library code inside the process | Baileys decrypt `Transform` queue and `remainingBytes`, decrypt/encrypt output copies, `Readable.fromWeb` / undici body-stream queue, `encryptedStream` write-stream queues, `fs.ReadStream` high-water buffers, `https.request` writable queue | **Counted.** Measured where the test exercises the real code (Baileys decrypt/encrypt, fs streams). Not covered where the test mocks it (undici `fetch` body internals, `https.request` buffering) — reported as a **coverage gap**, not an exclusion |
| C. Genuinely excluded OS/native memory | kernel socket buffers, OS page cache, RAM-backed temp files (tmpfs), OpenSSL/native cipher state, FFmpeg/LiteParse/sharp native memory | Excluded; disclosed in docs |

### Measurement approach

`pulled − written` is only a **backpressure check** (data does not accumulate without bound); it is not aggregate-memory evidence. The aggregate assertion instead sums live buffered bytes across stages at each sampling point:

1. **Stage queue accounting**: instrument each stream stage the test exercises with its live queued bytes — `readable.readableLength` / `writable.writableLength` for Node streams (Baileys decrypt `Transform`, `Readable.fromWeb` output, `fs.ReadStream`, `fs.WriteStream`, encrypt write stream), the mock source's enqueued-but-unread bytes, and the app's outstanding write-buffer bytes.
2. **Duplicate-copy accounting**: each stage that produces a new buffer (decrypt output, encrypt output, `remainingBytes` carry, snapshot buffer) contributes its live copies separately; a chunk held simultaneously as input and output counts twice. Implemented as per-stage counters incremented at creation and decremented when the downstream stage completes consumption (write callback / `drain`).
3. **Assertion**: at every chunk boundary and write-completion callback, `Σ stage queues + Σ live duplicate copies + app-held buffers ≤ 16,777,216`; also assert no single allocation ≥ file size and no `Buffer.concat` of transfer data.
4. **Release check**: after publication/refusal, all instrumented stages report zero queued bytes and the transfer holds no buffer references before processing begins (tested by asserting stream `destroyed`/`closed` and counters at zero before the processing hook is called).
5. **Separate backpressure check**: `pulled − written` stays bounded (retained as an additional assertion, not as the SC-002 proof).
6. Heap/RSS may be logged for information only; never a pass/fail gate.

### Coverage tiers to report

- **Tier 1 app-only**: synthetic plaintext stream, app writer/snapshot only (class A).
- **Tier 2 real Baileys streams, network mocked**: real `downloadContentFromMessage` decrypt over a mocked `fetch` returning a `ReadableStream`; real `encryptedStream` over the snapshot with an injected upload consumer (classes A + most of B).
- **Not covered by simulation (class B gap)**: undici's internal body buffering before `Readable.fromWeb`, and `https.request`/socket writable buffering in `uploadWithNodeHttp`. Bounded in principle by stream high-water marks, but unverified; reported as such.
- Live operator delivery is a separate, unauthorized tier.

### Static feasibility assessment (pending tests)

Every stage is pull-based or awaits write completion/`drain`; whatsapp-ng never concatenates transfer data. Expected per-stage live data is on the order of default high-water marks (16–64 KiB) plus one duplicate per crypto stage; an estimated sum below 1 MiB. This is an estimate from source reading, not a measurement.

### Boundaries (owner-resolved or capability limits)

1. Post-transfer processing of files ≤ 25 MiB is outside SC-002 (owner-approved).
2. Large outbound images/videos still need FFmpeg thumbnail/conversion within the unchanged 60 s budget and may be refused; documents are the supported large path.

## R4. Settings storage and malformed handling

Decision: one persisted object `mediaLimits: { inboundMiB?: number; outboundMiB?: number }`, validated by a pure `validateMediaLimits` alongside existing validators; absent object/field → 25; any present non-conforming value → malformed. `getMediaLimits()` throws on read failure or malformed (existing pattern), and callers turn that into a non-audio refusal with repair guidance (FR-005). Per-direction setters reuse `queueConfig` + revision + `current()` + atomic `writeConfig`, adding one parameter. Two revisions are unnecessary: one `mediaLimitsRevision` guards both fields because each save writes the full validated object with the other direction preserved.

Alternatives rejected: two top-level config keys (more `writeConfig` plumbing, no benefit); fallback to 25 MiB on malformed (owner rejected).

Note: `writeConfig` already threads every preserved field positionally; adding `mediaLimits` follows that pattern. Older versions drop unknown fields on save (documented, FR-004).

## R5. Inbound transfer design

Decision: a new `MediaTransferService` (inbound) owns: captured limit, admission, deadline, streaming write to a private partial name in the existing destination directory, size enforcement (declared pre-check, actual running count, declared-mismatch stop), publication by `rename` to the existing final name, cleanup, and a typed outcome (`stored | oversize | busy | interrupted | sizeMismatch | cleanupFailed`). `IncomingMediaService` uses it for image/video/document and then applies the fixed 25 MiB processing ceiling. All non-audio sizes use the same streaming path (Simplicity: one path); files ≤ 25 MiB that are eligible are read back from the completed file for the existing PDF/image processing, preserving behavior and budgets.

- Partial naming: same directory, `.<final>.partial` with `wx`/`0o600`, renamed on success so a half-written file never appears under the final name; names/permissions of completed files unchanged.
- Authority: an `isCurrent()` callback (runtime id + session context + chat admission), mirroring the audio path, checked per chunk, before rename (publication) and returned to the caller for the pre-handoff check. Published-but-unhanded files are kept (FR-031).
- Deadline: 10 min for large/unknown, 60 s for declared ≤ 25 MiB (timer destroys the stream → `interrupted`).
- Quoted images: limit = `min(capturedInbound, 25 MiB)`; known-oversized declarations short-circuit before download, so repeated quotes of an oversized image never download. Small quoted images keep current repeated-download behavior.
- Cleanup failure: `unlink` once; on failure return `cleanupFailed` with the leftover path for a bounded diagnostic.

Alternatives rejected: keeping the buffer path for small files (two code paths; the 60 s small deadline and mismatch rules need the same machinery anyway); a global inbound queue (owner chose busy refusal).

## R6. Outbound design

Decision: `OutgoingMediaService` takes the captured outbound limit for non-audio and keeps 25 MiB for audio (TTS keeps its supplied 8 MiB). `copySnapshot` gains the 5-minute preparation deadline (separate from the 60 s conversion deadline, which starts after copying as today). The explicit send path picks `sendTimeoutMs` 10 min when prepared size > 25 MiB, else 60 s; `mediaUploadTimeoutMs` stays 60 s (inactivity). A large-transfer slot is acquired before preparation and released in `onSettled` (after `dispose`), or on pre-transmission failure — never on caller timeout.

Automatic tool images: the captured outbound limit is added to the existing per-block `continue` checks before reservation (no slot consumed; no retry because the block is skipped). Malformed limits disable tool-image forwarding.

## R7. Admission caps

Decision: a tiny `TransferSlots` class (capacity 1) per direction, shared process-wide, `tryAcquire(): Release | undefined`. Busy → immediate refusal. Rationale: owner chose 1+1 and refusal over queueing. Inbound slot covers declared > 25 MiB and unknown size; outbound slot covers non-audio prepared/declared > 25 MiB (source size known from `stat` before copying).

## R8. Ordering and responsiveness

Unchanged model: `messages.upsert` events are dispatched with `void` (may overlap); messages within one payload are awaited sequentially (`whatsapp.service.ts:1118-1125`). A large inbound download can delay later same-batch messages (including phone controls) by up to 10 min; small declared files by up to 60 s. Documented, not redesigned.

## R9. Disk and temp storage

Outbound: original + snapshot (`os.tmpdir()`) + Baileys encrypted copy (Baileys tmp dir) ≈ 2 extra file sizes; conversion adds one more. `tmpdir()` may be tmpfs (RAM-backed) on Linux. ENOSPC during partial write/snapshot → typed failure, owned partial removed, originals untouched. No statfs preflight (YAGNI); no crash-recovery sweeper.
