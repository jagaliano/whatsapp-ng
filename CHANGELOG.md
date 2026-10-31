# Changelog

## Unreleased

## 1.1.2 — 2026-10-31

- Protect eligible approved Voice/Both/audio-Mirror finals from accidental same-chat text-tool sends, including aliases and native quotes. Refuse before sending and direct the model to its normal final answer; retain explicit explanations once a legacy caption/tool-only attachment already covers the final. Preserve consent, manual sends, fallback and duplicate/unknown-delivery safety; clarify late-fence outcomes and whole-reply diagnostics.
- Refresh the maintainer lock from `follow-redirects` 1.16.1 to patched 1.16.2 within the existing Axios range, with no direct-dependency or unrelated resolution changes. Fresh source/consumer audits remain separate from existing consumer locks, host SDK/native-binary exposure and newly disclosed development-tool findings.

## 1.1.1 — 2026-10-30

- Add explicit `ttsUseServerVoice` for compatible OpenAI-style servers such as Chatterbox: omit the HTTP voice field to use the server's built-in voice without requiring a separate voice pack. Preserve strict named-voice defaults, Fish/Edge validation, atomic settings and separate speech consent; reselect the default after endpoint/provider/model changes.

- Add optional connection-time CrispASR server management through trusted shell-free JSON descriptors: independent STT/TTS startup, owned listener/model checks, request fencing, exclusive endpoint leases and parent-IPC watchdog cleanup. Preserve unmanaged providers, consent and request budgets. Correct `/stop`, terminal HUP, transient probes and teardown fencing after Opus review. Local macOS Whisper/Kokoro STT, TTS and combined pipelines produced expected results, with maintainer-accepted native auxiliary resources; Windows management and broader platform/WhatsApp qualification remain open.

- Clarify operator-owned speech setup, shorten current guides/plans and refresh dated SDK risk disclosures without changing dependencies or broadening platform/live-support claims.

## 1.1.0 — 2026-10-29

The maintainer approved promoting the prepared, unpublished RC2 source to stable `1.1.0` under `latest`. The release adds the outcomes below to published RC1; broader platform/live qualification and the documented inherited SDK findings are unchanged. `next` is not advanced by this promotion.

- Add a default-off **Connection → Auto-connect on startup** preference for TUI/RPC, persisted as a strict `autoConnect` boolean. Serialize config writes/cleanup and preserve newer cross-process selections; keep print/JSON opt-in and skip occupied-profile retry noise. Reuse saved credentials and the explicit online flag; changes are future-only, and Off survives reload/session replacement in its process. Back from this setting returns to Connection without changing the preference. No new tool, dependency or automatic pairing.

- Add case-insensitive fuzzy `/model` search across authenticated provider/model identifiers. Require explicit selection for search results, retain filters through pagination, and preserve exact selection, owner/group authorization, idle guards and private-identifier redaction. No dependency changes.

- Refresh maintainer guidance, startup/Back acceptance, version availability and package discovery explanations; preserve dated source/live/artifact limits and the inherited development-audit findings. Publication is deliberate; no publishing-automation activation.

### Earlier development notes shipped in RC1

The published RC1 artifact retained these notes under “Unreleased”. They are preserved as historical development context, not new 1.1.0 work or current publication/bootstrap status. See the release guide for current preparation and separate publishing gates.

- Prepare PR/main validation and default-off tag-triggered GitHub/npm OIDC publishing. Require exact version-tag/main ancestry, protected-environment approval and the same checksummed candidate; reject rerun publication and token fallback, retain attempt evidence, and verify registry integrity/tags. First publication still needs a separately approved manual bootstrap; no tokens, environment settings, tags or releases are created automatically.

- Add dependency-free local release commands for explicit version/lockfile updates, clean-commit validation and tarball preparation, plus separately confirmed publication of the checksummed artifact. Keep prereleases on `next`, reserve `latest` for explicit stable versions, and retain publication-attempt evidence instead of retrying uncertain outcomes. No automatic commits, tags, pushes or release promotion.

- Clean a separate spoken copy of automatic answers: remove ordinary emphasis/headings/bullets and quote escapes, allow short inline words/menu labels, preserve approximate values and bound heading parsing. Keep displayed text unchanged and command-like snippets/tables/overlong answers as complete text. Preserve link addresses through full-text fallback in Voice/Mirror; Voice + text speaks link labels only after its text send is accepted. No summarization or provider change.

- Restrict `configure_wa_stt` updates and resets to verified local requests or the configured WhatsApp owner. Recheck authority through atomic settings commit; denied, stale, cancelled and failed writes preserve disk and memory. This prevents other allowed chats from redirecting transcription uploads or selecting a different API-key environment variable through this tool.

- Permit loopback HTTP speech endpoints and explicitly opted-in non-loopback HTTP without relaxing URL/redirect guards or destination consent. Add CrispASR CLI/model/language aliases while retaining Whisper-first PATH discovery, plus optional remote-only STT language and a packaged [local speech guide](docs/crispasr.md). Preserve TTS wire bodies and existing backends; no binaries/models or new download machinery are bundled. Validate with **1194 tests/81 files**, no skips, lint/typecheck clean; clarify non-destructive HTTP opt-in recovery and isolate tests from the operator's exported opt-in.
- Retain full JID namespaces in model-facing sender/participant labels and require +E164 or a complete person JID for manual Owner entry, with localized validation. Preserve verified PN/LID voice preference matching and explicit-text duplicate suppression; do not guess aliases, migrate live settings or claim that a malformed Mirror key caused a voice failure.
- Group `/whatsapp` into Connection, Chats / Owner, Replies, Voice, Groups and Advanced. Share confirmed terminal/phone Off, make repeated Off inert, refresh connection options and close expired dialogs without applying stale choices. Cancel stale startup retries and restore only previously active outbound tools after reload/re-enable. Keep offline history, login and saved preferences.
- Replace body/error-payload diagnostics with private metadata-only runtime logs, best-effort 5 MiB rotation plus one backup and bounded records. Preserve historical logs; verbose no longer enables protocol traces. Keep ordinary error notices visible through the narrow startup/shutdown noise filter.
- Correct Sonnet-reviewed group/optional-output behavior: preserve questions on failed quoted-image downloads, retain final explanations after projected images in legacy mode, and avoid read receipts for ignored/paused input. Clarify image-tool consent, warn locally on oversized terminal answers and resolve source diagnostic warnings without changing live settings.
- Add default-off, individually approved tool-image projection for verified WhatsApp work and explicitly confirmed terminal/RPC final-text forwarding to the private owner/account only. Keep terminal screenshots local; reject paths/URLs, stale work, group/gateway retargeting and mid-task opt-in. Reuse bounded private snapshots, deferred settlement and uncertain-delivery suppression. Owner-confirmed private terminal forwarding/disable checks passed; automatic-image live checks remain open.
- Default allowed groups to verified mentions/replies, with terminal choices for mentions, replies or all messages. Add explicitly confirmed, bounded memory-only text context and retained same-group image references for text/audio requests. Preserve pauses, group-only binding and control authorization; stale queued admissions abort before usable inference. Owner-confirmed live group mention/reply testing passed; broader live paths remain unverified.
- Accept manual self-chat messages through authenticated own PN/LID identity, including text ending in `π`, without accepting registered outgoing echoes or turning ordinary own-direction messages to other chats into automatic work. Keep history/import/replay exclusions and make phone pause state explicit.
- Extend default-off final stats with independently selected successful write/edit file labels, completed interim assistant text and one throttled own-key edited activity message. Keep reporting bounded, input-time consented and withdrawable without suppressing final answers, exporting reasoning/tool bodies or reviving revoked work. Conservatively adapt assistant Markdown while preserving code and URL destinations; live rendering remains owner-controlled.
- Default native phone-control polls off behind explicit `--whatsapp-ng-native-polls`; numbered menus remain usable. Correct valid implicit self-chat references and raw LID/phone cryptographic author selection without relaxing owner checks. Exact Codex-high review: OK; 984 tests passed. The owner subsequently confirmed bounded self-chat navigation and a thinking acknowledgement; broader poll/client compatibility remains experimental.
- Add verified-owner phone controls for exact model/thinking, compact/new/stop, approved voice/reply preferences and confirmed Off/quit. Numbered menus work first; bounded native polls share the existing admitted intake. Handled controls never become model prompts.
- Preserve Off across session replacement/reload, withdraw outbound tools and retain terminal-only re-enable. Bound pending plus withdrawn follow-ups together without eviction/expiry reviving stopped work; redact explicit filesystem model identifiers from phone output.
- Refresh source validation to **1148 tests/79 files**, no skips, lint/typecheck clean. Correct the Opus-reviewed inline-code formatting defect, bound long-line parsing and preserve existing stats/phone controls when optional reporting settings are malformed. Correct the final-stats review's late opt-in timing defect with seven failing-before/passing-after regressions, including production-entry RPC/UI. Existing production-audit and live-speech evidence remain separately dated; C4 live-client, remaining C3 image, new Linux/Windows and clean-install qualification are not claimed.
- Make the completed **October 24, 2026 Tesseract 5.5.3/LiteParse 2.17.0 OCR checks** explicit: direct English raster recognition, scanned-PDF OCR, OCR-disabled behavior, corrupt-input fallback and worker cleanup passed. English/Spanish language data were present; a separate Spanish-accuracy benchmark is not claimed.
- Record the user-confirmed **Groq STT → Fish TTS** self-chat voice-note round trip; distinguish that playback evidence from the separate English/Spanish Edge synthesis checks. Use explicit Mexico City/UTC dates for the Edge result.
- Add persisted Voice/Owner settings, terminal-only destination consent, per-chat output/automatic-reply controls and a reviewed AI introduction. Existing chats remain text-only; group speech requires independent opt-in and paused work is not replayed.
- Add owner-authorized `configure_wa_tts` with atomic merge/removal, safe metadata and no immediate synthesis or consent grant. Verify native terminal/RPC provenance or the actual configured WhatsApp owner, never a rendered header or absent reply target; pairing no longer appoints the owner.
- Offer an explicitly confirmed, selected-allowed-chat fixed-phrase voice preview; preserve cancellation, no automatic unknown-delivery retry, and sender-owned snapshot settlement.
- Wire a final-output coordinator for text, voice, voice + text and metadata-driven mirror modes, selected from validated saved preferences and destination approval.
- Reserve finalization throughout synthesis, cancel stale/session-disconnected work, retain full-text fallbacks without another model call, and never resend uncertain voice uploads or duplicate the text in both mode. Keep generated snapshots until actual sender settlement, including archive-preflight/recording failures.
- Upgrade the exact Edge client pin to MIT `msedge-tts@2.1.1`, incorporating merged upstream PR #43 and its Bing/v2 signing fix. Align consent/result metadata with the new synthesis endpoint; old-endpoint approval is not reused. Real English/Spanish Andrew Multilingual checks produced complete Opus voice-note artifacts, closing the local Edge synthesis gate without changing Fish/WhatsApp settings. See [evidence and scope](DEPENDENCIES.md#edge-service-regression-october-23-2026).
- Add internal bounded speech backends: native-fetch Fish/OpenAI-compatible/OpenRouter and an explicitly approved MIT Edge client, with exact provider mapping, destination consent checks, owned worker cancellation, private intermediates and existing Ogg/Opus voice-note preparation. Speech stays off until explicitly enabled in the terminal Voice menu.
- Carry input kind and verified direct/group/self actor metadata through exact input consumption and frozen routing snapshots, with conservative mixed/unknown handling and runtime/account revalidation; keep metadata out of hashed prompt content.
- Deliver the final explanation after attachment sends by default; retain explicit-text duplicate suppression and a persisted terminal option for legacy caption/tool-only behavior.
- Track attachment, explicit text, progress and final delivery separately, claim each final response before transmission, and reject captured snapshots after session reset.
- Add policy-aware WhatsApp prompt guidance and fixed retry notices for mixed, verified conversation inputs without forwarding ambiguously owned model content.
- Clarify the Voice/Owner menu, backend-only `configure_wa_tts`, global versus chat-specific Mirror settings, and why LID digits must not be converted into a phone JID.

## 1.1.0-rc.1

Maintained continuation of the [upstream project](README.md#fork-and-legacy-names), preserving original history, attribution and MIT notices. The prerelease tag is `next`, not `latest`.

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
- Include MIT terms, original/yearless upstream attribution, the owner's 2026 notice and private security reporting. No transport upgrade or protocol patch.

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
- Published-package and host behavior remain subject to the limitations above; this prerelease is not a stable-support commitment.
