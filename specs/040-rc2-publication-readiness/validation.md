# RC2 evidence and qualification limits

## Source and review checkpoint

The integration starts at main `330b8cdec7dbb3bcb1cdd6574d201ed253102ba7` plus the recorded auto-connect/navigation and documentation changes. This document was written during release integration, not before those implementations.

Before this preparation pass, isolated source validation passed **1,451 tests in 83 files**, zero failures/skips, lint/typecheck and whitespace. This includes real production-entry Pi RPC with synthetic socket/account/model fixtures and blocked network, and a separate Node process preserving another writer's Disabled preference. It is not a new Linux/Windows, published-package or live-account certification.

Native `anthropic/claude-opus-5-5` high review initially blocked implicit print/JSON startup and stale cross-process preference overwrites. Both were reproduced and corrected. Focused review then found retained-lock initialization and two smaller re-read/cleanup outcome issues; all were reproduced with failing regressions and corrected. Final narrow verdict: **OK**, with advisory retained-lock latency and fallback metadata-sync limits. The subsequent Back-navigation correction is parent-validated by unit and actual `pi -e` RPC regressions, not a separately claimed independent verdict.

The operator reported saved startup works. The physical post-fix Back sequence, every Off/flag variant, other clients/platforms and installed-artifact live behavior are not implied. No real state, authentication or speech settings were changed by the agent to obtain these results.

The general native Opus documentation audit inventoried 258 public records, read current guides fully and searched/sampled most historical/templates. AGENTS-specific corrections were confirmed; later parent authorization/Complexity Tracking clarifications and release-facing documentation corrections are not an additional independent full audit. Generic Spec Kit/Devin tooling repairs remain outside this preparation.

## Public registry/discovery: October 29, 2026

- Exact public registry lookup returned `whatsapp-ng@1.1.0-rc.1`, published **2026-10-28T22:34:20.232Z**, with both `latest` and `next` pointing to RC1. Published keywords include `pi-package`.
- Published RC1 integrity: `sha512-5ZE5+8ard9ckPcEzJhOipF5g61Nr5ikOWkUI/UYcxlG84GLXcwICXwFkJ2RHjqh+cnOQy5gDe/ManKl1mrMSiw==`. These selected registry fields did not establish RC1's source commit; no commit provenance is invented.
- Exact RC2 version lookup returned structured `E404`. That is dated absence evidence, not a reservation or publish permission.
- The reported `npm search whatsapp-ng | grep "ng"` behavior was reproduced against the public registry in a disposable HOME. Default 20 and expanded 100/250 broad results omitted the target. Maintainer-specific queries returned the package with `searchScore: 0`.
- `https://pi.dev/packages/whatsapp-ng` returned 200 and rendered RC1. `https://pi.dev/packages?name=whatsapp-ng` returned no matching catalog package. Exact availability and catalog listing are separate paths.
- Published eligibility metadata already exists; `latest` already resolves to the prerelease. This is not evidence that the RC suffix or a missing `latest` tag caused the omission. Upstream reports of zero-score ranking and catalog enumeration limits are corroborating reports, not proof of this site's internal algorithm. No registry tags, keyword stuffing or speculative re-publication were used.

Reproduce availability with `npm view whatsapp-ng@next version dist-tags keywords --json --registry=https://registry.npmjs.org`. Search is not an exact existence check; `grep "ng"` also matches unrelated description text.

## Dependency assessment: October 29, 2026

Fresh public-registry `npm audit --omit=dev --json` returned **0 findings**. Full-tree `npm audit --json` returned **2 affected packages: 1 high and 1 moderate**, in the development SDK/Undici path. This retains the previously documented inherited-risk decision to await a patched Pi cohort: no override, downgrade or forced fix was applied. Runtime dependency/lock bytes are unchanged.

These npm audits do not certify host-supplied peers, embedded native libraries, system FFmpeg/Tesseract, all platforms or service availability. A source audit is not a final artifact/consumer audit. Preserve the dated [dependency assessment](../../DEPENDENCIES.md#latest-audit-refresh) and its limitations.

## Final integration gate

Final isolated pre-commit commands ran on October 29, 2026:

- `npm test -- --maxWorkers=2 --reporter=json --outputFile=<local-report>`: **1,451/1,451 passed in 83 files**, zero failures/skips (89.2 seconds).
- `npm run lint`: exit 0; `npm run typecheck`: exit 0; `git diff --check`: exit 0.
- Changed-Markdown validation: 15 files, 83 relative links/anchors, zero failures. This checks changed documents, not a claim that every historical/template link is repaired.
- `gitleaks dir --redact=100 --report-format=json --report-path=<local-report> <isolated-candidate>`: exit 0 for the 26 intended changed/new files. The scan is candidate-scoped, not a new entire-history certification.

These checks used a disposable HOME/agent directory and credential-free environment. Actual production-entry RPC fixtures supply their own network guard; `PI_OFFLINE=1` alone is not represented as a network sandbox. No new live-account, provider, Linux or Windows acceptance was performed.

The clean-commit artifact receipt is deliberately pending at this tracked checkpoint: it can only be created after source/docs are committed. It remains local and binds the exact commit/version/tag/tarball integrity. Its absence or failure means preparation is incomplete even though source tests pass. Next commands are clean-commit `npm run release:prepare`, exact-tarball secret/member checks and isolated consumer/Pi startup. See [the plan](plan.md) and [release guide](../../docs/releases.md).

Publication, registry-tag changes, Git release tags, publishing-automation activation and additional live/provider/platform operations were not performed by these preparation records.
