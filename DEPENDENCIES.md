# Dependency and native-tool policy

## Maintainer reproduction

Use the committed npm lockfile with Node 26.x and Pi 1.4.0, matching the development SDK/AI/TUI cohort retained unchanged for `1.1.0`:

```sh
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
npm audit
npm audit --omit=dev
```

`--legacy-peer-deps` matches the Pi managed-install policy: Pi supplies the runtime host packages. Keep the flag with `npm ci`; the lock was generated with it. `--ignore-scripts` prevents dependency lifecycle downloads/builds. This workflow requires system FFmpeg; local OCR additionally requires Tesseract and its English data. It does not build Whisper or install a model.

The lock fixes the maintainer dependency graph and records integrity for npm artifacts. It does **not** freeze system executables, model files, future consumer transitive resolution or every native platform. Root package-lock.json is not shipped in the npm tarball. Consumers need their own lock/policy; exact Baileys/LiteParse pins are not a universal transitive freeze.

## Dated source checkpoint: October 27, 2026

The following is the earlier source/control checkpoint, not the current RC2 artifact qualification. Later source checks, fresh audits and remaining acceptance scope are recorded in the [RC2 preparation record](https://github.com/jagaliano/whatsapp-ng/blob/main/specs/040-rc2-publication-readiness/validation.md). Earlier live checks retain their separately recorded dates:

- macOS/Node 26.12.1 source validation: **1101 tests/78 files**, zero failures or skips, lint/typecheck clean. The previously recorded production-only `npm audit` reported **zero findings**; dependencies are unchanged by phone control, final stats, group/self-chat policy, optional output projection and settings/log privacy changes. That audit does not cover host-supplied peers or certify embedded native binaries.
- Exact Codex high phone-control review initially blocked retirement-fence eviction/expiry and identified relative-path disclosure. Both were corrected; focused re-review returned **OK**. Real isolated Pi fixtures verify session cancellation/replacement, Off persistence across replacement/reload, write-tool withdrawal and an already-aborted signal for withdrawn follow-ups. Encrypted direct/group votes are synthetic fixtures, not live-client qualification.
- Optional final-stats review identified one late opt-in timing defect. Eligibility now latches at input consumption, not the first assistant frame. Seven failing regressions, including actual production-entry RPC/UI, pass after correction; no second independent verdict is claimed. Native SDK cases cover successful/failed tools and terminal isolation. See [stats evidence and scope](specs/039-extension-improvements/c1-stats-validation.md).
- Group/self-chat policy adds default verified mention/reply triggers, optional confirmed bounded text context and cached image references without changing login/history layouts. Five production-entry RPC scenarios cover controls, polls, stats, stale queued group admission and self-LID echo protection with synthetic transport/model streams and zero network attempts. The owner subsequently confirmed the native mention/reply flow in one live test group from another participant; other live paths/clients remain unverified. See [C2 validation](specs/039-extension-improvements/c2-validation.md).
- Default-off optional outputs reuse existing image snapshots/sender guards and require individual tool consent or owner/account-bound private terminal-forwarding consent. Two additional production-entry RPC cases verify image deduplication/terminal isolation and late-opt-in/private-owner/group/disable routing with zero network attempts or extra model calls. The owner subsequently confirmed bounded private terminal forwarding and its local-only disable path. Automatic-image live checks remain open; the subsequent Sonnet 5.5 C2/C3 review and parent fixes are recorded in [the disposition](specs/039-extension-improvements/c2-c3-review.md). No agent-side real settings change is claimed. See [C3 validation](specs/039-extension-improvements/c3-validation.md).
- Grouped settings and shared terminal/phone Off add an eighth production-entry RPC scenario: active/queued WhatsApp work is withdrawn, Off survives new-session/reload, only previously active outbound tools return on terminal Connect, and fresh work succeeds. Private metadata logs exclude request/answer bodies and preserve historical logs. Synthetic transport/model streams made zero network attempts; no real settings change, independent C4 review or live-client verification is claimed. See [C4 scope](specs/039-extension-improvements/c4-validation.md).
- **Tesseract/OCR is verified, not pending.** The October 24 checks used Tesseract **5.5.3**, Leptonica **1.87.0** and LiteParse **2.17.0**. Direct English raster recognition and scanned-PDF OCR passed; the same real-tool contract tests passed without skips in that source suite. `eng` and `spa` data were installed, but a separate Spanish-recognition accuracy benchmark was not run.
- A real **Groq STT → Fish `s2.1-pro-free` TTS** self-chat round trip produced an accepted Ogg/Opus voice note, with user-confirmed playback. Self-chat does not establish independent-recipient receipt behavior.
- **Edge `msedge-tts@2.1.1`** completed fixed English/Spanish Andrew Multilingual synthesis and produced valid private Opus artifacts. The local synthesis compatibility gate is closed; Edge WhatsApp playback and universal service availability are not claimed.
- The **51-file phone-control package** was byte-checked and source/packaged startup-tested at the 976-test checkpoint. The later native-poll correction and final stats have isolated source/RPC checks; the current settings/log-privacy dry run contains 56 files, not a newly qualified tarball or clean consumer install. The native v2 Edge worker remains included.
- Native polls default off behind `--whatsapp-ng-native-polls`. Live self-chat showed votes without actions while typed numbers worked. A reviewed correction passes raw LID/phone author and implicit-reference fixtures through the production entry, with zero model/network activity; the owner subsequently confirmed bounded self-chat navigation and a thinking-level acknowledgement. Other clients/groups and model switching are not implied qualified.
- No new Linux/Windows qualification was performed. The older test counts below describe earlier checkpoints, not the current suite. The [full-tree/host assessment](#latest-audit-refresh) remains separately dated; the clean production audit does not close those findings.

## Reviewed changes

| Area | Candidate selection | Reason |
|---|---|---|
| Transport | Baileys 7.0.0-rc14 exact | Preserve the characterized transport; no protocol patch or newer prerelease. |
| PDF | LiteParse 2.17.0 exact | Upgrade from 2.15.1; native text extraction, real local OCR, corrupt-file recovery and worker cleanup tested. |
| Edge speech | msedge-tts 2.1.1 exact, MIT | Adopt merged PR #43's Bing/v2 signing fix; align consent identity, require completed protocol/audio and retain bounded worker cancellation. |
| Dev SDK/AI/TUI | Official Pi 1.4.0 packages, retaining legacy SDK/TUI import aliases | Align the SDK cohort with the installed host; keep runtime host peers wildcard rather than bundling copies. |
| Dev TypeBox | Legacy name aliased to typebox 1.3.27 | Pi 1.4.0 still supplies this independent TypeBox version; it is intentionally not changed to 1.4.0. |
| Test tools | Vitest/coverage 5.0.5, required Vite peer 8.3.5, Node types 26.6.5 | Remove the old critical Tinypool/test-server paths and satisfy declared tooling peers. |

The wildcard runtime host peers remain unchanged; dev copies are not runtime dependencies. The real SDK policy/input/image ownership test is retained with the current ModelRuntime API, an intercepted stream, blocked fetch and assertions of zero provider fetches.

## Native/runtime inventory and limits

| Component | Declared license / supply path | Candidate behavior |
|---|---|---|
| LiteParse/platform package 2.17.0 | Apache-2.0; platform-native addon and PDFium library supplied through npm artifacts | Matching optional package required. The generic tarball also contains Linux native files; those do not provide macOS/Windows support. Seven optional platform variants are locked, not all tested. |
| Speech synthesis | MIT `msedge-tts@2.1.1` (Edge only); native fetch for remote HTTP providers | Explicitly approved Edge dependency, including its browser-compatibility/axios/ws transitives. No Fish/OpenAI/OpenRouter SDK, dotenv package, CLI installer or speech model download. Edge is an unofficial online Microsoft service, not local inference or an Azure SLA. |
| Local OCR | System Tesseract (Apache-2.0), Leptonica and language data with their own terms | Tesseract 5.5.3/Leptonica 1.87.0 tested with direct raster OCR and LiteParse scanned-PDF OCR. No configured OCR server; missing tools/data retain the existing text/saved-file fallback. No JS Tesseract/model downloader. |
| Baileys/native crypto | MIT Baileys and whatsapp-rust-bridge 0.5.4; libsignal 6.0.0 declares GPL-3.0 | Retained, not relabeled MIT by this fork. Rust bridge ships its compiled/WASM assets; no transport-source build performed. |
| System FFmpeg | User-installed build; its licenses and codec support depend on the distributor | Resolve `FFMPEG_PATH`, otherwise `ffmpeg` on `PATH`. No binary, npm FFmpeg package or downloader is supplied. Users install and update it; tests used FFmpeg 9.0.2. |
| Whisper-cpp-node 0.2.12 / external Whisper.cpp CLI | MIT package with optional platform-native addons; independent user-installed CLI/models | Prefer explicit `CRISPASR_CLI_PATH`, then `WHISPER_CLI_PATH`; otherwise discover Whisper before CrispASR on `PATH`. A compatible Node addon packages the Whisper.cpp engine and does not need a separately installed CLI, but still needs a GGML model. Unsupported/missing addons do not prevent system CLI use. CPU mode is explicit. |
| Other lifecycle entries | Baileys engine check, protobufjs setup, esbuild binary setup, optional fsevents, dev @google/genai setup | All disabled by the stated workflow. Native code can still arrive in npm optional packages and execute at import; `--ignore-scripts` is not a native-code sandbox. |

The project's MIT license applies to its code, not to every dependency/native binary. Preserve third-party notices and obligations for any redistribution; no dependency binaries are vendored into this extension tarball. This table records package-declared licenses and observed setup, not a complete legal/native-library vulnerability certification.

PDF native import/construction occurs only inside the PDF fallback boundary. Each PDF gets one pool process/one native worker, with a 60-second **parse** timeout and close on success/error. Startup/initialization is outside the library's parse timeout. Successful shutdown/replacement-child cleanup is tested; no total-operation or all-descendant cancellation guarantee is asserted. Invalid/unavailable parsing retains the saved bytes and existing bounded-preview/fallback behavior.

## Remote STT

`sttEndpoint`, `sttModel` and `sttEnv` in extension config select an OpenAI-compatible `/audio/transcriptions` backend. `sttEnv` stores only an environment-variable name; its value is resolved at request time and is never copied into config. There is no provider SDK or new dependency. The implementation uses the host's `fetch`, `FormData`, `Blob`, TLS and cancellation support; auditing npm dependencies alone does not certify the host's HTTP implementation.

Selecting remote STT explicitly sends admitted voice-note audio to the configured endpoint. HTTPS is required except for loopback HTTP or launch-environment `WHATSAPP_NG_ALLOW_PLAIN_HTTP=1`; non-loopback HTTP exposes audio and Bearer credentials unencrypted. The same transport policy applies to remote TTS text/audio. URL/redirect guards and destination-specific speech approval remain intact. FFmpeg still converts to mono 16 kHz WAV; remote mode does not initialize local Whisper or download a model. Invalid/partial settings or request failures never silently fall back. No provider is selected by hostname, and compatible chat endpoints are not automatically compatible transcription endpoints. See [configuration, limits and privacy](README.md#audio-transcription).

Recorded validation passed 552 tests/55 files with `npm test -- --maxWorkers=2`, lint and typecheck in an isolated HOME. Coverage includes actual FFmpeg conversion, private scratch permissions/cleanup, config persistence, intercepted multipart uploads, byte limits, error redaction and session cancellation. An initial unrestricted run hit a 15-second native PDF/OCR timeout; the unchanged test passed alone and with two workers. Isolated Pi 1.4.0 startup/session-replacement checks preserved local and remote settings, and a 40-entry package dry run included the remote transcriber.

Live Groq checks include a five-second public speech upload returning HTTP 200, a real WhatsApp voice note transcribed through `whisper-large-v3-turbo` into Pi, and the subsequently confirmed Groq-to-Fish self-chat voice round trip. These validate specific examples, not general accuracy, every provider or all WhatsApp routing behavior. Additional regression coverage could exercise stalled response bodies and session changes during file preparation.

## Speech backend foundation

Remote adapters use native fetch and streaming responses; Edge alone uses the owner-approved exact `msedge-tts@2.1.1`. Source inspection and native-worker protocol tests confirm that the client ends its audio stream on `turn.end` and rejects premature socket closure; the earlier `node-edge-tts` streaming candidate could finish on error/timeout instead. The AGPL `edge-tts-universal` package was not adopted. Automatic finalization and the Voice/Owner settings require explicit destination consent; configuring a backend alone never enables speech.

Edge synthesis uses `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`; destination consent and result metadata identify that exact transport. Approval for the former `api.msedgeservices.com` endpoint is not carried to the new destination. Each request runs in an owned native `.mjs` worker, avoiding TypeScript stripping inside installed node_modules. Text crosses an in-memory channel, not argv; credentials and inherited preload flags are excluded. Worker diagnostics are discarded and termination is awaited. The remote adapters do not use the Edge client's transitive axios dependency. Destination-specific consent, credential-variable names, bounded text/audio/queue/deadline, session cancellation and existing FFmpeg/private PTT snapshot ownership apply to every backend. These bounded checks do not certify every provider/model/platform; the separately recorded Groq/Fish WhatsApp self-chat playback test does not qualify Edge WhatsApp playback.

### Edge service regression: October 23, 2026

Upstream [issue #42](https://github.com/Migushthe2nd/MsEdgeTTS/issues/42) reports a synthesis regression beginning **October 23, 2026**. Our October 25 check reproduced it with `msedge-tts@2.1.0`: HTTP 200 instead of a WebSocket upgrade; an endpoint-only legacy-route check returned HTTP 403. Those failed receipts remain historical evidence, not the current compatibility result.

Upstream [PR #43](https://github.com/Migushthe2nd/MsEdgeTTS/pull/43) merged October 25 and ships in the exact adopted **`msedge-tts@2.1.1`**. It restores the Bing synthesis route with v2 signing; changing the endpoint alone was insufficient ([issue #44](https://github.com/Migushthe2nd/MsEdgeTTS/issues/44)). The update's registry integrity/MIT license and completion/error/cancellation contract were inspected. Installation used `--ignore-scripts --legacy-peer-deps`; the package's `preinstall` (`npx only-allow pnpm`) was not run. Only the root dependency pin and msedge-tts lock node changed; no Python alternative or locally patched authentication code was adopted.

**Local synthesis gate closed October 25, Mexico City (October 26 UTC):** real English and Spanish fixed phrases using `en-US-AndrewMultilingualNeural`/`en-US` both reached successful protocol completion and produced valid private Ogg/Opus PTT artifacts (4 and 5 seconds). Native protocol tests cover v2 signing, compatibility headers, exact consent destination, truncated/empty/oversized streams and fresh approval after the endpoint change. Full regression validation passed **884 tests/69 files**, lint and typecheck. No live WhatsApp send or Fish-configuration change was performed for these Edge checks. This is scoped Node/macOS synthesis evidence, not an Azure SLA, universal availability or human-confirmed Edge WhatsApp playback.

## Whisper setup and model policy

The following applies to local mode, when remote STT is not configured. An existing system Whisper.cpp installation is sufficient; do not rebuild/install the Node addon merely to use that CLI. The runtime never runs a package installer or build script. Set `WHISPER_CLI_PATH` for a nonstandard executable, `WHISPER_MODEL_PATH` for your existing GGML model (including a light/tiny model), and optionally `WHISPER_LANGUAGE` (`auto` by default). Nonempty `CRISPASR_CLI_PATH`, `CRISPASR_MODEL_PATH` and `CRISPASR_LANGUAGE` are higher-priority aliases; invalid explicit paths never silently fall back. No CrispASR binary/model or new downloader is bundled. The optional remote-only `sttLanguage` does not change local language or TTS bodies. See the [CrispASR setup and limitations guide](docs/crispasr.md). The CLI receives `--no-gpu`; the native binding uses `use_gpu: false`.

A configured model must be a nonempty regular file. An invalid override fails without downloading or substituting another model. Without an override, the legacy default remains `whisper/models/ggml-base.bin` under the extension data root; first transcription downloads that model from Hugging Face if absent. Set an existing model path to avoid that download. Model bytes, licenses, provenance and runtime cost are separate from the npm lock.

A configured but invalid CLI is not silently replaced by another executable/backend. CLI selection does not prove model compatibility or successful transcription. Executables/models configured after the extension starts require a reload/restart to reconstruct its transcriber. Users install/build the CLI using upstream instructions; extension-maintained build helpers and implicit vendor-directory lookup have been removed.

## Native-tool update validation

Registry checks on 2026-10-24 reported LiteParse **2.17.0** and whisper-cpp-node **0.2.12** as their latest stable npm versions. LiteParse and its matching native package were upgraded; the Node binding was already current and remains a fallback. Its loader loads a packaged native addon, not an external `whisper-cli` process. CLI use is independent of that package.

The **October 24, 2026** native-tool validation on macOS used Node 26.12.1, system FFmpeg 9.0.2, Tesseract 5.5.3/Leptonica 1.87.0 and installed whisper-cli 1.9.5. English and Spanish OCR data were available; the OCR recognition fixtures exercised English. The installed Whisper CLI passed version/discovery checks; no new speech transcription was run. The Node addon cannot load on this environment's platform, so its native execution was not tested here. All **559 tests/57 files** passed with two workers and no skips, including direct Tesseract recognition of a synthetic raster and LiteParse OCR of a raster-only PDF. Native PDF text extraction, corrupt input/fallback, worker cleanup, FFmpeg codecs, media preparation and remote-STT conversion fixtures passed. Lint/typecheck passed; the package dry run contained 40 entries.

The production-only npm audit reported zero findings; the full tree retained the two known Pi SDK/Undici findings (one high, one moderate). No system tools were installed/upgraded, no Whisper model downloaded and no live WhatsApp or STT request was needed. These local checks do not requalify Linux/Windows packages or every user-installed tool version. See [OCR setup and manual checks](README.md#pdf-previews-and-ocr).

## Publication-review corrections

Fresh macOS validation with Node 26.12.1/Pi 1.4.0 passed **585 tests/58 files**, lint and typecheck, using a credential-free environment and isolated HOME. An actual `pi -e` synthetic probe first reproduced destructive partial STT updates and a CLI child continuing after abort; the corrected probe preserves the configured endpoint/key-variable name and observes cancellation. No real WhatsApp/STT call or model download was made.

Regression coverage now includes configuration-tool updates/rejections/clearing, CLI timeout/cancellation/session changes/child closure, mocked stalled model responses, private atomic model publication, concurrent model preparation, and capped/private incoming image/video/document storage. The CLI has a shared ten-minute preparation/transcription budget; its process guarantee does not extend to the native addon. The compatible Node fallback and dependency declarations remain intact: the installed `whisper-cpp-node@0.2.12` main package has no install/preinstall/postinstall hook, and native platform packages are optional.

The refreshed production audit remains clean; the full tree still has the two known SDK/Undici affected packages (one high, one moderate). No override, downgrade or dependency change was applied. Earlier test counts below remain historical rather than current release qualification.

## Earlier dependency-security testing

Assessment dated 2026-10-22. Before changes: 16 npm findings (11 high, 3 critical, 2 moderate), including LiteParse/Sharp, deprecated dev SDK/proxy/archive helpers and Vitest/Tinypool/Vite paths. After the scoped migrations, fresh full-tree and production-only `npm audit` runs reported **0 vulnerabilities**, without overrides, audit suppression or `npm audit fix --force`. Sharp is absent from the candidate lock; Baileys' separate optional image support is not represented as an installed vulnerable Sharp copy.

Audit results are time-scoped registry-advisory evidence. They do not scan all embedded PDFium/Tesseract/codec binaries or prove absence of vulnerabilities; refresh before release. Deprecation warnings for unchanged tooling are not automatically ignored security findings.

A fresh script-disabled `npm ci` regenerated node_modules with unchanged lock bytes, followed by 414 passing tests across 45 files, lint and typecheck. Real synthetic fixtures exercised PDF text, OCR off/on, corrupt PDFs, saved bytes/fallback and native child reaping. Tesseract-dependent tests explicitly skip if it is missing; the reported run had no such skip. Existing native Baileys/FFmpeg contracts also ran.

Those dependency-security tests used macOS, Node 26.12.0, npm 12.2.0, Pi 1.3.0, FFmpeg 9.0.2, Tesseract 5.5.3/Leptonica 1.87.0. Its 414-test count and audit date are historical, not the current validation status.

## Storage, platform and local transcription tests

Storage migration testing passed 502 tests/51 files on macOS and Linux amd64, Node 26.12.1/Pi 1.3.0. Both platforms passed managed-package install/remove/reinstall, host-peer/schema discovery, packaged RPC migration/session-replacement/recovery, installed native auth and competing-process checks. Repository and consumer audits, full-tree and production-only, reported zero findings. The two 39-member tarballs had identical uncompressed payload bytes despite different gzip hashes; see the [storage migration test results](specs/038-whatsapp-ng-namespace/validation.md).

The real namespace move was verified offline with settings/auth/media/archive/profile identities and permissions preserved. Earlier media/history checks predate that move. A later real WhatsApp voice note was transcribed through Groq and received by Pi; broader live behavior still requires separate testing.

The local transcription fix was reproduced on macOS: a working `whisper-cli` on `PATH` was missed by the old resolver. The updated source passed **515 tests/53 files**, lint and typecheck in an isolated HOME; new fixture checks cover selection, CPU arguments, explicit model reuse, language and no-download failure paths. Isolated actual `pi -e` startup and installed-CLI discovery were checked without connecting WhatsApp. A subsequent real CPU smoke check used the owner's existing `ggml-large-v3-turbo-q5_0.bin` with the source transcriber and installed CLI: five seconds of bundled public-domain speech produced the expected opening phrase in 32.3 seconds. Model metadata remained unchanged; no model was downloaded and no WhatsApp state was accessed. This single fixture does not establish general recognition quality, long-audio performance, Windows/ARM behavior or new artifact qualification. Service deployment and other model/platform combinations require separate checks. The prerelease targets the `next` tag; it is not a stable-support commitment.

### Pi 1.4.0 alignment

The SDK, AI and TUI development dependencies and their Pi dependencies use version 1.4.0. Runtime peers are still supplied by Pi. A clean `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund` reproduced the lock without changing it or building native tools/downloading models. Validation of that dependency update passed 515 tests/53 files, lint and typecheck on macOS, including real SDK policy/input/image ownership checks with provider requests blocked. Isolated Pi startup, session replacement and package-discovery checks also passed. Those results cover the dependency update, not later source changes or other platforms.

### Latest audit refresh

The 2026-10-31 release 1.1.2 preparation initially found one high production advisory, [cross-realm credential-header handling in follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p), through `msedge-tts` → Axios. The owner authorized a targeted, lifecycle-disabled `follow-redirects` **1.16.1 → 1.16.2** refresh within Axios's existing `^1.16.0` range. Only that lock entry changed; the manifest and all other resolutions stayed unchanged. The refreshed source production audit reports **0 findings**. A maintainer lock refresh does not force existing consumer locks to refresh: audit/update those separately; fresh isolated consumer qualification is a separate release gate.

The fresh full-tree audit reports **12 affected development-tree packages (one high, eleven moderate)**. It retains the eight Undici advisories below and newly reports [Minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), affecting installed tooling/SDK dependency chains below 11.0.1. No compatible automatic toolchain fix is offered by this audit; no SDK/toolchain override, forced downgrade or broad upgrade was applied. This does not certify installed-host bundles, native binaries or those unresolved findings as harmless.

The 2026-10-30 release 1.1.1 source refresh reports **0 production findings** and **2 affected development-tree packages (one high, one moderate)**. Package counts are unchanged, but the Undici 8.10.2 record now includes **eight advisories**, not three. In addition to the dated findings below, it reports [cross-origin redirect cache poisoning/disclosure](https://github.com/advisories/GHSA-4w7w-5xrc-9h26), [dropped Agent TLS options](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [TLS renegotiation denial of service](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm), [automatic WebSocket PONG buffering](https://github.com/advisories/GHSA-9fm3-97px-rjf6) and [decompress-interceptor exceptions](https://github.com/advisories/GHSA-55wc-3pg8-jfw6). No dependency override/change was applied. This is a fresh source dependency audit, **not** a new installed-host/bundled-code or native-binary reassessment; the existing upstream-remediation policy and unresolved host limits remain.

The 2026-10-24 publication-review refresh with Pi 1.4.0 still reports **0 production findings**, but **2 affected packages in the full tree: one high and one moderate**. The development SDK cohort is **1.4.0**; the recorded host assessment also used Pi **1.4.0**, pinning `undici@8.10.2`. That alignment did not remove the Undici findings. The later Edge-update production-only audit remains clean, but is not a fresh full-tree or installed-host reassessment.

That dated Undici record included three advisories, all patched at **8.12.2**:

- Moderate: [EventSource parser memory exhaustion](https://github.com/advisories/GHSA-4qv8-2p9j-2685).
- Moderate: [SRI algorithm-token validation](https://github.com/advisories/GHSA-f72v-6w45-q472).
- High: [unhandled errors with excessive content-encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c), newly observed in this refresh.

The package-level count is not the advisory count. Installed Pi 1.4.0 also contains bundled Undici modules in its CLI chunks. Replacing a nested dependency or applying a repo override does not rewrite those bundles or certify their patched provenance; a complete host fix needs an upstream patched/rebuilt release or a separately reviewed rebuild. Do not treat a clean overridden dependency graph as proof that embedded runtime code was replaced.

**Remediation: wait for a patched Pi release.** The development dependencies use Pi 1.4.0; no Undici override, audit suppression or forced fix has been applied. npm's proposed SDK downgrade to 0.75.3 is not accepted: it would abandon the characterized integration. Reassess the remaining findings and rerun validation when Pi updates its dependency and bundles; waiting does not mean the current host is certified unaffected. Production-only extension auditing also excludes host-supplied SDK peers, so it does not certify the host SDK as unaffected. Refresh the host/development dependency assessment and final artifacts before release; the earlier zero-finding audit results are historical, not a current clean full-tree claim.
