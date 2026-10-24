# Changelog

## 1.1.0-rc.1 candidate (unreleased)

Maintained continuation of the [upstream project](README.md#fork-and-legacy-names), preserving original history, attribution and MIT notices. Publication remains blocked by `private: true`; the intended prerelease tag is `next`, not `latest`.

### Messaging foundation

- Process every eligible batch item; isolate failures and suppress bounded replay/owned-send echoes.
- Resolve PN/LID/device aliases without replacing transport identity; re-index late mappings and fence obsolete socket/account work.
- Preserve complete message keys, including group participants; support compound emoji and unambiguous reaction targets.
- Attribute shared-context replies through Pi input provenance and immutable routing snapshots. Ambiguous or terminal-only work fails closed rather than using a stale recipient.
- Distinguish pre-send failure, socket acceptance and delivery-unknown outcomes; do not automatically retry uncertain sends.

### Media and native replies

- Add explicit local document/image/audio/voice-note/video sending and native quoted replies in tools/UI.
- Validate file type, allowed roots, ancestry and descriptor stability; reject symlinks/FIFOs/secret paths and bound files to 25 MiB.
- Prepare codec conversions/thumbnails in owned processes with a shared 60-second budget; retain private snapshots until consumers settle.
- Keep raw retry content bounded and exclude view-once/disappearing payloads as applicable. Missing/expired/unsupported quote targets remain explicitly unavailable.
- Bound incoming image/video/document downloads to 25 MiB; avoid repeated buffer copies and save new files privately with collision-resistant, exclusive names.

### Conversation fidelity

- Add private, versioned, atomically replaced per-profile/account archives and offline scope selection/pagination.
- Preserve visible text/emoji, observed identities, safe quote/media metadata and lifecycle state without transport secrets or attachment bytes.
- Add explicit bounded history requests and local status tracking; imported history never triggers agent prompts or media processing.
- Reconcile receipts, edits, revocations and reactions, with bounded pending updates and deletion-protecting admission floors. Interrupted work is not automatically reissued.

### Authentication and namespace

- Add canonical-profile transport ownership, serialized lifecycle transitions, retired-auth I/O fences and pinned rc14 credential-shape validation.
- Gate explicit legacy-profile adoption by source/destination ownership; preserve originals, reject merging and retain private adoption/reset markers.
- Rename the entry, logger, flags, environment identifiers, scripts, service templates and session/shutdown state to the independent `whatsapp-ng` namespace.
- Add explicit-source, same-filesystem whole-state migration to `~/.pi/agent/extensions/whatsapp-ng`: preserve settings/auth/history/media/logs and relative archive/profile identities. Never merge an occupied destination, copy credentials or steal locks.
- Gate startup/storage/logging on migration completion, including shutdown; retain startup results across session replacement and extension recreation. Recover interrupted moves only by verified directory identity.
- Verify that moving the data directory preserves settings, saved authentication, media, conversation archives, profile metadata and private permissions.

### Dependencies and packaging

- Pin Baileys 7.0.0-rc14 and upgrade LiteParse from 2.15.1 to 2.17.0; retain lazy native PDF loading and bounded parsing/cleanup/fallback.
- Remove the FFmpeg npm binary/downloader dependency. Use user-installed FFmpeg through `FFMPEG_PATH` or `PATH`.
- Use wildcard host-provided Pi/TUI/TypeBox peers and align the SDK/AI/TUI development cohort and lockfile with Pi 1.4.0; retain the host's independent TypeBox 1.3.27 version and refresh test tooling.
- Include MIT terms, original/yearless upstream attribution, the owner's 2026 notice and private security reporting. No transport upgrade/protocol patch or npm publication.

### Remote transcription

- Add provider-neutral `sttEndpoint`, `sttModel` and `sttEnv` settings for an OpenAI-compatible `/audio/transcriptions` endpoint. Persist the environment-variable name, never its key value.
- Keep local Whisper as the unconfigured default; configured remote mode skips local initialization/model downloads and never silently falls back after a configuration/provider error.
- Preserve omitted fields in STT configuration updates, reject invalid/incomplete combined settings before saving, and retain explicit empty-configuration clearing.
- Retain FFmpeg WAV conversion, add private collision-resistant audio scratch directories/cleanup, download/upload/response bounds, timeouts, redacted errors and account/session fencing with best-effort in-flight cancellation. No new dependency or live provider certification.

### Local transcription and documentation

- Use user-installed Whisper.cpp through `WHISPER_CLI_PATH` or `PATH`; remove repository build helpers and implicit vendor-directory lookup. Keep the independent Node binding fallback; npm still lists 0.2.12 as latest at the time of this update.
- Prefer an available CLI over the optional Node binding, so a working system install does not depend on the binding's Node ABI/build.
- Reuse an explicit `WHISPER_MODEL_PATH`, reject invalid/empty model overrides without a replacement download, support `WHISPER_LANGUAGE` (default `auto`), and use CPU mode.
- Bound CLI model preparation/transcription to ten minutes, abort on cancellation/session change, wait for child closure before cleanup, and publish downloaded models atomically from private temporary files.
- Replace the misleading Node-binding-only availability error with backend-neutral setup guidance; keep the obsolete local debug capture and generated Pi state out of version control.
- Refresh README/dependency guidance, index historical versus current specs and remove the redundant local strategy pointer. Historical decision/review records remain intact.

### Testing and known limits

- Recorded source validation passed 585 tests across 58 files with two workers and no skips, plus lint and typecheck on macOS with Pi 1.4.0. Direct Tesseract raster OCR and LiteParse 2.17.0 text/OCR/corrupt-file/worker-cleanup tests passed using system tools. Tests cover actual FFmpeg conversion, intercepted uploads, config persistence, credential handling, cleanup and session cancellation.
- Live direct-chat checks include media/native replies, saved-session reconnects, selected history/receipt behavior and a real WhatsApp voice note transcribed through Groq into Pi. These checks do not establish general recognition accuracy or compatibility with every provider.
- Earlier Linux package and storage-migration tests used Pi 1.3.0. The updated package needs fresh Linux testing; Windows, service installers and broader group/history/receipt behavior remain unverified. See [storage migration test results](specs/038-whatsapp-ng-namespace/validation.md) for the earlier evidence.
- Known Pi SDK/host Undici advisories remain outstanding. The latest recorded production-only npm audit reports zero findings but excludes host-supplied packages. See [dependency and security details](DEPENDENCIES.md#latest-audit-refresh).
- Final package verification and maintainer approval are still required before npm publication.
