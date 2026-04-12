# Research: Auto-Connect CLI Flag

## Decision: Flag Implementation
- **Selected**: Register both `--whatsapp` and `-w` explicitly using `pi.registerFlag`.
- **Rationale**: While Pi might not support internal aliases for flags, registering both names ensures the user can use either variant as specified in the clarifications.

## Decision: Auto-Connect Logic Location
- **Selected**: Inside the `session_start` event handler in `whatsapp-pi.ts`.
- **Rationale**: This is where we verify the `isRegistered` state and have access to the UI context to set initial status indicators.

## Decision: Retry Mechanism
- **Selected**: Async loop with 3s delay between attempts, capped at 3 retries.
- **Rationale**: Provides resilience against transient DNS or network issues during system startup without hanging the entire extension if the internet is permanently down.
