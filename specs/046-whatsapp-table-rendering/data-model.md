# Data Model: Readable Markdown Tables (046)

Pure in-memory values; nothing is persisted.

## SourceLine
- `body: string` (line without LF/CRLF), `ending: '' | '\n' | '\r\n'`.

## RowCandidate (classification of a SourceLine)
- Rules: 0–3 leading spaces, nonblank, ≥1 unescaped `|`; after indent not `>`, `#`, fence opener, `[-+*][ \t]`, `[0-9]{1,9}[.)][ \t]`.
- `isDelimiter`: ≥2 cells, each trimmed cell matches `^:?-+:?$`.

## Alignment
- `'left' | 'right' | 'center'` from delimiter cell: `---`/`:---` left, `---:` right, `:---:` center.

## Cell
- `raw: string` (trimmed, pipe-unescaped), `display: string` (projected), `width: number | 'unsupported'`.
- Validation: closed code spans; safe (no Cc, Bidi_Control, U+0060×3, lone surrogate) for both `raw` and `display`.

## TableCandidate
- `lines: SourceLine[]` (full run), `header: Cell[]`, `alignments: Alignment[]`, `body: Cell[][]` holding only present cells per row (length ≤ header length); missing trailing cells are implicit empty values, never materialized.
- Invalid if: no body rows; any body row has more cells than header; any body row delimiter-shaped; any unclosed cell code span; any unsafe cell.

## Layout (discriminated union)
- `{ kind: 'box', columnWidths: number[], size: number }` — 2–4 columns, all widths supported, row width ≤ 28.
- `{ kind: 'labeled', size: number }` — valid, safe, fails only box eligibility; all generated lines pass the fixed-point gate.
- `{ kind: 'legacy' }` — per-candidate refusal.
- Whole-input refusal (`unclosedCode` in run or later prose, budget overflow) is signaled to the formatter, which returns the original text and discards prepared output. Legacy-run output is counted against the budget like every other segment.

## State transitions per run
`detected → (unclosed raw code → REFUSE INPUT) → structurally valid? → split/projected → safe? → box-eligible? box : (box | labeled-candidate) → preflight size within budget? (no: REFUSE INPUT) → labeled: build lines + fixed-point gate? labeled : legacy → emit`

## Preflight sizes (before any string is built)
- `labeledBase = Σ_j pairLen(header_j, '') + 3·(n−1)`; row size adds deltas for present nonempty cells and the row ending.
- Box size from column widths (implicit cells width 0) and the header ending.
- Cost O(header + present cells), independent of rows × columns.

## Labeled-line invariant
- n ≥ 2 ⇒ every line contains ` · ` ⇒ never delimiter-shaped (no extra check).

## OutputBudget
- `limit = 65_536`, `used: number`; `fits(n)` before every addition.
