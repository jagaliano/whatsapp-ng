# Tasks: Terminal menu polish

**Input**: Design documents in `specs/041-terminal-menu-polish/` ([plan](plan.md), [spec](spec.md), [research](research.md), [data-model](data-model.md), [navigation](contracts/navigation.md), [labels](contracts/labels.md), [citations](contracts/citations.md), [quickstart](quickstart.md))

**Tests**: Requested. The repository requires a failing regression before behavior changes (`AGENTS.md`), and the spec's success criteria are test-shaped. Each story writes its tests first and confirms they fail against the baseline (`8f32898`).

**Organization**: Tasks are grouped by user story. All stories edit `src/i18n.ts` and `src/ui/menu.handler.ts`, so story phases run in order (US1 → US2 → US3). Tasks marked [P] touch different files within a phase.

**Git**: Do not commit, push, branch or publish. Do not regenerate `AGENTS.md`. Use synthetic data only: no real account, saved settings, provider or WhatsApp call.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unfinished dependency)
- Paths are relative to the repository root
- English label text and per-locale values come from [labels.md](contracts/labels.md); Back destinations come from [navigation.md](contracts/navigation.md). Changed labels must still invoke the same actions.

## Phase 1: Setup

**Purpose**: Record the baseline so regressions and preserved strings can be compared.

- [X] T001 Run `npm test -- --maxWorkers=2`, `npm run lint` and `npm run typecheck` on the untouched tree and note the pass counts and any skips (baseline for the final report; expect the 1.1.5 figures of 1633 tests / 86 files unless the tree has moved).
- [X] T002 Save the baseline strings outside the repo: `git show 8f32898:src/i18n.ts > /tmp/i18n.baseline.ts` (used only by T045; never committed).

---

## Phase 2: Foundational

**Purpose**: Make every new English key available so later stories only wire them. Adding keys changes no behavior.

**⚠️ CRITICAL**: Complete before any story.

- [X] T003 In `src/i18n.ts`, add to the English `fallback` object every row marked **new** in [labels.md](contracts/labels.md) (navigation and hints, root/category/state/status words, Connection/Advanced, Recents paging and `groupPrefix`, reporting, Optional outputs, Group replies, Voice `voice.chooseChat`) using the English column verbatim. Do not yet change any existing English value, add pt-BR/es/fr values, or remove keys. Use these exact key names: `menu.close`, `menu.hint.esc`, `menu.back.main|connection|chatsOwner|replies|groups|advanced|optionalOutputs|allowedContacts|allowedGroups|recents|conversation|contact|group|voice|voiceAdvanced|voiceBackend|voiceProtocol|chatList|chatSettings`, `menu.expired`, `menu.optionsChanged`, `menu.root.title`, `menu.state.enabled|off`, `menu.status.connected|disconnected|pairing|logged-out`, `menu.on`, `menu.off`, `menu.category.connection|chatsOwner|replies|groups|advanced`, `menu.connection.turnOff|autoConnect|offNotice`, `menu.autoConnect.title|enabled|disabled|saved`, `menu.advanced.privacy`, `menu.recents.groupPrefix`, `menu.page.previous|next`, `menu.replyDelivery.status`, `menu.reporting.files|interim|activity` (`.enable`/`.disable` each), `menu.reporting.invalid|saved`, `menu.optional.title|status|chooseImages|clearImages|terminalOn|terminalOff|imageTitle|toolOn|toolOff|invalid|ownerMissing|saved`, `menu.groups.replies|title|invalid|saved|contextOn|contextOff`, `menu.groups.mode.mentions-or-replies|mentions|replies|all`, `voice.chooseChat`. For rows whose English column says *(baseline English literal)*, copy the literal currently hardcoded in `src/ui/menu.handler.ts` or `src/ui/optional-output-settings.view.ts` byte for byte.
- [X] T004 Run `npm run typecheck` and `npx vitest run tests/unit/owner-menu-guidance.test.ts` to confirm that the key additions break nothing.

**Checkpoint**: Keys exist; behavior is unchanged.

---

## Phase 3: User Story 1 - Understand where Back and Esc go (Priority: P1) 🎯 MVP

**Goal**: Root exit reads "Close settings"; every child exit names its real destination; every select/input/editor says Esc closes settings; message detail says it returns to History. Destinations and outcomes are unchanged.

**Independent Test**: Drive each panel with the scripted UI adapter. Each exit label matches [navigation.md](contracts/navigation.md), each choice reopens the baseline destination, hinted titles end with the Esc hint, and `confirm`/`custom` titles are unchanged.

### Tests for User Story 1 (write first; confirm they fail on the baseline)

- [X] T005 [US1] In `tests/unit/settings-navigation.test.ts`, add tests that (a) `withSettingsRequest` appends `\n` + `t('menu.hint.esc')` to the title of `select`, `input` and `editor` but not `confirm` or `custom`, and a single Esc still closes the request without errors; (b) `chooseWhatsAppSetting` shows `menu.close` as the root's last option and `menu.back.main` as the last option of each category panel, and selecting them returns `undefined` (close) or the root (back) as before.
- [X] T006 [US1] In `tests/unit/menu.handler.test.ts` and `tests/unit/menu.handler.recents-grouping.test.ts`, replace the literal `'Back'` selections with the per-panel labels from [navigation.md](contracts/navigation.md) (auto-connect → `menu.back.connection`; Reply delivery → `menu.back.replies`; Group replies and Allowed groups → `menu.back.groups`; Allowed contacts → `menu.back.chatsOwner`; Allowed contact → `menu.back.allowedContacts`; Allowed group → `menu.back.allowedGroups`; history scope → `menu.back.advanced`; Recents → `menu.back.chatsOwner` or `menu.back.advanced` by captured parent; recent conversation → `menu.back.recents`; History → `menu.back.conversation|contact|group` by caller). Keep every destination/outcome assertion, and add one assertion per panel that the exit label is the last option. Page titles may now contain the hint line, so match titles with `startsWith`/`toContain` where they use exact equality.
- [X] T007 [P] [US1] In `tests/unit/voice-settings.view.test.ts`, replace `'Back'` with the contract labels: Voice main and the invalid-voice repair panel → `menu.back.main`; Advanced speech settings and chat settings panel → `menu.back.voice`; chat picker → `menu.back.voice` (setup, chat settings) or `menu.back.voiceAdvanced` (preview); setup mode picker → `menu.back.chatList`; chat-settings mode picker → `menu.back.chatSettings`; backend, default mode and format pickers → `menu.back.voiceAdvanced`; protocol → `menu.back.voiceBackend`; remote voice → `menu.back.voiceProtocol` (backend setup) or `menu.back.voiceAdvanced` (standalone); Owner panel → `menu.back.chatsOwner`. Keep the existing destination assertions.
- [X] T008 [P] [US1] In `tests/unit/optional-output-settings.view.test.ts`, replace the two `'Back'` selections: Optional outputs → `menu.back.replies`; image tools → `menu.back.optionalOutputs`; assert the destinations are unchanged. Add an invalid-saved-settings case: the invalid warning is shown, the panel opens with defaults, and `menu.back.replies` returns without saving or repairing (U2).
- [X] T009 [P] [US1] In `tests/unit/message-detail.view.test.ts`, assert the rendered hint is the `message.detail.hint.close` / `message.detail.hint.replyOrClose` text, that it says the close returns to History (English: "Enter or Esc returns to History"), and that Enter, Esc and Backspace still call `onClose` and R still replies only when a quote is available.
- [X] T010 [P] [US1] In `tests/unit/phone-control.rpc.test.ts` (lines ~127–129, 164, 169–171, 182–183, 287), update the RPC assertions: selections of `'Back'` use the contract labels, and exact title checks (`toBe('Connection')`, `toBe('Replies')`, `toBe('Chats / Owner')`, `toBe('Phone settings owner: not configured')`) become `startsWith` checks or include the second hint line. Keep every destination assertion.
- [X] T011 [US1] Run the T005–T010 files and confirm the new assertions fail for the expected reason (missing labels/hint), not for fixture mistakes.

### Implementation for User Story 1

- [X] T012 [US1] In `src/i18n.ts`, change the English values of `message.detail.hint.replyOrClose` and `message.detail.hint.close` per [labels.md](contracts/labels.md#recents-history-and-message-detail). Do not touch the handled keys in `src/ui/message-detail.view.ts`.
- [X] T013 [US1] In `src/ui/whatsapp-settings.view.ts`, make `withSettingsRequest`'s scoped `select`, `input` and `editor` append `\n` + `t('menu.hint.esc')` to the title argument and pass the remaining arguments through; leave `confirm`, `custom` and `notify` as they are. Keep `check()`, `answer()` and cancellation behavior byte-for-byte.
- [X] T014 [US1] In `src/ui/whatsapp-settings.view.ts`, update `chooseWhatsAppSetting`: keep `SettingsCategory` as the internal ID; add a typed ID→label map using `menu.category.*` and `voice.menu`; show the localized names in the root list and as each category panel's title; replace the root's trailing `back` with `t('menu.close')` and each category panel's trailing `back` with `t('menu.back.main')`; map the chosen label back to its ID; keep `resumeCategory`, the `Voice` shortcut and the options-changed recheck working on IDs. Do not change option order or eligibility. Use `t('menu.root.title', …)`, `menu.state.*` and `menu.status.*` only in US3.
- [X] T015 [US1] In `src/ui/menu.handler.ts`, replace each `backLabel` per [navigation.md](contracts/navigation.md): auto-connect select (`menu.back.connection`), Reply delivery select (`menu.back.replies`), `manageGroupReplies` (`menu.back.groups`), `manageAllowList` (`menu.back.chatsOwner`), `manageAllowedContact` (`menu.back.allowedContacts`), `manageAllowedGroups` (`menu.back.groups`), `manageAllowedGroup` (`menu.back.allowedGroups`), history scope (`menu.back.advanced`), `manageRecents` (`menu.back.chatsOwner` or `menu.back.advanced` by `parent`), `manageRecentConversation` (`menu.back.recents`). Give `showConversationHistoryForContact` and its two callers an extra parameter for the exit label key (`menu.back.conversation` from Recents, `menu.back.contact` from an allowed contact, `menu.back.group` from an allowed group). Compare selections against the same constants that render them. Destinations and the `!choice` handling do not change.
- [X] T016 [P] [US1] In `src/ui/voice-settings.view.ts`, replace the `back` constant per panel as listed in T007. Give `selectChat` and `remoteVoice` an explicit exit-label parameter supplied by each caller (setup, chat settings, preview; backend setup, standalone voice editor). Update `showOwnerSettings` to use `menu.back.chatsOwner`. Control flow and Back destinations stay identical.
- [X] T017 [P] [US1] In `src/ui/optional-output-settings.view.ts`, use `menu.back.replies` on the main panel and `menu.back.optionalOutputs` on the image-tools panel. Leave its strings and consent bodies untouched.
- [X] T018 [US1] Run `npx vitest run` on the T005–T010 files, then `npm run typecheck` and `npm run lint`; fix only failures caused by this story.

**Checkpoint**: US1 is complete and testable on its own, with English labels. This is the MVP.

---

## Phase 4: User Story 2 - Clear labels for contacts, groups, logout and speech (Priority: P1)

**Goal**: Sending-number versus contact-removal wording, identifier names, logout and speech labels are clear, in English and in the locales that already translate them. Actions are unchanged.

**Independent Test**: Render the affected panels. The relabeled options run the same actions with the same confirmations and outcomes.

### Tests for User Story 2

- [X] T019 [US2] In `tests/unit/menu.handler.test.ts`, update contact/group tests to the new English labels from [labels.md](contracts/labels.md#allowed-contacts-and-groups): `Set sending number`, `Remove sending number`, `Show phone number`, `Remove from allowed contacts`, `Show group JID`, `Remove from allowed groups`, `Allowed contacts`, `Allowed groups`, `Send message`, `Add alias`/`Remove alias`, `Allow contact`/`Allow group`, and the logout option `Log out and delete saved login`. Add assertions that: (a) the sending-number options never contain "contact removal" wording, and the removal option is the only one that removes the contact; (b) the logout confirmation title is `Log out and delete saved login?` and its body is still `Delete all credentials?`; (c) the entry prompt says "phone number", the send-number prompt says "sending number". Keep every action and outcome assertion.
- [X] T020 [P] [US2] In `tests/unit/voice-settings.view.test.ts`, update the `labels` object and literal option arrays (e.g. line ~83) to the new English speech labels from [labels.md](contracts/labels.md#voice-and-owner): `Speech service (Edge or remote)`, `Edge voice`, `Remote voice or reference ID`, `Remote audio format`, `Default reply mode (per-chat modes kept)`, `Send fixed-phrase voice preview (review first)`, `Send AI-assistant introduction (review first)`, `Turn speech off everywhere (revoke consent)`, `Chat settings: mode, automatic replies, introduction`, `Enter phone number or person JID`. Add assertions that each still invokes the same action, and that consent, review and preview bodies and `VOICE_PREVIEW_PHRASE` are unchanged.
- [X] T021 [US2] Confirm T019–T020 fail for the expected reason.

### Implementation for User Story 2

- [X] T022 [US2] In `src/i18n.ts`, change the **English** values listed as *changed* in [labels.md](contracts/labels.md) for Connection/Advanced (`menu.root.logoffDeleteSession`, `menu.root.logoffTitle`, `menu.root.reconnectStarted`, `menu.root.pairingStarted`), Allowed contacts and groups, Recents (`allowNumber`, `removeAlias`) and Voice and Owner. Keep `menu.root.logoffConfirmMessage` unchanged and all consent, review, authorization and disclosure keys unchanged.
- [X] T023 [US2] In `src/i18n.ts`, change the **pt-BR, es and fr** values of keys that already exist in those locales and are marked *changed* in [labels.md](contracts/labels.md): the contact/group/sending-number/removal/logout/speech keys, the pt-BR "contato" alignment (`menu.root.allowedNumbers`, `menu.allowed.title`, `menu.allowed.contact.title`, `menu.allowed.printAllowedNumbersTitle`, `menu.allowed.removeConfirmMessage`, `menu.recents.contact.allowNumber`, `menu.recents.grouped.*`), `voice.advanced` (es, fr) and the French apostrophe fix in `menu.allowed.contact.enterNumber|numberAdded|numberRemoved`. Keep placeholders identical to the English value.
- [X] T024 [US2] In `src/ui/menu.handler.ts`, confirm that every changed option is built from its `t()` constant and compared against the same constant (contact options, group options, logout, recents). Change code only where a comparison would break, such as a duplicated literal, and do not alter the options' order, eligibility or action bodies. Make the contact and group identifier prompts use `menu.allowed.enterNumber` / `menu.allowedGroups.enterGroup` as they already do.
- [X] T025 [US2] Run the T019–T020 files, `npm run typecheck` and `npm run lint`.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Consistent localized terminal menus (Priority: P2)

**Goal**: pt-BR, es and fr show translated, consistent terminal labels, headings, hints and notices, including root categories. Path citations in phone and transmitted text follow the visible labels. Consent bodies and the privacy notice stay as they are.

**Independent Test**: For each locale, every in-scope key exists, placeholders match, fixed labels are distinct per panel and across categories, no in-scope string falls back to English apart from the documented exceptions, and each translated label runs the same action.

### Tests for User Story 3

- [X] T026 [US3] Create `tests/unit/terminal-menu-i18n.test.ts`. For `en`, `pt-BR`, `es`, `fr` (via `WHATSAPP_NG_LOCALE` and `initI18n`/`resetI18n`, as in `tests/unit/owner-menu-guidance.test.ts`): (a) every key in a declared in-scope list (all keys in [labels.md](contracts/labels.md) plus the existing menu, Voice and archive-menu keys) resolves to a non-fallback value in pt-BR/es/fr unless it is on an explicit exception list (identical-by-nature values); (b) each translation has exactly the English value's `{placeholders}`; (c) the fixed options of the root, each category panel, contact, group, recents-conversation, Voice main, Advanced speech, chat settings and Optional outputs panels are pairwise distinct, and labels across all category panels plus `menu.close` are unique; (d) category display labels and `menu.close` are pairwise distinct; (e) pt-BR contact strings use "contato" and never "contacto". (f) For each locale, each panel exit in [navigation.md](contracts/navigation.md) renders exactly its `menu.back.*` or `menu.close` translation, driven through `chooseWhatsAppSetting`, `MenuHandler` and the Voice/Owner/Optional-outputs views with the scripted UI adapter; this is the SC-001 four-locale check (C1).
- [X] T027 [P] [US3] Extend `tests/unit/owner-menu-guidance.test.ts` so that, per locale, `voice.authUnknown` and `voice.authDenied` contain the rendered `/whatsapp > <voice.menu>` and owner routes, `voice.authNoOwner` contains the owner route, and `service.whatsapp.qrWelcomeMessage` contains the rendered Recents and Owner routes and ends with the localized `voice.menu` word. Derive routes from the rendered root title, never hardcode them.
- [X] T028 [P] [US3] In `tests/unit/whatsapp-command.router.test.ts`, add a per-locale case for the phone `/voice` setup reply: it contains `/whatsapp > ${t('voice.menu')} > ${t('voice.setupChat')}`, and its English output is byte-identical to the baseline sentence (`… Use terminal /whatsapp > Voice > Set up replies for a chat and select this chat. Nothing changed; no speech was enabled.`). Leave the `DENIED` assertion at line ~70 unchanged.
- [X] T029 [P] [US3] In `tests/unit/menu.handler.test.ts`, add per-locale cases (pt-BR, es, fr) for these routes: Connection → Auto-connect (choose Enabled/Disabled labels), Advanced → Privacy (still the English `METADATA_LOG_POLICY`), Groups → Group replies (localized modes, context toggle, the group-context confirmation still English), Replies → Reply delivery (localized status and reporting toggles), paging labels, and the `[Group]` prefix. Assert that each localized option runs the same action as its English counterpart. Add invalid-saved cases per locale for Group replies (`menu.groups.invalid` title, `menu.back.groups` returns without saving) and reporting (`menu.reporting.invalid` warning, other choices preserve reporting flags), and assert the invalid-voice repair title (`voice.invalidSaved`) with `menu.back.main` returning without reset (U2). Assert each heading’s state words are the localized `menu.on`/`menu.off` (or `menu.autoConnect.*`/`menu.state.*`) values, never English “On”/“Off” in pt-BR/es/fr (U1).
- [X] T030 [US3] Run the T026–T029 files and confirm they fail for the expected reason.

### Implementation for User Story 3

- [X] T031 [US3] In `src/i18n.ts`, add pt-BR, es and fr values for the **new** rows in [labels.md](contracts/labels.md): navigation/hints, root/state/status/category (section "Navigation and hints" and "Root, categories and state words").
- [X] T032 [US3] In `src/i18n.ts`, add pt-BR/es/fr values for the Connection/Advanced rows ("Connection and Advanced").
- [X] T033 [US3] In `src/i18n.ts`, add the missing **es and fr** Allowed-groups set (`menu.allowedGroups.*`), `menu.recents.contact.allowGroup` and `menu.recents.addedGroupToAllowList`, plus the new Recents rows (`menu.recents.groupPrefix`, `menu.page.*`).
- [X] T034 [US3] In `src/i18n.ts`, add the missing **pt-BR, es and fr** `menu.replyDelivery.*` set (including `menu.replyDelivery.status`) and the reporting and Optional-outputs rows ("Replies, reporting and optional outputs").
- [X] T035 [US3] In `src/i18n.ts`, add pt-BR/es/fr values for the Group replies rows and `voice.chooseChat`; confirm the other Voice rows from T023 are consistent with the glossary in [research R7](research.md#r7--per-locale-glossary-fr-012).
- [X] T036 [US3] In `src/i18n.ts`, apply the FR-014a citation changes in [citations.md](contracts/citations.md) to pt-BR, es and fr `voice.authUnknown`, `voice.authNoOwner`, `voice.authDenied` and `service.whatsapp.qrWelcomeMessage`. Change only the cited segments. Leave English values and all surrounding text byte-identical.
- [X] T037 [US3] In `src/ui/whatsapp-settings.view.ts`, replace the hardcoded root title and notices with `t('menu.root.title', { state, status })` (state from `menu.state.*`, status from `menu.status.*`, English output identical to the baseline apart from "logged out"), `t('menu.expired')` (both occurrences, including `src/ui/menu.handler.ts:44`) and `t('menu.optionsChanged')`. Keep the `SettingsCategory` IDs.
- [X] T038 [US3] In `src/ui/menu.handler.ts`, replace the hardcoded English labels, headings and notices with `t()` constants used for both rendering and matching: the Connection options (`menu.connection.turnOff`, `menu.connection.autoConnect`), Enabled/Disabled and the auto-connect heading/saved notice, the Off notice (filled with `menu.category.connection`), `menu.advanced.privacy`, `menu.optional.title` (the Optional outputs entry), `menu.groups.*` (replies label, title, invalid, modes, context toggles, saved), the reply-delivery status line and reporting toggles/notices, the paging labels, and the `[Group] ` prefix. Do **not** change the strings in these calls: `ctx.ui.confirm` for Off, reply reporting and group context, and `METADATA_LOG_POLICY`. The Off confirmation title is still matched by the tests and stays English. Also update `handleCommand` category arguments only if the ID type changes (it should not). Every state value interpolated into a heading comes from `t()`: auto-connect `{state}` from `menu.autoConnect.enabled|disabled`; Reply delivery `{stats}`, `{files}`, `{interim}`, `{activity}` and Group replies `{state}` from `menu.on`/`menu.off`. Also replace the History scope `legacy-unassigned` with the existing English-identical wording of `archive.menu.current` only if it reads naturally, otherwise list it as an exception in [labels.md](contracts/labels.md#documented-exceptions-sc-002); replace the send-failure fallback `'Unknown error'` with `t('message.reply.unknownError')` (U1, U4).
- [X] T039 [P] [US3] In `src/ui/optional-output-settings.view.ts`, replace the hardcoded heading, option labels (`menu.optional.*`), image-tool Enable/Disable labels, notices and the invalid-settings warning with `t()`; keep both `ctx.ui.confirm` titles and bodies byte-identical. The heading `{state}` for terminal forwarding comes from `menu.on`/`menu.off` (U1).
- [X] T040 [P] [US3] In `src/services/whatsapp-command.router.ts` (line ~210), change the setup reply to `` `/whatsapp > ${t('voice.menu')} > ${t('voice.setupChat')}` `` as in [citations.md](contracts/citations.md). Change nothing else in this file.
- [X] T041 [US3] In `src/i18n.ts`, delete `menu.root.back`, `menu.allowed.contact.back`, `menu.allowedGroups.group.back` and `menu.recents.contact.back` from every locale once `rg "menu\.(root|allowed\.contact|allowedGroups\.group|recents\.contact)\.back" src tests` shows no remaining reference (update any test reference first).
- [X] T042 [US3] Run the T026–T029 files, then `npm run typecheck` and `npm run lint`.

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Records, preserved-string proof and the full gate.

- [X] T043 [P] Update `docs/menu-diagrams.md` to the new English labels and Back edges (labels only; edges unchanged), add the Esc hint and "Close settings", and note that the five English-only confirmations and the privacy notice stay English in every locale. Update the "source-reviewed" line to the current commit and mention this change. Check against the source, not the old diagrams.
- [X] T044 [P] Align quoted labels in other docs per [plan](plan.md#confirmed-decisions-2026-11-07): `README.md:43` and `:196` (Allowed contacts case; "Log out and delete saved login"), `docs/crispasr.md:294` ("Turn speech off everywhere (revoke consent)"), `docs/reference.md:60` (Back names its destination, root is Close settings, Esc hint) and `tests/manual/prerelease-acceptance.md:60` (Back labels). `rg` each changed English label across `README.md`, `docs/`, `SECURITY.md`, `DEPENDENCIES.md` and `tests/manual/` to catch other citations.
- [X] T045 Run the preserved-string comparison from [quickstart §3](quickstart.md#3-preserved-string-comparison) against `/tmp/i18n.baseline.ts`. The only differences allowed outside menu/label keys are the FR-014a citation substitutions. Also confirm with `git diff 8f32898 -- src/services` that the only service change is the T040 line, and that `git diff 8f32898 -- src/ui` shows no change in any `confirm` title/body or `METADATA_LOG_POLICY`.
- [X] T046 Add an Unreleased entry to `CHANGELOG.md`: what changed (labels, Close settings, contextual Back, Esc hints, translations, citations), what is preserved, and the validation actually run. Do not claim live, platform or recipient-delivery evidence.
- [X] T047 Run the declared checks: `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, `git diff --check`. Record command, result, counts and any skips for the handoff.
- [X] T048 Check changed Markdown links and anchors (`docs/menu-diagrams.md`, `README.md`, `docs/reference.md`, `docs/crispasr.md`, `tests/manual/prerelease-acceptance.md`, `CHANGELOG.md`, this folder). Update the Status line in [spec.md](spec.md) only if the implementation is complete. Before that, perform a manual glossary review: read every pt-BR, es and fr in-scope value against the glossary in [research R7](research.md#r7--per-locale-glossary-fr-012), fix drift, and record “glossary reviewed: <locales>, <date>, deviations: <none|list>” in the handoff (T050). This is the FR-012 evidence; no new checking infrastructure (U3). Also align the spec’s Back-destination table panel names to the final labels if they differ.
- [X] T049 Run the isolated production-entry smoke from [quickstart §4](quickstart.md#4-production-entry-smoke-isolated) for `en`, `pt-BR`, `es` and `fr`, using a disposable HOME and `PI_CODING_AGENT_DIR`. Do not pair, connect or send. If the two-line title renders badly, fall back to the same-line suffix described in the plan's risks, recording the change in [research R1](research.md#r1--where-the-esc-hint-is-rendered) and in the affected tests. If the smoke cannot run, report it as skipped. Do not reload or terminate the owning Pi process from an agent turn.
- [X] T050 Hand off: list touched paths, the commands run with results, what was skipped and why, and that the operator reload and live check are pending. Do not commit, tag or publish.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T004)** → **US1 (T005–T018)** → **US2 (T019–T025)** → **US3 (T026–T042)** → **Polish (T043–T050)**.
- US2 and US3 each need only the Foundational keys, so each is testable on its own. They run after US1 because they share `src/i18n.ts` and `src/ui/menu.handler.ts`, and US1's Back-label rewrite changes the same lines.
- Within a story, write the tests (and confirm they fail) before the implementation.
- T013 → T014 (same file). T015 depends on T012. T016 and T017 are independent of T015.
- T031–T036 all edit `src/i18n.ts`: run them sequentially. T037 → T038 → T042, because the root's matched labels and `menu.handler` labels must change together.
- T043–T044 can run alongside each other, but only after T042. T045 and T047 follow all code changes.

## Parallel Opportunities

- US1 tests: T007, T008, T009 and T010 touch different files and run in parallel with T005–T006.
- US1 implementation: T016 and T017 run in parallel (separate files) after T012–T015.
- US2 tests: T020 runs in parallel with T019.
- US3 tests: T027, T028 and T029 run in parallel after T026.
- US3 implementation: T039 and T040 run in parallel with T037–T038.
- Polish: T043 and T044 run in parallel.

## Implementation Strategy

- **MVP (US1)**: Setup → Foundational → US1. Stop and validate: the exit labels and Esc hints are correct in English, destinations are unchanged and the declared checks pass. This alone fixes the main navigation friction.
- **Increment 2 (US2)**: Clearer contact, group, logout and speech wording. It is mostly string changes plus tests.
- **Increment 3 (US3)**: Translation completion and citation alignment. It is the largest `src/i18n.ts` edit, so it comes last and is guarded by the completeness test.
- Each increment must keep `npm test -- --maxWorkers=2`, lint and typecheck green before the next starts. A release or version bump is a separate decision and is not part of these tasks.

## Coverage

| Requirement | Tasks |
| --- | --- |
| FR-001–FR-005 | T005–T018 |
| FR-006–FR-009 | T019–T025 |
| FR-010–FR-013 | T026, T029, T031–T039, T041–T042, T048 (FR-012 manual glossary review) |
| FR-014, FR-014a, FR-015, FR-016, FR-018 | T027–T028, T036, T038–T040, T045 |
| FR-017 | T043–T044, T046 |
| SC-001 | T005–T008, T010, T026(f) |
| SC-002, SC-003 | T026, T029 |
| SC-004 | T027–T028, T045 |
| SC-005 | T019, T022 |
| SC-006 | T047 |
