# C2/C3 independent review and diagnostic corrections

- Reviewer: exact `anthropic/claude-sonnet-5-5`, high thinking; run `00bf3c17-1cd1-4d42-88b0-9dc87f36cd64`. One read-only review of 142 frozen public files and the pre-C2 baseline diff. C1 was already reviewed and was excluded. No child edits, tests, live data access or fallback are claimed; completed-run metadata confirms the requested model.
- Verdict on the frozen pre-correction source: **OK with notes**. The parent verified and corrected all three concrete findings; no second independent post-correction verdict is claimed.
- **F1, P2:** preserve the original question/transcription when a retained quoted image cannot download. Corrected centrally in `IncomingMediaService.processImage`; text/audio production-hook regressions exercise the real failed-download path.
- **F2, P3:** automatic tool images now use a distinct non-final `tool-image` purpose. Legacy explicit attachment suppression remains intact, while projected images never swallow the final explanation. Covered by accepted/in-flight/unknown router regressions and the actual production-entry RPC image scenario with legacy mode enabled.
- **F3, P3:** ignored/unaddressed group traffic, paused work and ordinary outgoing messages no longer themselves issue read receipts. Handled controls and admitted requests still do. This does not control another WhatsApp client's read state or promise per-message unread retention after a later group read.
- Optional notes: oversized terminal answers now emit one metadata-only local warning; image-tool consent explicitly warns that returned images may originate outside the workspace if the approved tool can read them. Delivery hooks remain awaited: slow sends can delay continuation; send/upload options carry 60-second timeouts under the existing sender lifecycle. Other optional hardening notes are not represented as newly fixed defects or release gates.

## Executed evidence

All tests used temporary HOME/agent directories, minimal environments without inherited credentials, and `PI_OFFLINE=1`.

- Before F1–F3 corrections: **9 expected failures / 124 passing tests** across the production-hook, router and native RPC suites. Local commands/results: `.pi/cache/c2-c3-review/review-baseline-command.json` and `review-baseline-results.json`.
- After correction: **196 focused tests / 7 files**, then **1078 full tests / 78 files**, zero failures/skips. `npm run lint`, `npm run typecheck` and `git diff --check` passed. Exact test commands/results are retained under `.pi/cache/c2-c3-review/` as `focused-command.json`, `full-command.json` and corresponding results.
- The full suite retains seven actual production-source `pi -e` RPC scenarios with synthetic sockets/models and zero network attempts. No extra independent review or live-client test was substituted for these checks.

## pi-lens disposition

Corrected the reported release-source patterns: unsafe non-null assertions, redundant filter/map chains, unbounded diagnostic payload logging on invalid contact input, boolean commit-mode ambiguity, contact-field removal, implicit string sorts and nested ternaries. Named atomic/ordinary commit modes preserve existing guarded-write/fallback behavior. Temporary config cleanup explicitly uses a basename. Removed Markdown links into ignored local receipt directories and linked the public Edge evidence instead.

Active source probes reported no compiler errors and only three remaining pattern false positives: two `reverse()` calls operate on fresh spread copies, and one intentional deletion removes a disconnected extension's optional Pi prompt section. These were explicitly marked **false-positive** in pi-lens, not silently represented as code defects. Push-only LSP silence is not a clean-state certificate; full typecheck/lint and tests passed independently.

The reported two `run.mjs` errors were not reproducible in either existing local helper. The owner confirmed the displayed file was probably temporary and absent from the release repository. No nonexistent file was fabricated, no historical helper was rewritten, and those stale entries are not claimed fixed by a source change.

C2's previously accepted group mention/reply and C3's terminal-forwarding/disable live results remain unchanged. The automatic-image live check remains **OPEN and owner-deferred**. No live sends/settings changes/reload, dependency change, Git delivery or publication was performed.
