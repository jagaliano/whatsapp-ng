# Quickstart: Validate WhatsApp Processing Reaction

Synthetic fixtures only; no real account, auth or live WhatsApp calls.

## Prerequisites

- Node 26.x, dependencies already installed from the lockfile
- Isolated `HOME`/`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`

Use a credential-free environment for each command (existing dependencies only):

```sh
VALIDATION_HOME=$(mktemp -d "${TMPDIR:-/tmp}/wa-processing.XXXXXX")
run_isolated() {
  env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" \
    HOME="$VALIDATION_HOME" USERPROFILE="$VALIDATION_HOME" \
    APPDATA="$VALIDATION_HOME/AppData/Roaming" LOCALAPPDATA="$VALIDATION_HOME/AppData/Local" \
    PI_CODING_AGENT_DIR="$VALIDATION_HOME/agent" PI_OFFLINE=1 WHATSAPP_NG_LOCALE=en "$@"
}
```

`PI_OFFLINE=1` is not a network sandbox: use the existing mocked socket/provider boundaries and network-guarded production-entry RPC fixtures, never real account state.

## Targeted regressions

```sh
run_isolated ./node_modules/.bin/vitest run tests/unit/processing-indicator.service.test.ts tests/unit/conversation-router.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts
```

Expected (see [contract](contracts/processing-indicator.md), [data model](data-model.md)):

1. Admitted message → one ⏳ add with the exact key (direct and group participant).
2. Ignored/system/history/duplicate/own-echo/phone-command input → no reaction call.
3. Tool-call intermediate messages → no removal; `agent_end` → one removal.
4. Two overlapping chats → each removal targets only its own key.
5. Queued message merged into ambiguous run → removed after refusal.
6. Abort, retired input, session reset → removal when current; Off/shutdown/account change → no call.
7. Reaction send rejects or hangs → prompt hand-off and reply unchanged; no retry; metadata-only log.
8. Own ⏳ echo → no Pi prompt.
9. Explicit `send_reaction` before, during and after the ⏳ add → sent immediately (no wait even with a hung add); no automatic add/removal afterwards.
10. Verified own-account reaction/removal echo (non-⏳) → supersedes; own ⏳ echo → ignored; foreign actor reaction → no effect; history reconciliation unchanged.

## Full checks

```sh
run_isolated npm test -- --maxWorkers=2
run_isolated npm run lint
run_isolated npm run typecheck
git diff --check
```

Live WhatsApp confirmation is a separate operator check, out of scope.
