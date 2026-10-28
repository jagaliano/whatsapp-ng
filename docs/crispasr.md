# Local speech with CrispASR

[**CrispASR**](https://github.com/CrispStrobe/CrispASR) is a unified, local C++ speech toolkit. It started as a fork of Whisper.cpp and brings many **speech-to-text (STT/ASR)** and **text-to-speech (TTS)** model families behind one `crispasr` executable, with a CLI and an OpenAI-compatible HTTP server. Its inference runtime does not require Python or PyTorch.

**Beta/experimental:** CrispASR is a fast-moving 0.x project; treat the setup in this guide as beta software rather than a stable compatibility promise. Model support, download defaults, flags and voice requirements can change between releases. Check the documentation for the version you install and test with your own languages/audio before relying on it.

`whatsapp-ng` can use a compatible `crispasr` executable for **local transcription**, or a separately operated OpenAI-compatible server for STT/TTS. These are optional operator-managed tools, not bundled providers. Existing Whisper, Groq, Fish, OpenAI-compatible and Edge configurations remain supported.

Installing a CLI does **not** replace configured remote STT. To select local transcription, explicitly run `configure_wa_stt({})` after you decide to stop using the current remote endpoint. Do not clear working settings merely to test discovery.

## What CrispASR provides

The following tables are a selected summary of the [upstream model catalogue](https://github.com/CrispStrobe/CrispASR#supported-backends), not a list of models individually qualified with `whatsapp-ng`. CrispASR supports many more engines and variants; use `crispasr --list-backends` and the [generated feature matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/feature-matrix.md) for the current list in your build.

### STT model examples

| Model family | Upstream scope / reason to consider it |
| --- | --- |
| Whisper / Distil-Whisper | Multilingual Whisper covers 99 languages; `.en` checkpoints and upstream's `distil-large-v3` entry are English-only. Choose size/quantization for accuracy, memory and speed. |
| NVIDIA Parakeet | Transducer/CTC variants, including Parakeet-TDT v3 for 25 European languages; other checkpoints target particular languages. |
| NVIDIA Canary | Multilingual transcription and speech translation; supported languages and source/target controls depend on the checkpoint. |
| Qwen3-ASR | 0.6B/1.7B speech-language models; upstream lists 30 languages plus 22 Chinese dialects. |
| Mistral Voxtral | Speech-language models with transcription/translation capabilities; language coverage and streaming support vary by variant. |
| Moonshine | Smaller transcription models for lighter deployments; language support depends on the checkpoint. |
| IBM Granite Speech | Speech-language model variants with checkpoint-specific multilingual coverage. |

The **99-language figure belongs to multilingual Whisper**, not every STT model or a hard limit for CrispASR. Upstream also lists broader-coverage families such as OmniASR. An English-only model does not become multilingual merely by setting `language=auto`.

### TTS model examples

Kokoro is one option, not CrispASR's only speech engine:

| Model family | Upstream scope / main consideration |
| --- | --- |
| Kokoro-82M | Compact preset-voice synthesis; available languages depend on the backbone, voice pack and phonemizer. This guide includes a Kokoro HTTP example. |
| Piper | Lightweight, language-specific community voice models; upstream lists 30+ languages across its voices. |
| Qwen3-TTS | Base, CustomVoice and VoiceDesign variants; preset voices and reference/voice-design requirements differ. |
| VibeVoice | Realtime/streaming and larger voice-model variants; actual latency depends on the model and hardware. |
| Chatterbox | Multilingual and language-specific variants, with preset/reference-voice workflows. |
| F5-TTS | Reference-conditioned synthesis; reference text, voice rights and consent requirements matter. |
| TADA | Built-in/reference voices and larger multilingual variants; CPU synthesis can exceed this extension's request deadline. |
| OmniVoice | Upstream advertises **600+ languages**. This is not coverage shared by every TTS model, and its reference-audio HTTP workflow is **not directly supported by this extension**; see [OmniVoice limits](#multilingual-and-omnivoice-limits). |

Choose the model, language and voice that suit **your** hardware, accuracy, latency and licensing needs. The examples below are starting points, not a required model choice or a guarantee of equal quality across languages.

### Platforms and acceleration

CrispASR provides builds for **Windows, Linux and macOS**, with CPU and GPU choices including:

| Execution option | Hardware / build considerations |
| --- | --- |
| CPU | CPU-only builds; instruction-set requirements differ between standard and legacy binaries. |
| CUDA | Supported NVIDIA GPUs with the matching build and driver; not a macOS GPU option. |
| Metal | Apple Silicon macOS builds; Intel macOS releases use CPU/Accelerate instead. |
| Vulkan | Cross-vendor GPU option where the build, driver and model support it; a suitable driver is required. |

These are upstream capabilities, **not every possible OS/CPU/GPU/model combination**. Follow the [upstream installation matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/install.md). The extension's direct CLI invocation still forces CPU with `--no-gpu`; operate a separate HTTP server to select other supported model families or GPU acceleration. Installing a GPU-enabled binary alone does not change the extension's CLI contract.

## Choose a path

| Task | Extension integration | Main caveat |
| --- | --- | --- |
| Local multilingual STT | CrispASR CLI with an existing compatible Whisper GGML model | CPU-only invocation; ten-minute preparation/execution budget |
| Shared local STT server | OpenAI-compatible `/v1/audio/transcriptions` | Sixty-second request deadline; one backend per CrispASR process |
| Local HTTP TTS | OpenAI-compatible `/v1/audio/speech`, e.g. compatible Kokoro GGUF voice packs | Voice path/language depend on the server; sixty-second synthesis budget including queue wait |
| OmniVoice | Manual CLI use, **not a direct extension TTS backend** | HTTP WAV references require a per-request consent field this client does not send |

For mixed-language speech without local inference, the existing Edge multilingual voice and compatible remote text-reading voices remain options. This guide does not select or recommend a default provider for the extension.

## Install and verify

Download the [CrispASR release](https://github.com/CrispStrobe/CrispASR/releases/latest) for your OS/architecture. Keep the archive contents together: the executable may need sibling C2PA/shared libraries. Do not copy only the executable or assume every release has the same directory layout. Confirm with:

```sh
crispasr --version
crispasr --list-backends
```

Make the binary available to the user/service that starts Pi. A terminal PATH is not necessarily the service's PATH. No extension code installs CrispASR, accepts model licences or runs its model registry. CrispASR itself can download and cache registered models when **you** run commands with `-m auto` / `--auto-download`, or explicitly select a Hugging Face repository. This is separate from the extension's unchanged Whisper default-model downloader; supply an existing model path to avoid that fallback.

### Models and licences

CrispASR can automatically download many registered STT/TTS models and their companion files on first use, then reuse its cache. For example, these **operator-run** commands select a backend's registry default; replace the public test audio/text as appropriate:

```sh
crispasr --backend parakeet -m auto -f /path/to/public-test.wav -l en
crispasr --backend qwen3 -m auto -f /path/to/public-test.wav
crispasr --backend kokoro -m auto --tts "Hello world." --tts-output hello.wav
```

Auto-download does **not** mean “choose the best model for me.” Defaults differ by backend/release, some models/voices need manual files or licence acceptance, and a first run can download additional codecs, voices or language-detection models. Review the [upstream model-resolution flags](https://github.com/CrispStrobe/CrispASR/blob/main/docs/cli.md#model-resolution-flags) before starting downloads.

### Explicit Turbo example: use the Hugging Face selectors

**This is an example, not a mandatory or universal recommendation. Pick a model that suits your languages, hardware, memory, speed and accuracy needs.** The supplied investigation used CrispASR 0.8.45 on Intel macOS with CPU/BLAS: larger Whisper models handled its short English/Spanish/Portuguese clips better than tiny/base. `ggml-large-v3-turbo-q5_0.bin` (about 574 MB) was a tested accuracy/CPU compromise; `small` also worked on those clips. This is limited measured evidence, not a general accuracy guarantee or Linux/Windows benchmark.

Do not confuse these three defaults with the Turbo file:

| Invocation / layer | Default to watch for |
| --- | --- |
| Standalone CrispASR CLI without an explicit model | Its default path is `models/ggml-base.en.bin`: the basic **English-only** model. Do not rely on it for multilingual voice notes or assume it downloads Turbo. |
| CrispASR `--backend whisper -m auto` | The checked registry selects multilingual `ggml-base.bin`, not `ggml-large-v3-turbo-q5_0.bin`. Defaults can change. |
| `whatsapp-ng` without a model-path override | Its existing Whisper downloader also selects `ggml-base.bin`; installing CrispASR does not replace that choice. |

The basic models can produce more transcription errors on difficult/noisy audio; `.en` is additionally the wrong choice for non-English speech. That does not mean every base-model result is wrong. Test candidates with your own representative audio instead of assuming a larger model is always necessary or always better.

To obtain **this exact Turbo file through CrispASR**, explicitly use its Hugging Face (`--hf-*`) download selectors. The checked CLI accepts **`--hf-repo` / `--hf-file`**, not a standalone `--hf` switch:

```sh
crispasr --backend whisper \
  --hf-repo ggerganov/whisper.cpp \
  --hf-file ggml-large-v3-turbo-q5_0.bin \
  --cache-dir "$HOME/.cache/crispasr" \
  --dry-run-resolve --no-gpu
```

PowerShell, as one line:

```powershell
crispasr.exe --backend whisper --hf-repo ggerganov/whisper.cpp --hf-file ggml-large-v3-turbo-q5_0.bin --cache-dir "$env:USERPROFILE\.cache\crispasr" --dry-run-resolve --no-gpu
```

**These HF examples download/cache the selected file.** In the checked CLI, HF fetching happens before `--dry-run-resolve`, which stops before inference and prints the resolved path; do not treat this combination as a network-free preview. The explicit cache directory matches the model-path examples below. Alternatively, download the exact file yourself from [the Whisper model repository](https://huggingface.co/ggerganov/whisper.cpp) and set its existing path. Neither `-m auto` nor setting a nonexistent `CRISPASR_MODEL_PATH` asks the extension to obtain this Turbo model for you.

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

`http://` endpoint support was added so local speech servers such as CrispASR can serve STT/TTS on the same machine without requiring a TLS reverse proxy just for localhost. A separately managed server can choose model families and CPU/CUDA/Metal/Vulkan execution independently of the extension's CPU-only local CLI path. HTTP support does not remove backend-specific model, voice, licence or consent requirements.

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
  --language auto --host 127.0.0.1 --port 8096
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

The extension still sends only its existing standard speech fields, including the configured `ttsModel`. It adds **no provider-specific TTS language or cloning-consent field, automatic model selection, local TTS subprocess or automatic provider fallback**. Select/load the actual backend and model when starting CrispASR; the request's model label does not launch or swap server models.

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

## Credits and upstream references

Project explanation and selected model/platform tables are summarized and adapted from **[CrispStrobe/CrispASR](https://github.com/CrispStrobe/CrispASR)** and its contributors' documentation, checked on **2026-10-28**. Credit for CrispASR and its speech runtimes belongs to that project and its contributors; credit for the original models/voices belongs to their respective creators. This guide documents the `whatsapp-ng` integration and does not replace upstream instructions or model licences.

- [Upstream README and model catalogue](https://github.com/CrispStrobe/CrispASR#supported-backends)
- [Generated backend feature matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/feature-matrix.md)
- [Installation and platform/build guidance](https://github.com/CrispStrobe/CrispASR/blob/main/docs/install.md)
- [CLI flags and model auto-download](https://github.com/CrispStrobe/CrispASR/blob/main/docs/cli.md)
- [TTS engines, voices and language requirements](https://github.com/CrispStrobe/CrispASR/blob/main/docs/tts.md)
- [HTTP server API and voice-consent requirements](https://github.com/CrispStrobe/CrispASR/blob/main/docs/server.md)
- [CLI implementation: HF selectors and default model path](https://github.com/CrispStrobe/CrispASR/blob/main/examples/cli/cli.cpp)
- [Model registry: current backend defaults and companions](https://github.com/CrispStrobe/CrispASR/blob/main/src/crispasr_model_registry.cpp)
