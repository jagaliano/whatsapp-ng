# Feature Specification: Configurable Media Transfer Size Limits

**Feature Branch**: `main` (no feature branch created; branch creation not requested)

**Created**: 2026-11-13 (date corrected from 2026-05-31 using file timestamps)

**Status**: Draft

**Input**: User description: self-contained request in `/Users/jagaliano/workspace/047.md` — two independent, configurable maximum non-audio file-transfer sizes (inbound and outbound), default 25 MiB each, configurable up to 512 MiB, with audio and automatic-processing budgets unchanged.

**Baseline note**: Current-behavior statements below come from static review of current source/tests (for example `src/services/incoming-media.service.ts`, `src/services/outgoing-media.service.ts`, `src/services/optional-output.service.ts`, `src/services/remote-audio.transcriber.ts`, `src/services/tts-config.ts`). They are static findings, not new runtime or live-delivery evidence.

**Units**: 1 MiB = 1,048,576 bytes; 25 MiB = 26,214,400 bytes; 512 MiB = 536,870,912 bytes. All limits are per file and inclusive (a file of exactly the limit is allowed; one byte more is refused).

## Clarifications

### Session 2026-11-13

- Q: How should non-audio transfers behave when a saved limit is malformed or the configuration is unreadable? → A: Refuse affected non-audio transfers with repair guidance (no fallback to 25 MiB).
- Q: Should the WhatsApp sender be notified of oversize/busy/interrupted refusals? → A: No new automatic reply; only the assistant receives bounded notices.
- Q: What happens to a file published while authority was current but not handed off before authority expired? → A: Keep the completed file on disk, unreported; no cleanup.
- Q: How must unknown or dishonest inbound sizes interact with admission and deadlines? → A: Unknown declared size is treated as large (large-transfer admission slot and deadline); actual bytes exceeding a declared size stop the transfer as a size mismatch, so a small declaration can never carry a large transfer outside large-transfer admission or past the small-file deadline.
- Q: How is cleanup failure handled in the partial-file guarantee? → A: Cleanup failure is reported explicitly as a distinct outcome; success criteria guarantee zero remaining partial files only when deletion succeeds, and otherwise require a bounded diagnostic and no receipt/handoff of the leftover file.
- Q: How many large non-audio transfers (above 25 MiB) may run concurrently per direction before busy refusal? → A: 1 inbound + 1 outbound.
- Q: What deadlines apply to large and small transfers? → A: Inbound large (incl. unknown size) 10 min; inbound small 60 s; outbound caller wait for sends above 25 MiB 10 min from start of transmission; outbound snapshot preparation 5 min (separate from the 60 s conversion/thumbnail budget).
- Q: Which receipt notices change? → A: Only receipts for files above 25 MiB use actual size, MiB and saved location; small-file receipt text is unchanged.
- Q: Should raising the inbound limit require confirmation? → A: Yes — warn and require explicit confirmation for every inbound increase whose new value is above 25 MiB, including increases from a value already above 25 MiB (e.g. 100 → 200). Decreases and outbound changes need no confirmation.
- Q: What does the SC-002 16 MiB bound measure? → A: Approved as the aggregate application-managed transfer-buffer budget per active large transfer (queued chunks and duplicate copies included), not per individual buffer; native processing, OS caches and RAM-backed temp storage are separate; small-file budgets unchanged.
- Q: Does SC-002 cover post-transfer processing? → A: No. SC-002 applies to the transfer phase; transfer buffers are released before eligible processing starts; unknown-size files finishing ≤ 25 MiB keep existing processing eligibility and budgets.
- Q: Can a send admitted as small grow into a large transfer during preparation? → A: No. It stays capped at 25 MiB with a distinct admission-cap refusal; no dynamic slot promotion (FR-023, 2026-11-14).
- Q: What input format and menu placement apply? → A: Whole numbers 1–512 in MiB with no unit suffix, under terminal `/whatsapp` → Advanced → Media limits.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explicitly send a large document (Priority: P1)

The operator asks the assistant to send a large drawing (for example a 300 MiB CAD/PDF file) from the workspace to a WhatsApp chat as a document, for downstream automation. Today anything above 25 MiB is refused.

**Why this priority**: Primary motivating use case; outbound already uses a file-backed snapshot, so value is high with a localized change.

**Independent Test**: With the outbound limit set to 512 MiB, explicitly send a synthetic 512 MiB document through a simulated transport; verify acceptance, byte-identical transferred content, untouched original, bounded application buffers, and that a 512 MiB + 1 byte file is refused before transmission.

**Acceptance Scenarios**:

1. **Given** outbound limit 512 MiB, **When** the operator explicitly sends a 300 MiB document, **Then** it is prepared from an owned snapshot, handed to the transport, and reported as accepted (not as delivered).
2. **Given** outbound limit 25 MiB (default), **When** a 25 MiB + 1 byte document is explicitly sent, **Then** it is refused before transmission with a message naming the configured limit and how to change it.
3. **Given** a send above 25 MiB whose caller wait expires while the upload is still progressing, **When** the caller reports delivery-unknown, **Then** no automatic resend occurs and the snapshot and capacity slot remain held until the transport actually settles.
4. **Given** a path merely mentioned in conversation, **When** no explicit send is requested, **Then** nothing is uploaded regardless of size limits.
5. **Given** any file explicitly sent as audio or voice note, **When** it exceeds 25 MiB, **Then** it is refused under the unchanged audio limit even if the outbound limit is 512 MiB.

---

### User Story 2 - Receive and store a large file without automatic processing (Priority: P1)

An allowed contact sends a 400 MiB drawing. The operator wants it saved locally and the assistant told where it is, without the extension loading the whole file into memory or attempting automatic parsing/vision.

**Why this priority**: Equal-priority half of the feature; inbound currently buffers whole files and has no deadline, so naive limit raising is unsafe.

**Independent Test**: With the inbound limit set to 512 MiB, deliver a synthetic 512 MiB document through a simulated incoming stream; verify byte-identical storage, bounded in-flight bytes, an assistant notice with saved location and actual size stating automatic processing was skipped, and refusal/cleanup at one byte over.

**Acceptance Scenarios**:

1. **Given** inbound limit 512 MiB, **When** an allowed chat sends a 400 MiB document, **Then** it is stored at the existing document destination and the assistant receives the location, actual received byte size, available metadata/caption, and a statement that automatic processing was skipped.
2. **Given** a declared size above the captured inbound limit, **When** the message arrives, **Then** no download starts and the assistant receives a bounded oversize notice.
3. **Given** a missing or understated declared size, **When** actual bytes exceed the limit mid-stream (including within a single chunk), **Then** the download stops, the owned partial file is removed, and an oversize notice is produced.
4. **Given** a 40 MiB PDF or image within the inbound limit, **When** it is received, **Then** it is saved without PDF parsing/OCR, without reading the image back, base64-expanding it, resizing it, or forwarding it to a vision provider.
5. **Given** a 10 MiB PDF or image, **When** it is received, **Then** existing automatic preview/inline behavior and optional-parser fallback are unchanged.
6. **Given** the download is interrupted, truncated, cancelled, hits the inbound deadline, or fails on disk, **When** the transfer ends, **Then** it is reported as interrupted (not received) and the owned partial file is removed.

---

### User Story 3 - Configure both limits independently and persistently (Priority: P2)

The operator opens the terminal `/whatsapp` menu and sets inbound and outbound limits separately, seeing units, range, audio exclusion and resource implications.

**Why this priority**: Required to unlock Stories 1–2, but defaults keep existing installations unchanged.

**Independent Test**: In an isolated synthetic configuration, set inbound to 512 and outbound to 100, reload, perform an unrelated settings save, and verify both values persist independently; verify invalid, stale, expired and cancelled inputs change nothing.

**Acceptance Scenarios**:

1. **Given** an existing configuration without the new fields, **When** the extension loads, **Then** both limits are 25 MiB.
2. **Given** a valid change to one direction, **When** it is saved, **Then** only that direction changes on disk and in memory; the other direction and unrelated settings are preserved, including across reload and later unrelated saves.
3. **Given** input 0, 513, a fraction, non-numeric text, or an expired/stale/cancelled menu request, **When** submitted, **Then** it is rejected and nothing changes.
4. **Given** persistence fails, **When** a change is saved, **Then** neither memory nor disk is partially updated.
5. **Given** a limit is lowered, **When** the change is saved, **Then** existing completed receipts and user originals are not deleted, and in-flight operations keep the limit captured at admission.

---

### User Story 4 - Audio and automatic-output budgets remain unchanged (Priority: P2)

The operator raises both limits to 512 MiB and expects voice notes, remote transcription, generated speech and automatic tool-image forwarding to keep their existing budgets.

**Why this priority**: Prevents cost/resource regressions in speech providers and automatic outputs.

**Independent Test**: With both limits at 512 MiB, verify incoming and explicit outgoing audio > 25 MiB are refused, remote transcription input remains ≤ 25 MiB, generated speech remains ≤ 8 MiB, and automatic tool-image forwarding keeps its 4-image / 25 MiB aggregate budget while also applying the outbound per-file limit.

**Acceptance Scenarios**:

1. **Given** limits at 512 MiB, **When** a 30 MiB voice note arrives, **Then** it is refused under the unchanged 25 MiB audio limit.
2. **Given** an audio file explicitly sent as a document, **When** it is within the outbound limit, **Then** it follows document rules and is not automatically transcribed.
3. **Given** outbound limit 5 MiB, **When** an automatic tool output includes a 6 MiB image, **Then** that image is not forwarded, is not retried, and the existing aggregate/count budgets and consent boundaries are unchanged.

---

### User Story 5 - Interrupted and revoked lifecycle work fails safely (Priority: P3)

During a long transfer the operator turns WhatsApp Off, the session is replaced, or a chat is removed from the allow-list.

**Why this priority**: Long transfers widen existing race windows; safety must hold but is exercised less often.

**Independent Test**: Using simulated slow-but-progressing transfers, trigger cancellation, explicit Off, account/session replacement and chat revocation at each stage; verify no stale publication, handoff or egress, correct partial-file cleanup, and no automatic resend.

**Acceptance Scenarios**:

1. **Given** an inbound non-audio download in progress, **When** explicit Off, account/session replacement or chat-admission revocation occurs, **Then** the download stops being processed, the owned partial file is removed, and nothing is handed to the assistant.
2. **Given** an explicit outbound send not yet transmitting, **When** cancellation, Off or account/session replacement occurs, **Then** nothing is sent and existing routing/recipient/quote protections are unchanged.
3. **Given** a received file published while authority was current, **When** authority expires before handoff to the assistant, **Then** the completed file is kept on disk, is not handed to the assistant, and is not deleted (FR-031).
4. **Given** a declared size of 10 MiB, **When** actual bytes exceed 10 MiB, **Then** the transfer stops as a size mismatch, the owned partial file is removed, and it never runs under small-file admission/deadline beyond the declared size.
5. **Given** an absent declared size, **When** large-transfer capacity is full, **Then** the transfer is refused as busy before download.

---

### Edge Cases

- Exact limit and one byte over at 1, 25 and 512 MiB, for both directions.
- Declared size known-over, absent, understated or overstated; actual bytes shorter than declared (truncated) versus longer (size mismatch, FR-012a).
- Deletion of an owned partial file itself fails (FR-014a).
- Excess bytes arriving inside a single chunk that crosses the limit.
- Insufficient disk space mid-download or mid-snapshot; failed cleanup of a partial file.
- Concurrent large transfers beyond the admission cap; a busy refusal must be distinct from oversize and interruption.
- Limit changed while a transfer is in flight (captured limit applies).
- Repeatedly quoting an oversized image in text or audio group messages.
- Malformed saved limit value versus absent field versus unreadable configuration file.
- An older extension version saving configuration and dropping the new fields.
- OS temporary storage that is RAM-backed (for example tmpfs).
- Caller wait expiry while the transport upload continues and later succeeds or fails.
- Multiple messages in one incoming batch where an early large file delays later messages.

## Requirements *(mandatory)*

### Functional Requirements

**Settings**

- **FR-001**: The system MUST provide exactly two new user-facing settings: inbound maximum non-audio file size and outbound maximum non-audio file size. No per-chat settings, no third configurable setting, and no new remote/phone configuration commands.
- **FR-002**: Each setting MUST default independently to 25 MiB when absent and accept whole-number MiB values from 1 through 512 inclusive, entered without a unit suffix; fractions, signs, suffixes and non-numeric text are rejected.
- **FR-003**: Changes MUST use existing authorized terminal navigation, captured authority, revision/currentness checks and existing configuration persistence ownership. Invalid, out-of-range, stale, expired or cancelled changes MUST be rejected without effect; failed persistence MUST NOT partially update memory or disk.
- **FR-004**: Each valid value MUST persist across reloads and unrelated saves without altering the other direction or unrelated state. Documentation MUST state these are process-loaded preferences: cooperating processes may overwrite each other and older versions may drop the fields (reverting to defaults). No general settings-synchronization redesign is in scope.
- **FR-005**: The system MUST distinguish an absent field (use 25 MiB), a malformed saved field, and an unreadable/corrupt configuration file. Malformed or unreadable state MUST NOT silently raise access or reset data. Affected non-audio transfers in the affected direction(s) MUST be refused with repair guidance; the system MUST NOT fall back to 25 MiB. This may newly block small explicit non-audio sends while configuration is malformed; audio budgets are unaffected.
- **FR-006**: The settings view MUST live at terminal `/whatsapp` → Advanced → Media limits and MUST show both current values, MiB units and range, the audio exclusion, the 25 MiB automatic-processing safeguard, and resource/storage implications.
- **FR-006a**: Any inbound increase to a value above 25 MiB, including increases from a value already above 25 MiB, MUST show a warning (all allowed contacts/groups may send files up to that size; disk accumulation; no automatic retention) and require explicit confirmation before saving. Cancelled, stale or expired confirmations MUST leave the setting unchanged. Decreases and outbound changes require no confirmation.
- **FR-007**: New user-facing copy MUST follow existing localization in all four locales. Tool descriptions MUST describe limits as configurable without embedding a stale startup-only value or implying dynamic description refresh.

**Scope and classification**

- **FR-008**: Limits MUST apply per file to documents, images and videos. Classification MUST follow the existing incoming media kind or the explicitly requested outgoing media type.
- **FR-009**: Incoming and explicit outgoing audio/voice notes MUST keep the 25 MiB limit; remote transcription MUST keep its independent 25 MiB budget; generated speech MUST keep its 8 MiB budget. Speech backend selection, consent, reply modes, conversion and provider fallback policy MUST NOT change.
- **FR-010**: Existing inbound/automatic-output chat admission and explicit-send recipient/quote/routing protections MUST be retained; no outbound allow-list requirement, privacy isolation or extra chat authorization is added.

**Inbound**

- **FR-011**: Each inbound operation MUST capture the inbound limit at admission; a later limit change MUST NOT alter it and is not revocation.
- **FR-012**: A known declared size above the captured limit MUST be refused before download. Actual bytes MUST be independently enforced throughout the download, including missing or dishonest declarations and excess within a single chunk.
- **FR-012a**: A transfer with no usable declared size MUST be treated as a large transfer (above 25 MiB) for admission (FR-029) and deadline (FR-019) purposes. When a size is declared, actual bytes exceeding the declared size MUST stop the transfer as a size mismatch (interrupted, partial removed), so a small or dishonest declaration cannot bypass large-transfer admission or receive the small-file deadline for more bytes than declared.
- **FR-013**: Inbound non-audio files MUST be stored with bounded application memory and backpressure; the complete payload MUST NOT be accumulated in an application buffer.
- **FR-014**: Incomplete work MUST be treated as partial. Owned partial files MUST be removed on oversize, cancellation, authority expiry, deadline expiry, download failure or disk failure. Actual length shorter than a declared length MUST be reported as interrupted, not received; no authenticated-length guarantee beyond the transport's is claimed.
- **FR-014a**: If deleting an owned partial file fails, the system MUST report a distinct bounded metadata-only cleanup-failure diagnostic (including the leftover location), MUST NOT report the file as received or hand it to the assistant, MUST NOT retry deletion indefinitely, and MUST NOT delete anything else in compensation.
- **FR-015**: Existing storage destinations, naming and permissions MUST be preserved (documents under the process working directory's `.pi-data/whatsapp/documents`, which may differ from Pi's session working directory; images/videos in the extension media directory). No storage-root migration or retention policy is added. Documentation MUST disclose disk accumulation, absence of automatic retention, and possible exposure of the document directory to workspace Git/indexers.
- **FR-016**: On successful storage of a file above the 25 MiB processing ceiling, the assistant MUST be told the saved location, actual received byte size, available metadata/caption, and that automatic processing was skipped, using MiB units. Receipt text for files at or below 25 MiB MUST remain unchanged.
- **FR-017**: Oversize, busy and interrupted refusals MUST produce distinct, bounded, metadata-only notices to the assistant, subject to current authority. Refused files MUST NOT be queued or automatically re-fetched; no later-fetch tool is added. The WhatsApp sender MUST NOT receive any new automatic reply for these refusals.
- **FR-018**: Inbound non-audio work MUST be cancellable and MUST check captured account/session/chat-admission authority during the transfer and immediately before completed-file publication and assistant handoff. Local stream termination is not claimed to stop underlying network activity immediately.
- **FR-019**: Inbound non-audio downloads MUST have a finite deadline: 10 minutes for transfers above 25 MiB or of unknown size, 60 seconds for declared sizes ≤ 25 MiB. Existing ordering MUST be preserved and documented: separate incoming events may overlap; messages within one payload are processed sequentially, so a large download can delay later same-batch messages up to that deadline. No new global queue or ordering guarantee is introduced.

**Automatic processing ceiling**

- **FR-020**: A fixed, non-configurable 25 MiB ceiling MUST govern automatic PDF previews/OCR and inline images to the assistant. Above it (within the inbound limit) PDFs are stored without parsing/OCR and images are stored without read-back, base64 expansion, automatic resizing or vision forwarding. At or below it, existing eligibility (including PDF detection by MIME type or `.pdf` filename) and optional-parser fallback are unchanged. Videos remain storage-only.
- **FR-021**: Automatic quoted-image downloads (text and audio group messages quoting images) MUST use the smaller of the captured inbound limit and 25 MiB, refuse known-oversized declarations before downloading, and bound unknown-length downloads. Repeatedly quoting an oversized image MUST NOT trigger another large download/storage copy for analysis. Existing repeated-download behavior for eligible small quoted images MUST NOT change (no new deduplication).
- **FR-022**: Documentation MUST state that the byte ceiling does not bound decoder/OCR native memory for smaller files, and that later deliberate inspection of a saved file follows existing tool/provider policies.

**Outbound**

- **FR-023**: Each explicit outbound non-audio operation MUST capture the outbound limit at admission and apply it to the source, the owned snapshot and any converted output. An operation whose opened source is at or below 25 MiB is admitted as small (no large-transfer slot) and stays capped at 25 MiB for the source, snapshot and converted output during preparation, even when the configured limit is higher. If it grows or converts past 25 MiB, it MUST be refused with a distinct, localized admission-cap message that does not claim the configured limit was exceeded or suggest raising it. There is no dynamic slot promotion. (Amended 2026-11-14 after review.)
- **FR-024**: Explicit upload intent, workspace/media-root restriction, credential-path refusal, native quote checks, stable message identity, existing format restrictions and untouched originals MUST be preserved. Arbitrary files (including drawings) may be sent as documents; no decoder or automatic conversion is added.
- **FR-025**: Automatic tool-image forwarding MUST also apply the outbound per-file limit without increasing its 4-image / 25 MiB aggregate budget or changing consent. Per-file refusals MUST NOT consume a count slot (matching existing aggregate-refusal accounting) and rejected files MUST NOT be retried. TTS preparation keeps its separately supplied budget.
- **FR-026**: Explicit non-audio sends at or below 25 MiB MUST keep the current 60-second caller wait; sends above 25 MiB MUST have a 10-minute caller wait measured from start of transmission. Local snapshot preparation MUST be bounded at 5 minutes; existing 60-second conversion/thumbnail and PDF-parsing budgets MUST NOT be silently extended.
- **FR-027**: After transmission begins, uncertain outcomes MUST be reported as delivery-unknown; there MUST be no application-level automatic resend or new speculative retry. Documentation MUST NOT claim absence of existing transport-internal upload-host fallback. Application acceptance of 512 MiB MUST NOT be presented as WhatsApp acceptance, recipient delivery, type/codec support or network completion.
- **FR-028**: Cancellation, explicit Off, session/account checks and routing snapshot/recipient/quote protections MUST be rechecked immediately before egress; stale settings authority or lifecycle replacement MUST NOT permit stale sends.

**Disk, concurrency and failure**

- **FR-029**: Large inbound and explicit outbound non-audio transfers MUST be governed by fixed admission caps of 1 inbound and 1 outbound concurrent large transfer with a clear busy refusal instead of an unbounded queue. Inbound capacity is released when owned local work ends; outbound capacity and owned snapshots are held until actual transport settlement, not caller timeout. Pending exposure is bounded by count; release within a fixed time and cross-restart disk bounds are not promised.
- **FR-030**: Insufficient disk, interrupted streams and failed cleanup MUST fail safely without deleting originals, unrelated completed receipts, or files still used by an unsettled upload. No broad crash-recovery deletion or migration is added. Documentation MUST disclose that an outbound document may need roughly two additional file-sized temporary copies plus the original (more with conversion/concurrency), that OS temporary storage may be RAM-backed, and must distinguish application heap, native processing, OS buffers and RAM-backed temporary files.
- **FR-031**: A file published to storage while authority was current but not handed off before authority expires MUST be kept on disk unreported: it is not handed to the assistant, not deleted, and not re-offered later. Documentation MUST disclose that such files can exist.

**Documentation**

- **FR-032**: README, `docs/reference.md`, `SECURITY.md` (resource/storage disclosures) and `CHANGELOG.md` MUST be updated, correcting relevant storage-location claims without unrelated cleanup.

### Key Entities

- **Transfer limit preference**: direction (inbound/outbound), whole-number MiB value, state (absent/valid/malformed); persisted in existing configuration.
- **Captured transfer operation**: direction, media kind, captured limit, captured authority (account/session/chat admission or explicit-send routing snapshot), state (admitted, in progress, partial, completed, refused-oversize, refused-busy, interrupted, delivery-unknown, settled).
- **Received file receipt**: saved location, actual byte size, declared size if any, metadata/caption, processing status (processed / skipped above ceiling).
- **Admission slot**: direction, held from admission until local completion (inbound) or transport settlement (outbound).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With limits at 512 MiB, a synthetic 536,870,912-byte document is received and stored, and separately prepared and accepted by a simulated transport, with byte-identical content in 100% of runs; 536,870,913 bytes is refused in both directions.
- **SC-002**: During each active large transfer (above 25 MiB or unknown size), the aggregate application-managed transfer-buffer bytes — all chunks held, queued or in flight plus any duplicate copies made by the application — never exceed 16 MiB (16,777,216 bytes), measured at the application's stream/allocation boundaries, independent of file size; no full-file application buffer is allocated. Native-processing memory, OS page caches/socket buffers and RAM-backed temporary storage are excluded from this budget and reported separately. The budget applies to the transfer phase (admission until publication or refusal); its transfer buffers are released before any eligible post-transfer processing starts. Files that finish ≤ 25 MiB — including unknown-size files admitted as large — retain existing processing eligibility and budgets, which are outside SC-002. Existing small-file (≤ 25 MiB) processing budgets are unchanged.
- **SC-003**: Exact-limit and one-byte-over cases at 1, 25 and 512 MiB pass/fail correctly in 100% of cases, including absent and dishonest declared sizes and chunk-boundary excess.
- **SC-004**: After every oversize, size-mismatch, cancellation, revocation, deadline, disk-failure or truncation case in which partial-file deletion succeeds, zero owned partial files remain. With injected deletion failure, 100% of cases emit the cleanup-failure diagnostic and none report the leftover as received or hand it to the assistant. In all cases zero originals, unrelated receipts or files used by unsettled uploads are removed.
- **SC-004a**: Transfers with absent declared size and transfers whose actual bytes exceed their declaration never run outside large-transfer admission and never continue past the declared size under the small-file deadline (verified for absent, understated and overstated declarations).
- **SC-005**: With both limits at 512 MiB, all existing audio, remote-transcription, generated-speech and automatic-image aggregate/count budget tests still pass unchanged.
- **SC-006**: Files above 25 MiB produce zero automatic PDF parses, image read-backs/base64 expansions or vision forwards; repeated quotes of an oversized image produce zero additional large downloads.
- **SC-007**: Setting changes survive reload and unrelated saves in 100% of isolated runs; invalid/stale/expired/cancelled/failed changes leave memory and disk unchanged.
- **SC-008**: Caller-wait expiry on a slow, progressing outbound transfer never releases its capacity slot or snapshot before simulated settlement and never triggers a resend.
- **SC-009**: Existing installations without the new fields keep today's receipt text and processing eligibility for all non-audio files ≤ 25 MiB. The only approved small-file behavior changes are the safety checks already required elsewhere: (a) a file whose actual bytes differ from a declared size is refused as interrupted (`sizeMismatch` / `truncated`) rather than saved (FR-012a, FR-014); (b) declared-small downloads have a new 60-second deadline where none existed (FR-019); (c) inbound non-audio work is cancelled on Off, session/account replacement or chat revocation (FR-018); (d) refusals use the new bounded notices (FR-017); (e) malformed/unreadable limits refuse non-audio work (FR-005). These are not rolled back.

Evidence tiers remain distinct: source/static checks, simulated-transport acceptance (app-only versus real transport-library encryption/preparation with network mocked), native-tool coverage, and separately authorized operator-confirmed WhatsApp delivery. None of the above proves recipient delivery. Expensive 512 MiB cases may live in a labelled opt-in suite, but must be run before claiming completion.

## Assumptions

Items marked **Agreed** or **Owner-decided** are approved; any item still marked **Proposed default — unapproved** is not.

- **Agreed (not reopened)**: audio exclusion; independent 25 MiB defaults; 512 MiB maximum; MiB units.
- **Owner-decided (2026-11-13)** Numeric input: whole numbers 1–512 inclusive, entered in MiB with no unit suffix.
- **Owner-decided (2026-11-13)** Menu placement: terminal `/whatsapp` → Advanced → Media limits.
- **Owner-decided (2026-11-13)** Inbound-raise confirmation: every inbound increase to a value above 25 MiB (including from an already-raised value) shows a warning that every allowed contact/group may send files up to that size with no automatic retention, and requires explicit confirmation; cancelling or letting the confirmation expire changes nothing.
- **Owner-decided (2026-11-13)** Admission caps: at most 1 concurrent inbound and 1 concurrent explicit outbound non-audio transfer above 25 MiB (including unknown-size inbound per FR-012a); files ≤ 25 MiB keep current admission; automatic outputs keep their existing 4-job cap.
- **Owner-decided (2026-11-13)** Deadlines: inbound non-audio downloads above 25 MiB or of unknown size 10 minutes; inbound ≤ 25 MiB 60 seconds (new bound); outbound snapshot preparation 5 minutes, not shared with the 60-second conversion/thumbnail budget; caller wait for explicit non-audio sends above 25 MiB 10 minutes from start of transmission.
- **Owner-decided (2026-11-13)** Receipt-text scope: actual-size/location reporting and MiB terminology apply only to receipts above the 25 MiB processing ceiling; small-file receipt text (declared size or zero, KB/MB labels, no image location) is unchanged.
- **Owner-decided (2026-11-13)** SC-002: 16 MiB aggregate application-managed transfer-buffer budget per active large transfer (see SC-002).
- **Owner-decided (2026-11-13)**: malformed/unreadable limits refuse affected non-audio work with repair guidance (FR-005); no automatic sender reply for refusals (FR-017); published-but-unhanded files are kept unreported (FR-031). Unknown/dishonest size handling (FR-012a) and cleanup-failure handling (FR-014a, SC-004) were specified at owner request.
- Existing failure behavior: an unreadable configuration already leaves inbound allow-lists empty, so inbound transfers are already refused in that state; FR-005 mainly newly affects explicit outbound.
- No real account, provider upload, model download, speech-server start or live large-file transfer is authorized by this specification.
