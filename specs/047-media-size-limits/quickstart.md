# Quickstart Validation: Configurable Media Transfer Size Limits

Synthetic, isolated validation only. No real account, provider upload, model download, speech server or live large-file transfer.

## Prerequisites

- Node 26.x, dependencies installed per [DEPENDENCIES.md](../../DEPENDENCIES.md#maintainer-reproduction) (no reinstall implied).
- Disposable `HOME` and `PI_CODING_AGENT_DIR`; `WHATSAPP_NG_LOCALE=en`; credential-free environment as in `scripts/release.mjs` isolation (reference only).
- ≥ 2 GiB free disk in the temp directory for the opt-in large suite.

## Source checks

```sh
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
git diff --check
```

## Scenario map

| # | Scenario | Expected | Spec |
|---|----------|----------|------|
| 1 | Fresh config, no `mediaLimits` | both 25 MiB; ≤ 25 MiB receipt text and processing eligibility unchanged; approved safety changes per SC-009 (size mismatch refused, 60 s small deadline, lifecycle cancellation, new refusal notices) | FR-002, SC-009 |
| 2 | Set inbound 512, outbound 100; reload; unrelated save | values persist independently | FR-004, SC-007 |
| 3 | Inputs `0`, `513`, `1.5`, `+5`, `25MiB`, stale/expired/cancelled, injected write failure | no change in memory or disk | FR-003, SC-007 |
| 4 | Malformed `mediaLimits`; unreadable config | non-audio refused with repair guidance; audio unaffected | FR-005 |
| 5 | Inbound raise 25→100 and 100→200 | confirmation required; cancel → unchanged | FR-006a |
| 6 | Exact limit / +1 byte at 1, 25, 512 MiB, both directions | allow / refuse | SC-003 |
| 7 | Declared absent, understated, overstated; chunk crossing limit | admission large; mismatch/truncation interrupted; partial removed | FR-012/012a, SC-004a |
| 8 | Injected `unlink` failure | `cleanupFailed` diagnostic, no receipt | FR-014a, SC-004 |
| 9 | 40 MiB PDF/image inbound | stored, no parse/read-back/base64/vision | FR-020, SC-006 |
| 10 | Quoted oversized image ×3 | zero downloads | FR-021, SC-006 |
| 11 | Second large transfer while one active (each direction) | busy refusal | FR-029 |
| 12 | Slow outbound > 25 MiB, caller wait expires | delivery-unknown, no resend, slot+snapshot held until simulated settle | SC-008 |
| 13 | Off / session replacement / chat revocation mid-download | no handoff; partial removed; published-before-expiry file kept unreported | FR-018, FR-031 |
| 14 | Audio > 25 MiB, STT, TTS, tool-image aggregate with limits at 512 | existing budgets hold | FR-009, FR-025, SC-005 |
| 15 | Menu + production entry | `pi --no-extensions -e ./whatsapp-ng.ts` in isolated env or existing RPC fixtures | FR-006 |

## Opt-in large suite (512 MiB)

Labelled suite (proposed name `tests/unit/media-large.test.ts`, enabled by an env flag such as `WHATSAPP_NG_LARGE_MEDIA=1`). It must be run and reported before claiming completion.

- Inbound: real Baileys decrypt over a mocked `fetch` stream of a synthetic AES-encrypted 536,870,912-byte payload; assert byte-identical stored file (rolling hash); aggregate of live stage queues + duplicate copies + app-held buffers ≤ 16,777,216 at every sampling point; `pulled − written` bounded (backpressure only); all stages released before processing.
- Outbound: synthetic 536,870,912-byte document → snapshot → real Baileys `encryptedStream` → counting mock upload; assert identical decrypted hash and the same aggregate accounting.
- Report which tier ran: app-only simulation vs. real Baileys preparation with network mocked. Report undici body and `https.request` buffering as uncovered JS buffering. Neither tier proves recipient delivery.

See [research.md](research.md#r3-sc-002-measurement-plan-and-feasibility-16-mib-aggregate-per-active-large-transfer) for the measurement definition and [contracts/media-limits.md](contracts/media-limits.md) for interfaces.

## Validation record (2026-11-13, superseded below; macOS, Node 26, source checkout)

| Command | Result |
|---------|--------|
| `npm test -- --maxWorkers=2` (JSON reporter) | 254 files; 2,345 passed, 0 failed, 3 skipped (the opt-in 512 MiB suite) |
| `WHATSAPP_NG_LARGE_MEDIA=1 npx vitest run tests/unit/media-large.test.ts` | 3/3 passed (figures superseded by the review-fix record below; the 73,728 B outbound "peak" was the snapshot allocation total and is withdrawn) |
| `npm run typecheck` | pass |
| `npm run lint` | superseded; see reconciliation below |
| `git diff --check` | clean |

Evidence tiers (memory): SC-002 is verified only for the measured simulated-transport stages. Undici body buffering and `https.request`/socket writable buffering are in-process JS buffers that were **not measured** (uncovered, not excluded); an end-to-end 16 MiB guarantee is **not proven**. Tier 1/2 only (app-only and real Baileys decrypt/encrypt with network mocked). Uncovered class-B JS buffering: undici response-body internals and `https.request`/socket writes. Production-entry RPC coverage: `/whatsapp` → Advanced → Media limits inbound raise with confirmation persisted, in en/pt-BR/es/fr (`tests/unit/phone-control.rpc.test.ts`, phone-polish mode). Not run: manual `pi --no-extensions -e ./whatsapp-ng.ts`, real FFmpeg conversion of large images/videos, and any live WhatsApp transfer (operator acceptance pending). Native-tool skips in other suites were not re-inspected for this feature.

## Reconciliation (2026-11-13, after review)

Records: SC-009 corrected to list approved small-file safety changes (size-mismatch refusal, 60 s small deadline, lifecycle cancellation, refusal notices, malformed-limit refusal); receipt text and processing eligibility unchanged. CHANGELOG and checklist aligned. No code changes.

Lint investigation (all output captured to files, unfiltered):

| Command | Exit | stdout | stderr |
|---------|------|--------|--------|
| `npm run lint >/tmp/lint-N.out 2>/tmp/lint-N.err`, N = 1–6 | 0 ×6 | 116 B (npm banner only) | 0 B |
| `./node_modules/.bin/eslint <repo lint globs>` while `vitest run --maxWorkers=2` ran concurrently | 0 (tests exit 0) | 0 B | 0 B |

**Probable** cause of the earlier exit-1 results (inferred, not reproduced): the agent shell's `rtk` 1.2.0 output wrapper appears to have intercepted those three piped/filtered invocations and ran its own whole-tree ESLint scan instead of the repository script. Its saved JSON logs (`rtk/tee/1794621195_lint.log`, `1794621298_lint.log`, `1794622035_lint.log`) are capped at 1 MiB. The 1,907 parsed file entries in each attribute all 755 errors (mostly `no-undef`) to `.pi/cache/**`: gitignored local review copies outside the repository lint globs. No error was in a file covered by `npm run lint`. Limitation: entries beyond the 1 MiB truncation could not be inspected. The repository lint script itself has not been observed failing.

## Review fixes (2026-11-14)

Fixes, each preceded by a failing regression: outbound admission inside preparation (`tests/unit/outgoing-media.limits.test.ts`, 3 cases); stalled inbound authority watchdog (`tests/unit/inbound-media-transfer.test.ts`, opened and opening cases); entry-handler stalled session replacement and the FR-031 keep-unreported race (`tests/unit/whatsapp-ng.message-end.test.ts`). The entry stall test was confirmed to fail with the watchdog disabled. SC-002 instrumentation is now passive: no `'data'` listener, it only wraps the encrypted WriteStream's `write` and `drain` for sampling.

Gate (outputs captured to files, run sequentially via a script):

| Command | Exit | Result |
|---------|------|--------|
| `vitest run --maxWorkers=2` | 0 | 257 files; 2,352 passed, 0 failed, 3 skipped (opt-in suite) |
| `WHATSAPP_NG_LARGE_MEDIA=1 vitest run tests/unit/media-large.test.ts` | 0 | 3/3 passed |
| `npm run lint` | 0 | stderr 0 B |
| `npm run typecheck` | 0 | stderr 0 B |
| `git diff --check` | 0 | no output |

512 MiB memory figures (simulated transport, network mocked):

| Stage | Measured | Estimated (not observed) |
|-------|----------|--------------------------|
| Inbound transfer | 262,128 B (stream queues + app write buffer) | 196,624 B (web queue, mock pull buffer, decrypt carry) |
| Outbound snapshot copy | 73,728 B app allocations | — |
| Outbound encryption | 65,536 B (ReadStream + encrypted WriteStream queues, 2,051 samples at 64 MiB) | 131,088 B (in-loop plaintext + cipher chunk) |
| Outbound mock upload | 65,536 B | — |

Uncovered: undici body buffering and `https.request`/socket buffering. An end-to-end 16 MiB guarantee is not proven.

## Opus review follow-up (2026-11-14)

Read-only review (`anthropic/claude-opus-4-8`) found no implementation blockers. It could not run tests. Its P2 finding is fixed with a failing regression first: a non-audio file that grows past the 25 MiB unadmitted cap during copying now reports the configured-outbound-limit message (`whatsapp-ng.ts` remap; test in `tests/unit/whatsapp-ng.extension.test.ts`). ~~Its note stands: the FR-031 entry test exercises session loss, not the separate admission/Off branch before handoff.~~ **Superseded** by [FR-031 handoff regressions](#fr-031-handoff-regressions-2026-11-14). The remap described in this section was itself superseded by the [admission-cap message](#admission-cap-message-2026-11-14).

Gate rerun (script, outputs to files): full vitest exit 0, 257 files, 2,353 passed, 0 failed, 3 skipped (opt-in); opt-in 512 MiB suite exit 0, 3/3, same figures as above; `npm run lint` 0; `npm run typecheck` 0; `git diff --check` 0.

## FR-031 handoff regressions (2026-11-14)

Added production-entry tests in `tests/unit/whatsapp-ng.message-end.test.ts` ('047 review' block) for explicit Off (the real `settingsMenus.off` path) and chat revocation (reply-admission key change). Each change is triggered during publication, after the transfer's last authority check and before assistant handoff. Both assert the completed file stays on disk with its bytes and `sendUserMessage` is not called. Mutation check: with the pre-handoff guard `!admissionCurrent() || deliberatelyOff` disabled, the revocation case fails as expected. The Off case still passes, because Off also resets the router's runtime ID and the earlier runtime/session check stops handoff. That production path is covered, but the `deliberatelyOff` clause itself is redundant defence and not uniquely exercised. No source changes. Affected suites: `whatsapp-ng.message-end` + `whatsapp-ng.extension`, 231 passed, 0 failed; `npm run lint` exit 0; `git diff --check` clean. The full gate was not rerun because no source changed. Memory limitations and open manual/live acceptance items are unchanged.

## Admission-cap message (2026-11-14)

Opus 5.5/high review P2: a send admitted as small (source ≤ 25 MiB when opened) that grew while copying, or converted past 25 MiB, was refused with a remapped "configured outbound limit" message. That message was false, and raising the limit would not help. Fix: `OutgoingMediaService.prepare` now throws a distinct localized `mediaLimits.unadmittedCap` error for this case. The remap in `whatsapp-ng.ts` again only covers exceeding the configured limit. FR-023, `docs/reference.md` and CHANGELOG now document the 25 MiB cap for small-admitted sends; there is no dynamic slot promotion.

Regressions, written first and failing before the fix: conversion of a 20 MiB video to 30 MiB with a 100 MiB limit, and source growth during copying (`tests/unit/outgoing-media.limits.test.ts`). Plus entry-level tests (`tests/unit/whatsapp-ng.extension.test.ts`): cap error passed through without "configured outbound limit" or the 512 value; exact configured-limit message with value 30; audio still gets the 25 MiB `media.tooLarge` message at a 512 MiB outbound limit. Mutation checks: restoring the old remap fails the entry test, and disabling the service mapping fails both service tests.

Gate (script, outputs to files): full vitest exit 0, 258 files, 2,360 passed, 0 failed, 3 skipped (opt-in); 512 MiB suite exit 0, 3/3, same figures as above; `npm run lint` 0; `npm run typecheck` 0; `git diff --check` 0. Link/anchor check: 1 pre-existing broken CHANGELOG→README anchor (`#fork-and-legacy-names`), not from 047. Memory limitations (network-library JS buffering uncovered; no end-to-end 16 MiB claim) and the open T026 manual session and live acceptance are unchanged.

## Cap wording and extra regressions (2026-11-14)

The `mediaLimits.unadmittedCap` wording now says "25 MiB or smaller" (en), "25 MiB ou menos" (pt-BR), "25 MiB o menos" (es) and "25 Mio ou moins" (fr), matching the at-or-below admission rule. Three regressions added, using existing fixtures:
- `tests/unit/outgoing-media.limits.test.ts`: configured limit exactly 25 MiB + growth during copying → `media.tooLarge(25)`, not the cap. Admitted large send (30 MiB, limit 40 MiB) growing to 41 MiB → `media.tooLarge(40)` and the slot is released.
- `tests/unit/outgoing-media.conversion.test.ts`: a mocked FFmpeg (`mocks.spawn`, no real tools or large media) converts a small-admitted QuickTime video and writes a sparse 26 MiB output. The size watcher kills the child, the cap message is returned, owned output is removed and the original is untouched. Mutation check: removing the 25 MiB cap makes this test time out because nothing stops the child; code restored and verified identical.

Gate run 1 (script, outputs to files): vitest exit 1, 258 files, 2,361 passed, **2 failed**: `phone-control.rpc` managed-manual and managed-auto. Both are timed polls waiting for the synthetic managed-speech server to start (`expected 1 to be ≥ 2`, `expected 0 to be ≥ 1` at `phone-control.rpc.test.ts:139`). These are suspected intermittent failures, not proven unrelated to 047. That suite then passed 38/38 in 3 separate isolated runs. Gate run 2 (unchanged code): vitest exit 0, 258 files, 2,363 passed, 0 failed, 3 skipped (opt-in); 512 MiB suite exit 0, 3/3, figures unchanged; `npm run lint` 0; `npm run typecheck` 0; `git diff --check` 0. The RPC managed-speech timing failures under full-suite load are suspected intermittent, cause not investigated. They are tracked outside 047 and not fixed here.

Still open: network-library JS buffering (undici body, `https.request`/socket) is not measured, so no end-to-end 16 MiB guarantee; T026 manual `pi` session; live WhatsApp acceptance; real FFmpeg conversion of large images/videos.

## Status (2026-11-14)

Implementation loop stopped. SC-002 is partially verified (no end-to-end 16 MiB guarantee). T026 (isolated manual `pi` session) remains open. The source-checkout live document checks below passed; exact 512 MiB live delivery, installed-artifact acceptance and broader format/platform checks remain unverified.

## Live source-checkout document acceptance (2026-11-14)

Operator-authorized tests on the connected source checkout, with inbound/outbound preferences set to 512 MiB:

- Outbound document: 424,562,280 bytes (404.89 MiB), one explicit send attempt returned transport acceptance; the recipient separately confirmed arrival and a complete download. The original was left untouched. Remote byte identity was not independently checked.
- Inbound document: 256,040,852 bytes (244.18 MiB), saved as a completed receipt reporting automatic processing skipped. Streaming comparisons of the received file and the operator-supplied original had identical byte counts and SHA-256 hashes; neither archive was extracted or modified. The saved file mode was `0600`.

Private filenames, recipient identifiers, message IDs, filesystem paths and content hashes are intentionally omitted from this public record. These checks cover large-document source behavior, not a live exact-512-MiB boundary, installed-package behavior, native conversion or measured network-library memory.
