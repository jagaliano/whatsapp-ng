# Research: Readable Markdown Tables (046)

All items resolved; no NEEDS CLARIFICATION remain. Source facts checked at `f385a24`.

## R1 — Integration seam
- **Decision**: Extend `formatWhatsAppText(text, options?)` with `{ tables?: boolean }` (default `true`); captions pass `false`.
- **Rationale**: All text callers (`whatsapp-ng.ts` `sendWithOwnership` line 172, reporting 202/213, optional outputs 250) already route through it; only the caption call (line 1002) must opt out. Phone-control replies bypass it already.
- **Alternatives**: separate `formatWhatsAppMessage()` wrapper (two names for one projection, easy to call the wrong one); per-caller flag inside services (spreads policy).

## R2 — Module and dependency direction
- **Decision**: New `src/services/whatsapp-table.ts` with class `MarkdownTableProjector`, constructed with a `LegacyTextRules` interface (`projectLine`, `unclosedCode`, `codeEnd`, `delimiter`, `isFenceOpener`) implemented in `whatsapp-text.ts`.
- **Rationale**: Avoids an import cycle, keeps the projector testable, satisfies DIP, leaves legacy helpers untouched.
- **Alternatives**: all code in `whatsapp-text.ts` (file triples, mixes responsibilities); exporting helpers directly (cycle when the formatter imports the projector).

## R3 — Cell splitting before inline parsing
- **Decision**: After trimming the row and one outer unescaped pipe at each end, scan once: count the backslash run immediately before each `|`; even → split, odd → keep pipe and drop one backslash. Then check each cell's code spans with `codeEnd` rules; unclosed → candidate fails (no whole-input return, since the raw line may be balanced).
- **Rationale**: Matches the GFM separator model the spec adopts and the golden cases (`a\|b`, `a\\|b`, three backslashes, `` `a|b` ``).

## R4 — Cell projection
- **Decision**: Dedicated scanner: backslash pairs copied verbatim; matched backtick runs → contents literal; bare `https?://[^\s<>]+` copied opaque; restricted link with exactly the legacy window: `]( ` searched by `delimiter(text, '](', i + 1, min(len, i + 513))` and accepted only when `labelEnd - i <= 512`, i.e. a label of at most **511** UTF-16 units; no `[` in the label; destination `^https?://[^\s()<>]+$` → `label (destination)`; label and strong content projected recursively with the legacy depth bound (`depth >= 4` returns the text unchanged, so at most four nested levels); `**`/`__` accepted under exactly today's boundary/escape/whitespace/unsupported-run tests → delimiters removed, content projected; everything else literal (`~~`, single `*`/`_`, images, HTML). **Correction (FR-013)**: images, HTML comments and HTML tags are opaque in cells and copied verbatim, so their inner `**`/`__` are never stripped. Image recognition is independent of the ordinary-link window: `![` copies through its label-closing `]`, found by one forward scan that skips backslash escapes and matched code spans and counts nested `[`/`]`. The scan refuses the cell (the candidate keeps legacy projection) on an unclosed code span or an unnested `]` not followed by `(`. It then copies through the destination's closing `)`. That `)` is found by one linear scan that counts balanced `(`/`)` and skips backslash-escaped characters. If no closing `)` exists, the boundary is undeterminable: the cell is refused and the whole candidate keeps its legacy projection rather than guessing. **Conservative refusal**: an image whose complete `![…](…)` span contains `"`, `'` or `<` is refused, so the candidate keeps legacy projection. Image titles and HTML inside labels can hide a false boundary, and they are deliberately not parsed. An image whose label never closes copies the rest of the cell literally; `<!--` copies through `-->`; `<` or `</` plus an ASCII letter copies through the closing `>`, respecting quoted attribute values. Any unclosed opener copies the rest of the cell literally. Each opener costs one forward search from its position, and scanning resumes past the copied text, so work stays bounded by the cell length with no repeated searches. The ordinary-link rule (label ≤ 511 units) is unchanged. Emphasis outside opaque constructs is still projected, and labeled lines still pass the fixed-point gate or fall back to legacy.
- **Rationale**: Inside a fenced box WhatsApp shows markers literally, so removal yields readable cells; reusing today's acceptance tests keeps recognition identical. Boundary regressions: 511-unit label projected, 512-unit label literal, in both legacy text and cells; nesting at depth 3/4/5. Labeled lines are then re-validated by R7, so a removed marker that legacy would reinterpret cannot slip through.

## R5 — Safety
- **Decision**: Reject candidate if any trimmed raw or projected cell matches `/[\p{Cc}\p{Bidi_Control}]/u`, contains `\u0060\u0060\u0060`, or `!isWellFormed()` (implemented as an equivalent lone-surrogate regex; the ES2022 `tsconfig` lib lacks `isWellFormed`).
- **Rationale**: Engine-native properties on the supported runtime; no data tables.

## R6 — Width approximation
- **Decision**: Iterate code points; a code point in the listed base ranges and not `\p{M}` counts 1; a U+0300–036F mark counts 0 only if the previous counted unit was a supported base or such a mark; anything else marks the cell "unsupported-width" (→ labeled text, content preserved). Row width = Σ(w+2)+n+1.
- **Rationale**: Fixed, deterministic, no grapheme database. Golden checks: `café`=4, `e`+U+0301=1, standalone U+0301 unsupported.

## R7 — Labeled-line fixed point and re-scan safety
- **Decision**: Accept labeled output only if every joined line `L` satisfies the spec's three checks: `projectLine(L) === L`, `!unclosedCode(L)`, `!isFenceOpener(L)` (existing `^ {0,3}(`{3,}|~{3,})` test). Checks run only after the R9 length preflight has accepted the whole segment.
- **Invariant (no extra check)**: a candidate needs a delimiter row of ≥ 2 cells, so every labeled line joins ≥ 2 pairs and contains at least one literal ` · `. U+00B7 cannot appear in a cell matching `:?-+:?`, so a labeled line is never delimiter-shaped and a second pass cannot form a new table candidate from labeled lines alone; FR-025 holds without an additional rejection rule.
- **Rationale**: These are exactly the spec's checks (FR-024). Together with the separator invariant they give segment-local stability (FR-025).
- **Box stability**: box is a plain triple-backtick fence without language, cell text never contains three U+0060 (unsafe), body lines start with box characters, so legacy fence handling reproduces it exactly.

## R8 — Line endings
- **Decision**: Keep the existing `/[^\n]*\n|[^\n]+$/g` split and `/\r?\n$/` ending extraction (lone CR stays content). Box: opener and internal lines use the header's ending; closing fence uses the last consumed line's ending (empty at EOF). Labeled: each line uses its body row's ending.

## R13 — First-line rendering workaround (T044, owner-approved 2026-11-13)
- **Observed** (operator screenshots on iPhone; same result reported on WhatsApp Web): in a code block whose first line is the top border, that line rendered shifted relative to the vertical borders, while an identical border in a later position aligned. An ASCII word as the first line aligned the whole grid; a leading blank line and putting the opening backticks on the border line did not. The emitted widths and code points were verified correct.
- **Decision**: a fixed literal `---` first line inside every generated box block. No heading text, hidden characters, spacing changes or ASCII substitution. Not applied to labeled text, captions or existing code blocks.
- **Accepted (2026-11-13)**: operator acceptance passed on iPhone and WhatsApp Web (six screenshots reviewed).
- **Unconfirmed**: the internal cause (hypothesis: the first line selects the block's font or line metrics) and the behavior on Android. Alignment remains client- and font-dependent.
- **Budget**: `boxSize` adds `3 + headerEnding.length` before materialization.

## R9 — Output budget, implicit missing cells and preflight order
- **Decision**: Body rows store only their present cells; missing trailing cells are implicit empty values and are never allocated. All per-table arithmetic is O(header cells + present body cells):
  - Labeled row size = `base + Σ_present (pairLen(h_j, v_j) − pairLen(h_j, '')) + ending`, where `base = Σ_j pairLen(h_j, '') + 3·(n − 1)` is computed once from the header (`pairLen(h,'') = h ? h.length + 1 : 0`; `pairLen(h,v) = h ? h.length + 2 + v.length : v.length` for nonempty v).
  - Box: column widths from header + present cells (implicit cells width 0); size = (rows + 4)·(rowWidth + headerEnding.length) + fence lengths, computed arithmetically.
  - Order: structure → split → code-span closure → projection → safety → width class → layout choice → **length preflight against remaining budget** → (labeled only) build each joined line and run R7 checks → emit. If `used + size > 65,536`, return original input before any joined line, padding or border string exists. Legacy line lengths are added as produced (each ≤ its input line). Equality allowed.
- **Adversarial regression**: ~50,004-unit input with a 10,000-column header/delimiter and 5,000 one-cell short rows. Padding would need 50 M slots; implicit cells keep work proportional to input, preflight shows labeled output ≫ 65,536 (≈ 30,000 separator units per row), and the original input is returned within the test timeout.
- **Outcome handling**: box → emit fenced box; labeled → emit lines after gate; legacy → emit each run line via `projectLegacyLine` (counted against the budget); whole-input refusal (raw unclosed code in run/later prose, or any budget overflow) → return the original input, discarding all prepared output.
- **Non-expansion evidence**: source rationale below plus explicit assertions on the frozen legacy fixtures (`formatWhatsAppText(x, { tables: false }).length <= x.length`). Assertions cover fixtures only; they are not a proof for all inputs.
- **Rationale**: Prevents the repeated-long-header blow-up (e.g. 5 KB header × 100 rows) from allocating. At `f385a24`, legacy output length ≤ input length (`**`→`*`, `[l](u)`→`l (u)`, `# h`→`*h*`, fence tag removal), so the guard is a no-op without tables; skipping it for `tables: false` keeps captions provably unchanged.

## R10 — Run termination and failure resumption
- **Decision**: Run = header + delimiter + maximal consecutive row candidates. Validate whole run; on failure project every run line legacy-style and continue at the line after the run. Mismatch case consumes only the header line.

## R11 — Tests and timeout
- **Decision**: Vitest default 5 s timeout, no benchmark framework. Adversarial fixtures: long header × many rows exceeding the cap (expect original), 10,000-column × 5,000 short-row input (R9), exact-65,536 output, many short candidate runs near input limit.

## R12 — Production-entry RPC evidence
- **Decision**: Keep mocked-entry tests in `whatsapp-ng.extension.test.ts`, and add an isolated actual Pi RPC test in `tests/unit/phone-control.rpc.test.ts` that spawns `pi --mode rpc --no-extensions` with `tests/fixtures/phone-control-rpc.extension.ts` (synthetic `fixture-phone` provider), the synthetic Baileys transport `tests/fixtures/phone-control-baileys.mjs` and the existing preload/network guards. A new fixture mode (`WA_PHONE_RPC_OPTIONAL=tables`) makes the synthetic model call `send_wa_message` with a table and `send_wa_media` (`type: 'document'`) on a synthetic local `.txt` file created in the disposable workspace, with a table caption.
- **Offline document path**: production `OutgoingMediaService.prepare()` stays unchanged. Only in that mode, the synthetic transport's `sendMessage` branch for `content.document` records the actual received `content.caption` (and `kind: 'document'`) in `metrics.sends` and returns a synthetic `documentMessage` without calling `generateWAMessageContent` or any Baileys media upload. The transport never hardcodes the expected caption; the test computes it with `formatWhatsAppText(caption, { tables: false })`.
- **Assertions**: recorded text equals the rendered box; recorded caption equals the legacy projection (heading/link/emphasis formatted, no table extraction); the existing `networkPath` guard (`tests/unit/phone-control.rpc.test.ts:46`) remains active and the test asserts its output `networkAttempts === 0`.
- **Rationale**: Proves the actual composition root wires the opt-out, not only the mocked entry.
