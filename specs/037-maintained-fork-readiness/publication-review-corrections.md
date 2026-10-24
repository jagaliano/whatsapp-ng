# Publication-review corrections — 2026-10-24

## Scope and disposition

The owner authorized correcting the reviewed issues and repeating validation, not committing, pushing, changing the publication guard or publishing. Existing unrelated working-tree changes were preserved. No dependency or manifest change was needed; the compatible native Node transcription fallback remains intact.

- `configure_wa_stt` now preserves omitted fields, validates the combined configuration before saving, and returns the effective settings. An incomplete first-time setup or invalid update is rejected without replacing the existing configuration. `{}` and three empty strings still explicitly select local mode. Validation does not read credentials or make a request.
- Local Whisper CLI preparation/transcription shares a ten-minute budget and caller/session cancellation. It kills the child and waits for its close event before audio scratch cleanup. Default model downloads use abortable pipelines, bounded HTTPS redirects and private UUID temporary files followed by atomic publication. Explicit model overrides remain no-download. These child-process guarantees do not extend to the native addon.
- Incoming image/video/document downloads enforce a 25 MiB advertised/actual byte limit and concatenate once. New directories/files use `0700`/`0600`, exclusive creation and collision-resistant names; MIME-derived extensions cannot contain path separators. Existing files/directories are not deleted or retroactively re-permissioned.

The proposed native-addon installation-build failure was not established: the installed main `whisper-cpp-node@0.2.12` package has no installation lifecycle hook and its platform-native packages are optional. The history-interruption hypothesis likewise did not establish a reachable caller bypassing the existing pre-transition interruption hooks. Neither was changed speculatively.

## Reproduction and verification

All subsequent validation used a credential-free environment and synthetic/isolated HOME. The actual Pi extension was registered through an instrumentation wrapper and launched with `pi --mode rpc --no-session --no-extensions -e <probe>`. Before the fix, a partial STT update reported success while losing the endpoint/key-variable name, and a synthetic CLI process continued after abort. Afterward the settings were preserved and the CLI operation cancelled. Network calls were blocked for that probe; no real WhatsApp state was used.

Local evidence is retained under `.pi/cache/review-fixes/` and is not a distributable payload.

| Command / check | Result |
| --- | --- |
| `python3 .pi/cache/review-fixes/reproduce.py baseline` | Both reported behaviors reproduced with synthetic settings/CLI; zero network attempts. |
| Focused extension/CLI/model-download/media unit runs | Passed after corrections; failing regression baseline retained separately. |
| `python3 .pi/cache/review-fixes/reproduce.py corrected` | Partial settings preserved; cancelled CLI settled; zero network attempts. |
| `npm test -- --maxWorkers=2` | **585 tests / 58 files**, zero failures or skips, including native PDF/OCR/media fixtures. Repeated after the final test-harness change. |
| `npm run lint` | Exit 0. |
| `npm run typecheck` | Exit 0. |
| `npm audit --omit=dev --json` | Exit 0, zero findings. |
| `npm audit --json` | Exit 1, the two known SDK/Undici affected packages: one high, one moderate. No override/downgrade applied. |
| `npm pack --json --ignore-scripts --pack-destination .pi/cache/review-fixes/artifacts` | Exit 0, 40 files, `private: true`, intended tag `next`. |
| `python3 .pi/cache/review-fixes/qualify-package.py` | Clean managed tarball install/remove/reinstall passed on macOS, Node 26.12.1 / Pi 1.4.0. |
| Installed resource discovery | Eight object-schema tools, one `whatsapp` command; zero errors/warnings or duplicate host-peer packages. |
| Installed-package RPC | Normal managed discovery; startup, two new sessions and menu open/cancel passed without connecting WhatsApp or starting a model run. |
| Consumer production audit | Zero findings. Installation lifecycle scripts were disabled. |
| `git diff --check` and changed-document local link/anchor check | Passed; 23 links/anchors checked. |
| Packaged-file/source equality and public-file credential check | Passed. All 40 packaged files still matched the working source/document bytes after final validation. |

No fresh Linux/Windows, scripts-enabled consumer installation, actual Whisper model download, additional live WhatsApp/STT upload or broad client rendering/playback test was performed. The checks above do not imply those cases passed.

## Exact artifact

Local tarball: `.pi/cache/review-fixes/artifacts/whatsapp-ng-1.1.0-rc.1.tgz`.

- SHA-1: `ba1d87b8017514741a5521fb1c915546448a3901`
- SHA-256: `3f794621f59830a99a1d4e8fb998ed3404389e246c559c7a4bdab9ef1e9d915f`
- 40 entries; no tests, caches, state, scripts, systemd templates or lockfile bundled.
- Private and unpublished. A changed packaged byte requires a new artifact identity and affected checks.

## Focused independent review

Requested and observed model: **`opencode-go/deepseek-v4.1-flash`, high thinking**, no fallback. Run `5bf2bce3-ac56-4516-b149-94929619c2e2` used only read/grep/ls/watchdog_diff, with ambient extensions disabled. Source hashes were unchanged during review. Verdict: **OK**, no blocking findings in the correction scope. Raw report and runtime proof are in the local `focused-review/` evidence directory.

After that review, two test mocks were changed to discard inherited environment values from recorded mock arguments, and the final 585-test/lint/typecheck checks passed again. Packaged runtime/document bytes did not change.

Non-blocking residual notes:

- Default model downloads are time-bounded but do not have a separate byte cap.
- Abrupt termination/power loss can leave private model temporary files; there is no stale-temp sweep. Atomic publication prevents reuse as a completed model, not all crash debris.
- A dedicated real spawn-failure/close regression could supplement current synthetic close-event tests and actual synthetic-process abort reproduction.
- Native-addon cancellation, remaining platform variants and the deferred live matrix remain unqualified.

## Test-output incident

One failing assertion unexpectedly included inherited environment values in its diagnostic. The operator was explicitly warned to treat the exposed credentials as compromised and rotate them; no values are repeated here. The retained local diagnostic was redacted. Subsequent validation stripped credentials from the environment, and the CLI test mocks now discard environment arguments before recording them. This cannot retract output already present in the original session; credential rotation remains an operator action.

## Remaining release boundary

The corrected candidate has local source/package evidence and a focused OK review for an experimental `next` prerelease, not stable-production certification. Known host advisories and deferred platform/live cases remain disclosed. Commit/push, publication-guard removal and npm publication still require separate explicit owner authorization.
