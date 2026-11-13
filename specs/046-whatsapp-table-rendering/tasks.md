# Tasks: Readable Markdown Tables in WhatsApp Text Messages

**Input**: `specs/046-whatsapp-table-rendering/` — [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/table-projection.md](contracts/table-projection.md), [quickstart.md](quickstart.md). Legacy baseline: `f385a24`.

**Tests**: REQUIRED. Regression-first per AGENTS.md "Validation" and plan "Testing Strategy": each test task is written and observed failing (or, for legacy-preservation tests, passing against `f385a24` behavior) before its implementation task. The isolated actual Pi production-entry RPC test (T032) is mandatory; a missing fixture capability is a blocker, not a waiver. Generic template "optional tests" wording does not apply.

**Authorization**: No implementation is authorized by this file. Run `/speckit.analyze` (read-only) and obtain explicit implementation authorization first. No commits, branches, dependency installs, real accounts, providers or network.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Record the baseline: run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck` on the unmodified tree and note results/skips in `specs/046-whatsapp-table-rendering/tasks.md` § Validation Evidence (no source change).

## Phase 2: Foundational (blocks all stories)

- [X] T002 Add legacy-freeze regressions (expected to PASS before and after the feature) in `tests/unit/whatsapp-text.test.ts`: link label of 511 UTF-16 units is projected, 512 stays literal; nested link/strong at depth 3/4/5 match current output; `formatWhatsAppText(x, { tables: false })` equals `formatWhatsAppText(x)` at `f385a24` for every existing fixture string in the file, and assert non-expansion `formatWhatsAppText(x, { tables: false }).length <= x.length` for each frozen fixture (research R1, R4, R9). Do not modify existing assertions except line 110 (handled in T012).
- [X] T003 In `src/services/whatsapp-text.ts`, add `export interface WhatsAppTextOptions { readonly tables?: boolean }` and signature `formatWhatsAppText(text: string, options: WhatsAppTextOptions = {})`; extract the existing per-line heading+inline branch (lines 26–30) into `projectLegacyLine(body: string, end: string): string` with byte-identical behavior; export a `LegacyTextRules` object implementing `projectLine`, `unclosedCode`, `codeEnd`, `delimiter`, `isFenceOpener` (`/^ {0,3}(`{3,}|~{3,})/`). No other behavior change; T002 must still pass.
- [X] T004 Create `src/services/whatsapp-table.ts` skeleton: `export interface LegacyTextRules` (as above), `type Alignment = 'left' | 'right' | 'center'`, readonly `Cell { raw: string; display: string; width: number | 'unsupported' }`, `TableCandidate { lines; header: Cell[]; alignments: Alignment[]; body: Cell[][] }` where body rows hold "only present cells per row (length ≤ header length); missing trailing cells are implicit empty values, never materialized", discriminated `Layout = { kind: 'box'; columnWidths: number[]; size: number } | { kind: 'labeled'; size: number } | { kind: 'legacy' }`, and class `MarkdownTableProjector` constructed with `LegacyTextRules` (data-model.md). Strict types, no `any`, `.js` imports.

- [X] T005 Write failing foundational unit tests in `tests/unit/whatsapp-table.test.ts` for the safety predicate (research R5: Cc incl. interior tab/lone CR, Bidi_Control, `\u0060\u0060\u0060`, unpaired surrogate → unsafe; plain ASCII/emoji safe) and the `OutputBudget` (`limit = 65_536`; `fits(n)` true at exact limit, false at +1; `add` rejects overflow without materializing).
- [X] T006 Implement in `src/services/whatsapp-table.ts` the safety predicate (`/[\p{Cc}\p{Bidi_Control}]/u`, `\u0060\u0060\u0060`, `!isWellFormed()`) and `OutputBudget` (`used`, `fits(n)`, `add(segment)`), and in `src/services/whatsapp-text.ts` route every pushed segment through the budget when tables are enabled, with overflow → return the original input. Define outcome handling now: `box` → emit box; `labeled` → emit gated lines; `legacy` → emit each run line via `projectLegacyLine` (counted); whole-input refusal (raw unclosed code, budget overflow) → return original input, discarding prepared output (research R9). T002 and T005 must pass.

**Checkpoint**: existing suite green; safety and budget prerequisites complete; no visible behavior change (rendering not yet wired).

## Phase 3: User Story 1 — Narrow table becomes an aligned box (P1) 🎯 MVP

**Goal**: valid 2–4-column supported-width table with row width ≤ 28 renders as an unlabeled fenced box.
**Independent test**: golden basic box from spec; 28 fits, 29 does not box.

### Tests (write first, must fail)

- [X] T007 [US1] In `tests/unit/whatsapp-table.test.ts` add golden basic box (spec "Golden Examples": `| Key | Value |\n|---|---:|\n| n | 42 |` → exact 7-line fenced box, width 15, no trailing newline) and second-pass stability (`format(format(x)) === format(x)` for the segment).
- [X] T008 [US1] In `tests/unit/whatsapp-table.test.ts`: alignment fixtures `---`, `:---`, `---:`, `:---:` with odd centered spare on the right; one padding space each side of every cell; three columns with widths 6,6,6 → row width 28 boxed; widths 6,6,7 → 29 not boxed; `café` width 4 and `e`+U+0301 width 1 boxed.
- [X] T009 [US1] In `tests/unit/whatsapp-table.test.ts`: line endings — CRLF input → opener/internal lines use header's CRLF; closing fence inherits last consumed line's ending; no final newline stays absent; lone CR elsewhere unchanged.
- [X] T010 [US1] In `tests/unit/whatsapp-table.test.ts`: cell splitting/projection — `| a\|b | c |` → `a|b`,`c`; `| a\\|b | c |` → 3 cells → whole run legacy; three backslashes keep the pipe with two backslashes; `` `a\|b` `` → literal `a|b`; multi-backtick exact-run spans; `[a\|b](https://example.test)` → `a|b (https://example.test)`; bare `https://example.test/**path**` unchanged; `**x**`/`__x__` delimiters removed under legacy limits; single `*`/`_`, `~~s~~`, images, HTML literal; 511-unit cell link label projected, 512 literal.
- [X] T011 [US1] In `tests/unit/whatsapp-table.test.ts`: detection — 0–3 leading spaces accepted; tab/4-space, `>`, `#`, fence-opener, `- `/`+ `/`* `, `1. `/`1) ` lines not row candidates; tables inside fences and after an unmatched opener not extracted; header/delimiter count mismatch → normal scan at next line; pipe prose directly after a table joins the run, after a blank line it does not.
- [X] T012 [US1] Update `tests/unit/whatsapp-text.test.ts:110` so `| A | B |\n|---|---|\n| x | y |` expects the rendered box; leave every other assertion untouched.

### Implementation

- [X] T013 [US1] In `src/services/whatsapp-table.ts` implement row classification: row candidate (nonblank, ≤3 leading ASCII spaces, ≥1 unescaped pipe, exclusions per data-model "RowCandidate") and `isDelimiter` ("≥2 cells, each trimmed cell matches `^:?-+:?$`"); alignment from delimiter cells.
- [X] T014 [US1] In `src/services/whatsapp-table.ts` implement cell splitting (research R3): trim ASCII space/tab, strip ≤1 leading/trailing unescaped pipe, split at pipes preceded by even backslash runs, odd run keeps pipe minus one backslash, trim cells; then per-cell code-span closure via `rules.codeEnd` (unclosed → candidate legacy, not original input).
- [X] T015 [US1] In `src/services/whatsapp-table.ts` implement cell projection (research R4): backslash pairs verbatim; matched backtick runs → contents literal; bare URL `^https?:\/\/[^\s<>]+` opaque; link via `rules.delimiter(text, '](', i + 1, Math.min(len, i + 513))` accepted only if `labelEnd - i <= 512` (label ≤ 511 units), no `[` in label, destination `^https?:\/\/[^\s()<>]+$` → `label (destination)`; `**`/`__` with exactly legacy boundary/escape/whitespace/unsupported-run tests → delimiters removed; recursion stops at `depth >= 4`.
- [X] T016 [US1] In `src/services/whatsapp-table.ts` implement width (research R6): listed base ranges (spec FR-019) excluding `\p{M}`, U+00AD, U+203C, U+2049 count 1; U+0300–036F count 0 only after a supported base or such mark; anything else → `'unsupported'`.
- [X] T017 [US1] In `src/services/whatsapp-table.ts` implement run collection (header + delimiter + maximal consecutive row candidates) and structural validation (no body rows, row wider than header, delimiter-shaped body row → legacy for the whole run); body rows store present cells only.
- [X] T018 [US1] In `src/services/whatsapp-table.ts` implement box layout: eligibility 2–4 columns, all widths numeric, `Σ(w+2)+n+1 ≤ 28`; column width = max over header and present cells (implicit cells 0); arithmetic size preflight `(rows + 4)·(rowWidth + headerEnding.length)` + fence lengths checked with `OutputBudget.fits` before building; render `┌─┬┐ │ ├─┼┤ └─┴┘` with one padding space per side, alignment inside, closing fence with last line's ending.
- [X] T019 [US1] In `src/services/whatsapp-text.ts` wire the projector into the line loop when `options.tables !== false`: before the per-line branch, detect a run; check every run raw line with `unclosedCode` (hit → return original text); reject unsafe candidates with the foundational safety predicate (legacy run); emit box or legacy run via `projectLegacyLine`, all through `OutputBudget`; resume after the run; fence traversal untouched.

**Checkpoint**: T007–T012 pass; whole suite green.

## Phase 4: User Story 2 — Wide/unsupported-width table becomes labeled rows (P1)

**Goal**: valid safe table failing only box eligibility → one ` · `-joined line per body row.
**Independent test**: golden `A: 👋 · B: 日本語`.

### Tests (write first)

- [X] T020 [US2] In `tests/unit/whatsapp-table.test.ts`: golden emoji/CJK fallback (`| A | B |\n|---|---|\n| 👋 | 日本語 |` → `A: 👋 · B: 日本語`, no final newline); 5-column table; width-29 table; `❤`, `❤️`, family emoji, flag, keycap, standalone U+0301 → labeled; second-pass stability of labeled lines.
- [X] T021 [US2] In `tests/unit/whatsapp-table.test.ts`: pair rules — empty header + `x` with `B`/`1` → `x · B: 1`; `Header:` for empty value; two empty pairs keep both separators; duplicate headers repeat; short rows produce `Header:` pairs; per-row original endings (LF/CRLF/none). Assert golden strings, never reparse.
- [X] T022 [US2] In `tests/unit/whatsapp-table.test.ts`: unstable labeled lines → whole run legacy (including original inline-code backticks): five-column row with code `` `**x**` ``; markup pairing across cells; a line starting with a recognized tilde fence opener.

### Implementation

- [X] T023 [US2] In `src/services/whatsapp-table.ts` implement labeled preflight (research R9): `labeledBase = Σ_j pairLen(header_j, '') + 3·(n−1)` with `pairLen(h,'') = h ? h.length + 1 : 0`, `pairLen(h,v) = h ? h.length + 2 + v.length : v.length`; per-row size adds present-cell deltas and ending; total checked with `OutputBudget.fits` before any joined line exists.
- [X] T024 [US2] In `src/services/whatsapp-table.ts` implement labeled build and gate (research R7), only after preflight acceptance: per row join pairs with ` · `; accept only if every line `L` has `rules.projectLine(L) === L`, `!rules.unclosedCode(L)`, `!rules.isFenceOpener(L)`; otherwise legacy run. No delimiter-row check (invariant: n ≥ 2 ⇒ every line contains ` · `); document the invariant in a one-line comment.

**Checkpoint**: US1 + US2 tests pass.

## Phase 5: User Story 3 — Malformed, unsafe or oversized input fails safe (P2)

**Independent test**: negatives and limit boundaries return legacy run or exact original input.

### Tests (write first)

- [X] T025 [US3] In `tests/unit/whatsapp-table.test.ts`: header-only; two tables without blank line (one failed run, legacy); two blank-separated tables (independent); over-wide body row (whole run legacy, no suffix extraction); delimiter-shaped body row; `` `a|b` `` cell → legacy run, not original input; later prose unclosed `` ` `` → original input even after a rendered table.
- [X] T026 [US3] In `tests/unit/whatsapp-table.test.ts`: unsafe cells (interior tab, lone CR, U+202E/U+2066 Bidi_Control, lone surrogate, three consecutive U+0060 in raw or projected) → legacy run.
- [X] T027 [US3] In `tests/unit/whatsapp-table.test.ts`: limits — output exactly 65,536 units rendered, 65,537 → original (count CRLF and supplementary chars as 2 units); input 65,536 vs 65,537 and NUL guards tested separately; long repeated header × many rows → original; 50,004-unit input with 10,000-column header/delimiter and 5,000 one-cell rows → original, within default timeout (research R9/R11).
- [X] T028 [US3] In `tests/unit/whatsapp-table.test.ts`: deterministic malformed/mixed/surrogate-heavy fixtures (unpaired high/low surrogates in cells and prose, mixed CRLF/LF/lone CR, unbalanced pipes/backticks/brackets, near-limit repeats built with `String.repeat`): assert `expect(() => format(x)).not.toThrow()` and `format(x) === format(x)` on repeated calls (FR-029). No new testing dependency.

### Implementation

- [X] T029 [US3] Fix any gaps exposed by T025–T028 in `src/services/whatsapp-table.ts` / `src/services/whatsapp-text.ts` without changing foundational semantics (safety predicate, budget, outcome handling).

**Checkpoint**: all unit tests pass within default timeout.

## Phase 6: User Story 4 — Everything else unchanged (P2)

**Independent test**: captions keep legacy output through both mocked and actual entries.

### Tests (write first)

- [X] T030 [P] [US4] In `tests/unit/whatsapp-ng.extension.test.ts` (mocked entry): `send_wa_message` with a table sends the rendered box; `send_wa_media` with caption `# T\n| A | B |\n|---|---|\n| x | y |` sends `*T*\n| A | B |\n|---|---|\n| x | y |` (legacy heading formatting, no extraction). Reuse existing synthetic workspace file setup (around line 333).
- [X] T031 [US4] Extend fixtures offline (research R12): in `tests/fixtures/phone-control-rpc.extension.ts` add mode `WA_PHONE_RPC_OPTIONAL=tables` where the synthetic `fixture-phone` model calls `send_wa_message` with a table and `send_wa_media` with `type: 'document'` on a synthetic `.txt` file created in the disposable workspace, with a table caption; in `tests/fixtures/phone-control-baileys.mjs` add a branch scoped to that mode for `content.document` that records the actual `content.caption` and `kind: 'document'` in `metrics.sends` and returns a synthetic `documentMessage` without `generateWAMessageContent` or Baileys media upload. Do not hardcode the expected caption in the transport. Production `OutgoingMediaService` unchanged; existing preload network guards retained.
- [X] T032 [US4] In `tests/unit/phone-control.rpc.test.ts` add an isolated actual Pi RPC test (disposable HOME/`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`, `--no-extensions -e` production entry as existing tests do) asserting recorded text equals the rendered box and recorded caption equals `formatWhatsAppText(caption, { tables: false })` computed in the test; reuse the existing `networkPath` guard output (`tests/unit/phone-control.rpc.test.ts:46`) and assert `JSON.parse(await readFile(networkPath, 'utf8')).networkAttempts === 0` (research R12).

### Implementation

- [X] T033 [US4] In `whatsapp-ng.ts` line ~1002 change the caption call to `formatWhatsAppText(params.caption, { tables: false })`; leave `sendWithOwnership`, reporting and optional-output callers on the default. No routing/delivery-policy change.
- [X] T034 [US4] Confirm `tests/unit/final-output.service.test.ts` speech-eligibility table test (lines ~171–172) is unchanged and passing; do not edit it.

## Phase 7: Polish & Cross-Cutting

- [X] T035 [P] Add a short display-formatting note in `docs/reference.md` (and one sentence in `README.md` if a display section exists): text-message tables become a box or labeled lines; captions unchanged; phone font alignment is not guaranteed. Preserve existing speech statements.
- [X] T036 [P] Add an `## Unreleased` entry in `CHANGELOG.md` linking `specs/046-whatsapp-table-rendering/tasks.md`; state operator portrait-phone acceptance pending.
- [X] T037 Run `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`, and `git diff --exit-code -- package.json package-lock.json` (must be unchanged, FR-003); check changed Markdown links; record exact commands, results, skips and platform in § Validation Evidence below.
- [X] T038 Constitution re-check against plan Complexity Tracking; record any new deviation in `plan.md`.

## Dependencies

- Phase 1 → Phase 2 (T002–T006: legacy freeze, seam, skeleton, safety predicate, output budget, outcome handling) → US1 → US2 → US3 → US4 → Polish.
- Rendering is wired (T019) only after T005–T006 are complete: no table is emitted without the safety check and budget.
- US2 depends on US1 (split, projection, width, run collection). US3 adds comprehensive boundary/determinism tests over foundational semantics. US4 caption opt-out depends on T003; its box assertions need US1.
- Within each story: tests before implementation; T012 after T007.

## Parallel Opportunities

- Tasks sharing `tests/unit/whatsapp-table.test.ts` (T005, T007–T011, T020–T022, T025–T028) are sequential; none are marked [P].
- T030 (`whatsapp-ng.extension.test.ts`) [P] may run alongside T031 (fixtures).
- Polish: T035 ∥ T036.

## Implementation Strategy

Incremental order US1 → US2 → US3 → US4 → Polish with the full suite at each checkpoint. Phases 1–3 are an internal checkpoint only. No partial MVP may ship without the approved safety (T005–T006), budget (T005–T006, T027), caption opt-out and production-entry proof (T030–T033) and validation (T037) requirements.

## Review Dispositions

- Directory `specs/046-whatsapp-table-rendering` accepted (I3).
- A1 (plan size estimate) and D1 (FR-024/025 vs research R7 overlap) are documented nonissues.

## Traceability

| Acceptance (spec input) | Tasks |
|---|---|
| 1 box ≤ 28, 28/29, stability | T007, T008, T018, T020 |
| 2 positional values, empty/duplicate/short | T021, T023, T024 |
| 3 emoji/CJK labeled; unsafe/unstable legacy | T005, T006, T020, T022, T026 |
| 4 malformed, escapes, code, links, fences, CRLF/EOF, later unclosed | T009–T011, T025 |
| 5 unchanged non-table output; line 110 revised; non-expansion | T002, T012, T034 |
| 6 long header, 65,536/65,537, distinct guards | T005, T006, T027 |
| 7 captions legacy, text renders (mocked + RPC, offline, zero network) | T030–T033 |
| 8 public note + changelog | T035, T036 |
| FR-003 no dependency change | T037 |
| FR-029 no throw, deterministic | T028 |

## Corrections

- [X] T039 [US1] FR-013 literal-preservation defect: cells containing `![**x**](https://e)` or `<b t="**x**">y</b>` had their inner `**` stripped. Regression added first in `tests/unit/whatsapp-table.test.ts` ("keeps images and HTML literal in cells…": boxed golden outputs, second-pass stability, mixed `![i](https://e) **y** | <i>__z__`, and 5-column labeled cases that fail the fixed-point gate and keep the legacy projection); observed failing (`![x](https://e)` received). Fixed in `src/services/whatsapp-table.ts` (`project()` image/HTML literal branches, `htmlTagEnd()`), research R4 updated. No contract change: FR-013 already requires images and HTML to stay literal.

- [X] T040 [US1] FR-013 follow-up: a 512-unit image label (`![${'a'.repeat(506)} **x**](https://e)`), an unclosed image label (`![**x**`) and HTML comments (`<!--**x**-->`, unclosed `<!--**x**`) lost literal markers. Regressions were added first ("keeps long, unclosed and comment-like opaque constructs literal") and observed failing. Fixed in `src/services/whatsapp-table.ts`: image recognition no longer uses the ordinary-link window, an unclosed image or comment copies the rest of the cell, and `<!--…-->` is opaque. The 511-unit ordinary-link test is re-asserted. A 512-unit image label in a 2-column table falls back to the legacy projection through the existing labeled-line stability gate (legacy itself turns `**x**` into `*x*`; that is the specified fallback). The T039 research claim about the link window was removed (R4).
- [X] T041 [US1] FR-013 image-destination boundary: `![x](https://e/(a)**b**)` stopped at the inner `)` and stripped `**b**` from the URL. A regression was added first ("keeps complete image destinations literal, including parentheses") and observed failing. It covers balanced (`(a)`, `((a))`) and escaped (`\)`) destination parentheses, emphasis after a closed image (`) **y**` → `y`), and unclosed destinations (`(a**b**`, `((a)**b**`), which keep the legacy projection. Fixed in `src/services/whatsapp-table.ts`: new `destinationEnd()`; `project()` returns `undefined` for an undeterminable boundary, which propagates through link labels and strong content to refuse the cell. Ordinary-link rules unchanged. Research R4 updated.
- [X] T042 [US1] FR-013 image-label boundary: the raw `indexOf('](')` matched inside escaped (`![a\](b) **x**](https://e)`) or nested (`![a [b](c) **x**](https://e)`) labels and stripped `**x**`. A regression was added first ("finds image label ends past escaped and nested brackets") and observed failing. It covers both cases, wide (labeled line unstable, so legacy) and boxed (literal), a code span containing `](` inside a label, emphasis after the image (`**y**` → `y`) and an unclosed code span in a label (legacy). Fixed with `imageLabelEnd()` in `src/services/whatsapp-table.ts`: one forward scan that skips escapes and matched code spans, counts nesting, and refuses ambiguous labels (`-2`), so the candidate keeps legacy. T041 destination handling and ordinary-link rules unchanged. Research R4 updated.
- [X] T043 [US1] FR-013 quoted/tagged image boundaries: `![x](h "t) **x**")` and `![<b t="](h) **x**">](h)` closed at a `)` hidden inside a title or attribute and rendered a box with `**x**` exposed or stripped. A regression was added first ("refuses ambiguous quoted image boundaries…") and observed failing. It asserts the complete legacy fallback strings (where legacy formats `**x**` as `*x*`), not raw-marker preservation. Fixed in `src/services/whatsapp-table.ts`: an image span containing `"`, `'` or `<` refuses the cell. No title or HTML-in-label parsing. The plain, escaped, nested and code-span label cases (T042) and destination handling (T041) still pass. Research R4 documents the refusal.
- [X] T044 [US1] Owner-approved output-contract change (research R13): every generated box block starts with a fixed `---` line before the top border, working around misaligned first-line rendering observed on iPhone and WhatsApp Web (cause unconfirmed, Android untested). Failing regressions first (15 failures): goldens updated in `whatsapp-table`, `whatsapp-text`, mocked entry and RPC tests; the 28-column test checks the fence/lead lines separately and asserts all 5 frame rows are 28 wide; new budget test with LF and CRLF exact-limit and one-over cases including the lead line; labeled text and existing code blocks have no lead. `BOX_LEAD` added to `box()` and `boxSize()` in `src/services/whatsapp-table.ts`. Spec FR-022, contract, plan, research R13, `docs/reference.md` and `CHANGELOG.md` updated.

## Validation Evidence

Recorded 2026-11-12, macOS (darwin), Node v26.13.0. Source tests only; no real account, provider, network or phone.

- **T001 baseline** (unmodified tree): `npm test -- --maxWorkers=2` → 90 files / 2179 tests passed; `npm run typecheck` clean.
- **Regression-first**: after T002/T005–T012 were written, `npx vitest run tests/unit/whatsapp-table.test.ts tests/unit/whatsapp-text.test.ts` failed (module missing; revised line-110 box assertion failed) while the new legacy-freeze tests passed. T030 failed before the T033 caption opt-out. Temporarily removing `{ tables: false }` made the T032 RPC `tables` scenario fail; it was restored.
- **Focused**: `whatsapp-table.test.ts` + `whatsapp-text.test.ts` → 143 passed (~0.7 s, including the near-limit and 10,000-column fixtures under the default 5 s timeout); `whatsapp-ng.extension.test.ts` → 75 passed; `phone-control.rpc.test.ts -t "(tables)"` → passed, `networkAttempts === 0`.
- **Full suite**: `npm test -- --maxWorkers=2` against the real HOME → 5 timeouts in `tests/unit/whatsapp.service.test.ts`. That file constructs a real `SessionManager` under the default data root and contends with the live Pi/WhatsApp process; it does not import the formatter. With a disposable `HOME`/`PI_CODING_AGENT_DIR` and `WHATSAPP_NG_LOCALE=en` (AGENTS.md "Validation"): 91 files / 2233 tests passed, and that file passes 18/18 on its own.
- **Lint**: the declared script `node node_modules/eslint/bin/eslint.js whatsapp-ng.ts "src/**/*.ts" "src/**/*.mjs" "scripts/**/*.mjs" "tests/**/*.ts"` → exit 0. `npm run lint` exits 1 in this shell because an environment `rtk` command proxy reports unrelated files (for example `mermaid-11.16.0.min.js`, `MsEdgeTTS.js`); not caused by this change.
- **Typecheck**: `npm run typecheck` → exit 0. **`git diff --check`** → clean. **`git diff --exit-code -- package.json package-lock.json`** → unchanged.
- **Implementation notes**: unpaired-surrogate detection uses a regex equivalent to `!isWellFormed()`, because the `tsconfig` target ES2022 lib lacks it. Existing transport branding (` π`, `message.sender.ts:115`) is appended after display formatting, including after the closing box fence; this is unchanged, existing behavior, asserted in the RPC test.
- **T038**: constitution re-check — no new deviation beyond plan Complexity Tracking.
- **Not done**: operator portrait-phone font/alignment acceptance; live WhatsApp delivery; README sentence (no display section exists, so only `docs/reference.md` gained a note).

### T039 correction run (2026-11-12)

The environment was credential-free (`env -i`), with a disposable `HOME`/`PI_CODING_AGENT_DIR`/`TMPDIR` and `WHATSAPP_NG_LOCALE=en`. `PATH` was `/usr/local/opt/node/bin:/usr/local/bin:/usr/bin:/bin`. No real-HOME run. `node` (v26.13.0) was no longer on this agent shell's default PATH, so the installed Homebrew binary was used directly; nothing was installed.

- Red: `vitest run tests/unit/whatsapp-table.test.ts -t "FR-013"` → 1 failed. Green: `whatsapp-table` + `whatsapp-text` → 144 passed.
- Full suite `vitest run --maxWorkers=2`, first attempt with PATH limited to `/usr/bin:/bin`: 4 failures, because system FFmpeg was hidden (`media.ffmpegMissing`). With `/usr/local/bin` restored: 1 timing failure in `managed-speech.service.test.ts`, which then passed alone 34/34 twice. Final full run: 91 files / 2234 tests passed.
- ESLint (declared globs, local binary) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; `package.json`/`package-lock.json` unchanged.
- No new phone/live evidence.

### T040 correction run (2026-11-12)

Same isolated, credential-free environment as T039 (`env -i`, disposable `HOME`/`PI_CODING_AGENT_DIR`/`TMPDIR`, `WHATSAPP_NG_LOCALE=en`, PATH `/usr/local/opt/node/bin:/usr/local/bin:/usr/bin:/bin`).

- Red: the `-t "opaque"` test failed (the 512-unit image was rendered as labeled text). One wrong assertion of mine (expecting `**x**` to survive inside the legacy fallback) was removed. Green: `whatsapp-table` + `whatsapp-text` → 145 passed.
- First full run: 5 failures in `managed-speech.service.test.ts` and `phone-control.rpc.test.ts (phone-polish:en)`, at load average ~18. `phone-control.rpc.test.ts --maxWorkers=1` → 38/38. A rerun full suite → 91 files / 2235 tests passed. `managed-speech.service.test.ts` alone failed 6 tests once under the same load, then passed 34/34 three times at load ~6. These are load-sensitive timing tests that do not use the formatter.
- ESLint (declared globs) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; package files unchanged.

### T041 correction run (2026-11-12)

Same isolated, credential-free environment as T039/T040.

- Red: `-t "destinations"` failed (`**b**` stripped from the destination). My first assertions wrongly expected a box: the 24-unit cell exceeds 28 columns, so labeled text is the specified layout. The assertions were corrected to exact labeled golden strings.
- Green: `whatsapp-table` + `whatsapp-text` → 146 passed. Full suite (load average ~5.5) → 91 files / 2236 tests passed, with no flaky failures this run.
- ESLint (declared globs) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; package files unchanged.

### T042 correction run (2026-11-12)

Same isolated, credential-free environment as T039–T041.

- Red: `-t "label ends"` failed (`**x**` stripped to `x`). Green: `whatsapp-table` + `whatsapp-text` → 147 passed.
- Full suite (load average ~20) → 91 files / 2237 tests passed. ESLint (declared globs) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; package files unchanged.

### T043 correction run (2026-11-13)

Isolated, credential-free environment as before. `/tmp/iso.sh` was recreated after a host restart, with the same definition; `node` v26.13.1 is the Homebrew `node` at `/usr/local/opt/node/bin`.

- Red: `-t "quoted image"` failed (a box was rendered). Green: `whatsapp-table` + `whatsapp-text` → 148 passed.
- Full suite (load ~4) → 91 files / 2238 tests passed. ESLint (declared globs) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; package files unchanged.

### T044 correction run (2026-11-13)

Isolated credential-free environment as for T043. Red: 15 failures after golden updates. One wrong new assertion of mine (expecting a box in the emoji labeled-text limit fixture) was replaced by box-specific LF/CRLF boundary cases. Green: `whatsapp-table`, `whatsapp-text`, `whatsapp-ng.extension` → 224 passed. Full suite → 91 files / 2239 tests passed (includes the RPC `tables` scenario). ESLint (declared globs) exit 0; `tsc --noEmit` exit 0; `git diff --check` clean; package files unchanged. Phone/Web acceptance of the new output is pending.

### T044 operator acceptance (2026-11-13)

Operator-confirmed on iPhone and WhatsApp Web; six screenshots were reviewed in the control session and all passed:
- The basic and 28-column boxes, with the `---` lead line, align without wrapping.
- Supported characters render correctly.
- Labeled fallbacks, protected code, other formatting and the caption opt-out behave correctly.

This is operator evidence, not a unit test. Android remains untested, the internal cause of the first-line misalignment is unconfirmed, and alignment remains client- and font-dependent.
