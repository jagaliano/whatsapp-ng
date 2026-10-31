# Protect automatic spoken replies

## Decision

The owner approved a narrow runtime guard after source review showed that a model-issued same-chat `send_wa_message` intentionally covers the whole final response, preventing automatic speech. This is workflow hardening, not an Edge backend fix. Existing suppression after accepted/in-flight/unknown sends remains unchanged.

## Requirements

- While the owning automatic final remains eligible, reject model-tool text at initial preflight before transmission, outgoing-history recording or send-ledger coverage when its captured approved policy requests Voice, Both or verified audio-Mirror. Check canonical PN/LID aliases and final transport/gateway resolution; explicit JIDs and native quotes cannot bypass it. An already-covering legacy attachment retains its explicit explanation route, because no automatic final remains eligible.
- Recheck actual identity/currentness immediately before transmission. A late refusal uses the existing sender outcome/attempt counter and may leave a failed archive intent; it is not the early zero-attempt guidance error.
- Return a structured zero-attempt tool error directing the agent to provide its ordinary final answer. Do not synthesize the tool text, grant consent, silently change provider or resend anything.
- Keep the captured speech-policy decision in the existing final-output coordinator; share effective Mirror/group-mode interpretation with delivery and use the router's read-only final eligibility check. Captured spoken protection cannot be downgraded by mutable settings during the same assistant frame. It grants no delivery authority: revocation/cancellation/currentness still fence final delivery.
- Preserve text-only/disabled/unapproved policies, non-audio Mirror, groups without opt-in, terminal/idle/manual replies and existing fallback/deduplication behavior. Other-chat sends remain available, with conservative late owning-input admission fencing during protected frames. Model-issued same-chat quoted text is deliberately restricted during protected spoken turns; native manual replies remain separate.
- Clarify tool guidance and metadata-only suppression wording. Document the restriction and test canonical identity, quotes, changed policy, no effects and a later single normal final response.

## Boundaries

The implementation authorization excluded dependency/version/Git/release actions, real account/session dumps, live speech/WhatsApp calls, settings changes, consent changes, unrelated roadmap edits and automation activation. The subsequent commit-only authorization below expands local Git delivery only. Existing ignored 039 record gaps remain historical, not a waiver for these new records.

## Commit-only follow-up

After validation, the owner explicitly requested committing the guard/25 added regressions and the pre-existing ROADMAP.md changes on the current main branch. Retain that Edge retry/fallback-diagnostics proposal byte-for-byte as a separate documentation concern. Its dated live-probe statements are supplied observations, not newly verified evidence or the demonstrated cause of the explicit-send suppression incident. Recording the proposal is not authorization to implement it; a future implementation needs its own specification/plan and gates. No push, release, publication or live reload was requested.
