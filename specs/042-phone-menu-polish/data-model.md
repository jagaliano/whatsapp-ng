# Data Model: Phone Menu Polish

No persisted data changes.

## PhoneMenu (in-memory, existing `Menu<T>`)
- `title` (short, ≤120 after sanitizing) — also poll name
- `body?` (new, optional, ≤1,000, text message only; over-limit is rejected, never truncated) — full `/replies` disclosure or shared-session guidance
- Raw `title` and option labels must be ≤120 before sanitizing in every locale (no silent truncation)
- `options[]`: `{ label (localized, may end with current marker), value: Action (unchanged) }`, 1–12, order fixed
- `instruction` (localized; group variant adds quote requirement)
- Lifecycle unchanged: created → active (text/poll id) → selected | cancelled by ordinary text | expired at 5 min.

## PhoneReply
- Localized informational text: help, status (sections Shared / This chat), outcome lines.

## Locale
- One of en, pt-BR, es, fr; fallback per existing i18n.
