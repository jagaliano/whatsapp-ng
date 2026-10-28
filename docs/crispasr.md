# Local speech with CrispASR

`whatsapp-ng` can use a compatible `crispasr` executable for **local transcription**, or an OpenAI-compatible server for STT/TTS. These are optional operator-managed tools, not bundled providers. Existing Whisper, Groq, Fish, OpenAI-compatible and Edge configurations remain supported.

Installing a CLI does **not** replace configured remote STT. To select local transcription, explicitly run `configure_wa_stt({})` after you decide to stop using the current remote endpoint. Do not clear working settings merely to test discovery.

## Choose a path

| Task | Extension integration | Main caveat |
| --- | --- | --- |
| Local multilingual STT | CrispASR CLI with an existing compatible Whisper GGML model | CPU-only invocation; ten-minute preparation/execution budget |
| Shared local STT server | OpenAI-compatible `/v1/audio/transcriptions` | Sixty-second request deadline; one backend per CrispASR process |
| Local HTTP TTS | OpenAI-compatible `/v1/audio/speech`, e.g. compatible Kokoro GGUF voice packs | Voice path/language depend on the server; sixty-second synthesis budget including queue wait |
| OmniVoice | Manual CLI use, **not a direct extension TTS backend** | HTTP WAV references require a per-request consent field this client does not send |

For mixed-language speech without local inference, the existing Edge multilingual voice and compatible remote text-reading voices remain options. This guide does not select or recommend a default provider for the extension.

## Install and verify

Download the CrispASR release for your OS/architecture from its upstream project. Keep the archive contents together: the executable may need sibling C2PA/shared libraries. Do not copy only the executable or assume every release has the same directory layout. Confirm with:

```sh
crispasr --version
crispasr --list-backends
```

Make the binary available to the user/service that starts Pi. A terminal PATH is not necessarily the service's PATH. No extension code installs CrispASR, accepts model licences or runs its model registry. The existing Whisper default-model downloader remains unchanged; supply an existing model path to avoid it.

### Models and licences

Obtain compatible models yourself. The supplied investigation used CrispASR 0.8.45 on Intel macOS with CPU/BLAS: larger Whisper models handled its short English/Spanish/Portuguese clips better than tiny/base. `ggml-large-v3-turbo-q5_0.bin` (about 574 MB) was the tested accuracy/CPU compromise; `small` also worked on those clips. This is limited measured evidence, not a general accuracy guarantee or Linux/Windows benchmark. CrispASR's `-m auto` registry choice may be base, not the larger model you want.

For example, an **operator-run** download of the chosen Whisper model:

```sh
mkdir -p "$HOME/.cache/crispasr"
curl -fL -o "$HOME/.cache/crispasr/ggml-large-v3-turbo-q5_0.bin" \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
```

Review current upstream model and voice-pack licences before downloading/using them. Do not assume the wrapper's licence covers every model. In the supplied investigation, OmniVoice weights were non-commercial CC-BY-NC with additional Boson tokenizer terms; it is not an unrestricted commercial default. Licence acceptance and voice/reference rights are the operator's decisions, never an automatic extension action.

## Local CLI transcription

Example POSIX shell configuration (adapt paths; preserve your existing working environment):

```sh
export CRISPASR_CLI_PATH="$(command -v crispasr)"
export CRISPASR_MODEL_PATH="$HOME/.cache/crispasr/ggml-large-v3-turbo-q5_0.bin"
export CRISPASR_LANGUAGE=auto
```

PowerShell:

```powershell
$env:CRISPASR_CLI_PATH = "$env:LOCALAPPDATA\crispasr\crispasr.exe"
$env:CRISPASR_MODEL_PATH = "$env:USERPROFILE\.cache\crispasr\ggml-large-v3-turbo-q5_0.bin"
$env:CRISPASR_LANGUAGE = "auto"
```

Restart Pi through its normal lifecycle after changing its launch environment; a running process cannot inherit later shell exports, and `/reload` alone does not import them. Keep the saved WhatsApp login. Do not create a second connection to the same profile.

Selection rules:

1. Nonempty `CRISPASR_CLI_PATH`, otherwise nonempty `WHISPER_CLI_PATH`. The first explicit choice is authoritative: an invalid executable does not fall through.
2. Otherwise find `whisper-cli` on PATH **before** trying `crispasr` on PATH, even if CrispASR appears in an earlier PATH directory. Windows uses the `.exe` names.
3. Otherwise retain the optional native Whisper addon on supported macOS/Windows builds. No new Linux addon support is implied.
4. Model: `CRISPASR_MODEL_PATH`, then `WHISPER_MODEL_PATH`, then the existing Whisper default-model path/download behavior. A missing/empty/directory explicit model fails without a replacement download.
5. Local language: `CRISPASR_LANGUAGE`, then `WHISPER_LANGUAGE`, then `auto`. Set CrispASR's value explicitly to `auto` if an existing Whisper variable pins a language.

The CLI gets `--model`, `--file`, `--language`, `--no-timestamps`, `--no-prints`, and `--no-gpu`. Both CLIs must support that contract. The native addon uses the model/language aliases too; this does not let it load arbitrary CrispASR backend models. A compatible Whisper GGML model is still required. The existing availability error retains its historical Whisper wording; check either supported executable/override.

## HTTP transport and privacy

Both existing remote clients accept HTTPS. HTTP is additionally permitted for normalized loopback hosts: `127.0.0.0/8`, `localhost`, and IPv6 `[::1]`. This is a lexical Node URL-host check, not DNS verification or proof of server identity. It does not include `localhost.example`, a wildcard bind address or arbitrary LAN hosts.

For non-loopback HTTP, explicitly set this in **Pi's launch environment**:

```sh
export WHATSAPP_NG_ALLOW_PLAIN_HTTP=1
```

```powershell
$env:WHATSAPP_NG_ALLOW_PLAIN_HTTP = "1"
```

**Plain HTTP exposes voice-note audio, spoken reply text and any Bearer API key without transport encryption.** Do not treat the opt-in or an allowed host as encryption, authentication or participant consent. Bind local servers to loopback unless you deliberately want network access; secure/authenticate remote deployments. A TLS reverse proxy with an appropriate Node trust configuration remains an alternative.

The value must be exactly `1`. This is a process-wide opt-in for **both STT and TTS to any non-loopback HTTP host**, not permission scoped to one server. The environment is authoritative, not persisted permission: if it is missing later, non-loopback HTTP becomes invalid again.

**If saved TTS settings become invalid, all automatic WhatsApp replies pause—including text-only chats.** The original configuration file remains intact. The non-destructive recovery is to restore the deliberately chosen `WHATSAPP_NG_ALLOW_PLAIN_HTTP=1` in Pi's launch environment and restart Pi. Do not use Reset merely to repair transport. While settings are invalid, Voice offers only Reset or Back, and `configure_wa_tts` cannot patch the endpoint. The only in-app recovery is an explicitly confirmed Voice Reset, which clears the speech backend, consent and all per-chat reply/speech overrides, including pause preferences. Choose that only if you intend to reset and reconfigure them. Remote STT independently fails closed rather than silently switching to local processing.

URL credentials, query strings, fragments and redirects remain forbidden. Keys are read from the named environment variable, never supplied as tool values or embedded URLs. Existing audio limits, cancellation, error redaction and timeouts are unchanged. STT notices include the scheme and host, without path/key/body content.

## STT server

Start the server yourself with your model:

```sh
crispasr --server --backend whisper \
  -m "$HOME/.cache/crispasr/ggml-large-v3-turbo-q5_0.bin" \
  --host 127.0.0.1 --port 8096
```

Configure explicitly through Pi:

```js
configure_wa_stt({
  sttEndpoint: 'http://127.0.0.1:8096/v1',
  sttModel: 'whisper',
  sttEnv: 'CRISPASR_API_KEY',
  sttLanguage: 'auto'
})
```

The client appends `/audio/transcriptions`; it sends multipart `file` (mono 16 kHz WAV), `model`, `response_format=json` and an optional `language`, expecting `{"text":"..."}`. The model string is operator-chosen; no provider-specific value is injected.

- `sttEnv` must name a nonempty environment variable. If the server intentionally has no authentication, an operator-chosen dummy value satisfies the client; with server authentication enabled, use the real server credential via your secret-management environment. Never paste a key into chat or commit it.
- `sttLanguage` affects remote STT only. Omit it or use `auto` to **omit** the wire field and let the server decide. An explicitly language-pinned server may remain pinned. A code such as `es` is sent as configured; supported codes are provider-dependent. `null` or `''` clears only this field; `{}` clears all remote settings and selects local STT. Partial updates preserve omitted fields.
- Remote STT has a sixty-second deadline; a CPU server can time out on long clips. Local CLI mode has a ten-minute budget. No timeout increase or GPU benchmark is implied.
- A CrispASR process serves one backend. Sending STT to a TTS-only process may return an empty transcription, not an HTTP error. Use distinct ports/processes.

## TTS server

The extension still sends only its existing standard speech fields. It adds **no TTS language, cloning-consent field, model selection, local TTS subprocess or automatic provider fallback**.

Example from the supplied working Kokoro HTTP setup; prepare the model/voice pack and verify current upstream options yourself:

```sh
crispasr --server --backend kokoro -m auto \
  --voice-dir ./voices --host 127.0.0.1 --port 8098
```

```js
configure_wa_tts({
  ttsProtocol: 'openai-compatible',
  ttsEndpoint: 'http://127.0.0.1:8098/v1/audio/speech',
  ttsModel: 'kokoro',
  ttsEnv: 'CRISPASR_API_KEY',
  ttsVoice: 'voices/af_heart.gguf',
  ttsFormat: 'wav'
})
```

The operator-run `-m auto` example can invoke CrispASR's own model-registry/download flow. Review the current model/voice licences before starting it, or supply an existing compatible model with `-m <path>` instead. The extension does not run this server command or accept licences for you.

STT uses a base URL; TTS uses the **complete** speech URL. The example voice is English. In the supplied investigation, the Kokoro registry lacked a Portuguese pack: adding `-l pt` to an English pack is not a language fix. Voice paths are server-side; the measured setup required a relative path under its working directory rather than a bare voice name/absolute path. Verify the server's own path policy and do not assume every provider treats voice strings as paths.

Configuration does not grant speech consent. In terminal `/whatsapp` → **Voice**, review/approve the destination, enable speech and select the desired mode. Group speech needs separate opt-in. Changing scheme/endpoint changes the destination key and requires fresh approval. Fish's request branch and Edge's unconfigured default are unchanged.

### Multilingual and OmniVoice limits

Choose outgoing language through the provider's voice/model, the server's launch configuration or an operator-managed gateway. No `language` key is added to TTS: strict OpenAI-compatible speech services may reject it. For a language-bound local engine, run an appropriately configured server/voice pack; some engines accept language through a gateway, but this extension does not inject it.

OmniVoice's measured CLI auto-language behavior does **not** make its HTTP path directly compatible. In the supplied 0.8.45 investigation, a nonempty `voice` was interpreted as a WAV reference, and synthesis demanded per-request `consent_attestation`. This extension sends no such field and has no local-CLI TTS provider. Manual OmniVoice CLI use is separate from automatic WhatsApp speech. An operator-owned proxy was experimentally possible but is not supplied/recommended here; it must handle legitimate reference rights/attestation itself.

The measured proxy route took roughly 49 seconds for a short sentence, including a spoken AI disclosure; default CLI synthesis took minutes. Those measurements do not prove normal replies fit the **sixty-second TTS budget including queue wait**. TADA was similarly near/over that deadline on the measured CPU. This change does not raise limits or claim GPU/Windows/Linux performance. Prefer a setup whose actual measured latency fits your workload.

## Check safely

Use public/synthetic audio and text, one destination at a time, and your existing instance—not a competing profile connection. Confirm the scheme/host, model and voice, then check a short transcription and spoken reply. Do not change working remote STT/TTS merely because the CLI was discovered. Avoid billing/real account tests without separate approval. Unsupported clients/platforms and unmeasured models remain unverified, not automatically qualified by this guide.

| Symptom | Check |
| --- | --- |
| CLI not selected | Remote STT still configured? Explicit CLI invalid? Service environment differs from your shell? |
| Missing model | Set an existing compatible GGML path; invalid explicit paths never trigger replacement downloads |
| Empty/garbled transcript | Correct Whisper server port/backend? Adequate multilingual model? Language pinned on server/local environment? |
| Endpoint rejected | Loopback host or exact HTTP opt-in? No credentials/query/fragment? |
| Saved LAN HTTP speech invalid after restart; automatic text replies also stop | Non-destructively restore the deliberate launch-environment opt-in and restart Pi. Voice Reset is destructive to backend/consent/per-chat overrides; do not select it unless you intend a full reset |
| TTS not spoken | Correct per-chat mode and destination approval? Explicit text-send tool already covered that reply? |
| TTS voice/path error | Server-specific relative path/voice pack and language; OmniVoice attestation is not provided by the client |
| Timeout | Actual model/host speed versus existing deadlines; no automatic retry or silent destination switch |

Return to [audio configuration](../README.md#audio-transcription) or [speech replies](../README.md#speech-replies-opt-in).
