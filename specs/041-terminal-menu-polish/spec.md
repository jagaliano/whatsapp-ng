# Feature Specification: Terminal menu polish

**Feature Branch**: none — specification directory `specs/041-terminal-menu-polish` (no branch was created)

**Created**: 2026-11-07

**Status**: Implemented — source and synthetic production-entry validation complete; operator visual/live acceptance pending

**Input**: User description: "Improve the existing terminal /whatsapp menus wording, navigation clarity and translations. This is a bounded polish pass, not a menu redesign or a continuation of the abandoned menu-option-identity work. Keep the existing menu hierarchy, option order, eligibility and actions. In scope: clearer labels (sending number versus contact removal, contact/group identifiers, logout, speech settings); “Close settings” at the root and contextual Back labels in child panels; concise navigation hints describing actual Back/Esc behavior; consistent terminal labels, headings and hints in English, pt-BR, Spanish and French. Preserve Esc closing the settings request, message-detail close returning to History, every Back destination and save/close outcome, authorization, consent bodies and their translations, recipient/text review, sends, routing, history, delivery, phone-menu output, transmitted introductions and preview phrases. Out of scope: new framework, settings, dependencies or capabilities; restructuring; dense-panel layout redesign; unrelated fixes; reviving earlier corrective/refactoring packages."

**Baseline**: current source at `8f32898` (`src/ui/whatsapp-settings.view.ts`, `src/ui/menu.handler.ts`, `src/ui/voice-settings.view.ts`, `src/ui/optional-output-settings.view.ts`, `src/ui/message-detail.view.ts`, `src/ui/message-reply.view.ts`, `src/i18n.ts`). Source behavior takes precedence over `docs/menu-diagrams.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand where Back and Esc go (Priority: P1)

An operator navigating `/whatsapp` can tell, before choosing, whether an option closes settings or returns to a named parent, and knows that Esc closes the whole settings request.

**Why this priority**: Today every exit is labelled “Back”, including the root (which closes settings), and Esc closing everything is undocumented in the panel. Mis-navigation is the most frequent friction.

**Independent Test**: Drive each panel with a scripted terminal adapter; the exit label names the panel actually reopened, the root exit reads “Close settings”, and the heading hint matches the observed Esc outcome.

**Acceptance Scenarios**:

1. **Given** the root panel, **When** it is shown, **Then** its last option is “Close settings” and choosing it closes the request exactly as Back does today.
2. **Given** any child panel listed in the Back-destination table, **When** it is shown, **Then** its exit option names that destination (e.g. “Back to Allowed contacts”) and choosing it reopens that destination.
3. **Given** a panel whose Back destination depends on its caller (Recents, History, Voice chat picker, remote voice choice), **When** it is reached from each caller, **Then** the label names the caller actually returned to.
4. **Given** any menu, text input or editor inside the settings request, **When** the operator presses Esc, **Then** the request closes (unchanged) and the visible hint said so.
5. **Given** a message-detail overlay, **When** it is closed with Enter, Esc or Backspace, **Then** History reopens (unchanged) and the overlay hint says it returns to History.

---

### User Story 2 - Clear labels for contacts, groups, logout and speech (Priority: P1)

An operator can distinguish removing a contact's sending number from removing the contact, recognizes which identifier is shown or entered for contacts and groups, understands that logout deletes the saved login, and can read speech settings without knowing internal terms.

**Why this priority**: “Remove Number” beside “Remove Contact”, “Print Contact” and “Logoff (Delete Session)” are ambiguous and can lead to an unintended removal or logout.

**Independent Test**: Render each affected panel in every locale and select each relabeled option; the same existing action runs, with the same confirmations and outcomes.

**Acceptance Scenarios**:

1. **Given** an allowed contact with a sending-number override, **When** its panel is shown, **Then** the override options mention the sending number and the removal option states removal from Allowed contacts; selecting each runs today's action.
2. **Given** an allowed contact or group, **When** the operator chooses the identifier option, **Then** its label names the identifier shown (phone number or group JID) and today's print/notify behavior runs.
3. **Given** a registered login, **When** Advanced is shown, **Then** the logout option states that it logs out and deletes the saved login on this machine, distinct from “Turn WhatsApp off”, and its confirmation still states credential deletion.
4. **Given** Voice and Advanced speech settings, **When** shown, **Then** backend, voice, speed, format and default-mode labels describe what is changed in plain words; selecting each runs today's action.

---

### User Story 3 - Consistent localized terminal menus (Priority: P2)

An operator using pt-BR, Spanish or French sees terminal menu labels, headings and hints in that language with consistent terminology, and no English leftovers apart from documented exceptions.

**Why this priority**: Spanish and French lack the whole Allowed-groups and Reply-delivery label sets; pt-BR mixes “Contactos”/“contato” and lacks Reply-delivery; several panels are hardcoded English.

**Independent Test**: For each locale, enumerate every terminal menu string in the inventory and compare against the English fallback and the exception list.

**Acceptance Scenarios**:

1. **Given** locale pt-BR, es or fr, **When** every panel in the Back-destination table is rendered, **Then** no option, heading or hint is the untranslated English fallback, except the documented exceptions.
2. **Given** any locale, **When** a translated label is selected, **Then** the same action runs as for the English label.
3. **Given** pt-BR, **When** contact terms appear, **Then** a single Brazilian Portuguese term (“contato”) is used throughout.
4. **Given** any locale, **When** phone guidance, the phone `/voice` setup reply, the QR welcome message or a repair error cites a `/whatsapp > …` path, **Then** every cited segment matches a label visible in that locale's terminal menu, and the rest of the text is unchanged.

### Edge Cases

- Translated category names must not collide with each other or with “Close settings” in any locale.
- Two fixed options in one panel must not render identically in any locale; a duplicate would make one action unreachable.
- Dynamic entries (contact/group names, aliases, chat labels, tool names, history scopes) keep their current rendering; collisions between user-provided names and fixed labels remain as today (option identity is out of scope) and must not become more likely through a new label equal to an existing one.
- Panels with conditional options (Connect/Off, logout, history scope, contact Send Message, remote-only format, server-default voice, Optional outputs, Owner) keep identical eligibility in every locale.
- Invalid-saved repair panels (voice, group policy, optional outputs, reporting) keep their repair semantics; Back from the voice repair panel still returns to the root without repairing.
- Settings expiry still closes the request with the existing reopen notice; Back never renews authority.
- An empty Recents or History list still notifies and returns to its caller.
- The Pi host's own key-hint row (e.g. “esc cancel”) is host-owned and is not changed; extension hints must not contradict it.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation**

- **FR-001**: The root panel's exit option MUST read “Close settings” (localized) and keep today's close outcome.
- **FR-002**: Every child-panel exit option MUST name its actual destination per the Back-destination table, including caller-dependent destinations, and MUST keep that destination.
- **FR-003**: Every select heading, text-input prompt and editor title within the terminal settings request MUST carry a concise localized hint that Esc closes settings. Confirmation dialogs are excluded (their No/Esc outcome stays caller-specific).
- **FR-004**: The message-detail overlay hints MUST state that closing returns to History (and R replies when a quote is available); its keys and outcome are unchanged.
- **FR-005**: Menu hierarchy, option order, option eligibility, the action each option invokes, every Back destination and every save-then-close or save-then-stay outcome MUST be unchanged.

**Labels**

- **FR-006**: Allowed-contact options MUST distinguish the sending-number override (“Set sending number” / “Remove sending number”) from contact removal (“Remove from allowed contacts”); its input prompt and notices MUST say “sending number”.
- **FR-007**: Identifier options and prompts MUST name the identifier: contacts by phone number, groups by group JID (e.g. “Show phone number”, “Show group JID”, “Enter phone number (e.g. +5511999999999)”).
- **FR-008**: The logout option and its confirmation title MUST state logging out and deleting the saved WhatsApp login on this machine; the confirmation MUST still state credential deletion. The label MUST be distinguishable from “Turn WhatsApp off”, which retains login and history.
- **FR-009**: Speech-setting labels (backend, Edge voice, provider voice, speed, format, default mode, preview, introduction, revoke) MUST be plain-language and consistent with the Voice root; terms shared with consent bodies MUST keep their meaning.
- **FR-010**: Hardcoded English terminal labels, headings, hints and non-consent menu notices in the menu sources (e.g. categories, “Auto-connect on startup”, Enabled/Disabled, “Turn WhatsApp off”, “Privacy and logs”, “Group replies” and its modes, “Optional outputs” labels, reporting toggles, Previous/Next, “[Group]”, status words in headings) MUST be localizable and translated. This includes the six root category names (“Connection”, “Chats / Owner”, “Replies”, “Voice”, “Groups”, “Advanced”); text that cites them is aligned under FR-014a.

**Translations**

- **FR-011**: Every terminal menu string in scope MUST exist in English, pt-BR, es and fr, including the missing Allowed-groups, Recents-group and Reply-delivery sets.
- **FR-012**: Each locale MUST use one consistent term per concept across labels, headings, hints and notices (contact, group, sending number, owner, history, settings, back/close).
- **FR-013**: Fixed option labels within a panel MUST be distinct in every locale, and every localized label MUST invoke the same action as its English counterpart; only the local comparisons needed for that are changed.

**Preserved surfaces**

- **FR-014**: Text sent to WhatsApp or shown by phone commands MUST be byte-identical per locale — including phone-menu output, phone guidance, the QR welcome message, the introduction disclosure text and the preview phrase — except for the terminal-path citations permitted by FR-014a.
- **FR-014a**: Any text that cites a terminal `/whatsapp > …` path or quotes a terminal label (phone owner/speech guidance, the phone `/voice` setup reply, the QR welcome message, saved-settings repair errors) MUST cite the labels the operator actually sees in that locale after this change. Only the cited path segments/labels change; all surrounding wording stays byte-identical. English-only texts cite the English labels. Each such text is listed in the implementation plan with its before/after citation.
- **FR-015**: Authorization checks, consent and opt-in bodies and their existing translations (speech consent, group opt-in, reporting disclosure, group-context disclosure, automatic image consent, terminal forwarding, owner confirmation, introduction/preview review) MUST be unchanged; English-only consent bodies stay as they are.
- **FR-016**: Recipient/text review, actual sends, routing, history, delivery semantics and settings persistence MUST be unchanged.

**Records**

- **FR-017**: `docs/menu-diagrams.md` MUST be updated to the new labels and hints, and `CHANGELOG.md` MUST record the change. Other public or manual-acceptance docs that quote a changed English label MUST be aligned to it.
- **FR-018**: The privacy and logs notice MUST stay unchanged, and the English-only texts left untranslated (FR-015) MUST be listed as documented exceptions.

### Back-destination table (preserved contract)

| Panel | Exit returns to |
| --- | --- |
| Root | Closes settings |
| Connection, Chats / Owner, Replies, Groups, Advanced | Root |
| Auto-connect on startup | Connection |
| Reply delivery; Optional outputs | Replies |
| Automatic image tools | Optional outputs |
| Owner; Allowed contacts | Chats / Owner |
| Allowed contact | Allowed contacts |
| Group replies; Allowed groups | Groups |
| Allowed group | Allowed groups |
| Local history scope | Advanced |
| Recents | Captured parent: Chats / Owner or Advanced |
| Recent conversation | Recents |
| History | Caller: recent conversation, allowed contact or allowed group |
| Voice; invalid-voice repair | Root |
| Voice chat picker | Voice (setup, chat controls) or Advanced speech settings (preview) |
| Chat setup mode picker | Voice chat picker |
| Chat settings | Voice |
| Chat settings mode picker | Chat settings |
| Advanced speech settings | Voice |
| Speech service; default mode; audio format | Advanced speech settings |
| Speech API protocol | Speech service |
| Remote voice choice | Protocol (during backend setup) or Advanced speech settings (standalone) |

### Key Entities

- **Terminal menu string**: a label, heading, hint or non-consent notice rendered by the terminal settings menus, with an English fallback and pt-BR/es/fr translations.
- **Preserved string**: consent/authorization body, review body, phone-facing or transmitted text; excluded from changes.
- **Panel exit**: the per-panel option that closes settings (root) or reopens a named destination.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of panels in the Back-destination table show an exit label naming the destination actually reopened, verified in all four locales.
- **SC-002**: 0 in-scope terminal menu strings fall back to English in pt-BR, es or fr, other than documented exceptions (proper nouns, protocol/format names, user data, preserved English-only consent bodies).
- **SC-003**: For every relabeled or translated option, selecting it in each locale produces the same action and resulting panel/close outcome as before (100% of covered options).
- **SC-004**: 0 differences in preserved strings (FR-014, FR-015) per locale compared with the baseline, other than FR-014a path/label citations; 100% of those citations match the visible terminal labels of their locale.
- **SC-005**: An operator can identify, from the panel alone, which of the two contact removal options deletes the contact, without consulting documentation.
- **SC-006**: Relevant menu, navigation and translation regressions and all of the repository's declared checks pass.

## Assumptions

- Scope is the terminal `/whatsapp` hierarchy in the files listed under Baseline; phone slash-command menus are not edited.
- Hints are text in extension-owned headings/prompts; the Pi host key-hint row is not modified.
- Proper nouns and technical tokens (WhatsApp, Microsoft/Edge, OpenAI-compatible, Fish, mp3/wav/opus, JID, URLs, environment-variable names) stay untranslated.
- Exact wording for each locale is chosen during implementation within these requirements; English examples above are indicative.
- Labels currently used as action identifiers may need local comparison adaptations; no general option-identity migration is introduced. Root categories may keep stable internal identifiers while displaying localized names.
- Clarification 2026-11-07 (option C): root categories are translated and terminal-path citations in phone/transmitted text are updated to match, as a deliberate, bounded exception to the original “phone-menu output and transmitted introductions preserved” constraint. Introduction disclosure text, preview phrase and phone-menu choice lists are not affected.
- Tests asserting old English labels are updated alongside the change; behavior assertions are not weakened.
- Declared checks are those in `AGENTS.md`: `npm test -- --maxWorkers=2`, `npm run lint`, `npm run typecheck`, plus `git diff --check` and changed-link checks.
- This record reuses number 041; an earlier, since-removed `041-release-gate-existing-version` record exists only in Git history.
