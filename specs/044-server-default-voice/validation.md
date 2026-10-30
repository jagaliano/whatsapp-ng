# Validation — 2026-10-30 UTC

## Scope and evidence

Source checkout on macOS, Node 26.13.0 / Pi development cohort 1.4.0. This change extends the existing config, persistence and tool owners; it does not install a runtime copy, edit the manifest/lockfile or apply real settings. Existing 042/043 and other unrelated changes were preserved. Earlier Opus review of 043 does not certify this later change; no new independent delegation was authorized or dispatched.

The pinned model card and CrispASR source linked from [spec.md](spec.md) establish that the built-in Chatterbox voice exists and an omitted `voice` inherits server startup parameters. This is static integration evidence, not native Spanish synthesis evidence.

## Regressions

Before implementation, the focused four-suite command below failed **15 tests**, with 175 existing cases passing: explicit opt-in/schema, HTTP payload omission, persistence and validation/merge behavior were not supported. After initial implementation, self-review added six failing checks for invalid flag-only settings being silently cleared into Edge, including a saved-settings reopen case. Corrected the update validation before accepting final results; corrupt/incomplete saved selection now remains an explicit invalid-settings state, with original bytes preserved.

Final focused command:

```sh
npm test -- --maxWorkers=2 tests/unit/tts-config.test.ts tests/unit/remote-tts.service.test.ts tests/unit/session.manager.test.ts tests/unit/whatsapp-ng.extension.test.ts
```

Result: **191 passed across four files**, exit 0.

## Initial source gate (before independent review)

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2` | 1,508 passed across 84 files; zero failures/skips; exit 0 |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `git diff --check` | Passed |
| Changed Markdown relative links/anchors and new record whitespace | 90 relative links/anchors across 15 changed/new Markdown files; 13 new files whitespace-clean |

Commands ran with disposable HOME, agent directory, USERPROFILE/APPDATA/LOCALAPPDATA, an allowlisted credential-free environment, English locale and an external-egress guard. Unit HTTP calls use synthetic fixtures. Existing RPC fixtures independently block network and mock transport/provider boundaries. The added `server-voice` RPC case loads the actual `whatsapp-ng.ts`, submits one real `configure_wa_tts` tool request through a synthetic model, saves/reopens the boolean with no named voice, keeps speech disabled/unapproved and records zero network attempts. HTTP adapter tests assert the complete JSON body has no `voice` key, no extra request and no fallback.

## Boundaries and operator handoff

No native server launch, model download, inference, WhatsApp call, real config change, owner reload/shutdown, dependency installation, Git delivery, version change or release preparation/publication. No new Linux/Windows, native Chatterbox latency/pronunciation or package-install qualification was performed. Source checks do not establish a successful real Spanish voice note.

## Documentation follow-up and review authorization

The subsequent owner request adds a complete paired CMD/client walkthrough and native Anthropic Opus 5.5 read-only review. Current setup wording now uses macOS without architecture labels; earlier host-specific historical records remain preserved and do not imply wider qualification. The guide links from the README and distinguishes shell exports, client settings, actual native downloads, startup/request deadlines and separate destination/group consent.

The five walkthrough code blocks were extracted and checked in both `/bin/bash --noprofile --norc` and `/bin/zsh -f`, using disposable HOME/cache paths, synthetic credentials and a fake CrispASR executable that refuses execution. The actual managed descriptor parser, remote STT config constructor and TTS config resolver accepted the paired objects; origins differ, model/endpoint labels agree, credentials remain names and the explicit server voice resolves unnamed. No native executable or HTTP inference request was run. Markdown/whitespace checks are repeated after the final records. The native model-review identity is `anthropic/claude-opus-5-5`/high; this follow-up is separately authorized and does not retroactively change the initial no-independent-review checkpoint above.

The authorized review completed **OK with notes**, with no blocker; see [findings, actual coverage and parent verification](review.md). The owner then explicitly authorized documentation plus the diagnostic correction; its post-review changes and validation are recorded below and in that review record.

## Owner-authorized review-note corrections

Before changing the diagnostic, the focused managed/config/HTTP command failed two STT/TTS tests (`expected one notice, got zero`), with 95 passing cases. The fix reports invalid roles before skipping an absent command and preserves the existing fail-closed/unmanaged policy. A synthetic managed Chatterbox/default-voice test covers admission, voice-only changes without a process restart, and owned teardown. No upstream/native runtime was used for those tests.

Latest commands:

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2 tests/unit/managed-speech.service.test.ts tests/unit/tts-config.test.ts tests/unit/remote-tts.service.test.ts` | 97 passed across three files; exit 0 |
| `npm test -- --maxWorkers=2` | 1,511 passed across 84 files; zero failures/skips; exit 0 |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| Updated guide extraction | Six blocks; Bash/Zsh descriptor/client construction passed; three native prefetch commands syntax/argument-checked only, never executed |
| Changed Markdown links/anchors and whitespace | 95 relative links/anchors across 16 changed/new Markdown files; 14 new files whitespace-clean; `git diff --check` passed |

Used the same disposable, credential-free environment and external-egress guards as the earlier source gate. Model cache preparation remains operator-only; inspection of the pinned CLI parser confirms HF fetching precedes the preview exit, but no native fetching/model loading was executed. Existing consent carryover, inherited voice rights, registry filenames and reconnect costs are now explicit in the guide. No new independent review was dispatched for this post-review correction; the original Opus verdict retains its frozen scope.

After this turn, the operator must load the updated checkout, then explicitly configure `ttsUseServerVoice: true` with the selected OpenAI-compatible endpoint/model/environment-variable name. Named voices and omitted opt-in preserve their original requirements. Normal destination/group consent and enabling speech remain separate. See the [current example](../../docs/crispasr.md#built-in-server-voice).
