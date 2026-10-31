# Plan

1. Trace the existing projection, coordinator and provider boundaries; reproduce with a synthetic Unicode rule and contrast Markdown/display behavior. Distinguish confirmed outbound formatting leakage from unknown provider/WhatsApp transcription behavior.
2. Add failing cases in `tests/unit/whatsapp-text.test.ts` and `tests/unit/final-output.service.test.ts`: horizontal variants, spacing/quotes/CRLF, meaningful punctuation and unchanged safety; verify cleaned provider input and preserved original text.
3. Extend only the existing standalone-rule predicate in `src/services/whatsapp-text.ts`. Keep rule handling after existing code/indent guards; do not strip all Unicode symbols or change provider settings.
4. Update current reference/changelog/index; run affected and full isolated checks plus link/anchor/diff checks. Record failing/passing evidence and limits in validation; honor the subsequently selected local-commit-only handoff without push, publication or live effects.

## Complexity Tracking

Use the existing bounded speech parser and paragraph handling; one additional regex alternative, no new service, abstraction or dependency. No proof of acoustic causation or universal pronunciation correction is claimed. The owner already requested this narrow filter extension; broader normalization and actual listening/provider validation remain separate decisions.
