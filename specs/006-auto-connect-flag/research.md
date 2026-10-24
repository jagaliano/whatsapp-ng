# Research: Auto-Connect CLI Flag

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Decision: Flag Implementation
- **Selected**: Register both `--whatsapp` and `-w` explicitly using `pi.registerFlag`.
- **Rationale**: While Pi might not support internal aliases for flags, registering both names ensures the user can use either variant as specified in the clarifications.

## Decision: Auto-Connect Logic Location
- **Selected**: Inside the `session_start` event handler in `<legacy-entrypoint>`.
- **Rationale**: This is where we verify the `isRegistered` state and have access to the UI context to set initial status indicators.

## Decision: Retry Mechanism
- **Selected**: Async loop with 3s delay between attempts, capped at 3 retries.
- **Rationale**: Provides resilience against transient DNS or network issues during system startup without hanging the entire extension if the internet is permanently down.
