# Evidence: Speech and settings improvements for 1.1.x

Condensed from former records 040–054. All runs used macOS x86_64, Node v26.13.0, Pi 1.4.0 development peers, disposable HOME/`PI_CODING_AGENT_DIR`, an allow-listed credential-free environment and existing network guards. Source checks, independent review, artifact qualification and live acceptance are separate evidence tiers; post-commit release outcomes live in local release receipts and the public registry, not here.

## Source gates per story

| Story | Failing baseline before fix | Full suite after (`npm test -- --maxWorkers=2`) | Date |
| --- | --- | --- | --- |
| US1 auto-connect / Back | Opus findings reproduced as failing regressions | 1,451 / 83 files | 2026-10-29 |
| US2 managed servers | new-service scaffold; 9 selected review-correction cases | 1,490 / 84 files | 2026-10-30 |
| US3 server-default voice | 15 tests; later 2 missing-notice tests | 1,511 / 84 files | 2026-10-30 |
| US4 spoken-reply guard | 17 unit + 1 RPC; later 7 legacy-attachment cases | 1,553 / 84 files | 2026-10-31 |
| US5 synthesis budget | 3 cases failing in a disposable copy of the old source | 1,556 / 84 files | 2026-10-31 |
| US6 separators | 17 of 20 new cases | 1,578 / 84 files | 2026-10-31 |
| US7 owner guidance | 10 unit + 1 RPC | 1,589 / 85 files | 2026-11-02 |
| US8 menus | 10 unit; later 4 review regressions | 1,623 / 86 files | 2026-11-02 |
| US9 npm 12 | 10 release-script cases | release suites 94 / 2 files | 2026-11-02 |

Every gate had zero failures/skips and `npm run lint`, `npm run typecheck`, `git diff --check` exit 0. Typecheck covers entry/source, not tests. Production-entry RPC fixtures reported zero external network attempts.

## Independent reviews

All reviews used native `anthropic/claude-opus-5-5`, high thinking, fresh read-only context, no fallback. Parent verified model metadata and frozen-source hashes; reviewers ran no tests. Coverage was partial and recorded per run (full reads of changed owners; sampled callers).

| Story | Verdict | Confirmed findings and disposition |
| --- | --- | --- |
| US1 | BLOCK → OK | Implicit print/JSON startup; stale cross-process overwrite; retained-lock init; re-read/cleanup outcomes — all fixed with regressions. |
| US2 | BLOCK → OK with notes | F1 `/stop` restarted servers; F2 SIGHUP orphan; F3 rejected retirement poisoned teardown; F4 transient probe retired healthy server; Q2 lifecycle windows — fixed. Three P3 notes fixed afterward. |
| US3 | OK with notes | F3 malformed-descriptor notice missing — fixed; F1/F2/F4/F5 documentation (cache preparation, consent carryover, inherited voice rights) — fixed. Post-fix not re-reviewed. |
| US4 | OK with notes → OK | F1 legacy-attachment explanations refused — fixed via `router.canFinalize`; N1–N3 documentation/test hardening. Legacy late-admission timing left as optional hardening. |
| US6 | OK with notes | N2/N5 test naming and budget wording fixed; N3/N4 wider glyphs/box tables deferred. |
| US7 | OK with notes | Phone denial's `Owner` label stays English; locale-test and RPC-preference advisories — not applied (review-only request). |
| US8 | proposal review; OK with notes → OK | Repair-screen Back, expiry during save, Recents parent category — fixed after four failing regressions; focused re-review "No issues found". |

US5 (concurrent commit `5239956`) and US9 had parent inspection only, no independent review.

## Native CrispASR acceptance

2026-10-30, local macOS, isolated HOME, numeric-loopback endpoints, CPU/two-thread servers, production `ManagedSpeechService`, remote STT client and `TtsService`/FFmpeg. No WhatsApp socket, Pi model answer or real settings. Phrase: “This is an automated speech test. The number is forty two.”

| Case | Requests | Result | Elapsed / startup |
| --- | --- | --- | --- |
| TTS only | one Kokoro `/v1/audio/speech` | valid Ogg/Opus, 4.7565 s | 26.868 s / 4.252 s |
| STT only | one Whisper `/v1/audio/transcriptions` | “This is an automated speech test. The number is 42.” | 2.114 s / 1.010 s |
| Both | one Whisper, one Kokoro | same transcript; valid 4.2565 s Opus | 21.833 s / 1.605 s |

`/health` and authenticated `/v1/models` matched expected backend, loaded-model path and `owned_by: crispasr`; all leases released after confirmed shutdown. Codec validation is not listening, voice-quality or WhatsApp-playback evidence.

### Native download scope exception

Approved: Whisper tiny.en, Kokoro Q8_0 and `af_heart`, capped at 256 MiB (targeted download: 219,549,835 bytes). The native runtime additionally fetched `fireredpunc-q4_k.gguf` and two `misaki-us_*.json` files without an explicit selector, totalling 283,536,765 bytes (~270.4 MiB). Disclosed immediately; the owner accepted the auxiliary resources without a rerun. Explicit primary-model paths do not prevent auxiliary downloads — strict budgets need native egress blocking.

## Dependency and audit notes

- Production `npm audit --omit=dev`: zero findings at each release after the 1.1.2 `follow-redirects` 1.16.1 → 1.16.2 lock-only patch (GHSA-mrwp-f3q8-3g9p via `msedge-tts` → Axios).
- Full-tree audit retains disclosed development-tree findings (Pi SDK/Undici, Minimatch); no overrides or suppression. See [DEPENDENCIES.md](../../DEPENDENCIES.md) and [SECURITY.md](../../SECURITY.md).

## Remaining open acceptance

- Linux managed ownership executed only in fixtures; Windows management unsupported; IPv6/wrappers unqualified.
- No live WhatsApp speech, listening, transcription accuracy or operator-confirmed terminal rendering for US4–US8.
- npm search ranking: 2026-10-29 public checks showed exact lookup and `pi.dev/packages/whatsapp-ng` working while broad `npm search` ranked the package with `searchScore: 0`; no registry tagging was used to influence search.
