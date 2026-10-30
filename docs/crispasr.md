# Local speech with CrispASR

[CrispASR](https://github.com/CrispStrobe/CrispASR) provides local C++ speech-to-text (STT) and text-to-speech (TTS) through a CLI and an OpenAI-compatible HTTP server. Inference needs no Python/PyTorch.

**Beta/experimental:** model support, voices and flags vary by release. Check your installed build and model licences. CrispASR and its models are operator-managed, not bundled with `whatsapp-ng`.

Installing CrispASR does not replace configured remote STT. `configure_wa_stt({})` explicitly returns to local CLI transcription; do not clear working settings just to test discovery.

## What CrispASR provides

Selected [upstream backends](https://github.com/CrispStrobe/CrispASR#supported-backends), not individually qualified extension integrations. Check `crispasr --list-backends` and the [feature matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/feature-matrix.md) for your build.

### STT model examples

| Family | Language/model considerations |
| --- | --- |
| Whisper / Distil-Whisper | Multilingual Whisper covers 99 languages; `.en` checkpoints and `distil-large-v3` are English-only. |
| NVIDIA Parakeet | Transducer/CTC variants; TDT v3 covers 25 European languages. |
| NVIDIA Canary | Multilingual transcription/translation; checkpoint-specific controls. |
| Qwen3-ASR | 0.6B/1.7B models; upstream lists 30 languages plus 22 Chinese dialects. |
| Mistral Voxtral | Speech-language models with variant-specific coverage. |
| Moonshine | Smaller models with checkpoint-specific languages. |
| IBM Granite Speech | Speech-language models with checkpoint-specific coverage. |

The 99-language figure belongs to multilingual Whisper, not every STT backend. `language=auto` does not make an English-only model multilingual.

### TTS model examples

| Family | Main consideration |
| --- | --- |
| Kokoro-82M | Preset voices; language depends on the voice pack and phonemizer. |
| Piper | Lightweight, language-specific community voices. |
| Qwen3-TTS | Base, CustomVoice and VoiceDesign have different requirements. |
| VibeVoice | Realtime/streaming variants; latency depends on model/hardware. |
| Chatterbox | Multilingual and language-specific variants; built-in/reference voices. |
| F5-TTS | Reference audio/text and speaker rights required. |
| TADA | Built-in/reference voices; CPU synthesis can exceed the request deadline. |
| OmniVoice | Upstream advertises 600+ languages, but its reference-audio HTTP workflow is [not directly supported](#multilingual-and-omnivoice-limits). |

### Platforms and acceleration

CrispASR supplies Windows, Linux and macOS builds. CPU, NVIDIA CUDA, Apple Metal and Vulkan support depends on the build, hardware and model; see the [installation matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/install.md). Metal requires a compatible macOS build; CUDA requires a supported NVIDIA GPU.

The extension's **direct CLI path always uses CPU** (`--no-gpu`) and a compatible Whisper GGML model. Use a compatible HTTP server for other model families or acceleration. No all-platform/model qualification is implied.

## Choose a path

| Task | Integration | Limit |
| --- | --- | --- |
| Local STT | Whisper-compatible CLI | CPU; ten-minute preparation/execution budget |
| HTTP STT | `/v1/audio/transcriptions` | Sixty-second request; one backend per process |
| HTTP TTS | `/v1/audio/speech` | Provider voice or explicit server-default voice; sixty seconds including queue wait |
| OmniVoice | Manual CLI only for its reference workflow | This client does not send cloning attestation |

STT and TTS are independent. Edge and existing remote providers remain alternatives.

## Install and verify

Download the [release](https://github.com/CrispStrobe/CrispASR/releases/latest) for your system. Keep the executable and sibling runtime libraries together, and expose them to the user/service launching Pi:

```sh
crispasr --version
crispasr --list-backends
```

### Models and licences

CrispASR can download/cache models through `-m auto`, `--auto-download` or HF selectors, including when an explicitly configured managed command uses those flags. Defaults differ by release; codecs, voices and auxiliary models/lexicons may download separately. The extension does not install binaries or accept licences.

Review model/voice/reference rights before use. OmniVoice weights were non-commercial CC-BY-NC with additional tokenizer terms in the dated investigation; do not assume the wrapper's licence covers its models.

### Explicit Turbo example: use the Hugging Face selectors

`ggml-large-v3-turbo-q5_0.bin` is a multilingual Whisper option, about 574 MB—not a required default. Select model size/quantization for your workload.

| Layer | Checked default, not Turbo |
| --- | --- |
| Standalone CrispASR without an explicit model | `models/ggml-base.en.bin`, English-only |
| CrispASR `--backend whisper -m auto` | Multilingual `ggml-base.bin` |
| Extension without a model-path override | Its existing Whisper `ggml-base.bin` downloader |

Explicit HF selection uses `--hf-repo` / `--hf-file`, not a standalone `--hf` flag:

```sh
crispasr --backend whisper \
  --hf-repo ggerganov/whisper.cpp \
  --hf-file ggml-large-v3-turbo-q5_0.bin \
  --cache-dir "$HOME/.cache/crispasr" \
  --dry-run-resolve --no-gpu
```

PowerShell:

```powershell
crispasr.exe --backend whisper --hf-repo ggerganov/whisper.cpp --hf-file ggml-large-v3-turbo-q5_0.bin --cache-dir "$env:USERPROFILE\.cache\crispasr" --dry-run-resolve --no-gpu
```

**HF fetching happens before `--dry-run-resolve`: these commands download/cache the file.** The preview exits before inference. Alternatively, download the exact file yourself and use its existing path. A nonexistent `CRISPASR_MODEL_PATH` is an error, not a request to fetch Turbo.

## Local CLI transcription

Set these in Pi's launch environment:

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

Restart Pi after changing its environment; `/reload` cannot import shell exports. Do not create a competing same-profile connection.

Selection order:
1. Nonempty `CRISPASR_CLI_PATH`, otherwise `WHISPER_CLI_PATH`; an invalid explicit choice fails without fallback.
2. Otherwise search all PATH directories for `whisper-cli` before `crispasr` (`.exe` on Windows).
3. If neither CLI exists and neither override is set, retain the native Whisper addon on compatible macOS/Windows builds; no Linux addon support.
4. Model: `CRISPASR_MODEL_PATH`, then `WHISPER_MODEL_PATH`, then the existing Whisper default downloader. Invalid explicit files fail without replacement downloads.
5. Language: `CRISPASR_LANGUAGE`, then `WHISPER_LANGUAGE`, then `auto`.

The CLI must accept `--model`, `--file`, `--language`, `--no-timestamps`, `--no-prints` and `--no-gpu`. Native addon aliases still require a compatible Whisper GGML model; they do not load arbitrary CrispASR backends.

## HTTP transport and privacy

HTTPS is supported. HTTP is allowed on normalized loopback hosts (`127.0.0.0/8`, `[::1]`, `localhost`); this is a lexical host check, not DNS or server-identity verification. Keep local servers bound to loopback.

Non-loopback HTTP requires this exact opt-in in Pi's launch environment:

```sh
export WHATSAPP_NG_ALLOW_PLAIN_HTTP=1
```

```powershell
$env:WHATSAPP_NG_ALLOW_PLAIN_HTTP = "1"
```

**This exposes audio, reply text and Bearer keys without transport encryption, for both speech clients process-wide.** URL credentials, query strings, fragments and redirects remain forbidden. Keys come from named environment variables, never tool values or URLs. HTTPS with a correctly trusted reverse proxy is an alternative.

Removing the opt-in invalidates saved LAN HTTP settings. **Invalid saved TTS settings pause all automatic replies, including text-only chats.** Restore the intended environment and restart Pi to recover without deleting preferences. While invalid, the TTS tool cannot patch the endpoint; Voice offers Reset or Back. Confirmed Reset clears the backend, consent and per-chat overrides, including pause preferences—do not use it merely to repair transport. STT fails without silently changing backend.

See the [speech reference](reference.md#remote-speech-endpoints) for request, cancellation, scratch-file and retention limits.

## Optional managed startup

`CRISPASR_STT_CMD` and `CRISPASR_TTS_CMD` are JSON descriptors in Pi's trusted launch environment, **not shell commands or chat settings**. Unset/blank variables preserve operator-run servers. Restart Pi after changing them; these settings are separate from `CRISPASR_CLI_PATH`.

| Field | Contract |
| --- | --- |
| `executable`, `cwd` | Absolute paths. Run the non-daemonized server directly, or an executable wrapper that `exec`s it; no shell interpreter/command string. |
| `args` | Literal strings; `$HOME`/`~` inside JSON do not expand. Model paths do not prevent auxiliary downloads. |
| `endpoint` | Numeric-loopback HTTP with explicit port: STT `/v1`, TTS `/v1/audio/speech`. No `localhost`, LAN/wildcard binding, URL credentials/query/fragment. |
| `backend` | Expected `/health` backend, supporting the selected API. |
| `model` | Exact selected `sttModel`/`ttsModel` API label. |
| `loadedModel` | Exact authenticated `/v1/models` ID, with matching backend and `owned_by: crispasr`; not the API alias. |
| `env` | Additional environment-variable **names** to inherit. Defaults cover PATH/home/temp/locale and platform basics, not arbitrary credentials. |
| `startupTimeoutMs` | 100–300,000 ms; default 180,000. Request deadlines are separate. |

- Roles need separate listening origins. A matching selected backend starts on connection or an online settings change, even when TTS output is disabled. Management does not grant consent or submit inference requests; native warmup depends on launch flags.
- Readiness and every request require owned-child/listener proof plus matching health/backend/model metadata. Foreign listeners and retained locks are refused, never adopted or killed. Native output is discarded; diagnostics expose bounded reason codes only.
- Transient startup probes wait within the budget; transient admission errors refuse that request without uploading, retrying audio or killing a healthy server. Fatal ownership/model/backend errors retire the role. Fix a failed start, then explicitly retry with Off → Connect or a fresh runtime.
- Valid descriptors leave unrelated endpoints unmanaged; a different API model/protocol at their own endpoint is refused. Malformed descriptors refuse **all numeric-loopback selections for that role**, with one configuration notice per retry/runtime when connected. Hosted and `localhost` selections stay unmanaged; `localhost` is not a valid descriptor.
- Off, disconnect, committed session replacement, reload/shutdown and relevant backend changes retire owned processes. `/stop` cancels speech work without retiring a connected server. Reconnect reloads models, which can be expensive on CPU.
- A Node watchdog handles parent IPC loss/SIGHUP, with three seconds for TERM and two for KILL of its owned non-daemonized process group. Never remove unknown locks or kill by name/port. Daemonizing wrappers, simultaneous watchdog/OS failure and damaged retained locks require operator inspection.

Ownership uses `lsof` on macOS and procfs on Linux; **Windows management is unsupported**. This is cooperative ownership, not a hostile-same-user sandbox. [Dated validation and native acceptance](../specs/043-managed-crispasr/review.md) do not establish every platform/model combination.

The checked unified server (0.8.48, commit `cc114d2b4a5a9413738f390093e9131576743cb6`) returns `/health` status/backend and authenticated `/v1/models` metadata. An explicit model's ID is its resolved path. Verify metadata only on a known owned server using securely loaded credentials; older standalone server implementations may have a different schema.

### Complete example: Spanish Whisper Turbo and Chatterbox

For macOS/Linux Bash or Zsh. **CMD descriptors launch servers; `configure_wa_*` selects clients. Both are required.** Use an updated checkout/release with managed startup and `ttsUseServerVoice`, and load only one WhatsApp extension. Node below formats JSON; it performs no inference.

#### 1. Prepare the launch environment

Use the terminal that will launch Pi. If CrispASR is not on PATH, set `CRISPASR_BIN` to its absolute path instead.

```sh
export CRISPASR_BIN="$(command -v crispasr)"
export CRISPASR_CACHE_DIR="$HOME/.cache/crispasr"
mkdir -p "$CRISPASR_CACHE_DIR"

# Load the client's CRISPASR_API_KEY securely from your secret manager.
: "${CRISPASR_API_KEY:?Load CRISPASR_API_KEY securely before continuing}"
export CRISPASR_API_KEY
export CRISPASR_API_KEYS="$CRISPASR_API_KEY"
```

`CRISPASR_API_KEY` is the client's **single** key; `CRISPASR_API_KEYS` is the server's accepted-key list. They are different variable names. If only `CRISPASR_API_KEYS` exists and contains exactly one key, `export CRISPASR_API_KEY="$CRISPASR_API_KEYS"` can supply the client value before this block. Do not copy a comma-separated list into the client variable. Never paste key values into chat, JSON, argv or logs, and do not enable shell tracing.

#### 2. Define the STT command

Node expands the absolute paths before producing JSON; embedded shell variables would not expand inside the descriptor.

```sh
export CRISPASR_STT_CMD="$(node --input-type=module <<'JS'
import { isAbsolute, join } from 'node:path';
const executable = process.env.CRISPASR_BIN;
const cwd = process.env.CRISPASR_CACHE_DIR;
if (!executable || !cwd || !isAbsolute(executable) || !isAbsolute(cwd)) {
  throw new Error('Set absolute CRISPASR_BIN and CRISPASR_CACHE_DIR paths');
}
console.log(JSON.stringify({
  executable, cwd,
  args: [
    '--server', '--backend', 'whisper',
    '--hf-repo', 'ggerganov/whisper.cpp',
    '--hf-file', 'ggml-large-v3-turbo-q5_0.bin',
    '--cache-dir', cwd,
    '--language', 'es', '--host', '127.0.0.1', '--port', '8096',
    '--threads', '2', '--no-gpu', '--no-warmup'
  ],
  endpoint: 'http://127.0.0.1:8096/v1',
  backend: 'whisper', model: 'whisper',
  loadedModel: join(cwd, 'ggml-large-v3-turbo-q5_0.bin'),
  env: ['CRISPASR_API_KEYS'], startupTimeoutMs: 300000
}));
JS
)"
```

Stop if either formatter reports an error or leaves its CMD variable empty. The resolved path must match `loadedModel`; verify it against your server's metadata.

#### 3. Define the TTS command

Use multilingual **`chatterbox`**, not `chatterbox-turbo`. T3 and S3Gen are required; the built-in voice needs no separate voice file.

```sh
export CRISPASR_TTS_CMD="$(node --input-type=module <<'JS'
import { isAbsolute, join } from 'node:path';
const executable = process.env.CRISPASR_BIN;
const cwd = process.env.CRISPASR_CACHE_DIR;
if (!executable || !cwd || !isAbsolute(executable) || !isAbsolute(cwd)) {
  throw new Error('Set absolute CRISPASR_BIN and CRISPASR_CACHE_DIR paths');
}
console.log(JSON.stringify({
  executable, cwd,
  args: [
    '--server', '--backend', 'chatterbox',
    '--hf-repo', 'cstr/chatterbox-GGUF',
    '--hf-file', 'chatterbox-v3-t3-q8_0.gguf',
    '--cache-dir', cwd,
    '--codec-model', 'chatterbox-v3-s3gen-q8_0.gguf',
    '--auto-download',
    '--language', 'es', '--target-lang', 'es',
    '--host', '127.0.0.1', '--port', '8098',
    '--threads', '2', '--no-gpu', '--no-warmup'
  ],
  endpoint: 'http://127.0.0.1:8098/v1/audio/speech',
  backend: 'chatterbox', model: 'chatterbox',
  loadedModel: join(cwd, 'chatterbox-v3-t3-q8_0.gguf'),
  env: ['CRISPASR_API_KEYS'], startupTimeoutMs: 300000
}));
JS
)"
```

The explicit companion filename pins Q8_0; no extra codec-quant flag is needed. The v3 filenames come from the checked [registry](https://github.com/CrispStrobe/CrispASR/blob/cc114d2b4a5a9413738f390093e9131576743cb6/src/crispasr_model_registry.cpp), not the model card's older non-v3 examples. Defining the variables does not execute CrispASR.

#### 4. Prepare the primary model cache before connecting

Allow about 574 MB for Whisper Turbo and 960 MB for Chatterbox T3 + S3Gen Q8_0, plus auxiliaries. Review licences/storage needs and complete these operator-run transfers **before** launching/connecting Pi; do not rely on downloads fitting the five-minute startup budget.

```sh
"$CRISPASR_BIN" --backend whisper \
  --hf-repo ggerganov/whisper.cpp \
  --hf-file ggml-large-v3-turbo-q5_0.bin \
  --cache-dir "$CRISPASR_CACHE_DIR" --dry-run-resolve --no-gpu

"$CRISPASR_BIN" --backend chatterbox \
  --hf-repo cstr/chatterbox-GGUF \
  --hf-file chatterbox-v3-t3-q8_0.gguf \
  --cache-dir "$CRISPASR_CACHE_DIR" --dry-run-resolve --no-gpu

"$CRISPASR_BIN" --backend chatterbox \
  --hf-repo cstr/chatterbox-GGUF \
  --hf-file chatterbox-v3-s3gen-q8_0.gguf \
  --cache-dir "$CRISPASR_CACHE_DIR" --dry-run-resolve --no-gpu
```

**These commands download despite `--dry-run-resolve`.** Let all three finish successfully and compare the printed paths with `loadedModel`. The third fetches S3Gen; the server later selects it through `--codec-model`. The preview starts no server/inference backend, but auxiliary downloads may still occur on first load. A strict network/asset budget requires native-process egress controls, not just explicit model paths.

After interruption/cache errors, follow upstream recovery guidance; do not assume partial files are valid or repeatedly reconnect. The manager does not certify native download atomicity or retry audio automatically.

#### 5. Launch Pi and select the matching clients

Save the exports in a file and load it with `source /absolute/path/to/crispasr-env.sh`, **not `cd`**. For persistence, source it from shell startup configuration, with secure credential loading. These are launch-environment variables, not Pi `settings.json` entries. Restart Pi normally from that terminal after changing them; `/reload` updates code, not shell environment. Do not start a second same-profile owner.

For a manual test before automatic speech resumes, first choose `/whatsapp` → **Voice → Text-only everywhere / revoke speech consent**. Otherwise, approval for the same endpoint/protocol/credential-variable identity survives model/voice changes.

Inside Pi, ask the agent to call these tools; they are **not shell commands**:

```js
configure_wa_stt({
  sttEndpoint: 'http://127.0.0.1:8096/v1',
  sttModel: 'whisper',
  sttEnv: 'CRISPASR_API_KEY',
  sttLanguage: 'es'
})
```

```js
configure_wa_tts({
  ttsEndpoint: 'http://127.0.0.1:8098/v1/audio/speech',
  ttsProtocol: 'openai-compatible',
  ttsModel: 'chatterbox',
  ttsEnv: 'CRISPASR_API_KEY',
  ttsUseServerVoice: true,
  ttsFormat: 'wav',
  ttsSpeed: 1
})
```

Do not supply a placeholder `ttsVoice`. `ttsUseServerVoice: true` omits the HTTP voice field; a supplied named voice conflicts with it. The server flags select TTS Spanish; `sttLanguage` affects transcription only.

#### 6. Connect and approve spoken replies

Use **Connection → Connect WhatsApp** or saved auto-connect. Selecting matching settings while already connected can also start the server. Configuration success does not prove readiness or inference.

In **Voice**, approve the destination, enable speech and choose the mode; groups need separate opt-in. **Mirror** speaks replies to verified voice-note inputs, not ordinary text. Test a short approved sample after readiness. STT requests and TTS synthesis retain their sixty-second budgets; startup time is separate.

## STT server

For operator-managed STT, unset `CRISPASR_STT_CMD`, restart Pi and start the server yourself:

```sh
crispasr --server --backend whisper \
  -m "$HOME/.cache/crispasr/ggml-large-v3-turbo-q5_0.bin" \
  --language auto --host 127.0.0.1 --port 8096
```

Use the [matching client example](#complete-example-spanish-whisper-turbo-and-chatterbox), changing `sttLanguage` to `auto` for detection. Unset/`auto` omits the language wire field; a language-pinned server may stay pinned. `null`/blank clears only that setting; `{}` selects local CLI transcription. Updates preserve omitted fields.

The client posts a mono 16 kHz WAV to the base URL plus `/audio/transcriptions`, with `model` and `response_format=json`, expecting a JSON `text` string. A TTS-only server is not an STT endpoint. Each client needs a nonempty credential value; for deliberately unauthenticated loopback use an operator-chosen dummy, otherwise the actual accepted server key.

## TTS server

For operator-managed Kokoro, unset `CRISPASR_TTS_CMD`, restart Pi and prepare a compatible voice pack under `./voices`:

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

`-m auto` can download registry defaults. The example voice is English; changing language alone does not supply a missing voice pack. Voice paths are server-side and may require a relative path under its working directory. Select the actual backend/model at server startup; the request's model label does not load or swap it.

### Built-in server voice

Chatterbox contains default voice conditioning; use `ttsUseServerVoice: true` as in the [complete example](#complete-example-spanish-whisper-turbo-and-chatterbox), without a fake `default` voice ID or Kokoro voice.

- Requires explicit `openai-compatible` protocol. Without this opt-in, a provider voice remains required; Fish/Edge cannot select server default.
- Selecting server default clears an inherited named voice; selecting a named voice clears inherited default mode. Supplying both is rejected. Endpoint/provider/model changes require explicit re-selection, including after reopen.
- The client cannot verify an inherited startup voice or send cloning attestation. Use the built-in voice (no cloned startup `--voice`), or a server-side voice with speaker consent/rights already secured. Do not rely on omission to enforce a native per-request clone gate.
- Backend configuration does not grant destination/group consent or enable speech. Existing approval is destination-scoped, not model/voice-scoped.

### Multilingual and OmniVoice limits

TTS requests add no `language` or cloning-consent field. Select language through the server/model/voice. Strict compatible servers may reject extra fields.

OmniVoice's reference-audio HTTP workflow requires per-request `consent_attestation`, which this client does not send; it is not directly integrated. Manual CLI use is separate. No proxy is supplied; any operator gateway must handle legitimate speaker rights and attestation itself. Slow CPU models, including TADA/OmniVoice, may exceed the sixty-second budget; CLI timings are not HTTP latency guarantees.

## Check safely

Use approved public/synthetic samples and one existing instance, not a competing profile connection. Configuration/API acceptance is not proof of playable client audio. No automatic retry or provider fallback follows a failure/unknown delivery.

| Symptom | Check |
| --- | --- |
| CLI not selected | Remote STT still configured? Explicit CLI invalid? Different launch PATH? |
| Missing model | Existing compatible GGML path; invalid overrides do not download replacements |
| Empty/garbled transcript | Correct STT port/backend, multilingual model and language |
| Managed configuration warning | Valid CMD JSON/absolute paths? `CRISPASR_API_KEY` exported separately from server `CRISPASR_API_KEYS`? Both CMDs loaded before Pi? Fix environment and restart |
| Endpoint rejected | Loopback or explicit HTTP opt-in; no URL credentials/query/fragment |
| Invalid saved LAN HTTP; automatic text also stops | Restore intended opt-in/restart; Reset clears backend/consent/chat preferences |
| TTS not spoken | Destination approval, speech enabled and correct mode; Mirror requires verified audio input |
| Voice/path error | Server-compatible voice/path or explicit server default; cloning attestation is not supplied |
| Startup/timeout failure | Correct loaded-model metadata, port/lease ownership, completed cache and applicable time budget; inspect unknown locks, never delete blindly |

Return to [audio configuration](../README.md#audio-transcription) or [speech replies](../README.md#speech-replies-opt-in).

## Credits and upstream references

The model/platform overview is adapted from [CrispStrobe/CrispASR](https://github.com/CrispStrobe/CrispASR) and its contributors, checked on 2026-10-28. Model/voice credit and licences belong to their creators. This guide covers extension integration, not every upstream capability.

- [Model catalogue](https://github.com/CrispStrobe/CrispASR#supported-backends) and [feature matrix](https://github.com/CrispStrobe/CrispASR/blob/main/docs/feature-matrix.md)
- [Installation](https://github.com/CrispStrobe/CrispASR/blob/main/docs/install.md)
- [CLI/model resolution](https://github.com/CrispStrobe/CrispASR/blob/main/docs/cli.md) and [CLI source](https://github.com/CrispStrobe/CrispASR/blob/main/examples/cli/cli.cpp)
- [TTS/voices](https://github.com/CrispStrobe/CrispASR/blob/main/docs/tts.md) and [server API/consent](https://github.com/CrispStrobe/CrispASR/blob/main/docs/server.md)
- [Model registry](https://github.com/CrispStrobe/CrispASR/blob/main/src/crispasr_model_registry.cpp)
