# Feature Specification: Readable Markdown Tables in WhatsApp Text Messages

**Feature Branch**: `046-whatsapp-table-rendering` (spec folder only; no branch created)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Make Markdown pipe tables readable in WhatsApp text messages, without images or new dependencies." (full description retained in the invoking request; all of its rules are captured below.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Narrow table becomes an aligned box (Priority: P1)

A phone user receives an assistant answer containing a small Markdown table. Instead of raw pipes and a delimiter row, they see a monospace box with aligned columns and a separated header.

**Why this priority**: Core readability gain for the most common case.

**Independent Test**: Send text containing a 2–4 column table of supported characters whose box fits in 28 columns; compare against a golden box output.

**Acceptance Scenarios**:

1. **Given** a valid 3-column ASCII table whose box width is ≤ 28, **When** the text is projected for display, **Then** it becomes an unlabeled triple-backtick fence containing top border, header, separator, body rows and bottom border using single-line box characters, with exactly one padding space on each side of every cell.
2. **Given** a table whose box width is exactly 28, **When** projected, **Then** the box is used; **Given** width 29, **Then** labeled text is used.
3. **Given** delimiter alignments `---`, `:---`, `---:`, `:---:`, **When** projected, **Then** header and body cells are left, left, right and centered (odd spare space on the right).
4. **Given** the rendered box, **When** projected again, **Then** the box segment is unchanged.

---

### User Story 2 - Wide or unsupported-width table becomes labeled rows (Priority: P1)

A valid, safe table that is too wide, has more than four columns, or contains emoji/CJK/other unsupported-width characters becomes one prose line per body row, e.g. `Name: Ana · Age: 30`.

**Why this priority**: Wide tables are common; data must survive without box misalignment.

**Independent Test**: Golden-string comparison for wide, 5-column, emoji and CJK tables, including empty and duplicate headers and short rows.

**Acceptance Scenarios**:

1. **Given** a 5-column table, **When** projected, **Then** each body row becomes one line of ordered `Header: value` pairs joined by ` · `, ending with that row's original line ending.
2. **Given** an empty value, **Then** the pair is `Header:`; **given** an empty header, **Then** the value alone; **given** both empty, **Then** an empty pair with its separators preserved; duplicate headers repeat as written.
3. **Given** a short body row, **Then** missing cells are treated as empty.
4. **Given** a generated line that today's projection would alter, that contains an unclosed code span, or that looks like a fence opener, **Then** the whole candidate keeps today's projection.

---

### User Story 3 - Malformed, unsafe or oversized input fails safe (Priority: P2)

Content is never dropped or guessed: malformed or unsafe candidates keep today's display projection; whole-input guards return the exact original input.

**Independent Test**: Fixtures for header-only tables, adjacent tables, over-wide body rows, delimiter-shaped body rows, control/bidi characters, unclosed cell code, resource limits.

**Acceptance Scenarios**:

1. **Given** two tables with no blank line between them, **Then** the whole run keeps today's per-line projection; separated by a blank line, each is independent.
2. **Given** a cell with a control, bidi control, unpaired surrogate or triple backticks, **Then** the candidate keeps today's projection.
3. **Given** output that would exceed 65,536 UTF-16 units, **Then** the exact original input is returned; exactly 65,536 succeeds.
4. **Given** an unclosed inline code span in later prose outside fences, **Then** the existing whole-input rule returns the original input, taking precedence over table output.

---

### User Story 4 - Everything else is unchanged (Priority: P2)

Non-table text, protected code, media captions, phone-control replies and speech eligibility behave exactly as today.

**Independent Test**: Existing tests pass unchanged except the one raw-table expectation; caption test shows a table stays as today's caption output while a text-message caller renders it.

**Acceptance Scenarios**:

1. **Given** a media caption containing a table, **Then** no table extraction occurs and heading/link/emphasis formatting and limits are unchanged.
2. **Given** a table inside a fence (including an unmatched opener protecting the rest) or indented by a tab / ≥ 4 spaces, **Then** it is not extracted.

### Golden Examples (approved)

`\n` denotes LF; backslashes are literal. These define expected behavior; they are not evidence of an executed test.

**Basic box and explicit alignment** — input:

````text
| Key | Value |
|---|---:|
| n | 42 |
````

Expected output (no trailing newline when the input has none):

`````text
```
---
┌─────┬───────┐
│ Key │ Value │
├─────┼───────┤
│ n   │    42 │
└─────┴───────┘
```
`````

The `---` line is the T044 workaround (FR-022), not a frame row. Line width is 15 including borders; `Value` fills its column, so right alignment adds nothing beyond the one-space padding on each side.

**Emoji/CJK fallback** — input (LF, no final newline):

````text
| A | B |
|---|---|
| 👋 | 日本語 |
````

Expected: `A: 👋 · B: 日本語` (no final newline).

### Edge Cases

- CRLF vs LF vs lone CR (content); final newline presence preserved; closing fence inherits the last consumed line's ending (none at EOF); internal box lines use the header line's ending.
- Prose containing a pipe right after a table is a body row; a blank line separates it.
- Header/delimiter cell-count mismatch is not a candidate; scanning continues at the next line.
- Failure resumes extraction after the whole run, never at an interior row.
- Escaped pipes (`\|`, odd backslash runs) stay in cell with one backslash removed; even runs split.
- `` `a|b` `` splits into an unclosed cell code span → candidate fails, without triggering the whole-input guard.
- Bare URLs with marker-looking characters remain opaque.
- Combining marks: zero width only when attached to a supported base; standalone → labeled text.
- Deliberately repeated long header near the output limit must not allocate oversized intermediates and must finish within the existing test timeout.

## Requirements *(mandatory)*

### Functional Requirements

**Scope**

- **FR-001**: Table rendering MUST apply unconditionally to text-message display projection only, via the existing text-projection seam, with no setting or new localized string.
- **FR-002**: Media captions MUST NOT have tables extracted; their existing formatting and input limits remain (an explicit caption opt-out is allowed).
- **FR-003**: No images/PDF, new dependency, font, network/filesystem access, media, routing, consent, transport-policy or speech change.

**Detection**

- **FR-004**: Lines end in LF or CRLF (removed for parsing); lone CR is content. Untouched endings and final-newline presence are preserved.
- **FR-005**: Existing fence traversal is preserved, including unmatched openers; no extraction inside protected fences or from lines starting with tab or ≥ 4 spaces.
- **FR-006**: A row candidate is a nonblank line with 0–3 leading spaces and ≥ 1 unescaped pipe that, after indentation, does not start with `>`, `#`, a backtick/tilde fence opener, `-`/`+`/`*` + space/tab, or 1–9 digits + `.`/`)` + space/tab.
- **FR-007**: A delimiter row is a row candidate with ≥ 2 cells all matching `:?-+:?`. A header followed immediately by a delimiter row of equal cell count starts a candidate.
- **FR-008**: Body rows are consecutive following row candidates; the first non-row line or EOF ends the candidate and is not consumed.
- **FR-009**: Header-only tables, a body row wider than the header, or a delimiter-shaped body row invalidate the whole candidate. Short rows are padded with empty cells.
- **FR-010**: On failure the full run gets today's per-line projection; extraction resumes after the run.

**Cells**

- **FR-011**: Trim row spaces/tabs, remove at most one leading and one trailing unescaped pipe, split at pipes preceded by an even backslash run, before inline parsing (including inside code/links). Odd-run pipes stay with one backslash removed; other backslashes preserved. Cells trimmed of spaces/tabs; inline-code contents are not trimmed.
- **FR-012**: Matched exact-length backtick runs (today's rules) are unwrapped with literal contents; an unclosed cell code span fails the candidate.
- **FR-013**: Outside code, only today's restricted HTTP(S) link shape becomes `label (address)`; destination is never dropped; bare URLs opaque; images, HTML and other links literal.
- **FR-014**: Only balanced `**`/`__` recognized under existing limits are removed; single `*`/`_`, `~~strike~~`, unsupported runs and punctuation preserved; no global marker stripping.
- **FR-015**: Cells/headers are positional: no dedupe, reorder, abbreviation, summary or numeric normalization.
- **FR-016**: A candidate is unsafe if any trimmed raw or projected cell contains a Cc control (incl. interior tab, lone CR), unpaired surrogate, Bidi_Control char, or three consecutive U+0060 characters; unsafe candidates get today's projection.
- **FR-017**: The existing whole-input unclosed-inline-code check still covers raw lines outside fences, including consumed table lines, and overrides table output; it never scans inside fence bodies.

**Box**

- **FR-018**: Box only for 2–4 columns, safe cells, supported characters, and line width ≤ 28; no wrapping, truncation or row cutoff.
- **FR-019**: Supported bases: U+0020–007E; U+00A0–024F except U+00AD; U+0370–03FF; U+0400–04FF; U+2010–2027; U+2030–205E except U+203C, U+2049; U+20A0–20C0; combining marks are never bases. A base counts 1; U+0300–036F marks count 0 only when attached to a supported base (possibly after other such marks). Anything else selects labeled text, preserving content.
- **FR-020**: Column width = widest projected cell (min 0). Every boxed cell (header and body) MUST have exactly one padding space on each side, with alignment padding added inside that margin. Row width = Σ(width+2) + n + 1; borders equal width.
- **FR-021**: Alignment from delimiter only; centered odd spare goes right.
- **FR-022**: Output fence is triple backtick without language; internal lines use the header's ending; closing fence uses the last consumed line's ending. **T044 (owner-approved 2026-11-13)**: the first line inside the box block is a fixed literal `---` line, before the top border. It is not part of the frame: the 28-column limit and widths apply to frame rows only. It is counted in output size, and labeled text, captions and existing code blocks never get it. Reason: on iPhone and WhatsApp Web, a first block line made of box-drawing characters rendered misaligned, while the same line in another position aligned. The internal cause is unconfirmed, and Android is untested.

**Labeled text**

- **FR-023**: For a valid safe table failing only width/column-count/character checks, emit one line per body row with pairs joined by ` · ` per the pair rules in Story 2, using each row's original ending.
- **FR-024**: Each complete generated line must be unchanged by today's heading+inline projection, have no unclosed code span, and not be a fence opener; otherwise the whole candidate keeps today's projection. No escaping to force a pass; non-table inline projection unchanged.
- **FR-025**: Generated box and fallback segments are stable under another projection pass (segment-local guarantee only).

**Atomicity & limits**

- **FR-026**: Existing NUL, input > 65,536 UTF-16 units and unclosed-code guards return the exact original input; additionally, prospective total output > 65,536 units returns the original. Equal to 65,536 is allowed.
- **FR-027**: All output is counted; repeated-header and padding lengths are preflighted; budget checked before every addition; no oversized intermediates, partial results, truncation or retry.
- **FR-028**: Added scanning/layout/storage bounded by input size plus output ceiling; legacy inline cost retained, not refactored.
- **FR-029**: Synchronous, pure, deterministic on the supported runtime; never throws on unsupported content.

**Documentation**

- **FR-030**: Add a short public display-formatting note and a changelog entry; preserve speech statements; portrait-phone appearance remains an operator check.

### Key Entities

- **Table candidate**: header row, delimiter row (alignments), body rows, original line endings, run boundaries.
- **Cell**: raw trimmed text, projected display value, display width or unsupported flag, safety flag.
- **Rendering outcome**: box, labeled text, or legacy projection (per candidate); original input (whole-input refusal).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of golden box fixtures produce lines ≤ 28 columns; 28-wide fits, 29-wide uses labeled text.
- **SC-002**: 100% of fixtures preserve every projected header and body value positionally (golden strings, incl. empty/duplicate headers and short rows).
- **SC-003**: Zero fixtures lose content: emoji/CJK data appears in labeled text; unsafe/unstable candidates match today's projection.
- **SC-004**: All tests pass, including the revised raw-table assertion; unrelated assertions and speech-eligibility tests remain unchanged.
- **SC-005**: Output of exactly 65,536 units is returned rendered; 65,537 returns the original input; near-limit adversarial fixture completes within the existing test timeout.
- **SC-006**: Second projection pass leaves 100% of generated box/fallback segments unchanged.
- **SC-007**: Caption fixture with a table matches today's caption output exactly, while a text-message caller renders it.

## Assumptions

- Implementation extends the existing projection in `src/services/whatsapp-text.ts`; no new spec-level behavior beyond the description.
- "Today's projection" / "existing" / "legacy" behavior means the display projection as of commit `f385a24` (package 1.1.10): the heading-plus-inline per-line formatter, its fence traversal and its input/unclosed-code guards, including its non-idempotent behavior on non-table text.
- Width approximation targets common phone monospace fonts; real-device alignment is an operator acceptance check, not unit-test evidence.
- Determinism is claimed for the project's supported Node 26 runtime only.
