# Remaining C1 and WhatsApp formatting: validation and live handoff

## Delivered scope

The existing reporter now supports independently default-off observed file labels, completed interim assistant text and one coalesced/throttled edited activity message. Final stats retain their existing format and remain separately selectable. Terminal Reply delivery and the verified owner's `/replies` expose the settings; enabling warns about sharing metadata/intermediate text with allowed chats. The outgoing assistant-text adapter conservatively handles common Markdown without rewriting code bodies, URL destinations, input hashes, quotes, speech or media bytes.

No dependency or manifest change belongs to this slice. Offline implementation/automated qualification did not inspect or mutate live settings/auth/history, reload the owner process or send real messages. The subsequent owner-controlled live check is recorded below. No Git delivery or publication was performed. The separate C3 image live gate remains open.

## Evidence

- Expected initial red run: 43 passing / 7 failing tests plus the not-yet-created formatter module. Corrections subsequently passed 221 focused tests and `npm run lint` / `npm run typecheck`.
- The actual production-entry `pi -e` RPC reporting case passed with synthetic Baileys transport/provider and network blocked. It covers no mid-task opt-in, a successful native write, completed interim text without thinking/tool bodies, formatting/code preservation, one edited own-message key, full group participant, terminal isolation, independently disabled stats and Off cancellation.
- An initial full run had 1121 passing / 1 failing test, no skips. The existing reconnect/settings RPC also failed against the untouched pre-change snapshot. Its fixture emitted group traffic at socket-open before auth/archive readiness; using the same persisted-connected checkpoint as direct delivery fixed the focused reconnect test. No production reconnect behavior was changed for this fixture correction.
- One fresh read-only `anthropic/claude-opus-5-5:high` review completed (run `7224c0f7-8823-4311-bdbb-6c0e20872381`). Actual project/user routing preflight and run status confirmed authenticated native Anthropic, official endpoint, high thinking, four read-only tools and disabled ambient extensions. Its verdict was **BLOCK** on F1: emphasis parsing could consume markers inside inline code. F2 (long-heading parsing cost) and F3 (malformed optional settings disabling existing stats/phone controls) were concrete non-blocking notes, also corrected. The owner requested prompt completion; the same reviewer was asked to conclude from inspected evidence. It did not inspect the full test suite. No fallback or second independent post-correction approval is claimed.
- Three new regression tests failed before the corrections. The formatter now skips exact backtick code spans and URLs when finding delimiters, bounds link-label searches, leaves cross-line/unfinished inline code literal and caps heading parsing at 1 KiB. Malformed optional flags fall back to disabled without disabling existing stats or reply controls; raw saved data is replaced only by an explicit reporting selection. Optional cosmetic/history and last-activity-status notes do not add a second writer/transport or stronger delivery guarantees.
- Final `python3 .pi/cache/c1-rest/run-gates.py full` passed **1126 tests**, no failures/skips, plus `npm run lint` and `npm run typecheck`. `npm pack --dry-run --json --ignore-scripts` passed with **57 entries**, including the new formatter/reporter and excluding tests/runtime caches. Package and lockfile bytes match the pre-slice snapshot; `git diff --check` passed. No dependency/audit refresh, undeclared build, cross-platform or clean-install qualification is claimed.

Reproduction/artifacts: `.pi/cache/c1-rest/` contains the public before/after snapshot hashes, exact command JSON, expected baseline failures, focused/full results, native reporting/reconnect results, sanitized routing preflight and reviewer report. Gates run with isolated `HOME`/agent directory, `PI_OFFLINE=1` and an allowlisted environment rather than inherited credentials. `python3 .pi/cache/c1-rest/run-gates.py full` runs the full test command, lint and typecheck; JSON command records retain the precise reporter arguments.

## Owner-confirmed private-chat live result

After reloading Pi and reporting the reply-delivery options enabled, the owner submitted the public fixture task through WhatsApp. The assistant created a fresh uniquely named workspace file with `write`, read it and updated it with `edit`, without calling WhatsApp send tools or quoting file contents in the final. The final included a heading, bold text, an HTTPS link and the inline glob `**/*.ts` within emphasized text.

The owner reported the live C1 test ran successfully, everything looked fine and one copy was received. This records owner-attested private-chat rendering and no visible duplicate for that run—not a transport-log audit or independently measured edit cadence. The owner explicitly postponed all tests requiring other participants, including group routing and separate-recipient checks; these remain unverified, not failed. The owner subsequently confirmed the `/stop`/fresh-input and Off/re-enable fresh-reply checks below. The C3 image check remains deferred. The public fixture remains in the workspace; no cleanup or settings restoration was performed automatically.

## Owner-confirmed stop/fresh-input result

The owner submitted the read-only cancellation request and then a fresh request for exactly `C1-RESUMED`. The assistant returned that fresh marker, and the owner confirmed the test worked. This records the owner-attested stop/fresh-input behavior without a stale final. No 30-second wait tool execution is visible in the recorded assistant turn, so this does not independently prove interruption of an already-running subprocess. `/stop` does not disconnect WhatsApp; the separate Off/terminal re-enable result follows.

## Owner-confirmed Off/re-enable fresh reply

Following the terminal Off instruction, the owner reported WhatsApp was off. After the terminal Connect guidance, the owner sent a fresh WhatsApp request for exactly `C1-AFTER-OFF`; the assistant returned that marker and the owner confirmed it appeared in WhatsApp and the terminal. The same answer appearing on both surfaces is expected in the shared Pi session, not evidence of two WhatsApp copies. This establishes the owner-observed post-Off/re-enable fresh-reply path; it does not independently audit transport shutdown, credential refresh, all queued-work cases or interruption of an already-running tool. No further live action was automated.

## Owner-controlled live checks

Do not enable these automatically or combine them with the deferred C3 image test.

1. At the next owner-chosen source reload/restart, verify reporting is still off. In terminal `/whatsapp` → Replies → Reply delivery, enable only the reporting options you want and accept the disclosure. These are shared preferences; use only mutually trusted allowed chats.
2. From one allowed private chat, request a small public fixture write/edit with a fresh workspace-relative filename, one short intermediate update, and a final heading/bold/link/code example. Check one final answer, one bounded file summary, no tool contents/thinking, readable code/link and at most one activity message whose status edits in place. Brief work may show no intermediate edit; this is expected throttling/coalescing.
3. **Deferred by owner:** all tests requiring other participants, including an already-allowed group's reply/activity routing and separate-recipient checks. Resume only when the owner asks; do not add participants or change permissions for testing.
4. For one longer public task, turn the selected reporting option off or use confirmed Off. No new unsent updates should appear; already-issued sends may settle and the last status may remain visible. Re-enable and verify only a fresh input reports. Terminal-only work must remain local unless the separately consented C3 terminal forwarding is intentionally enabled.
5. Restore the reporting choices you want. Report actual client observations; offline fixtures do not qualify client rendering, Linux/Windows, a clean installation or other live providers.
