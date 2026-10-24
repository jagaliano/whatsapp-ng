# Dependency and native-tool policy

## Maintainer reproduction

Use the committed npm lockfile with Node 26.x and Pi 1.4.0, matching the development SDK/AI/TUI versions for `1.1.0-rc.1`:

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

## Reviewed changes

| Area | Candidate selection | Reason |
|---|---|---|
| Transport | Baileys 7.0.0-rc14 exact | Preserve the characterized transport; no protocol patch or newer prerelease. |
| PDF | LiteParse 2.17.0 exact | Upgrade from 2.15.1; retain the native PDF backend and test text extraction, local OCR, corrupt-file recovery and worker cleanup. |
| Dev SDK/AI/TUI | Official Pi 1.4.0 packages, retaining legacy SDK/TUI import aliases | Align the SDK cohort with the installed host; keep runtime host peers wildcard rather than bundling copies. |
| Dev TypeBox | Legacy name aliased to typebox 1.3.27 | Pi 1.4.0 still supplies this independent TypeBox version; it is intentionally not changed to 1.4.0. |
| Test tools | Vitest/coverage 5.0.5, required Vite peer 8.3.5, Node types 26.6.5 | Remove the old critical Tinypool/test-server paths and satisfy declared tooling peers. |

The wildcard runtime host peers remain unchanged; dev copies are not runtime dependencies. The real SDK policy/input/image ownership test is retained with the current ModelRuntime API, an intercepted stream, blocked fetch and assertions of zero provider fetches.

## Native/runtime inventory and limits

| Component | Declared license / supply path | Candidate behavior |
|---|---|---|
| LiteParse/platform package 2.17.0 | Apache-2.0; platform-native addon and PDFium library supplied through npm artifacts | Matching optional package required. The generic tarball also contains Linux native files; those do not provide macOS/Windows support. Seven optional platform variants are locked, not all tested. |
| Local OCR | System Tesseract (Apache-2.0), Leptonica and language data with their own terms | No configured OCR server. OCR failure is nonfatal; missing tools/data can leave only native text or the saved-document fallback. No JS Tesseract/model downloader remains in this dependency path. |
| Baileys/native crypto | MIT Baileys and whatsapp-rust-bridge 0.5.4; libsignal 6.0.0 declares GPL-3.0 | Retained, not relabeled MIT by this fork. Rust bridge ships its compiled/WASM assets; no transport-source build performed. |
| System FFmpeg | User-installed build; its licenses and codec support depend on the distributor | Resolve `FFMPEG_PATH`, otherwise `ffmpeg` on `PATH`. No binary, npm FFmpeg package or downloader is supplied. Users install and update it; tests used FFmpeg 9.0.2. |
| Whisper-cpp-node 0.2.12 / external Whisper.cpp CLI | MIT package with optional platform-native addons; independent user-installed CLI/models | Prefer `WHISPER_CLI_PATH` or `PATH`. A compatible Node addon packages the Whisper.cpp engine and does not need a separately installed CLI, but still needs a GGML model. Unsupported/missing addons do not prevent system CLI use. CPU mode is explicit. |
| Other lifecycle entries | Baileys engine check, protobufjs setup, esbuild binary setup, optional fsevents, dev @google/genai setup | All disabled by the stated workflow. Native code can still arrive in npm optional packages and execute at import; `--ignore-scripts` is not a native-code sandbox. |

The project's MIT license applies to its code, not to every dependency/native binary. Preserve third-party notices and obligations for any redistribution; no dependency binaries are vendored into this extension tarball. This table records package-declared licenses and observed setup, not a complete legal/native-library vulnerability certification.

PDF native import/construction occurs only inside the PDF fallback boundary. Each PDF gets one pool process/one native worker, with a 60-second **parse** timeout and close on success/error. Startup/initialization is outside the library's parse timeout. Successful shutdown/replacement-child cleanup is tested; no total-operation or all-descendant cancellation guarantee is asserted. Invalid/unavailable parsing retains the saved bytes and existing bounded-preview/fallback behavior.

## Remote STT

`sttEndpoint`, `sttModel` and `sttEnv` in extension config select an OpenAI-compatible `/audio/transcriptions` backend. `sttEnv` stores only an environment-variable name; its value is resolved at request time and is never copied into config. There is no provider SDK or new dependency. The implementation uses the host's `fetch`, `FormData`, `Blob`, TLS and cancellation support; auditing npm dependencies alone does not certify the host's HTTP implementation.

Selecting remote STT explicitly sends admitted voice-note audio to the configured HTTPS host. FFmpeg still converts to mono 16 kHz WAV; remote mode does not initialize local Whisper or download a model. Invalid/partial settings or request failures never silently fall back. No provider is selected by hostname, and compatible chat endpoints are not automatically compatible transcription endpoints. See [configuration, limits and privacy](README.md#audio-transcription).

Recorded validation passed 552 tests/55 files with `npm test -- --maxWorkers=2`, lint and typecheck in an isolated HOME. Coverage includes actual FFmpeg conversion, private scratch permissions/cleanup, config persistence, intercepted multipart uploads, byte limits, error redaction and session cancellation. An initial unrestricted run hit a 15-second native PDF/OCR timeout; the unchanged test passed alone and with two workers. Isolated Pi 1.4.0 startup/session-replacement checks preserved local and remote settings, and a 40-entry package dry run included the remote transcriber.

Live Groq checks include a five-second public speech upload returning HTTP 200 and a real WhatsApp voice note transcribed through `whisper-large-v3-turbo` into Pi. These validate specific examples, not general accuracy, every provider or all WhatsApp routing behavior. Additional regression coverage could exercise stalled response bodies and session changes during file preparation.

## Whisper setup and model policy

The following applies to local mode, when remote STT is not configured. An existing system Whisper.cpp installation is sufficient; do not rebuild/install the Node addon merely to use that CLI. The runtime never runs a package installer or build script. Set `WHISPER_CLI_PATH` for a nonstandard executable, `WHISPER_MODEL_PATH` for your existing GGML model (including a light/tiny model), and optionally `WHISPER_LANGUAGE` (`auto` by default). The CLI receives `--no-gpu`; the native binding uses `use_gpu: false`.

A configured model must be a nonempty regular file. An invalid override fails without downloading or substituting another model. Without an override, the legacy default remains `whisper/models/ggml-base.bin` under the extension data root; first transcription downloads that model from Hugging Face if absent. Set an existing model path to avoid that download. Model bytes, licenses, provenance and runtime cost are separate from the npm lock.

A configured but invalid CLI is not silently replaced by another executable/backend. CLI selection does not prove model compatibility or successful transcription. Executables/models configured after the extension starts require a reload/restart to reconstruct its transcriber. Users install/build the CLI using upstream instructions; extension-maintained build helpers and implicit vendor-directory lookup have been removed.

## Native-tool update validation

Registry checks on 2026-10-24 reported LiteParse **2.17.0** and whisper-cpp-node **0.2.12** as their latest stable npm versions. LiteParse and its matching native package were upgraded; the Node binding was already current and remains a fallback. Its loader loads a packaged native addon, not an external `whisper-cli` process. CLI use is independent of that package.

Validation on macOS used Node 26.12.1, system FFmpeg 9.0.2, Tesseract 5.5.3/Leptonica 1.87.0 and installed whisper-cli 1.9.5. English and Spanish OCR data were available. The installed Whisper CLI passed version/discovery checks; no new speech transcription was run. The Node addon cannot load on this environment's platform, so its native execution was not tested here. All **559 tests/57 files** passed with two workers and no skips, including direct Tesseract recognition of a synthetic raster and LiteParse OCR of a raster-only PDF. Native PDF text extraction, corrupt input/fallback, worker cleanup, FFmpeg codecs, media preparation and remote-STT conversion fixtures passed. Lint/typecheck passed; the package dry run contained 40 entries.

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

The 2026-10-24 publication-review refresh with Pi 1.4.0 still reports **0 production findings**, but **2 affected packages in the full tree: one high and one moderate**. Both the development SDK and installed/published Pi are now **1.4.0**, still pinning `undici@8.10.2`. The alignment does not remove the Undici findings.

The current Undici record includes three advisories, all patched at **8.12.2**:

- Moderate: [EventSource parser memory exhaustion](https://github.com/advisories/GHSA-4qv8-2p9j-2685).
- Moderate: [SRI algorithm-token validation](https://github.com/advisories/GHSA-f72v-6w45-q472).
- High: [unhandled errors with excessive content-encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c), newly observed in this refresh.

The package-level count is not the advisory count. Installed Pi 1.4.0 also contains bundled Undici modules in its CLI chunks. Replacing a nested dependency or applying a repo override does not rewrite those bundles or certify their patched provenance; a complete host fix needs an upstream patched/rebuilt release or a separately reviewed rebuild. Do not treat a clean overridden dependency graph as proof that embedded runtime code was replaced.

**Remediation: wait for a patched Pi release.** The development dependencies use Pi 1.4.0; no Undici override, audit suppression or forced fix has been applied. npm's proposed SDK downgrade to 0.75.3 is not accepted: it would abandon the characterized integration. Reassess the remaining findings and rerun validation when Pi updates its dependency and bundles; waiting does not mean the current host is certified unaffected. Production-only extension auditing also excludes host-supplied SDK peers, so it does not certify the host SDK as unaffected. Refresh the host/development dependency assessment and final artifacts before release; the earlier zero-finding audit results are historical, not a current clean full-tree claim.
