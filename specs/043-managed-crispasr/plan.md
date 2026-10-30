# Managed speech implementation plan

Scope: [spec.md](spec.md); work items: [tasks.md](tasks.md). Preserve existing speech providers, consent and R5 deferral. Decisions and results are dated records, not standing execution permission.

1. Add failing synthetic descriptor/lifecycle tests: independent roles, occupied ports/leases, wrong backend/model, cancellation/staleness, failure retention, exit, shutdown and parent death.
2. Implement `ManagedSpeechService` for trusted descriptors/lifetimes/request gates and a dependency-free Node worker for endpoint leases, native-process supervision, health/model/listener proof and TERM/KILL/IPC cleanup. macOS uses `lsof`; Linux uses procfs; unsupported ownership fails closed.
3. Wire verified connection/Connect/Off/session/shutdown events, committed SessionManager config changes and pre-STT/TTS gates. Fence authority across awaits; keep speech cancellation separate from server retirement.
4. Exercise production-entry RPC with synthetic servers; verify worker packaging and run isolated focused/full checks. Inspect skips and natural exits.
5. Document configuration, recovery and platform limits. No dependency/release or live effect without separate authorization.

## Implementation checkpoint

Implemented. See [validation](validation.md) for commands/results and [review](review.md) for Opus findings, corrections and owner-authorized STT/TTS/combined native acceptance. No dependency or release change was required.

## Complexity Tracking

A separate worker is required to clean up after parent SIGKILL/crash. SessionManager's narrow post-commit callback serves UI and tools without a parallel config writer.

Native acceptance exceeded its initial three-asset/256 MiB cap through automatic auxiliaries; the owner accepted the additional resources. Preserve that [exception](review.md#native-download-scope-exception). Strict future budgets need native egress controls. Linux implementation is not Linux qualification; Windows management remains unsupported.
