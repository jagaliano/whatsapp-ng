# Independent source/documentation review — 2026-10-30 UTC

## Verdict and actual scope

**OK with notes**, no blocking finding. One fresh read-only native `anthropic/claude-opus-5-5` reviewer, high thinking, run `84aaf756-adce-4771-b19e-50e6d2b1fc66`, reviewed a frozen public working-tree delta against HEAD: 22 modified files and 16 new public files, with unchanged context and pinned upstream evidence supplied. The reviewer used only read/grep/find/ls, no fallback, writes, execution or live operations.

Coverage was not a deep audit of every supplied file. All changed deltas were inspected; new managed service/worker and mirrored test/fixture were read fully. Other owners/callers were read fully or around affected seams. The current guide's changed sections were deeply read. 043 plan/tasks were not read, its review record was sampled, and roughly 140 unchanged context files were not reviewed. No tests or native speech were run by the reviewer. The parent's fresh 1,508-test/84-file, lint/typecheck and extracted-example checks remain separate evidence tiers.

## Notes and parent verification

- **F1, evidence gap rather than confirmed bad flag:** the reviewer could not verify `--codec-quant` from the supplied upstream extracts. The parent independently confirmed the installed CLI's help lists `--codec-quant Q` in a disposable credential-free HOME, without model resolution, downloads or inference. The explicit S3Gen Q8_0 filename already fixes the quantization, so removing this redundant flag is also a possible documentation simplification.
- **F2, non-blocking documentation completeness:** provide concrete operator-run cache-preparation commands for Whisper Turbo, Chatterbox T3 and S3Gen before Connect, instead of relying on first downloads fitting the five-minute managed-startup budget. Native interrupted-download atomicity was not established.
- **F3, confirmed fail-closed diagnostic gap:** [managed-speech.service.ts](../../src/services/managed-speech.service.ts) records parse failures as an invalid role, but `update()` skips before reporting them because no command exists. `gate()` then refuses numeric-loopback requests for that role; this needs a one-time notice and an explicit guide exception to the ordinary unrelated-endpoint/unmanaged rule. This is non-blocking and does not adopt or kill a foreign server. Runtime correction/regression work requires a follow-up owner decision.
- **F4, non-blocking consent wording:** existing approval remains valid for the same endpoint/protocol/credential-variable identity when changing model/voice. The guide should tell operators to disable speech/use text mode first if they want a manual test before automatic replies resume. No destination-consent policy change is proposed.
- **F5, non-blocking inherited-voice warning:** the client cannot verify a server's startup voice or attach cloning attestation. Clarify that server-default mode should use the built-in voice or an otherwise legitimately consented server-side voice. A potential upstream clone-gate bypass was not confirmed from the supplied policy sources.

Advisories: distinguish registry v3 filenames from the older model-card examples; describe an owned non-daemonized server process group rather than terminal foreground ownership; add a managed-TTS/server-default combined regression; explain disconnect reload cost. Linux socket-inventory bounds, generic tool errors, inherited credential environments and pre-existing roadmap/spec-index record gaps remain separately classified, not new blockers or permission for unrelated edits.

## Owner-authorized correction disposition

The owner subsequently selected **documentation and diagnostic fix**. Applied after the frozen Opus review:

- F1: removed the redundant quant flag from the guide. The flag itself was supported, not a confirmed bug: both isolated installed help and the pinned [CLI parser](https://github.com/CrispStrobe/CrispASR/blob/cc114d2b4a5a9413738f390093e9131576743cb6/examples/cli/cli.cpp) confirm it. No private generated launch file or real environment was modified.
- F2/A1: added three explicit operator-only HF cache-preparation commands for Whisper Turbo, Chatterbox T3 and S3Gen, with pre-Connect completion/path checks, interrupted-cache caution and registry v3 filename provenance. Inspected the pinned CLI's HF-before-preview path; did not execute model resolution or downloads.
- F3: reproduced two missing-notice failures before the fix, then moved invalid-role handling ahead of the no-command skip. Reused `failRole` deduplication; hosted/`localhost` unmanaged behavior and numeric-loopback refusal stay unchanged. Tests verify no spawn/raw descriptor disclosure and notice renewal only after explicit retry.
- F4: the guide now names **Text-only everywhere / revoke speech consent** before switching a previously enabled backend for manual testing, and explicitly describes approval carryover for an unchanged destination identity.
- F5: documented that inherited server voice cannot be verified by this client and must be built-in or otherwise legitimately consented; omission must not be relied on to enforce a native per-request clone gate.
- A2/A3/A4: clarified owned non-daemonized server groups and reload cost after disconnect, and added combined managed Chatterbox/default-voice admission and teardown coverage. A8's missing 042 index entry was added. The separate pre-existing R5 record gap and remaining platform/error/environment advisories were not silently waived or refactored.

## Post-review evidence and boundaries

Focused managed/config/HTTP suites pass **97 tests across three files**. Final `npm test -- --maxWorkers=2` passes **1,511 tests across 84 files**, zero skips/failures; lint/typecheck pass. The updated six-block guide was checked in Bash/Zsh: descriptors/client objects exercise actual config parsers, while native prefetch commands receive syntax/argument checks only and are never executed. Markdown links/anchors and whitespace pass.

These corrections are parent-validated; the earlier Opus verdict applies to its original frozen snapshot and was **not independently rerun** over this post-review delta. No native server, model download, inference, real settings change, owner reload, Git/release or installation action occurred. Native Spanish Chatterbox, Linux/Windows and real WhatsApp acceptance remain unverified by this work.
