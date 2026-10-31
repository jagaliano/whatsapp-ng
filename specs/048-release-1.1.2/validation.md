# Source/release checkpoint — 2026-10-31

Platform: macOS x86_64, existing Node v26.13.0/npm 11.20.0/Pi SDK 1.4.0 cohort. This is source evidence before the final version/commit/artifact, not installed/live/platform certification.

## Review and corrective evidence

Initial native Anthropic Opus 5.5/high review (`anthropic/claude-opus-5-5`, completed metadata verified) covered `6102a20..7c6d446` in a frozen public snapshot with fresh read-only context. The original 166-file snapshot hashes were checked unchanged before preparing a separate 170-file correction snapshot. See [precise coverage and F1/N1/N2/N3 dispositions](../047-spoken-reply-guard/review.md). Focused follow-up again completed on native Opus 5.5/high with completed metadata verified: **OK with notes; no material introduced issue**. It confirmed F1/N1/N2/N3 and the narrow lock/disclosure consistency, without runtime/network verification. Corrected its remaining SECURITY.md wording note; retained pre-existing optional legacy late-admission hardening outside this scope. No model fallback or reviewer mutation occurred.

The new legacy attachment matrix/pending case reproduced seven failures before the eligibility fix. After reusing `router.canFinalize(snapshot)`, the same selected command passed 19 cases (89 others filtered), including late identity/transport/admission cases. Initial failing results were observed in command output; the reused local log label later contains the passing rerun, not an immutable failed-log artifact. Existing deduplication and unknown-send rules were not weakened.

With the corrected working source and approved dependency patch, a fresh isolated credential-free/network-guarded run completed:

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2` | 1553 passed/84 files; no skips. Includes the actual production-entry Pi RPC fixtures with synthetic socket/model boundaries. |
| `npm run lint` | Exit 0. |
| `npm run typecheck` | Exit 0; entry/source scope, not separate test typechecking. |

## Targeted dependency exception

Fresh source `npm audit --omit=dev --json --registry=https://registry.npmjs.org` initially failed with one high production `follow-redirects@1.16.1` advisory. After the owner's explicit targeted-install/lock approval, `npm update follow-redirects --ignore-scripts --legacy-peer-deps --no-audit --no-fund --registry=https://registry.npmjs.org` exited 0 and changed exactly that lock node/installed package to 1.16.2. Manifest and all other lock entries remained byte/structurally unchanged. The same production audit then passed with zero findings.

The fresh full-tree audit still exits 1 with twelve affected development-tree packages (one high/eleven moderate), including existing Undici and newly reported Minimatch exposure. Disclosures were refreshed without broad upgrades, override, suppression or SDK downgrade. This does not repair existing consumer locks or certify host bundles/native binaries.

## Pre-publication limits

Public npm lookup returned structured E404 for 1.1.2, existing latest 1.1.1/next 1.1.0-rc.1 and maintainer jagaliano; normal local identity verified jagaliano. No 1.1.2 publish-attempt marker existed at preflight. These observations must be rechecked at actual publication, not treated as reservation or future delivery proof.

No live WhatsApp/STT/TTS/native-model, Telegram, real-state, new Linux/Windows or manual-client acceptance ran. The Edge retry roadmap remains proposed. Source checks and corrective review are complete as described above. Static/security scans, local commits, version bump, CI, artifact/consumer qualification and one-shot publication outcomes must be recorded at their actual checkpoints/local receipts; they are not asserted complete here.
