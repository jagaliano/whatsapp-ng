# Quickstart: Recents — Group Messages by Same Text and Time

## Goal

Verify that the Recents view collapses multiple contacts with the same message text and same minute into one line, that drilling into a grouped entry shows each contact individually, and that "Allow Contact" works correctly from within a grouped entry.

---

## Prerequisites

- WhatsApp is connected.
- At least two contacts have sent (or received) the **same message text** within the **same clock minute** (timestamps differ by < 60 s and share the same hour:minute).

---

## Scenario A — Grouped Line Appears in Recents

1. Receive the same broadcast-style message (e.g. `"Good morning!"`) from at least two different contacts within the same minute.
2. Open the `/whatsapp` menu → **Recents**.
3. **Expected**: Instead of two separate lines for those contacts, one grouped line appears, formatted as:
   ```
   Good morning! • <time> • (2 contacts)
   ```
4. Confirm all other contacts (with unique texts or different minutes) appear as normal ungrouped lines.

---

## Scenario B — Drilling Into a Grouped Entry

1. In the Recents list, select the grouped line from Scenario A.
2. **Expected**: A sub-list appears titled `Recents • (2 contacts)`, listing each individual contact as a separate option (using the normal `Name • time • preview` format).
3. Select one of the individual contacts from the sub-list.
4. **Expected**: The standard per-contact menu appears (History, Send Message, Allow Contact, Back).
5. Navigate Back → confirm the Recents list is shown again with the grouped view intact.

---

## Scenario C — Allow Contact from a Grouped Entry

1. Ensure one of the grouped contacts is **not yet in the allowed list**.
2. Open Recents → select the grouped line → select that contact from the sub-list.
3. Select **Allow Contact**.
4. **Expected**: Notification confirms the contact was added to the allow list.
5. Close the menu and re-open Recents.
6. **Expected**: The contact's grouped line (or individual line, if now ungrouped) no longer shows the "Allow Contact" option when you drill into it.
7. Send a new message from that contact and confirm it is processed (not silently dropped).

---

## Scenario D — Single-Contact Group Is Ungrouped

1. If only one contact has a unique text at a given minute, open Recents.
2. **Expected**: That contact appears as a normal single line — no count label, no sub-list on selection; the per-contact menu appears directly.

---

## Scenario E — No Groups When All Texts Are Unique

1. Ensure all recent contacts have different last message texts or different minutes.
2. Open Recents.
3. **Expected**: The view looks identical to the pre-feature Recents — no grouped lines, normal individual lines for each contact.

---

## Verification Checklist

- [ ] A grouped line shows `(N contacts)` and does not expose individual sender identifiers at the top level.
- [ ] Every contact reachable before this feature remains reachable via the sub-list.
- [ ] Allowing a contact from the sub-list marks them as `isAllowed: true` immediately on the next Recents open.
- [ ] `recents.json` is not modified by opening Recents or navigating the grouped view.
- [ ] Pagination (Next/Previous) works correctly when the grouped list spans more than 10 entries.
