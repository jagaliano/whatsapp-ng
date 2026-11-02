# Menu review and dispositions

## Proposed menu review — 2026-11-02

Owner-authorized native `anthropic/claude-opus-5-5:high`, run `581321dc-2aa4-4ca7-bddd-7831d142d86e`, completed successfully with only read/search tools and ambient extensions disabled. This was a proposal review, not final implementation approval. Full reads: the spec/plan, four proposed UI owners and speech/config policy. Composition/phone/SDK excerpts were sampled; message-detail/reply, tests and pending 052 were not reviewed.

The reviewer supported chat-first versus advanced separation, with these implementation requirements:

- Preserve Pi's lazy context/UI getters. Derive the scoped context rather than spreading it; resolve the host UI on every call. Weak-key only the derived request context, remove it at outer completion, and prove a reused original context works after cancellation.
- Explicitly rethrow cancellation through Voice/Owner catches; suppress late notifications and unwind once. Cover cancellation inside remote setup and manual composition, not only at the root.
- Retain the original authority across legacy recursive Back and pass it into child settings actions. Do not renew authority after connection/owner changes. Connect/Off/logout end with an outcome.
- Centralize shared enablement/destination consent for all mode paths, including approved-but-disabled state. Explain retained defaults/overrides/groups and preserve pauses. Capture a single setup snapshot/revision before the picker and save once; report conflicts and effective policy accurately.
- Make backend changes' approval loss visible. Expose compatible server-default versus named voice explicitly, never as a blank/placeholder fallback; Fish retains a reference requirement.
- Make optional-output child Back return to its parent without renewing owner authority, localize Back, keep overlay close semantics and document confirmation Esc/No equivalence.
- Keep phone refusals metadata-free. Saving matching trusted managed configuration may start/health-check a local server; this is separate from synthesis or a WhatsApp send.

These dispositions are implemented and covered by focused source/RPC regressions. The existing recursive menu structure is retained rather than broadly rewritten: every recursion shares the same derived request/guard, so it cannot refresh authority. This is a bounded implementation choice, not permission to rebind stale contexts.

## Final implementation review — 2026-11-02

Native `anthropic/claude-opus-5-5:high`, run `a3b81bbf-287d-48b2-84f7-fdce2899ae29`, returned **OK with notes**, with no blocking defect. Parent verified matching requested/actual model metadata, successful exit, disabled ambient extensions and unchanged hashes for all 35 frozen public files. The reviewer used only read/search tools; it did not run tests or independently verify validation logs/hashes.

Full reads: the public diff/manifest, menu handler, Voice/navigation owners, TTS config, navigation regressions and 053 records. Optional outputs, other changed tests and public docs/i18n were reviewed through diff hunks; composition, speech/session policy, reply view and Pi context creation were sampled. Message detail/generation handling were searched only. Pending 052 records, owner-guidance tests, full fixture and validation logs were not deeply reviewed. This is not a claim of complete repository or live-rendering coverage.

### Low-severity findings and disposition

1. Repair-screen Back returned no navigation result. Correct it to return to the parent and add an invalid-settings regression.
2. Expiry during a speech-settings save incorrectly invited choosing again in a closed menu. Use the common expiry path and one reopen notice; retain the choose-again notice only for a still-current revision conflict.
3. Recents reached through Advanced/history scope returned to Chats / Owner. Carry its captured parent category through the existing conversation/Back paths without renewing authority; test empty and populated histories.
4. Phone refusal prose is English with the actual localized setup-action label. Retain this non-blocking convention, which matches the existing phone/control surface and preserves an accurate menu target; general phone-language localization is outside this change. New terminal setup/consent/status labels are provided in all four existing locales.
5. Records were deliberately frozen while review ran and still showed pending validation/review. Update them after recording the actual result; do not manufacture reviewer-run tests or rewrite checkpoint evidence.

Findings 1–3 were reproduced with four failing regressions before corrections (90 tests filtered out); the corrected affected suite passes 106 tests across four files, and lint/typecheck/whitespace checks pass. No other runtime scope was added.

## Focused correction confirmation — 2026-11-02

Native `anthropic/claude-opus-5-5:high`, run `974ca163-b441-40bf-a42a-2183c0ffef89`, returned **OK — No issues found** for the three corrections. Parent verified successful exit, matching requested/actual model, disabled ambient extensions and unchanged hashes across the frozen public scope. This does not upgrade the earlier full review's cosmetic mixed-language note to a fixed item.

The reviewer fully read the correction diff/manifest and navigation owner; sampled Voice (1–230), menu dispatch/Recents (1–200, 460–584), relevant test setup, composition and labels. It confirmed all parent-category propagation by code reading; tests directly exercise empty/populated Recents-list Back, not every contact/history/alias redisplay. It ran no checks or real operations and did not independently verify hashes, broad test output or live rendering.

Parent's post-correction broad gate passes **1623 tests / 86 files, no skips**. The Pi 1.5.0 isolated actual-entry replay again passes 2 cases with 15 name-filtered skips; lint/typecheck and final static checks pass. Exact commands and evidence limits are in [tasks](tasks.md). All source changes remain pending operator reload/live acceptance, not a release or real-settings mutation.
