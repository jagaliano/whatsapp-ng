# RC2 publication readiness

## Status and provenance

Recorded during RC2 preparation on October 29, 2026. Saved auto-connect, Back navigation and the AGENTS refresh were already implemented/reviewed in the working tree; this is a current integration/release specification, not a backdated claim of a pre-implementation plan. The earlier fuzzy-model-search checkpoint remains in ROADMAP. Historical records and missing earlier plan coverage are not silently rewritten.

## Authorized scope

Prepare the already-versioned `1.1.0-rc.2`, commit and push the coherent changes, and investigate npm/Pi discovery. Actual npm publication, release-tag creation, stable promotion, registry-tag changes and publishing-automation activation require separate approval.

## Requirements

1. Retain strict, default-off profile-wide `autoConnect`: only literal true enables implicit TUI/RPC startup, saved credentials are required, print/JSON remain opt-in, and the explicit online flag keeps its existing meaning.
2. Preserve process-local deliberate Off across reload/session replacement, future-only preference changes, no automatic pairing/reset and occupied-profile informational skip. Do not claim all RPC children are excluded from the preference.
3. Preserve newer cooperative config choices across writers, reject stale explicit choices and retain readable settings when an unknown config lock blocks writes. Invalid preference re-reads must not poison existing reply settings. Cleanup cannot hide commit/original-error outcomes.
4. Auto-connect Back returns to Connection, then main menu, without changing preference/transport or recapturing expired authority. Cancellation retains its existing exit behavior.
5. Align current docs with RC1 availability versus RC2/source features, dated qualification/audit evidence, current menu labels and proposal/history boundaries. Keep old evidence dated; do not reinterpret a source-test count as artifact/platform/live qualification.
6. Verify discovery through public exact registry lookup, normal/narrowed search and Pi direct/catalog pages. Distinguish observed zero search score/ranking from unproven upstream implementation details; never retag/publish merely to manipulate search.
7. Stage only task files, scan candidate content for sensitive data, run declared isolated checks, commit with repository conventions and push normally. Preserve existing history; do not force-push.
8. Run clean-commit release preparation and validate the checksummed candidate, including required files and isolated consumer/Pi entry loading. Keep transient receipts outside tracked source and bind them to the exact prepared commit.
9. Keep known host/development audit findings and unverified platforms/live variants explicit. Do not install tools/models, reset authentication, enable optional output or use real accounts as a preparation side effect.

## Acceptance

Automated source/production-entry RPC regressions establish implementation behavior. The operator reported saved startup works; physical post-fix Back navigation and broader packaged/platform variants are not implied. Publication readiness additionally needs the actual clean-commit receipt and relevant separate acceptance/risk decisions; publication itself is outside this authorization.
