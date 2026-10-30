# Explicit server-default speech voice

## Authorization and evidence

The owner authorized adapting the client to Chatterbox's built-in voice, with regression tests and no model downloads, server starts or saved-setting changes. Earlier advice incorrectly implied Chatterbox always needed a separate voice file. The [model card](https://huggingface.co/cstr/chatterbox-GGUF/blob/c45504bb8d55473a2213db17ec472ed11b69056a/README.md) documents a built-in voice. The inspected [CrispASR handler](https://github.com/CrispStrobe/CrispASR/blob/cc114d2b4a5a9413738f390093e9131576743cb6/examples/cli/crispasr_server.cpp) inherits startup voice parameters when `voice` is omitted. Model-card/source inspection is not native Spanish inference evidence.

## Requirements

- Add explicit `ttsUseServerVoice: true`, only with explicitly selected `openai-compatible` protocol and complete endpoint/model/environment-variable-name configuration. It omits `voice` from the speech JSON; never send a sentinel, placeholder, empty voice or null.
- Missing voices remain invalid by default. Reject malformed flags, simultaneous named/default selection, and default-voice selection for Fish or Edge. This is not an automatic fallback and grants no cloning attestation.
- Selecting server default clears an inherited named voice; selecting a named voice clears an inherited server-default choice. Both supplied together are rejected atomically.
- Do not inherit a server-default choice across effective destination/provider/model changes unless explicitly selected again. Ordinary partial updates preserve it. Reset removes it. Persistence and reopen preserve the explicit boolean.
- Keep owner/currentness/cancellation/revision checks, separate destination/group consent, request bounds, credential-name-only storage and no retry/fallback intact. No inference or consent from configuration.
- Expose the choice through `configure_wa_tts`; document that a compatible server must support omission and supplies the actual voice/language. No change to managed-process descriptors.

## Documentation follow-up

The owner requested both complete CMD descriptor examples and matching client-tool examples in the CrispASR guide, plain macOS naming in current setup text, and an independent read-only native Anthropic Opus 5.5 review of the source delta plus documentation. No additional runtime/configuration or native download/inference effects are included. Historical host-specific evidence remains dated evidence, not a general platform guarantee.

## Authorized review-note correction

The owner subsequently authorized documentation and the non-blocking malformed-descriptor diagnostic fix. An invalid role must continue refusing numeric-loopback request admission, with one bounded/redacted notice when connected with a relevant selection. Hosted/`localhost` unmanaged behavior remains unchanged. No spawned process, foreign listener/lock adoption, settings change, download, native inference or additional delegation is authorized by this correction.

## Acceptance

Failing regressions before implementation; focused configuration/HTTP/settings/tool tests; isolated full declared source checks; actual production-entry RPC tool configuration with a synthetic provider and blocked network. Native Chatterbox inference, model download, live settings mutation, reload, Git delivery and release actions are outside authorization.
