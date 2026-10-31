# Concurrent timeout inclusion — 2026-10-31

The owner explicitly chose **Include and requalify** after another session committed `5239956`, beyond qualified source `bf77b5d`. Preserve that commit/history and its 180-second `TTS_SYNTHESIS_TIMEOUT_MS`; no dependency, worker-inactivity, STT, destination-consent or live-state changes are authorized here. The concurrent commit lacked corresponding spec/plan/new tests; the subsequent inclusion decision and work are now recorded in [spec](spec.md), [plan](plan.md) and [tasks](tasks.md), not backdated.

## Inspection and scope

Parent source inspection covered the shared `TtsService` constructor/admission timer, queue, abort/cleanup and preparation; remote/Edge adapters, pinned `msedge-tts@2.1.1` timeout reset, and relevant tests/docs. The synthesis timer includes queue wait and is cleared before separate codec preparation. The Edge worker retains 60-second connection/inactivity timers; the client resets synthesis inactivity on activity. Text (2,000 Unicode characters), audio (8 MiB), one-active/five-pending limits and earlier cancellation remain unchanged. No assumption that a given character count always fits a provider's latency is justified.

The owner's other-session summary reports a successful ~51-second Edge synthesis and an earlier ~74.8-second observation. Those are supplied observations, not this session's independently reproduced live evidence. A 51-second sample alone does not establish that the old budget was insufficient. No fresh live speech, WhatsApp, server startup, model download or owning-Pi reload ran here. The earlier independent Opus reviews did not include this concurrent runtime change; this is parent inspection plus deterministic/source/artifact qualification, not a new independent Opus verdict or broader platform certification.

## Regression and fresh source evidence

Three new cases exercise the omitted timeout option rather than forcing the former test-helper default: 180-second bounds/shorter overrides, synthetic 75-second completion without retry, and active/queued expiration measured from each job's admission. Existing cancellation, cleanup, text/byte/queue and provider-failure tests remain.

- In a disposable public-source copy of `bf77b5d`, the same three new cases failed against 60 seconds; this was a comparison after the concurrent fix, not a claimed pre-commit test run. No active source rollback or dependency install occurred.
- The same selected command on current source passed three cases; eighteen unrelated cases were filtered in each selected run, not native-tool skips.
- Fresh isolated credential-free, network-guarded `npm test -- --maxWorkers=2`: **1556 passed/84 files, no skips**.
- `npm run lint` and `npm run typecheck`: exit 0. Typecheck covers entry/source, not tests as a separate TypeScript project.
- Fresh `npm audit --omit=dev --json --registry=https://registry.npmjs.org`: exit 0, zero findings. Full audit: exit 1, twelve affected development packages (one high/eleven moderate), unchanged disclosed limits; no broad update or suppression.

## Publication-launch failure and replacement qualification

The previous local wrapper passed `--confirm-version`, but the existing script requires `--confirm`. A pure injected-runner check confirmed rejection at argument validation with zero Git/npm calls. The failed launcher returned before creating `publish-1.1.2.attempt.json`. A fresh credential-free public lookup returned structured E404 for 1.1.2, with latest 1.1.1 and next 1.1.0-rc.1. This was not an uncertain publish transmission, and no attempt evidence was removed. Raw authentication terminal output was not retained.

The old successful preparation, 63-member tarball/consumer checks and exact `bf77b5d` CI are historical only. Preserve their receipts/artifact; do not use them to certify the new source. New clean-commit CI, prepare, source-byte/member/secret checks, consumer/installed-entry checks and authenticated one-shot publication/registry verification remain separate gates. Their final post-commit results belong in local receipts, so writing records does not invalidate the prepared commit. The corrected invocation is `npm run release:publish -- --confirm 1.1.2 --tag latest`.
