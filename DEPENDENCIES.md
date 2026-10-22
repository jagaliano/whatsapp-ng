# Dependency and native-tool policy

## Maintainer reproduction

The owner approved a committed npm lockfile for the `1.1.0-rc.1` candidate. Use Node 26.x and the reviewed Pi 1.3.0 host:

```sh
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm test
npm run lint
npm run typecheck
npm audit
npm audit --omit=dev
```

`--legacy-peer-deps` matches the Pi managed-install policy: Pi supplies the runtime host packages. Keep the flag with `npm ci`; the lock was generated with it. `--ignore-scripts` prevents dependency lifecycle downloads/builds. This workflow requires system FFmpeg; local OCR additionally requires Tesseract and its English data. It does not build Whisper or install a model.

The lock fixes the maintainer dependency graph and records integrity for npm artifacts. It does **not** freeze system executables, FFmpeg release assets, model files, future consumer transitive resolution or every native platform. Root package-lock.json is not shipped in the npm tarball. Consumers need their own lock/policy; exact Baileys/LiteParse pins are not a universal transitive freeze.

## Reviewed changes

| Area | Candidate selection | Reason |
|---|---|---|
| Transport | Baileys 7.0.0-rc14 exact | Preserve the characterized transport; no protocol patch or newer prerelease. |
| PDF | LiteParse 2.15.1 exact | Replace the vulnerable 1.5.3/Sharp path with the native backend. |
| Dev SDK/TUI | Legacy import names aliased to official Pi 1.3.0 packages | Match the tested host instead of drifting deprecated `latest` copies. |
| Dev TypeBox | Legacy name aliased to typebox 1.3.27 | Match the host's actual legacy-import mapping. |
| Test tools | Vitest/coverage 5.0.5, required Vite peer 8.3.5, Node types 26.6.5 | Remove the old critical Tinypool/test-server paths and satisfy declared tooling peers. |

The wildcard runtime host peers remain unchanged; dev copies are not runtime dependencies. The real SDK policy/input/image ownership test is retained with the current ModelRuntime API, an intercepted stream, blocked fetch and assertions of zero provider fetches.

## Native/runtime inventory and limits

| Component | Declared license / supply path | Candidate behavior |
|---|---|---|
| LiteParse/platform package 2.15.1 | Apache-2.0; platform-native addon and PDFium library supplied through npm artifacts | Matching optional package required. The generic tarball also contains Linux native files; those do not provide macOS/Windows support. Seven optional platform variants are locked, not all tested. |
| Local OCR | System Tesseract (Apache-2.0), Leptonica and language data with their own terms | No configured OCR server. OCR failure is nonfatal; missing tools/data can leave only native text or the saved-document fallback. No JS Tesseract/model downloader remains in this dependency path. |
| Baileys/native crypto | MIT Baileys and whatsapp-rust-bridge 0.5.4; libsignal 6.0.0 declares GPL-3.0 | Retained, not relabeled MIT by this fork. Rust bridge ships its compiled/WASM assets; no transport-source build performed. |
| FFmpeg-static 5.3.0 | GPL-3.0-or-later; install.js normally downloads binary/README/LICENSE from its b6.1.1 GitHub release | Retained because runtime fallback imports it. Lifecycle download disabled for maintainer checks; system FFmpeg 9.0.2 was used instead. The lock does not integrity-pin those external release downloads. |
| Whisper-cpp-node 0.2.12 / external CLI | MIT package; platform binding/CLI and models have separate distribution/setup requirements | Retained because transcription uses it on macOS/Windows with CLI fallback; Linux uses CLI. No model or Whisper build/real transcription was validated in M2. |
| Other lifecycle entries | Baileys engine check, protobufjs setup, esbuild binary setup, optional fsevents, dev @google/genai setup | All disabled by the stated workflow. Native code can still arrive in npm optional packages and execute at import; `--ignore-scripts` is not a native-code sandbox. |

The project's MIT license applies to its code, not to every dependency/native binary. Preserve third-party notices and obligations for any redistribution; no dependency binaries are vendored into this extension tarball. This table records package-declared licenses and observed setup, not a complete legal/native-library vulnerability certification.

PDF native import/construction occurs only inside the PDF fallback boundary. Each PDF gets one pool process/one native worker, with a 60-second **parse** timeout and close on success/error. Startup/initialization is outside the library's parse timeout. Successful shutdown/replacement-child cleanup is tested; no total-operation or all-descendant cancellation guarantee is asserted. Invalid/unavailable parsing retains the saved bytes and existing bounded-preview/fallback behavior.

## Security assessment and evidence

Assessment dated 2026-10-22. Before changes: 16 npm findings (11 high, 3 critical, 2 moderate), including LiteParse/Sharp, deprecated dev SDK/proxy/archive helpers and Vitest/Tinypool/Vite paths. After the scoped migrations, fresh full-tree and production-only `npm audit` runs reported **0 vulnerabilities**, without overrides, audit suppression or `npm audit fix --force`. Sharp is absent from the candidate lock; Baileys' separate optional image support is not represented as an installed vulnerable Sharp copy.

Audit results are time-scoped registry-advisory evidence. They do not scan all embedded PDFium/Tesseract/codec binaries or prove absence of vulnerabilities; refresh before release. Deprecation warnings for unchanged tooling are not automatically ignored security findings.

A fresh script-disabled `npm ci` regenerated node_modules with unchanged lock bytes, followed by 414 passing tests across 45 files, lint and typecheck. Real synthetic fixtures exercised PDF text, OCR off/on, corrupt PDFs, saved bytes/fallback and native child reaping. Tesseract-dependent tests explicitly skip if it is missing; the reported run had no such skip. Existing native Baileys/FFmpeg contracts also ran.

Observed host: Darwin x86_64, Node 26.12.0, npm 12.2.0, Pi 1.3.0, FFmpeg 9.0.2, Tesseract 5.5.3/Leptonica 1.87.0. Linux/Windows/other architectures, independent Pi-managed artifact installation and live account operations remain M3/M4 work. This candidate remains private and unpublished.
