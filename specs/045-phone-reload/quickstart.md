# Quickstart: Validate Phone `/reload`

Use synthetic accounts and an isolated HOME/`PI_CODING_AGENT_DIR` with `WHATSAPP_NG_LOCALE=en` (see AGENTS.md "Validation"). Do not use a real account.

## Automated
```sh
npx vitest run tests/unit/whatsapp-command.router.test.ts tests/unit/phone-menu-i18n.test.ts tests/unit/phone-control.rpc.test.ts
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
git diff --check
```

## Scenarios covered (see [contract](contracts/phone-reload.md), [data model](data-model.md))
1. Owner, private chat, idle → menu → confirm → gateway calls `ctx.reload()` exactly once; nothing runs afterward.
2. Non-owner / group / cancel / expired / replayed / busy / pending → no `reload()` call, localized reply.
3. `session_shutdown(reload)` with an armed intent publishes the handoff; `session_start(reload)` consumes it, `resume` → `phone.reload.ready` once.
4. Auto-connect off → `resume` starts exactly one socket; preference unchanged. Race cases (a)–(d) in research.md R3 / T019: pending retry cancelled, in-flight retry joined, invalid handoff keeps retries, failed reconnect leaves terminal recovery.
4a. Confirm while connecting/disconnected → `phone.reload.notConnected`, no reload.
4b. Session id, history and config revision unchanged after reload; uncertain send in flight is not resent.
4c. `ctx.reload()` rejects → error reaches Pi, intent cleared, no handoff remains.
5. Explicit Off, owner/chat/revision/session/profile changed, or expired → no resume, no reply.
6. Terminal reload without an armed intent → existing handoff discarded, no resume.
7. `resume` false → terminal notice; single best-effort `phone.reload.failed`; no retry.
8. All new keys present and non-English in pt-BR/es/fr.

## Real-entry regression (mandatory)
`tests/unit/phone-control.rpc.test.ts` must drive the production entry through phone `/reload` → shutdown(reload) → start(reload). Extend the fixture if it cannot; a missing fixture is a blocker, not a waiver.

## Manual (operator, optional)
`pi --no-extensions -e ./whatsapp-ng.ts` in an isolated environment; verify `/whatsapp --internal control-reload <random uuid>` only warns.

## Validation results (2026-11-11, macOS, Node 26, Pi 1.5.0 dev dependency; synthetic socket/accounts only)
- `npx vitest run tests/unit/whatsapp-command.router.test.ts` → 105 passed.
- `npx vitest run tests/unit/phone-menu-i18n.test.ts` → 112 passed.
- `npx vitest run tests/unit/phone-control.rpc.test.ts` → 32 passed, including `reload`, `reload-auto`, `reload-retry`, `reload-invalid`, `reload-fail`.
- Regression check: with `cancelAutoConnectRetry` stubbed to a no-op, `reload-retry` fails (4 socket starts instead of 3).
- `npm test -- --maxWorkers=2` → 90 files, 2163 tests passed. `npm run lint` → exit 0. `npm run typecheck` → exit 0. `git diff --check` → clean.
- Not done: operator live acceptance on a real account; Windows/Linux runs.

## Validation results, review-fix pass (2026-11-11, macOS, Node 26, Pi 1.5.0 dev dependency; synthetic only)
- Router regressions R1, R2 and R3 (×2) were observed failing before their fixes (see the tasks.md review-fix test history).
- `npm test -- --maxWorkers=2` → 90 files, 2169 tests passed, including RPC `reload-off`.
- `npm run lint` → exit 0. `npm run typecheck` → exit 0 (it covers the entrypoint and `src` only). `git diff --check` → clean.
- Not covered: editor diagnostics at `tests/fixtures/phone-control-rpc.extension.ts:29,132` come from code that predates 045 and are outside its scope, and no `tsc` covers fixtures. No live account, operator reload, Windows or Linux run.

## Validation results, third pass (B1/B2; 2026-11-11, macOS, Node 26, Pi 1.5.0 dev dependency; synthetic only)
- `npm test -- --maxWorkers=2` → 90 files, 2174 tests passed. `npm run lint` → exit 0. `npm run typecheck` → exit 0. `git diff --check` → clean.
- Real-entry `reload-account` and `reload-account-auto` were added; the open gaps G-M1 and G-M2 are listed in plan.md.

## Validation results, fourth pass (G-M1/G-M2; 2026-11-11, macOS, Node 26, Pi 1.5.0 dev dependency; synthetic only)
- Real-entry `reload-offrace` and `reload-busy` pass, 3 of 3 repeated runs. Each fails when its guard is removed (R2 Off generation; R1 lock check) and passes once restored.
- `npm test -- --maxWorkers=2` → 90 files, 2176 tests passed. `npm run lint` → exit 0. `npm run typecheck` → exit 0. `git diff --check` → clean.
- Editor diagnostics at `tests/fixtures/phone-control-preload.mjs:5,7` and `tests/fixtures/phone-control-rpc.extension.ts:29,132` are on lines that predate 045 and are not fixed here. Fixture `.mjs` files are outside lint and typecheck.
