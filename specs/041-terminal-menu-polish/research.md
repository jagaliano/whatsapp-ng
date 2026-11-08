# Research: Terminal menu polish

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Baseline**: `8f32898`

No Technical Context item was left as NEEDS CLARIFICATION. The decisions below settle the design questions the spec left to planning. Evidence comes from current source/tests and the installed Pi 1.5.0 host, not from `docs/menu-diagrams.md`.

## R1 — Where the Esc hint is rendered

- **Decision**: Add the hint in one place. `withSettingsRequest` (`src/ui/whatsapp-settings.view.ts`) already wraps every `select`/`input`/`editor` of the settings request. Its scoped dialogs append a second line, `\n` + `t('menu.hint.esc')`, to the title. `confirm` and `custom` (the message-detail overlay) are not changed.
- **Rationale**: This covers every panel in the request, including Voice, Owner, Optional outputs and the quoted-reply editor, which all receive the scoped context. It needs no per-call edits and cannot drift. Pi 1.5.0 renders titles through `Text`/`wrapTextWithAnsi`, which split on `\n` (`node_modules/@mariozechner/pi-tui/dist/utils.js`), so the hint appears as its own line. RPC clients receive the same two-line title string.
- **Alternatives rejected**: Appending the hint at each call site is roughly 40 edits and could miss some. The `description` dialog option is rendered by the host, but `ExtensionUIDialogOptions` in Pi 1.5.0 only declares `signal`/`timeout`, so using it would be untyped. A same-line suffix would make the already-long Voice and reply-delivery headings longer. Changing the host's own "esc cancel" key row is host-owned and out of scope.

## R2 — Contextual Back labels

- **Decision**: Use one full translation key per destination (`menu.back.*`; see [contracts/navigation.md](contracts/navigation.md)), not a `Back to {destination}` template. The root exit uses `menu.close`.
- **Rationale**: Articles and prepositions differ by language and destination ("Voltar para a conversa", "Retour aux Contacts autorisés", "Volver al grupo"), and a template cannot get them right. Destinations are fixed panel names, never user data (contact or chat names). A Back label therefore never matches a dynamic entry, and its length stays bounded.
- **Caller-dependent exits**: Recents, History, the Voice chat picker and the remote-voice choice receive their exit label from their caller as one extra argument. This is the "necessary local adaptation" the spec allows. The control flow that chooses the destination does not change.

## R3 — Root categories under clarification C

- **Decision**: Keep the `SettingsCategory` identifiers (`'Connection'`, `'Chats / Owner'`, …) as internal IDs. `chooseWhatsAppSetting` displays `menu.category.*` labels (Voice uses `voice.menu`), maps the chosen label back to its ID, and titles each category panel with the localized name. `resumeCategory`, Recents' captured parent and every `handleCommand(ctx, <id>)` keep using IDs.
- **Rationale**: This translates what the operator sees (FR-010) without migrating option identity. The English displayed labels stay identical, so English citations and docs do not change.
- **Action matching**: `MenuHandler.showSettings` switches on the label returned by the category panel. Hardcoded cases (`'Privacy and logs'`, `'Optional outputs'`, `'Group replies'`, `'Turn WhatsApp off'`, `'Auto-connect on startup'`) become `t()` constants. Because the switch ignores which category the label came from, labels shown by `chooseWhatsAppSetting` must be unique across all category panels in every locale. A test enforces this ([contracts/navigation.md](contracts/navigation.md#identity-rules)).

## R4 — Path citations (FR-014a)

- **Decision**: Only path segments change, and only in pt-BR, es and fr (English labels for Voice, Chats / Owner, Owner and Recents do not change). Affected texts: `voice.authUnknown`, `voice.authNoOwner`, `voice.authDenied`, `service.whatsapp.qrWelcomeMessage`, and the phone `/voice` setup reply in `src/services/whatsapp-command.router.ts:210`. That reply already inserts the localized `t('voice.setupChat')` after a literal `Voice`, so it becomes `` `/whatsapp > ${t('voice.menu')} > ${t('voice.setupChat')}` ``; its English output is byte-identical.
- **Unchanged English-only texts**: `DENIED` (`whatsapp-command.router.ts:18`), the repair errors in `session.manager.ts:458` and `speech-settings.ts:24`, and the tool descriptions in `whatsapp-ng.ts`. Under FR-014a, English-only texts cite English labels, and those labels do not change.
- **Exact before/after**: [contracts/citations.md](contracts/citations.md).
- **Existing guard**: `tests/unit/owner-menu-guidance.test.ts` already derives the rendered owner route per locale and asserts that every notice contains it. Extend it to cover the Voice route and the QR "in Voice" phrase.

## R5 — English wording and document churn

- **Decision**: Use sentence case for English menu labels ("Allowed contacts", "Send message", "Add alias"). Change English wording only where the spec requires clarity: sending number versus removal, identifiers, logout, speech labels and Back/Close. Keep "Turn WhatsApp off", "Auto-connect on startup", "Optional outputs", "Reply delivery", "Group replies" and "Set up replies for a chat" unchanged.
- **Rationale**: Public docs and the manual acceptance guide cite these labels (`README.md:43,46,196`, `docs/reference.md:124,137,177,192`, `docs/crispasr.md:294`, `SECURITY.md:23`, `tests/manual/prerelease-acceptance.md:27,34,60,155`). Fewer English changes means fewer doc edits and no change to English citations in transmitted text.
- **Consequence**: Besides the diagrams and changelog (FR-017), the implementation aligns the doc lines that cite a changed English label: `README.md:43` (case), `README.md:196` (logout), `docs/crispasr.md:294` (revoke label), `docs/reference.md:60` (Back/Close wording) and `tests/manual/prerelease-acceptance.md:60` (Back labels). These are documentation-only edits.

## R6 — Confirmations, consent and policy text

- **Decision**: Confirmation dialogs are not relabeled, with three exceptions: the logout title (FR-008), and the already-localized contact/group removal confirmations, which get terminology alignment (e.g. pt "Contactos" → "Contatos") and titles matching their option. Hardcoded English confirmations stay byte-identical: Off, reply reporting, group context, automatic image, terminal forwarding. `METADATA_LOG_POLICY`, the privacy notice shared with the logger, also stays English.
- **Rationale**: FR-015 freezes consent and opt-in bodies. The Off confirmation is a protected destructive-action review on the same footing. Keeping these bodies avoids rewording a safety text in a polish pass. They are listed as documented exceptions for SC-002.

## R7 — Per-locale glossary (FR-012)

| Concept | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| contact | contact | contato | contacto | contact |
| group | group | grupo | grupo | groupe |
| chat | chat | conversa | chat | discussion |
| sending number | sending number | número de envio | número de envío | numéro d’envoi |
| phone number | phone number | número de telefone | número de teléfono | numéro de téléphone |
| owner | owner | proprietário | propietario | propriétaire |
| history | History | Histórico | Historial | Historique |
| settings | settings | configurações | ajustes | réglages |
| back | Back to … | Voltar para … / ao … | Volver a … / al … | Retour à … / au … / aux … |
| close | Close settings | Fechar configurações | Cerrar ajustes | Fermer les réglages |
| Esc key | Esc | Esc | Esc | Échap |
| imperative | Enter … | Digite … | Ingresa … | Entrez … |

French typography: use `’` and a non-breaking-style space before `:`/`?` as the existing strings do. Normalize the stray ASCII `'` in `menu.allowed.contact.*` French values.

## R8 — Validation approach

- **Decision**: Add `tests/unit/terminal-menu-i18n.test.ts` for key completeness in every locale, per-panel distinctness and cross-category uniqueness. Extend `owner-menu-guidance.test.ts` for citations. Update the existing navigation tests (`menu.handler.test.ts`, `settings-navigation.test.ts`, `voice-settings.view.test.ts`, `optional-output-settings.view.test.ts`, `message-detail.view.test.ts`) to the new labels without weakening their destination and outcome assertions, and add exit-label assertions for each row of the navigation contract.
- **Preserved strings (SC-004)**: Check preserved strings with a one-off comparison against `8f32898` (see [quickstart.md](quickstart.md#3-preserved-string-comparison)). The script is not committed, so baseline strings are not duplicated in the test tree. Phone surfaces are covered by the existing `whatsapp-command.router`/`command-menu` suites.
- **Type safety**: `t()` keys are `keyof typeof fallback`, so `npm run typecheck` rejects references to missing English keys. Locale completeness needs the new test because translations are `Partial`.

## R9 — Unused keys

- **Decision**: Remove keys that no source references after the change (`menu.root.back`, `menu.allowed.contact.back`, `menu.allowedGroups.group.back`, `menu.recents.contact.back`) from all locales. Keep `menu.root.disconnectWhatsApp`: `MenuHandler` still matches it.
- **Rationale**: This avoids dead translations that could later be mistaken for live labels. The change is minimal and local to `src/i18n.ts`.

## R10 — Message-detail hint

- **Decision**: Change only the text: "Press R to reply • Enter or Esc returns to History" / "Enter or Esc returns to History". The handled keys (Enter, Esc, Backspace, R) and the `quoteAvailable` behavior stay the same. Backspace is not mentioned, to keep the hint short.

## Implementation notes (2026-11-08)

- Baseline: 1,641 tests / 86 files passed, lint and typecheck passed (macOS, Node 26.13.0). No baseline skips.
- US1: 164 tests / 8 files passed, including the network-guarded production-entry RPC fixture; lint and typecheck passed. Initial regressions failed on old Back labels and missing hint as expected.
- Existing action fixtures use `Back` as a test-only exit gesture, resolved to the last rendered option. Exact exit labels are asserted independently by the panel-contract matrix; original destination/authority/action assertions are retained. This avoids repeating localized exit text throughout unrelated action tests.
- Detail-hint regression exposed truncation at width 80: the sizing code measured only the shorter close hint. `message-detail.view.ts` now measures the actual displayed hint (one local sizing correction, no new layout). The width-80 regression and close/reply key tests pass.

- US2 initial regression run: 35 expected old-label failures; after wiring, 94 tests / 2 files passed. US3 dictionary regressions initially failed on missing locale keys; final targeted gate passed 425 tests / 12 files.
- The per-locale exit/action/repair matrix is centralized in `tests/unit/terminal-menu-i18n.test.ts` rather than duplicating its fixtures in `menu.handler.test.ts`. Existing English action/authority/egress tests remain in their original suites.
- `voice.previewConfirmTitle` / `voice.introduceConfirmTitle` preserve the original titles in every locale, decoupled locally from the clearer option labels. Bodies, review text and preview phrase are unchanged.
- The fixed `legacy-unassigned` archive marker remains a documented technical-token exception; no account identifiers are reworded.
- Glossary reviewed: pt-BR, es, fr, 2026-11-08. Corrected es `voice.changed` from “opciones” to “ajustes”, fr `voice.changed` from “paramètres” to “réglages”, and es Edge “online” to “en línea”. Other terminology deviations are confined to the deliberately frozen consent/disclosure/authorization texts and technical tokens. No glossary checking infrastructure was added.
- Found and translated the existing English no-readable-text placeholders in the detail/reply views (all three non-English locales). The Voice heading displays localized Edge wording without changing the destination description used in consent bodies.
- Production-entry RPC smoke: four new `menu-polish:<locale>` cases use disposable state and existing socket/provider/network guards. All four passed: categories and contextual Back, auto-connect Back, root Close settings, input cancellation, unchanged config, zero socket starts/model starts/network attempts. These substitute for an interactive visual TUI smoke; no owning process was reloaded.


## Validation and handoff (2026-11-08)

Source scope: working tree based on `8f32898`, macOS / Node 26.13.0 / Pi 1.5.0. No package qualification, publish, real account, live provider or recipient-delivery claim.

- Setup: existing `.gitignore`, flat ESLint ignores and `package.json#files` allowlist cover this change. No ignore/config/dependency edits were needed.
- Baseline: `npm test -- --maxWorkers=2` passed 1,641 tests / 86 files, no skips; `npm run lint` and `npm run typecheck` passed. Commands use a disposable HOME and `PI_CODING_AGENT_DIR` with an allow-listed credential-free environment, based on `scripts/release.mjs` (release preparation was not run).
- TDD: navigation/hint regressions failed first; wording tests failed on old labels; dictionary tests failed on missing locale entries. These then passed. Initial full gate found five old-label fixture failures in `whatsapp-ng.message-end.test.ts`; only its three selected-label literals changed, preserving all send/settlement/cancellation assertions.
- Targeted gate: the 12 suites listed in quickstart passed 425 tests before the final coverage additions. Final four-locale panel matrix alone passed 183 tests.
- Production-entry RPC: `npx vitest run tests/unit/phone-control.rpc.test.ts -t "menu-polish:" --maxWorkers=2` passed four locale cases; 17 unrelated scenarios were filtered out in that targeted invocation, not native-tool skips. The final full suite includes all scenarios with no skips.
- An early inherited-environment `npm run lint` tool invocation reported 2,893 findings including vendored/generated JavaScript paths, unlike the declared scoped script. It is not treated as clean evidence. The isolated script reruns printed the declared globs and passed; no dependencies or ignore settings were changed to suppress those findings.
- Final `npm test -- --maxWorkers=2`: **1,833 tests / 87 files passed**, no skips. Final `npm run lint` and `npm run typecheck`: exit 0. Final `git diff --check`: exit 0.
- One-off preserved-string/AST comparison against `8f32898`: 1,051 frozen translation values and 16 citation-key/locale pairs checked; confirmation bodies identical, original introduction/preview titles identical via their new dedicated keys, preview phrase identical, logger/phone-menu service/composition root identical. Only the approved citation substitutions and terminal labels/placeholders changed. The sole service diff is the phone `/voice` citation.
- Active LSP check: no error diagnostics in the changed test probes. Source checks retain existing advisory findings (including the lazy-UI Proxy's `Reflect.get` heuristic and unused parser hint) and multilingual spelling false positives; no unrelated refactor performed. Typecheck and lint above are the declared gates.
- Glossary review was manual (pt-BR, es, fr); changes and deliberately frozen exceptions are listed above. No glossary infrastructure added.
- Changed Markdown links/anchors checked with a local script including explicit HTML anchors (133 local links). The initial heading-only checker falsely flagged the existing `fork-and-legacy-names` HTML anchor; the corrected checker recognizes it.
- Visual TUI and real-client acceptance are **not run**. The actual-entry RPC fixture is the bounded lifecycle/tool/menu evidence. Operator reload and any live check remain pending. No commits, branch changes, delegation or release actions.
