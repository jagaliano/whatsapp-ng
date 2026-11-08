# Quickstart: validate phone menu polish

Prerequisites: installed checkout dependencies, Node 26.x and the existing system tools. Do not reinstall into a running Pi dependency directory, download models or connect a real account for these checks. Run from the repository root.

## Isolate state and credentials

```sh
TEST_HOME="$(mktemp -d)"
check() {
  env -i PATH="$PATH" HOME="$TEST_HOME" USERPROFILE="$TEST_HOME" \
    APPDATA="$TEST_HOME/AppData/Roaming" LOCALAPPDATA="$TEST_HOME/AppData/Local" \
    PI_CODING_AGENT_DIR="$TEST_HOME/agent" PI_OFFLINE=1 WHATSAPP_NG_LOCALE=en "$@"
}
```

The isolated HOME/agent directory prevents real-state access; the existing socket/provider/network guards provide the actual network isolation. `PI_OFFLINE=1` alone does not block networking.

## Targeted regressions

```sh
check ./node_modules/.bin/vitest run tests/unit/phone-menu-i18n.test.ts \
  tests/unit/whatsapp-command.router.test.ts tests/unit/command-menu.poll.test.ts --maxWorkers=2
check ./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts \
  -t 'phone-polish:' --maxWorkers=2
```

Expected: explicit coverage in en/pt-BR/es/fr; matching placeholders; localized help/status/menu bodies/refusals; fixed action identities from the [contract](contracts/phone-surface.md); complete `/replies` disclosure, including the invalid-settings note, within 1,000 characters. Over-limit bodies are rejected, never truncated. Fixed titles/labels fit the original cap; current markers survive dynamic model-label capping without changing selection IDs. Encrypted polls preserve frozen labels even if the locale changes.

The four RPC cases launch the real `whatsapp-ng.ts` entry via Pi `-e` with a synthetic socket and network guard. They verify grouped help, split status, current voice mode, cancellation without config writes and a numbered reply-policy selection. Expect one synthetic connection per case, zero model starts/network attempts and no extension errors. Other RPC scenarios are filtered out by this focused command, not native-tool skips. Run the unfiltered file or the full gate to include them.

## Full gates

```sh
check npm test -- --maxWorkers=2
check npm run lint
check npm run typecheck
git diff --check
```

Check changed Markdown links/anchors and compare pre-existing i18n values with the saved baseline; only `phone.*` additions are permitted. Inspect all failures and skips. Results and any execution adjustments belong in [research.md](research.md), not the read-only requirements checklist.

## Separate operator acceptance

Visual TUI/phone rendering and live delivery are not proven by these fixtures. Any live `/help`, `/status`, `/voice` or `/replies` batch needs separate recipient/message-budget approval; these commands may send messages. No source acceptance command authorizes real-state changes, reload of the owning Pi process, commit or publication.
