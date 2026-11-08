# Feature Specification: Phone Menu Polish

**Feature Branch**: `main` (no branch created; Git hooks disabled)

**Created**: 2026-11-08

**Status**: Implemented — source and synthetic production-entry validation complete; operator visual/live acceptance pending.

**Input**: User description: "Polish the existing WhatsApp phone menus: group /help commands with short explanations; separate shared Pi settings from chat settings in /status; use friendly option labels and indicate current selections; clearly explain numbered replies, expiry, group quoting and cancellation; keep the complete /replies disclosure visible despite title truncation; localize all phone-menu presentation in English, pt-BR, Spanish and French using the existing locale configuration. Keep commands, accepted arguments, model IDs, actions, authorization, consent meaning, confirmations, routing and delivery behavior unchanged. Preserve numbered menus and existing optional polls. No new commands, settings, dependencies, menu framework or terminal changes. Update relevant docs and changelog. Include regression and four-locale tests."

## Scope

A wording/presentation pass over the phone (WhatsApp chat) command surface: `/help`, `/status`, and the numbered menus opened by `/model`, `/think`, `/voice`, `/replies`, `/new`, `/off` and `/quit`, plus their short replies (usage, busy, cancelled, denied, failure). The terminal `/whatsapp` menu (feature 041) is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand available commands (Priority: P1)

The verified owner sends `/help` from WhatsApp and sees commands grouped by purpose (for example: information, shared Pi session, this chat, WhatsApp/process), each with a one-line explanation and its accepted argument form, plus which commands are owner-only.

**Why this priority**: `/help` is the entry point; today it is a single dense line.

**Independent Test**: Send `/help` in each locale; verify every existing command appears exactly once in a group with an explanation, and no command is added or removed.

**Acceptance Scenarios**:

1. **Given** any allowed chat, **When** a participant sends `/help`, **Then** the reply lists all current commands (`/help /status /stop (/abort) /model /think /compact /new /voice /replies /off /quit`) grouped with short explanations, the owner-only rule, menu expiry and this chat's current mode.
2. **Given** a non-owner sends `/help`, **When** the reply arrives, **Then** it remains informational and grants nothing (unchanged authorization).

---

### User Story 2 - Read status at a glance (Priority: P1)

The user sends `/status` and sees two clearly labeled sections: "Shared Pi and WhatsApp" (connection, Pi idle/busy, model, thinking, context, reply delivery, final stats) and "This chat" (automatic replies, voice mode), using friendly values instead of internal tokens.

**Independent Test**: Send `/status` in each locale and verify both section headings, all existing fields and values for representative states.

**Acceptance Scenarios**:

1. **Given** any state, **When** `/status` is sent, **Then** shared fields appear under a shared heading and per-chat fields under a this-chat heading, with no field lost.
2. **Given** a model is active, **When** status shows it, **Then** the model identifier is shown verbatim (not translated).

---

### User Story 3 - Choose from clear numbered menus (Priority: P2)

The owner opens `/think`, `/voice`, `/replies`, `/new`, `/off`, `/quit` or `/model` and sees friendly option labels with the current selection marked, followed by an instruction explaining how to answer: reply with the option number within 5 minutes; in groups, reply by quoting the menu; any other text cancels the menu.

**Independent Test**: Open each menu in each locale; verify labels, the current-selection marker, the instruction text, and that choosing each number triggers the same action as before.

**Acceptance Scenarios**:

1. **Given** voice mode is "both" for this chat, **When** `/voice` opens, **Then** the "Voice + text" option is marked current, and selecting any number applies the same value as today.
2. **Given** a group chat, **When** a menu is sent, **Then** the instruction states the quote requirement; in a direct chat it does not.
3. **Given** a menu older than 5 minutes or ordinary text sent, **When** a number is then sent, **Then** behavior is unchanged (expired/cancelled), and the instruction had described this.
4. **Given** optional native polls are enabled, **When** a menu opens, **Then** the poll is still sent with the same number of options in the same order, using the same friendly labels.

---

### User Story 4 - See the full /replies disclosure (Priority: P2)

When `/replies` opens, the full privacy disclosure (what enabling reporting shares with allowed chats and what it never shares, plus the invalid-settings note when applicable) is visible in full, even where the menu title or poll name is shortened.

**Independent Test**: Open `/replies` in each locale (with and without native polls, and with invalid saved reporting settings); verify the complete disclosure text is delivered unabridged in the numbered menu message.

**Acceptance Scenarios**:

1. **Given** the title length limit would cut the disclosure, **When** `/replies` is sent, **Then** the complete disclosure still appears unabridged in the delivered numbered menu message.

---

### User Story 5 - Use my language (Priority: P2)

With the existing locale configuration set to English, pt-BR, Spanish or French, all phone-menu presentation (help, status, menu titles, labels, instructions, short replies) appears in that language.

**Independent Test**: For each of the four locales, render every phone-menu surface and confirm no untranslated English remains other than allowed tokens.

**Acceptance Scenarios**:

1. **Given** locale pt-BR, **When** any phone command reply or menu is produced, **Then** all presentation text is Brazilian Portuguese; commands, arguments, model identifiers and provider names stay verbatim.

### Edge Cases

- Group menus: non-owner numeric replies and non-quoted replies keep today's handling.
- Paged `/model` lists: current model marked when on the visible page; Previous/Next page labels localized; order and page size unchanged.
- Busy, denied, usage, too-long, no-model, cancelled and failure replies are localized without changing when they are sent.
- Invalid saved reporting settings: the disclosure includes the repair note.
- Unknown locale: falls back as the existing locale configuration does today (English).
- Unreadable saved speech preferences: `/voice` still opens with the original four actions, but no current marker; selection retains its existing validation/refusal and cannot repair or enable speech.
- Long translations: titles and labels must fit their limits untruncated; explanatory text goes in the menu body, which must also fit in every locale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/help` MUST group every existing command with a one-line explanation and its accepted argument form, and state the owner-only rule, menu expiry and the chat's current mode.
- **FR-002**: `/status` MUST present shared settings and this-chat settings under separate headings, retaining every currently reported field.
- **FR-003**: Menu options MUST use friendly labels and mark the current selection wherever the current value is known (thinking level, voice mode, reply delivery, final stats, each reporting toggle, current model on its page).
- **FR-004**: Every numbered menu MUST explain: answer with the option number, the 5-minute expiry, the quote requirement in groups (only in groups), and that ordinary text cancels.
- **FR-005**: The complete `/replies` disclosure MUST be delivered unabridged in the numbered menu message regardless of title/poll-name length limits. The full disclosure (including the invalid-settings note) MUST fit the menu body limit in every locale; it is never truncated.
- **FR-005a**: Menu titles MUST be short enough to appear untruncated in every locale; shared-session guidance and other explanations MUST appear in the menu body, not the title or poll name.
- **FR-006**: All phone-menu presentation MUST be localized in English, pt-BR, Spanish and French via the existing locale configuration.
- **FR-007**: Commands, aliases, accepted arguments, model identifiers, option order and count, selected values/actions, authorization, consent meaning, confirmations (Cancel/Confirm for `/new`, `/off`, `/quit`), expiry, routing and delivery behavior MUST be unchanged.
- **FR-008**: Numbered text menus MUST remain the primary mechanism; optional native polls MUST keep their existing opt-in behavior, using the same option labels.
- **FR-009**: No new commands, settings, dependencies, menu framework or terminal-menu changes.
- **FR-010**: Relevant docs (README phone-control section, operating reference, menu diagrams) and CHANGELOG MUST reflect the new wording.
- **FR-011**: Regression tests MUST cover unchanged actions/authorization/routing, and four-locale tests MUST cover help, status, every menu, instructions and the full disclosure.

### Key Entities

- **Phone command reply**: informational text for `/help`, `/status` and short outcomes.
- **Numbered menu**: title, ordered options (label + unchanged action), current-selection marker and answer instructions; optionally mirrored as a native poll.
- **Locale**: existing configured language (en, pt-BR, es, fr).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing phone commands appear in `/help` with an explanation, in all 4 locales.
- **SC-002**: `/status` shows 100% of current fields, split into 2 labeled sections, in all 4 locales.
- **SC-003**: Every mutually exclusive choice with a known current value marks exactly one option as current; independent on/off toggles show their current state.
- **SC-004**: 0 untranslated English phone-menu strings in pt-BR, es and fr outside allowed tokens.
- **SC-005**: For every menu and option, the selected action is identical to the pre-change baseline (0 behavior differences in regression tests).
- **SC-006**: The `/replies` disclosure is delivered 100% unabridged in all 4 locales, including the invalid-settings case.

## Assumptions

- "Phone menus" means the chat command surface handled for allowed WhatsApp chats; the existing locale setting (`WHATSAPP_NG_LOCALE`/current i18n resolution) selects language; it is not per-chat.
- Allowed untranslated tokens: command names and arguments, model/provider identifiers, "Pi", "WhatsApp".
- Status values (e.g., connection state) are shown with friendly localized wording; underlying values are not changed.
- The current-selection marker is a localized `(current)` suffix that also works in poll options (research R3). Existing model-label privacy hiding and display limits remain; exact model action identifiers are unchanged.
- Prior terminal-menu wording (041) is reused where the same concept appears, for consistency.
- Validation uses synthetic sockets/fixtures; no live WhatsApp sends.
