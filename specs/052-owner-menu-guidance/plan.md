# Owner-guidance correction plan

Scope: [specification](spec.md). Progress and validation: [tasks](tasks.md).

1. Trace the phone router's denial, OwnerAuthorization messages, pairing welcome copy, grouped terminal menu, owner chooser and mirrored tests. Confirm the menu route from current source without reading real configuration.
2. Add failing phone-denial and four-locale navigation/copy regressions. Extend the existing synthetic production-entry Pi RPC fixture with an unset-owner `/voice mirror` denial and actual terminal Owner navigation; verify zero model/network work and unchanged owner/speech settings.
3. Change only navigation strings and localized notices. Preserve denial/authority/currentness and speech-consent checks; add a short operating-reference explanation, Unreleased changelog entry and spec-index link.
4. Run the affected suite, actual-entry RPC regression and broader isolated test/lint/typecheck gate. Check skips, Markdown links/anchors and whitespace. Record source versus operator/live evidence; do not reload the owning Pi, change saved settings, stage, commit or publish.

## Subsequently approved independent review

1. Confirm installed pi-subagents, native Opus 5.5/high read-only configuration, explicit cwd and the 12-file public change scope. Freeze hashes and a public diff; provide the new untracked tests/records explicitly.
2. Dispatch one fresh native reviewer without ambient extensions, fallback or nested delegation. Keep source immutable while it reviews route/copy accuracy, owner/consent preservation, locale tests, actual-entry RPC coverage and evidence claims against public owners/callers/tests.
3. Verify actual model/tool/completion evidence and unchanged hashes, inspect each finding and record accurate coverage. Report the review and any required corrections; do not commit, push, reload or change real settings.

## Complexity Tracking

No new abstraction, dependency or constitutional deviation. Reuse existing command/authorization/menu owners and the existing RPC fixture. Locale tests compare guidance to the real category and localized submenu labels instead of inventing a parallel menu model. A corrected path is not a grant of owner authority or proof of a PN/LID match.
