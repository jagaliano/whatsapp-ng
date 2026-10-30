# Opus 5.5 review and correction record — 2026-10-29–30 (UTC)

## Scope and authority

The owner requested one `anthropic/claude-opus-5.5` reviewer; the registry spelling is `anthropic/claude-opus-5-5`. One fresh read-only high-thinking reviewer ran with that exact provider/model and no fallback. Public source, callers, mirrored tests and 043 records were in scope, including new untracked implementation files. A 36-file parent hash checkpoint was unchanged when review completed. The reviewer used only read-oriented tools and did not run tests, servers, providers or Git actions.

Verdict: **BLOCK** before live acceptance. Parent must verify findings and add failing regressions before fixes. This record supplements, not rewrites, the earlier validation checkpoint.

## Findings and planned dispositions

| ID | Severity | Finding | Correction / verification |
| --- | --- | --- | --- |
| F1 | P1 | Turn-router reset from phone `/stop` changes managed scope; the next sync restarts servers despite the immediate PID assertion passing. Explicit retry also reuses cached selection/scope. | Separate transport/account server lifetime from turn ownership; retry clears failure without replaying cached state. Actual-entry `/stop` followed by same-settings commit must retain the PID/spawn count. |
| F2 | P1 | Watchdog shares the terminal process group but does not handle SIGHUP; terminal closure can orphan the detached native child. | Handle SIGHUP through the same owned cleanup. Synthetic host process-group HUP must kill its server and release only its lease. |
| F3 | P2 | A rejected retirement Promise poisons subsequent retirement/start/disconnect and can prevent WhatsApp teardown. | Normalize retirement settlement while reporting/fencing unconfirmed ownership; do not borrow a timed-out predecessor's authority. Always attempt WhatsApp stop even if speech teardown fails. Fake-time timeout and hook regressions required. |
| F4 | P2 | A transient metadata timeout/unready response retires a healthy server, aborts other requests and causes sticky failure. | Retry unready/transient startup checks only inside startup budget; refuse a transient admission without retiring a healthy owned process. Preserve fatal positive mismatch/ownership-loss handling and leave request/upload retry policy unchanged. Parent check budget must exceed bounded worker probe time. |
| Q1 | Question | Synthetic fixture mirrors metadata assumptions; exact installed native health/model schema still needs confirmation. | Inspect matching public upstream source first; subsequently verify real metadata during separately bounded native acceptance. Do not weaken identity/model checks to accept arbitrary responses. |
| Q2 | Question | Shutdown can admit a new server before transport stops; cancelling a proposed session switch can leave servers stopped until the next request. | Fence committed runtime closing/startup windows; keep server ownership through a cancelable pre-switch proposal, retire at committed replacement/shutdown. Prove with hook/RPC cases. |

Advisories: add a full managed TTS descriptor example and update stale R4 roadmap wording. Linux/IPv6/wrappers remain unqualified, Windows management unsupported, and a second instance never adopts the first instance's server.

## Reviewer coverage

Full reads covered the managed service/worker/tests, synthetic server, AudioService, remote STT, TTS config, endpoint policy and 043 spec/plan/validation. Entrypoint lifecycle/speech regions, SessionManager persistence paths, socket status/stop, router reset and the managed RPC cases were sampled. Several other source/test/docs files were grep-only; owner authorization, speech settings, remote TTS and the remaining RPC cases were not deeply reviewed. This is not a whole-repository review or live/platform qualification.

## Live acceptance follow-up

The owner requests exactly three real cases after corrections: STT only, TTS only and both, preferably small English Whisper/Kokoro models. Model availability, metadata IDs, local-only versus real WhatsApp scope, destinations, bounded startup/inference budgets and any required downloads/configuration changes must be settled before those effects. No downloads, native inference, real sends or live configuration changes have yet been performed for this follow-up.

## Correction evidence

The initial selected regression run failed all nine selected cases: deferred `/stop` PID loss, cached retry replay, two startup-transient modes, admission-transient cancellation, retirement settlement poisoning, SIGHUP orphaning and two lifecycle-hook cases. The hook tests initially spied on a stale module instance after `vi.resetModules`; after correcting their dynamic import, both were reproduced against the actual entry instance: WhatsApp stop was not called and a closing settings callback admitted `connected: true`. The HUP baseline cleans only its known test-created orphan in `finally`.

Corrections remove turn runtime IDs from server scope, require fresh host sync after retry, trap HUP, normalize retirement while retaining failure/ownership fences, always attempt transport teardown, distinguish transient probes from definite ownership/backend/model failure, and fence actual runtime closing. A cancelable pre-switch only cancels work; native ownership retires on committed replacement. The RPC case now re-commits settings after `/stop` and after a canceled `/new`, proving the same PID/spawn count survives both.

`npm test -- --maxWorkers=2 tests/unit/managed-speech.service.test.ts tests/unit/phone-control.rpc.test.ts tests/unit/whatsapp-ng.message-end.test.ts` passed **120 tests across three files**, followed by `npm run lint` and `npm run typecheck`, both exit 0. This is the focused correction checkpoint, not the final full-suite/live result.

## Q1 source evidence

Pinned upstream [unified CLI HTTP source](https://github.com/CrispStrobe/CrispASR/blob/cc114d2b4a5a9413738f390093e9131576743cb6/examples/cli/crispasr_server.cpp#L2388-L2444) confirms health `{status, backend}` and authenticated model entries `{id, backend, owned_by: crispasr}`. `id` is `params.model`; explicit model paths remain paths, while auto/download resolution replaces them with resolved paths. The separate legacy `examples/server/server.cpp` has different health metadata and is not evidence for this CLI. No shape relaxation was needed. Installed native responses remain to be checked during real acceptance, not inferred from source alone.

Public model-registry evidence recommends Kokoro Q8_0 (~135 MB) plus the English `af_heart` preset (~4 MB). Metadata-only inventory of the checked CrispASR/Whisper caches found only the ~547 MiB Turbo model, no small English model or Kokoro pack. Downloads or alternative existing paths therefore require an explicit decision.

## Bounded native-test approval

After the correction checkpoint, the owner explicitly approved targeted downloads of Whisper tiny.en, Kokoro Q8_0 and its English af_heart voice, capped at **256 MiB total**, into an isolated test directory. The chosen scope is **local real-model tests first**, not WhatsApp end-to-end. Run exactly one STT-only case, one TTS-only case and one combined case with neutral synthetic/public input. Use production speech clients/lifecycle gates, disposable HOME/configuration, numeric-loopback servers, bounded startup/request/output budgets and owned cleanup. Do not change real WhatsApp settings, send messages, download extra models, install binaries or silently switch backends. Real WhatsApp acceptance remains separate.

## Post-correction full source gate

`npm test -- --maxWorkers=2` passed **1,488 tests across 84 files**, zero failures/skips; lint, typecheck, both worker/fixture syntax checks and lifecycle-disabled package dry-run passed (63 entries). The targeted three-file download completed at **219,549,835 bytes total**, below 256 MiB, with SHA-256 receipts and expected model-file magic; no extra model assets were downloaded. Models are retained only in the isolated test directory, not installed globally. This is not yet native inference or auditory/client-playback evidence.

## Focused Opus re-review and final notes

The same exact Opus 5.5/high reviewer returned **OK with notes**, explicitly clearing F1–F4 and Q2 for the approved local native cases. The reviewer fully read the corrected managed owners/tests and reviewed relevant entry/RPC/doc regions; several other seams were grep-only, not a new whole-repository review.

Its three remaining P3 notes were addressed: preserve definite backend/model reason codes through checked replies; prevent an awaited old `session_start` from clearing a later shutdown fence using a captured lifecycle counter; and explicitly test a queued replacement whose predecessor retirement becomes unconfirmed. Reason-code and delayed-start regressions failed before the final corrections and passed after; the queued-ownership coverage passed without weakening the existing fence. Lint/typecheck also passed. Those final note changes are parent-regression-verified, not falsely described as part of the earlier Opus-reviewed snapshot.

## Real native acceptance results

All three **local real-model** pipelines returned the expected results, but the original download constraint was exceeded and subsequently accepted by the owner, as detailed below. They used existing production `ManagedSpeechService`, remote STT client and `TtsService`/FFmpeg preparation. The connection flag was supplied by an isolated local test host; no real WhatsApp socket, Pi model answer or saved consent/configuration was involved. Startup used existing model files explicitly, CPU-only/two-thread server arguments, isolated HOME, fixed numeric-loopback endpoints and ephemeral test-only credentials. No license/disclosure-bypass flags were used. Explicit model paths did not prevent the native runtime's unanticipated auxiliary downloads; the post-run inventory below corrects that assumption.

Execution order was TTS-only, then STT-only reusing its synthetic clip, then combined. This avoids a fourth inference solely to create test audio. The known phrase was “This is an automated speech test. The number is forty two.” Combined processing transcribed that clip and synthesized a fixed neutral response; it was not a claim of real WhatsApp/LLM end-to-end behavior.

| Case | Real inference requests | Observed result | Total elapsed / startup |
| --- | --- | --- | --- |
| TTS only | One Kokoro `/v1/audio/speech` POST | Codec-validated Ogg/Opus, 4.7565 seconds of audio. | 26.868 s / 4.252 s |
| STT only | One Whisper `/v1/audio/transcriptions` POST | “This is an automated speech test. The number is 42.” | 2.114 s / 1.010 s |
| Both | One Whisper POST, then one Kokoro POST | Same correct transcript; valid 4.2565-second Opus response. | 21.833 s / 1.605 s |

These timings include startup, metadata checks, media preparation and owned shutdown; they are single-host observations, not an inference-performance benchmark. The harness refused duplicate inference attempts and non-test parent HTTP destinations. Native `/health` and authenticated `/v1/models` passed production ownership/readiness checks and matched expected `whisper`/`kokoro`, explicit loaded-model paths and `owned_by: crispasr`. All cases had no failure notices and released every owned endpoint lease after confirmed native shutdown.

No real WhatsApp messages or settings were touched. Source clients retained their normal 60-second budgets, startup was bounded at 120 seconds, and the aggregate test deadline was ten minutes. Codec/duration validation is **not human listening, voice-quality certification or WhatsApp playback evidence**. Linux, IPv6, wrappers and Windows management limitations remain as documented. Downloaded models and synthetic audio are private local test artifacts, not shipped package contents. No dependency install, global configuration change, Git delivery or publication occurred.

## Native download scope exception

The native results completed at **2026-10-30 01:51 UTC**. Post-run metadata inventory of the isolated HOME found an additional `fireredpunc-q4_k.gguf` (**57,886,944 bytes**) plus `misaki-us_silver.json` (**3,099,517 bytes**) and `misaki-us_gold.json` (**3,000,469 bytes**), with small provenance sidecars. The runtime fetched them without an explicit `-m auto` or HF selector. This was not caught by the parent's targeted downloader or parent HTTP guard: the native process was not under an OS outbound-network sandbox.

Targeted files plus these auxiliary payloads total **283,536,765 bytes (~270.4 MiB)**, exceeding the approved **256 MiB** aggregate cap. This is a disclosed execution-scope failure, **not clean acceptance or retroactive authorization**. The three inference/codec outcomes and request counts remain observed facts, but the requested strict asset set/budget was not preserved. Auxiliary processing may have participated in the native results; do not call them pure three-file inference.

All owned servers stopped and endpoint leases were absent at inspection. The six additional cache/provenance files exist only under the disposable test HOME; no real WhatsApp settings or user credentials were accessed/changed. Downloaded artifacts are retained for inspection, not silently deleted. The parent disclosed the exception immediately and stopped further downloads/native inference. The subsequent owner disposition below accepts these qualified results without a rerun. A future test requiring a strict asset budget must account for auxiliary resources and block native egress rather than rely only on explicit primary-model paths.

## Final source gate

After the final note corrections, `npm test -- --maxWorkers=2` passed **1,490 tests across 84 files**, zero failures/skips. `npm run lint`, `npm run typecheck`, both worker/fixture `node --check` commands and `npm pack --dry-run --json --ignore-scripts` passed. The package contains 63 entries including the managed worker and no test/model/cache payload. `git diff --check` passed; the changed-Markdown scan checked 83 relative links/anchors across 11 files and new-file whitespace passed. This source gate does not waive the native acceptance download-scope exception above.

No commit, push, dependency installation, version change, publication or real WhatsApp operation occurred. No additional native inference/downloads were performed after the three cases.

## Owner disposition — 2026-10-30 UTC

After disclosure and inspection, the owner explicitly accepted CrispASR downloading additional auxiliary resources and directed that this not block completion. The three successful local native cases are therefore **accepted with the expanded native auxiliary-asset scope**; no offline rerun is required. Preserve the original cap/observed-byte history rather than claiming the earlier strict three-file budget was met. No new server start, download, configuration change or inference was needed for this disposition. General documentation still warns other operators that explicit primary-model paths do not prevent auxiliary downloads.
