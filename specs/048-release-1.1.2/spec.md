# Reviewed release 1.1.2

The owner requested an independent Anthropic Opus 5.5 review of the last changes, correction of confirmed errors/notes, version 1.1.2, commit/push and npm publication. Telegram disconnected afterward; no Telegram delivery/actions are permitted.

Review scope is `6102a20..7c6d446`: spoken-reply guard/25 regressions and the separately supplied Edge resilience roadmap proposal. Registry canonical model ID is `anthropic/claude-opus-5-5`; use that native provider/model, fresh read-only context, no fallback or delegation. Reviewers cannot edit or act on real state; the parent verifies findings and owns corrections/tests/delivery.

Repeat the owner-approved guarded release procedure: version-only release synchronization plus the separately authorized security patch below, no other dependency upgrades, isolated lifecycle-disabled consumer installs, exact clean-commit artifact preparation, secret/member checks, authenticated maintainer/version absence, one publication under latest and registry integrity/tag/installed-Pi verification. Preserve next unless separately authorized. No Git tag/GitHub release, automation activation, settings/consent/auth changes, live account/provider/native-model operations or implementation of the proposed Edge retries.

## Explicit security-patch exception

Fresh preflight found production GHSA-mrwp-f3q8-3g9p in `follow-redirects@1.16.1` through `msedge-tts` → Axios. The owner explicitly approved targeted 1.16.2, its resolution lock change and lifecycle-disabled install. `npm update follow-redirects --ignore-scripts --legacy-peer-deps --no-audit --no-fund --registry=https://registry.npmjs.org` changed exactly that installed/locked package; manifest and other lock entries remained identical. Production audit changed from one high finding to zero. Full-tree development/host findings remain separate and disclosed. Existing consumer locks are not automatically repaired by a maintainer lock refresh.

Uncertain transmission is never permission to resend. A publication attempt requires retained evidence and must not be retried automatically. Normal npm terminal authentication stays local; no secrets/OTP values in tools or chat. Record actual review coverage, commands, failures/dispositions and remaining platform/live limits rather than claiming universal readiness.
