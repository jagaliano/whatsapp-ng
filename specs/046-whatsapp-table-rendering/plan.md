# Implementation Plan: Readable Markdown Tables in WhatsApp Text Messages

**Branch**: `main` (unchanged; the setup script reports `046-whatsapp-table-rendering` as the feature id only) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/046-whatsapp-table-rendering/spec.md`. Legacy baseline: commit `f385a24` (package 1.1.10).

## Summary

Add conservative Markdown pipe-table rendering to the text-message display projection `formatWhatsAppText()` (`src/services/whatsapp-text.ts`). A recognized, valid, safe table becomes either a fenced 28-column box (2–4 columns, supported-width characters) or one labeled prose line per body row; every other case keeps the `f385a24` per-line projection or, for whole-input guards, the original input. A new pure module owns detection, cell splitting/projection, safety, width, layout and output-budget accounting; the existing formatter only delegates candidate runs to it. Media captions pass an explicit opt-out. No dependency, setting, i18n key, routing, delivery or speech change. See [research.md](research.md) for decisions, [data-model.md](data-model.md) for entities, [contracts/table-projection.md](contracts/table-projection.md) for the observable contract.

## Technical Context

**Language/Version**: TypeScript (strict, ES modules, `.js` import suffixes), Node 26.x, Pi 1.5.0

**Primary Dependencies**: none added; ECMAScript Unicode property escapes (`\p{Cc}`, `\p{Bidi_Control}`, `\p{M}`) and `String.prototype.isWellFormed` from the Node 26 runtime

**Storage**: N/A (pure string transformation)

**Testing**: Vitest (`tests/**/*.test.ts`, default 5 s per-test timeout), ESLint, `tsc --noEmit`

**Target Platform**: Pi extension host on Node 26; output displayed by WhatsApp clients (phone rendering is an operator check)

**Project Type**: Pi extension (single project)

**Performance Goals**: near-limit (≈64 KiB) adversarial input completes within the existing unit-test timeout; added work bounded by input size + 65,536-unit output ceiling

**Constraints**: synchronous, pure, deterministic, never throws; no intermediate string larger than the remaining output budget; legacy inline projection cost/behavior unchanged

**Scale/Scope**: one new source module (~250 lines), small edits to `whatsapp-text.ts` and the caption call in `whatsapp-ng.ts`; unit + entry-level tests; README/reference note and CHANGELOG entry

No NEEDS CLARIFICATION items remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Table logic lives in one class, `MarkdownTableProjector`, which depends on a narrow `LegacyTextRules` interface supplied by `whatsapp-text.ts`. The existing module-level formatter functions stay functional (existing pattern; not refactored — see Complexity Tracking).
- [x] **II. Clean Code**: Separate small methods for row classification, cell splitting, cell projection, safety, width, box layout, labeled layout and budget.
- [x] **III. SOLID**: SRP — formatter traverses lines/fences, projector renders candidates. DIP — projector receives legacy rules through an interface, avoiding an import cycle. OCP — callers opt out via an options object, no caller-specific branching inside the projector.
- [x] **IV. TypeScript**: Discriminated union for outcomes (`box | labeled | legacy | refuse-input`), readonly records, no `any`.
- [x] **V. Simplicity**: No Markdown library, no grapheme database, no config; fixed character ranges and a single fixed-point recheck reuse existing code.

Post-design re-check (after Phase 1): all five still pass; the only deviation is recorded below.

## Project Structure

### Documentation (this feature)

```text
specs/046-whatsapp-table-rendering/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/table-projection.md
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
src/services/
├── whatsapp-text.ts          # formatWhatsAppText(text, options?) — delegates candidate runs; exposes LegacyTextRules
└── whatsapp-table.ts         # NEW: MarkdownTableProjector (detect, split, project, safety, width, layout, budget)
whatsapp-ng.ts                # send_wa_media caption call passes { tables: false }
tests/unit/
├── whatsapp-text.test.ts     # revise raw-table assertion (line 110); legacy regressions untouched
├── whatsapp-table.test.ts    # NEW: golden/negative/limit fixtures
├── whatsapp-ng.extension.test.ts  # mocked entry: text tool renders table; send_wa_media caption does not
└── phone-control.rpc.test.ts      # actual Pi RPC entry: same proof via synthetic fixtures
tests/fixtures/
├── phone-control-rpc.extension.ts     # new synthetic model mode calling send_wa_message / send_wa_media
└── phone-control-baileys.mjs          # record outgoing caption in metrics.sends
README.md, docs/reference.md, CHANGELOG.md   # short display-formatting note + Unreleased entry
```

**Structure Decision**: Single project. New module beside the formatter it extends; tests mirror it. `tests/unit/final-output.service.test.ts:171` (speech eligibility on the original answer) stays unchanged and is not table-layout evidence.

## Design Outline

1. **Formatter seam** — `formatWhatsAppText(text, options: { tables?: boolean } = {})`, default `tables: true`. With `tables: false` the code path is byte-for-byte the `f385a24` behavior (captions). Input guards (NUL, > 65,536 units) unchanged and checked first.
2. **Line traversal** — existing loop and fence handling unchanged. Before the per-line branch, when tables are enabled and the line is a row candidate followed by a delimiter row with equal cell count, the projector collects the run (header, delimiter, consecutive row candidates). Header/delimiter mismatch → normal per-line handling of that line only.
3. **Unclosed-code precedence** — every raw line in the run is checked with the existing `unclosedCode()`; any hit returns the original input (same as today). Later prose keeps its existing check.
4. **Candidate evaluation** (no output allocated until accepted): structure (header-only, wide row, delimiter-shaped body) → split/unescape → cell code-span closure → projection → safety → width class → layout choice → length preflight against remaining budget (arithmetic only; implicit missing cells) → materialize box, or build labeled lines and run the fixed-point gate → emit. Body rows keep only present cells; short rows are never padded in memory (research R9).
5. **Legacy run fallback** — per-candidate refusal emits each run line through the same heading+inline path as today (extracted as one helper, `projectLegacyLine`, with no behavior change), then resumes after the run.
6. **Labeled-text gate** — each joined line must equal its legacy projection, have no unclosed code span and not match the fence-opener regex. Runs only after preflight. A labeled line always contains ` · ` (≥ 2 columns), so it can never be a delimiter row; no extra check (research R7). Any failure → legacy run.
7. **Output budget** (foundational, built and tested before table wiring) — a running UTF-16 counter covers every pushed segment including legacy lines; additions are length-checked before materialization; exceeding 65,536 returns the original input. Applied only when tables are enabled (legacy output never grows; research R9).
8a. **Box lead line (T044)** — box blocks start with a fixed `---` line (research R13); it is included in the size preflight and is not a frame row.
8. **Caption opt-out** — `whatsapp-ng.ts` send_wa_media passes `{ tables: false }`; other text callers (`sendWithOwnership`, reporting, optional outputs) keep the default.

## Testing Strategy (regression-first)

- Write failing tests first for: both approved golden examples, 28/29 width boundary, alignments, CRLF/EOF endings, empty/duplicate headers, short rows, escaped pipes, inline-code/link cells, emoji/CJK/combining marks, unsafe characters, unstable fallback, adjacent/header-only/mismatched runs, fences/indentation/container exclusions, later unclosed prose, output 65,536/65,537 and input-guard boundaries, long repeated header near limit, second-pass stability of generated segments, 511/512-unit link labels and depth 3/4/5 nesting (research R4), 10,000-column × 5,000 short-row input returning the original without padding (research R9).
- Mocked-entry test in `whatsapp-ng.extension.test.ts`: `send_wa_message` text renders the box; `send_wa_media` caption with the same table matches `f385a24` output.
- Actual production-entry RPC test in `tests/unit/phone-control.rpc.test.ts` (isolated HOME/`PI_CODING_AGENT_DIR`, synthetic `fixture-phone` model, synthetic Baileys transport, existing preload/network guards): ordinary text renders the table; caption keeps legacy formatting (research R12). Fixture extension limited to a mode-scoped offline document branch recording `content.caption` (research R12); zero network attempts asserted.
- Foundational safety and budget units (FR-016, FR-026/027) are tested and completed before rendering is wired; US3 holds the comprehensive boundary tests.
- Determinism/no-throw fixtures (FR-029) and non-expansion assertions on frozen legacy fixtures (research R9).
- Then: `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`.

## Review Dispositions

- Feature directory `specs/046-whatsapp-table-rendering` accepted as is (differs from the research-note name; no rename).
- Analyze A1 (size estimate) and D1 (FR-024/025 vs R7 overlap) are documented nonissues.
- No partial MVP ships without the approved safety, budget, caption opt-out and validation requirements.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I partially: existing formatter helpers (`inline`, `codeEnd`, `unclosedCode`, `delimiter`) remain module functions, wrapped by a `LegacyTextRules` object rather than converted to a class | Spec forbids refactoring the legacy formatter and requires byte-identical legacy behavior | Converting them to a class would be an unrelated refactor with regression risk and no user value |
| Cell projection duplicates the shape of `inline()` (code/URL/link/strong scanning) instead of parameterizing `inline()` | Cells must *remove* `**`/`__` and unwrap code, whereas legacy must keep emitting `*` and backticks unchanged | Adding modes to `inline()` changes the legacy function the spec freezes; the new scanner reuses `codeEnd`/`delimiter` for the shared recognition rules |
