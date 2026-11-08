# Implementation Plan: Terminal menu polish

**Branch**: none created (work stays on `main`; `setup-plan.sh` reported `041-terminal-menu-polish` from the feature pointer) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/041-terminal-menu-polish/spec.md`

## Summary

This pass polishes terminal `/whatsapp` wording, navigation labels and translations without changing hierarchy, order, eligibility, actions, destinations or outcomes.

- **Esc hint:** one hint is added centrally in the settings-request dialog wrapper.
- **Exit labels:** each exit option names its destination using per-destination keys. The root exit reads "Close settings".
- **Relabels:** ambiguous options are relabeled: sending number versus contact removal, identifiers, logout and speech settings.
- **Translations:** hardcoded English terminal strings, including root categories (clarification C), are moved into `src/i18n.ts`. All four locales are completed and aligned to one glossary.
- **Citations:** terminal-path citations in phone and transmitted text are updated to the localized labels, and nothing else in those texts changes.
- **Identity:** categories keep internal IDs. Other labels keep today's label-based matching, now with `t()` constants.

Details: [research.md](research.md), [navigation](contracts/navigation.md), [labels](contracts/labels.md), [citations](contracts/citations.md).

## Technical Context

**Language/Version**: TypeScript ES modules (strict), Node 26.x

**Primary Dependencies**: Pi 1.5.0 extension UI (`ctx.ui.select/input/editor/confirm/custom/notify`) and `@mariozechner/pi-tui` for the message-detail overlay. No new dependencies.

**Storage**: N/A. No config, archive or auth format changes.

**Testing**: Vitest (`tests/**/*.test.ts`) with synthetic UI adapters, plus an isolated production-entry smoke (`pi --no-extensions -e ./whatsapp-ng.ts`).

**Target Platform**: Pi TUI and RPC hosts, on macOS/Linux/Windows, as today.

**Project Type**: Pi extension (single project).

**Performance Goals**: N/A. String lookup only.

**Constraints**: Preserved strings stay byte-identical except for FR-014a citations. No option-identity migration. Label comparisons stay local. Do not modify the host key-hint row.

**Scale/Scope**: About 30 panels. Seven edited source files (`src/ui/whatsapp-settings.view.ts`, `src/ui/menu.handler.ts`, `src/ui/voice-settings.view.ts`, `src/ui/optional-output-settings.view.ts`, `src/i18n.ts`, `src/ui/message-detail.view.ts`, one line in `src/services/whatsapp-command.router.ts`). The detail view locally measures its actual displayed hint so the longer text is not unnecessarily truncated. About 110 new or changed keys across four locales. `src/ui/message-reply.view.ts` needs no edit: its editor receives the hint through the wrapper.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. OOP**: Existing owners keep their responsibilities: `MenuHandler`, view functions and the `withSettingsRequest` wrapper. No new classes are needed.
- [x] **II. Clean Code**: Hardcoded literals become named `t()` keys. Exit labels say what they do. Repeated literal comparisons become local constants.
- [x] **III. SOLID**: The hint lives in the single dialog wrapper (one responsibility, no per-panel duplication). Caller-dependent labels are passed in rather than inferred. Interfaces are unchanged except for an optional label argument on four helpers.
- [x] **IV. TypeScript**: Keys stay `keyof typeof fallback`, so the compiler rejects unknown keys. The category ID↔label map is typed over `SettingsCategory | 'Voice'`. No `any` is added.
- [x] **V. Simplicity**: There is no option-identity framework, no new settings and no layout redesign. The only structural additions are a category display map and one wrapper line.

**Post-design re-check**: still passes. Phase 1 added only string contracts and validation docs. No deviations, so Complexity Tracking is empty.

**Workflow note**: The constitution requires a spec/plan/tasks record for user-visible behavior changes; this folder provides it. `AGENTS.md` and Spec Kit context were not regenerated.

## Project Structure

### Documentation (this feature)

```text
specs/041-terminal-menu-polish/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── navigation.md    # exit labels, Esc hint, identity rules
│   ├── labels.md        # target strings per locale
│   └── citations.md     # FR-014a before/after
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks), not created here
```

### Source Code (repository root)

```text
whatsapp-ng.ts                          # unchanged (composition root)
src/
├── i18n.ts                             # new/changed/removed keys; four locales
├── services/whatsapp-command.router.ts # :210 citation only
└── ui/
    ├── whatsapp-settings.view.ts       # Esc hint in scoped dialogs; category ID↔label map; Close settings; localized title/notices
    ├── menu.handler.ts                 # t() constants for matched labels; contextual Back; caller labels for Recents/History; paging; reporting/group-replies strings
    ├── voice-settings.view.ts          # contextual Back; caller labels for chat picker/remote voice; Owner Back
    ├── optional-output-settings.view.ts# localized labels/headings/notices (consent bodies unchanged)
    └── message-detail.view.ts          # measure the actual displayed hint; keys unchanged
tests/unit/
├── terminal-menu-i18n.test.ts          # new: completeness, placeholders, distinctness, cross-category uniqueness
├── owner-menu-guidance.test.ts         # extended: Voice route, QR trailing citation, router reply
└── settings-navigation, menu.handler*, voice-settings.view, optional-output-settings.view, message-detail.view tests  # updated labels + exit-label assertions
docs/menu-diagrams.md, CHANGELOG.md     # FR-017
README.md, docs/reference.md, docs/crispasr.md, tests/manual/prerelease-acceptance.md  # cited-label alignment (research R5)
```

**Structure Decision**: Single existing project. All changes stay inside current owners. No new modules except one test file.

## Implementation sequence (input to `/speckit.tasks`)

1. **Tests first**: Add `terminal-menu-i18n.test.ts` and the exit-label and citation assertions. They fail against the baseline.
2. **Strings**: Add, change and remove keys in `src/i18n.ts` per [labels.md](contracts/labels.md) and [citations.md](contracts/citations.md).
3. **Wrapper and root**: Add the Esc hint in `withSettingsRequest`. Add the category display map, Close settings, `menu.back.main` on category panels, the localized root title and the expiry/options-changed notices.
4. **MenuHandler**: Replace hardcoded matched labels with `t()` constants used for both rendering and matching. Add contextual Back labels. Pass caller labels into Recents and History. Localize paging, `[Group]`, reporting, group replies and auto-connect. Leave consent bodies untouched.
5. **Voice, Owner and Optional outputs**: Add contextual Back labels. Pass caller labels into `selectChat` and `remoteVoice`. Use the new label keys. Leave consent bodies untouched.
6. **Router citation**: Change line 210.
7. **Update existing tests**: Change label literals without weakening destination or outcome assertions.
8. **Docs**: Update `docs/menu-diagrams.md`, add a `CHANGELOG.md` Unreleased entry and align the docs from R5.
9. **Validate**: Run [quickstart](quickstart.md) §1–§5 and report commands, results and skips.

## Confirmed decisions (2026-11-07)

1. Docs that quote a changed English label are aligned along with the diagrams and changelog: `README.md:43,196`, `docs/crispasr.md:294`, `docs/reference.md:60` and `tests/manual/prerelease-acceptance.md:60` ([research R5](research.md#r5--english-wording-and-document-churn)).
2. The translated `Voice` segment in the phone `/voice` setup reply (`whatsapp-command.router.ts:210`) is covered by clarification C ([citations](contracts/citations.md#phone-voice-setup-reply-srcserviceswhatsapp-commandrouterts210)).
3. Existing consent and disclosure texts and `METADATA_LOG_POLICY` stay unchanged. Their English-only parts are documented exceptions ([labels](contracts/labels.md#documented-exceptions-sc-002), [research R6](research.md#r6--confirmations-consent-and-policy-text)).

## Risks

| Risk | Mitigation |
| --- | --- |
| A translated label collides with another in the same comparison scope, making an action unreachable | Distinctness and cross-category uniqueness tests in every locale |
| A citation drifts from rendered labels | Route-derived assertions in `owner-menu-guidance.test.ts` |
| A preserved string changes accidentally | Baseline comparison (quickstart §3), restricted to citation diffs |
| A two-line title renders poorly in some host | Pi 1.5.0 wraps on `\n`, and RPC receives a plain string. If the smoke test shows a problem, fall back to a same-line ` — ` suffix (decided during implementation and recorded in research) |
| Test churn hides a behavior change | Destination and outcome assertions are kept, and only label literals change |

## Complexity Tracking

No constitution violations.
