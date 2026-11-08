# Tasks: Phone menu polish

**Input**: Design documents in `specs/042-phone-menu-polish/` ([plan](plan.md), [spec](spec.md), [research](research.md), [data-model](data-model.md), [phone surface contract](contracts/phone-surface.md), [quickstart](quickstart.md))

**Tests**: Requested (FR-011). `AGENTS.md` requires a failing regression before behavior-visible changes, so each story writes tests first and confirms they fail on the baseline (`HEAD` at task start).

**Organization**: Grouped by user story. Every story edits `src/i18n.ts` and `src/services/whatsapp-command.router.ts`, so story phases run in order (US1 → US5). Tasks marked [P] touch different files within a phase.

**Git**: Do not commit, push, branch, tag or publish. Do not regenerate `AGENTS.md`. Synthetic fixtures only: no real account, config, provider or WhatsApp call.

## Format: `[ID] [P?] [Story] Description`

- Paths are relative to the repository root.
- Locale values: use the glossary and wording of feature 041 ([labels contract](../041-terminal-menu-polish/contracts/labels.md)) for the same concepts. pt-BR is Brazilian ("contato", not "contacto").
- **Invariant**: option order/count and `Action` values never change; only labels, titles, instructions and reply prose do.

## Phase 1: Setup

- [X] T001 Run `npm test -- --maxWorkers=2`, `npm run lint` and `npm run typecheck` on the untouched tree in an isolated HOME (`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`, credential-free env); record test/file counts and any skips as the baseline.
- [X] T002 Save the baseline outside the repo: `git show HEAD:src/i18n.ts > /tmp/i18n.042.baseline.ts` and `git show HEAD:src/services/whatsapp-command.router.ts > /tmp/router.042.baseline.ts` (used by T034 only; never committed).
- [X] T003 Capture an **action-parity snapshot** from the baseline: create `tests/unit/phone-menu-i18n.test.ts` (shared router fixture pattern from `tests/unit/whatsapp-command.router.test.ts`; `initI18n`/`resetI18n` via `WHATSAPP_NG_LOCALE`, as in `tests/unit/terminal-menu-i18n.test.ts`) containing a table-driven helper that, for each of `/think`, `/voice`, `/replies`, `/new`, `/off`, `/quit`, `/model`, extracts the ordered `Action` values from a menu via the existing router test fixture. Record the expected arrays literally from [phone-surface.md](contracts/phone-surface.md) so later tasks compare against fixed data, not against the code under change.

---

## Phase 2: Foundational

**Purpose**: Make menu text assembly localizable and able to carry an unabridged body. No visible change in English until stories run.

- [X] T004 In `src/services/command-menu.service.ts`, add an optional `body?: string` parameter to `create(binding, title, options, body?)`. Body is sanitized by control/bidi stripping (reuse the `safeLabel` filter without its 120-char slice via a small shared helper) and limited to 1,000 characters. A body over the limit is **never truncated**: `create` throws like its other guards, so no menu is sent and the router's existing failure reply applies. Locale tests (T025, T030) guarantee every shipped body fits. The body is rendered only in `text` (between title and options), never in `poll.name`. Keep `safeLabel` and per-option/title caps unchanged; keep the `options.length > 12` guard.
- [X] T005 In the same file, replace the hardcoded instruction with `t('phone.menu.instruction')` / `t('phone.menu.instructionGroup')` (group variant states quoting). Import `t` from `../i18n.js`. English values must equal the current wording so existing tests still pass: `Reply with a number within 5 minutes. Ordinary text cancels this menu.` and `Reply with a number within 5 minutes, quoting this menu. Ordinary text cancels this menu.`
- [X] T006 In `src/i18n.ts`, add the English values for these two keys under a `phone.*` namespace and run `npm run typecheck` plus `npx vitest run tests/unit/command-menu.poll.test.ts tests/unit/whatsapp-command.router.test.ts` to prove nothing changed.

**Checkpoint**: Menu service localizable; English output byte-identical.

---

## Phase 3: User Story 1 - Grouped /help (Priority: P1) 🎯 MVP

**Goal**: `/help` lists every existing command in four groups with one-line explanations, the owner-only rule, expiry and this chat's mode.

**Independent Test**: `/help` in each locale lists each command exactly once, adds none, and still works for non-owners.

### Tests (write first; confirm they fail on baseline)

- [X] T007 [US1] In `tests/unit/whatsapp-command.router.test.ts`, update the existing `/help` assertion (`offers truthful help/status…`, ~line 203) and add cases: (a) reply contains each of `/help /status /stop /abort /model /think /compact /new /voice /replies /off /quit` exactly once as a command token and no other `/word` command; (b) the four group headings appear in order Information, Shared Pi session (includes `/replies`), This chat (`/voice`), WhatsApp and process (`/off`, `/quit`); (c) `/stop (/abort)` aliasing and argument forms `[provider/model or search]`, `[level]`, `[focus]`, `[text|voice|both|mirror]` are shown verbatim; (d) owner-only sentence, five-minute expiry and `Current chat mode` are present; (e) a non-owner still receives help and no state changes. Keep no-paths/no-keys/no-shell assertions.
- [X] T008 [US1] Confirm T007 fails for the expected reason (single-line help), not fixture error.

### Implementation

- [X] T009 [US1] In `src/i18n.ts`, add English `phone.help.*` keys (`title`, group headings `info|shared|chat|process`, one line per command `cmd.help|status|stop|model|think|compact|new|voice|replies|off|quit`, `ownerOnly`, `expiry`, `mode`). Command tokens and bracketed argument forms are not translated and are interpolated or embedded identically in all locales.
- [X] T010 [US1] In `src/services/whatsapp-command.router.ts`, build the `/help` reply from those keys (small private method `helpText(chat)`), keeping the `SHARED` sentence content via a key (`phone.shared`) and `chatReplyPolicy(...).mode` rendered through the localized mode word (keys added in T015, US2; until then the raw mode token). Authorization/frame logic untouched.
- [X] T011 [US1] Run the T007 test file, `npm run typecheck`, `npm run lint`.

**Checkpoint**: English `/help` grouped; other behavior unchanged.

---

## Phase 4: User Story 2 - Split /status (Priority: P1)

**Goal**: `/status` shows "Shared Pi and WhatsApp" then "This chat" sections, retaining all fields with friendly values.

### Tests

- [X] T012 [US2] In `tests/unit/phone-menu-i18n.test.ts` (created in T003), add a `/status` test: shared heading precedes WhatsApp, Pi, model (identifier verbatim), thinking, context, reply delivery and final stats; the this-chat heading precedes automatic replies and voice mode; no field missing; shared fields never appear after the this-chat heading.
- [X] T013 [US2] In `tests/unit/whatsapp-command.router.test.ts`, update the baseline `/status` expectation(s) to the new section layout and keep the unavailable-model, unknown-context and paused-replies cases.
- [X] T014 [US2] Confirm T012–T013 fail for the expected reason.

### Implementation

- [X] T015 [US2] In `src/i18n.ts`, add English `phone.status.*` keys (headings `shared|chat`, field labels `whatsapp|pi|model|thinking|context|replyDelivery|finalStats|automaticReplies|voice`, values `idle|busy|unavailable|unknown|explainAfter|captionOnly|enabled|paused|on|off`) and `phone.mode.text|voice|both|mirror` (reuse `voice.modeText|Voice|Both|Mirror` wording; mode tokens used in commands stay unchanged elsewhere). Connection state uses existing `menu.status.*` keys.
- [X] T016 [US2] In `src/services/whatsapp-command.router.ts`, rebuild the `/status` reply from those keys in two sections. Data sources and `chatReplyPolicy` calls unchanged (compute the policy once).
- [X] T017 [US2] Run T012–T013 files, typecheck, lint.

**Checkpoint**: `/help` and `/status` done in English.

---

## Phase 5: User Story 3 - Friendly numbered menus with current markers (Priority: P2)

**Goal**: `/think`, `/voice`, `/replies`, `/new`, `/off`, `/quit`, `/model` show friendly localized labels, mark the current selection, and share a clear answer instruction.

### Tests

- [X] T018 [US3] In `tests/unit/phone-menu-i18n.test.ts`, add English tests: (a) `/voice` options are Text only / Voice / Voice + text / Mirror audio input (final wording from the contract in T020) with `(current)` on exactly the active mode for that chat; (b) `/think` marks the active level; (c) `/replies` explain/caption marks the active policy and the stats on/off pair marks the active state; (d) `/model` marks the current model only when on the visible page and keeps `Previous page`/`Next page` labels, order and ≤10 per page; (e) `/new|/off|/quit` keep Cancel then Confirm; (f) instruction text: direct chat has no quote clause, group chat does; ordinary-text cancellation still cancels (existing behavior test) and expiry at 5 minutes unchanged; (g) for every menu the ordered `Action` values equal the T003 fixed arrays; (h) with polls enabled (`command-menu.poll.test.ts` fixture) the poll `values` equal the text labels one-for-one and are unique.
- [X] T019 [US3] Update literal English expectations in `tests/unit/whatsapp-command.router.test.ts`, `tests/unit/command-menu.poll.test.ts` and `tests/unit/phone-control.rpc.test.ts` that depend on old labels/titles (`Voice for this chat`, `Thinking —`, `Explain after attachments`, `Enable final stats for allowed chats`, `Disable final stats`, `Cancel`/`Confirm`) only; every action/authorization assertion stays. Match selection by the numbered label text exactly as the tests do today.
- [X] T020 [US3] Confirm T018–T019 fail for the expected reason.

### Implementation

- [X] T021 [US3] In `src/i18n.ts`, add English keys: `phone.current` (`(current)`), `phone.voice.title|text|voice|both|mirror`, `phone.think.title`, `phone.replies.explain|caption|statsOn|statsOff` and per-report toggle labels `phone.replies.files|interim|activity` with `.on`/`.off` variants, `phone.model.title|titleMatches|previous|next`, `phone.new.title`, `phone.off.title`, `phone.quit.title`, `phone.cancel`, `phone.confirm`. Titles are short and must fit the 120-character title limit untruncated in every locale. The shared-session guidance (`phone.shared`) and any other explanatory sentence formerly in a title go in the menu **body** (T004) for `/think`, `/model`, `/new`, `/off` and `/quit`, never in the title or poll name.
- [X] T022 [US3] In `src/services/whatsapp-command.router.ts`, replace each menu title/label literal with `t(...)`, passing shared-session guidance as the `body` argument (T021); add a private `mark(label, isCurrent)` helper appending `t('phone.current')`. Compute current values from the same ports already used by `/status` (chat policy mode, `getFinalAfterAttachments()`, `getReplyStats()`, reply flags, `ctx.model`, `getThinkingLevel()`). Do **not** change `value` objects, order, revision fields or the `Cancel`/`Confirm` action values.
- [X] T023 [US3] Localize the remaining short replies in `apply()`/`models()`/handler: `Cancelled.`, usage lines (`Usage: /voice text|voice|both|mirror`, `Usage: /replies`, `Usage: /stop (or /abort)`, `Usage: /<command>` keep the command tokens verbatim), busy, denied (keep the terminal path citation using `t('menu.category.chatsOwner')`/`voice.owner` as `voice.authDenied` does), too-long, no model, unsupported thinking, model selection/auth/unavailable lines, voice/replies/stats confirmation lines, off/quit lines, compaction lines, failure line, and the `/voice` refusal reasons ("Speech is disabled", "Speech destination is not approved", missing group speech opt-in) plus their terminal-path sentence. Messages' meaning and the conditions that send them are unchanged. Terminal-only notices (`ports.notify`, e.g. `Compaction reply failed.`) stay unchanged (FR-009).
- [X] T024 [US3] Run T018–T019 files, `npx vitest run tests/unit/command-menu.poll.test.ts`, typecheck, lint.

**Checkpoint**: Menus friendly in English with markers; behavior parity proven.

---

## Phase 6: User Story 4 - Unabridged /replies disclosure (Priority: P2)

**Goal**: The full disclosure is always present in the delivered numbered menu message.

### Tests

- [X] T025 [US4] In `tests/unit/phone-menu-i18n.test.ts`, add tests (English first, then per-locale in T032): the delivered `/replies` text contains the complete disclosure — "Enabling shares workspace-relative paths/intermediate assistant text or tool names with allowed chats; never thinking/tool bodies" meaning, current stats/files/interim/activity states, and, when `getReplyReporting` throws, the invalid-settings repair note — with every sentence present even though the short title is ≤120 characters; the poll name (if polls enabled) equals the short title; the worst-case body (all states plus the invalid-settings note) is ≤1,000 characters and delivered untruncated in every locale; the test fails rather than accepting a shortened disclosure.
- [X] T026 [US4] In `tests/unit/command-menu.poll.test.ts`, add a service-level test: `create(..., body)` puts the sanitized body only in text (control characters and bidi controls stripped; a body over 1,000 characters throws and is never truncated), not in the poll name, and omitting `body` is byte-identical to today.
- [X] T027 [US4] Confirm T025–T026 fail for the expected reason (disclosure currently truncated by the 120-char title cap).

### Implementation

- [X] T028 [US4] In `src/i18n.ts`, add `phone.replies.title` (short, includes final-stats state) and `phone.replies.disclosure` (full state summary + share/never-share sentence) plus `phone.replies.invalid`. In `src/services/whatsapp-command.router.ts`, pass the short title as `title` and the disclosure (+ invalid note) as the `body` argument added in T004. Option labels/actions unchanged.
- [X] T029 [US4] Run T025–T026 files, typecheck, lint.

---

## Phase 7: User Story 5 - Four-locale presentation (Priority: P2)

**Goal**: pt-BR, es and fr provide every `phone.*` key; all phone-menu presentation localizes; nothing else changes.

### Tests

- [X] T030 [US5] In `tests/unit/phone-menu-i18n.test.ts`, for each of `en`, `pt-BR`, `es`, `fr` add: (a) key completeness — every `phone.*` key exists with matching `{placeholders}` in all four locales; (b) rendered `/help`, `/status` and every menu/reply path (T018 matrix) contains no baseline English phrase in non-English locales (compare against a list of the old English literals extracted from `/tmp/router.042.baseline.ts` at test-writing time and stored literally in the test, minus allowed tokens: command names, argument forms, model/provider ids, `Pi`, `WhatsApp`); (c) command tokens/args and model ids appear verbatim; (d) the `/replies` disclosure, shared-session body text, `/voice` refusal reasons, current marker and group quoting instruction are localized; (e) option labels are unique per menu per locale; (f) action-parity arrays identical per locale; (g) every raw title and option label is ≤120 characters **before** `safeLabel` (so nothing is silently cut), every body ≤1,000, ≤12 options; (h) an unsupported locale value falls back exactly as the existing i18n resolver does (English); (i) unreadable saved speech preferences preserve the original `/voice` menu with no current marker and the same guarded failure on selection; long current-model labels keep the marker within the existing display cap and retain full action identifiers.
- [X] T031 [US5] In `tests/unit/whatsapp-command.router.test.ts`, rewrite the existing per-locale test `quotes the localized terminal setup path without changing phone prose` (~line 37), which asserts the English reply in every locale, so it expects the localized refusal while still asserting the exact `/whatsapp > ${t('voice.menu')} > ${t('voice.setupChat')}` path and no settings write; update the English-substring assertions in the two following `/voice mirror` tests to `t()` values. Then add one per-locale case each for: owner denied reply (still cites the terminal path with localized labels), busy reply, and a `/voice` setup-needed reply — asserting only that behavior (authorization/guards) is identical across locales.
- [X] T032 [US5] Confirm T030–T031 fail for the expected reason (missing locale values).

### Implementation

- [X] T033 [US5] In `src/i18n.ts`, add pt-BR, es and fr values for every `phone.*` key (help, status, menu titles/labels, current marker, instructions, disclosure, replies). Reuse 041 glossary terms (e.g. "Voz + texto", "Estatísticas finais", "Respostas", "Volver"…); keep the consent/authorization meaning of the `SHARED`, denied and disclosure sentences exactly; add a manual glossary review note to `research.md` (no new tooling).
- [X] T034 [US5] Run `node` one-off comparison of `/tmp/i18n.042.baseline.ts` vs current: every pre-existing key's value is unchanged (only `phone.*` additions); and compare router action values via T018(g)/T030(f). Record the result in `research.md`.
- [X] T035 [US5] Run `npx vitest run tests/unit/phone-menu-i18n.test.ts tests/unit/whatsapp-command.router.test.ts tests/unit/command-menu.poll.test.ts --maxWorkers=2`, typecheck, lint.

---

## Phase 8: Production-entry smoke, docs and gates

- [X] T036 In `tests/unit/phone-control.rpc.test.ts`, add four locale-tagged scenarios (`phone-polish:<locale>`, modeled on `menu-polish:<locale>`) that run the real entry with synthetic transport and blocked network: owner sends `/help`, `/status`, `/voice`, `/replies` and a numeric reply; assert localized grouped help, two-section status, instruction line, unabridged disclosure, applied choice, no extension errors, zero extra socket/model/network activity, unchanged config for cancelled menus. Reuse the existing fixture mechanisms; do not add a fixture framework.
- [X] T037 [P] Update documentation: `README.md` (phone controls section), `docs/reference.md` (phone command/menu wording, expiry/quoting/cancellation, current marker, localization via existing locale setting), `docs/menu-diagrams.md` (phone-menu section: help/status layout, instruction, marker; keep source-versus-diagram note and date/base commit), `tests/manual/prerelease-acceptance.md` only where it cites old phone wording. Link-check changed Markdown.
- [X] T038 [P] Add an `## Unreleased` entry to `CHANGELOG.md`: grouped `/help`, split `/status`, friendly labels with current markers, clear numbered-reply/expiry/quote/cancel instructions, unabridged `/replies` disclosure in the text menu, four-locale phone presentation; behavior, commands, authorization, consent meaning, polls and terminal menu unchanged; validation scope and remaining operator/live checks.
- [X] T039 Run the full gates in an isolated environment (disposable HOME + `PI_CODING_AGENT_DIR`, credential-free, `WHATSAPP_NG_LOCALE=en`): `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`, changed-Markdown link/anchor check. Inspect skips.
- [X] T040 Update `research.md` with the validation record (commands, counts vs T001 baseline, preserved-value comparison from T034, manual glossary review, explicitly **not run**: live WhatsApp, operator visual check, release/publish), mark `spec.md` status, check boxes in this file, and leave all requirements checklist files and markers unchanged (read-only gate).

---

## Dependencies & execution order

- Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → US5 → Phase 8. Stories are sequential because they share `src/i18n.ts` and the router; they are still independently testable at each checkpoint.
- Within phases: tests precede implementation; T037/T038 are [P].
- **MVP**: Phases 1–3 (US1) then validate; next increments US2, US3 (English complete), US4, then translations (US5).

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-001 | T007–T011 |
| FR-002 | T012–T017 |
| FR-003 | T018–T024 |
| FR-004 | T005, T018(f), T021–T022 |
| FR-005 | T004, T025–T029, T030(g) |
| FR-005a | T004, T021–T022, T030(g) |
| FR-006 | T021–T023, T030–T035 |
| FR-007 | T003, T018(e,g), T030(f), T031, T034 |
| FR-008 | T018(h), T026 |
| FR-009 | T034, T039 (diff scope review: no new command/setting/dependency/terminal file) |
| FR-010 | T037–T038 |
| FR-011 | T007, T012, T018, T025, T030, T031, T036 |
| SC-001 | T007, T030(b) |
| SC-002 | T012 |
| SC-003 | T018(a–d) (exclusive choices marked; toggles show state) |
| SC-004 | T030(b) |
| SC-005 | T003, T018(g), T030(f), T036 |
| SC-006 | T025, T030(d) |
