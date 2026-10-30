# Server-default voice plan

Contract: [spec.md](spec.md). Work: [tasks.md](tasks.md). Evidence: [validation.md](validation.md). Review and corrections: [review.md](review.md).

1. Verify Chatterbox's built-in voice and add explicit `ttsUseServerVoice` selection; retain strict named-voice defaults.
2. Add failing config/merge, exact HTTP omission, persistence/reopen and authorized-tool regressions.
3. Extend existing config/persistence/tool owners. Represent the omitted voice as optional; add no fake voice ID, fallback or consent grant.
4. Cover production-entry RPC; run focused/full tests, lint/typecheck and documentation checks without native effects.
5. Document paired Spanish CMD/client setup and operator reload/configuration/consent steps.

## Documentation and independent review follow-up

The owner authorized complete CMD/client examples and one read-only native `anthropic/claude-opus-5-5`/high review, without fallback. Freeze the public delta and preserve historical qualification; no real settings, downloads, inference or release effects. The review returned OK with notes; see [coverage and findings](review.md).

## Authorized review-note corrections

The owner then authorized F3's one-time malformed-descriptor notice and regression, plus documentation corrections. Preserve numeric-loopback refusal and hosted/`localhost` unmanaged behavior; reuse `failed`/`failRole`. Cover managed TTS with server-default voice. Clarify cache preparation, consent carryover, inherited voice rights, registry filenames, process groups and reconnect cost. Results and the absence of a second independent review are recorded in [validation](validation.md).

## Complexity Tracking

No deviations, dependencies or new runtime abstraction. Reuse existing owners/fixtures; delegation, native effects and release actions require separate authorization.
