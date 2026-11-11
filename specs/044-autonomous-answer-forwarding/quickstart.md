# Quickstart: Validate Autonomous Answer Forwarding

Automated checks use synthetic fixtures only: isolated HOME/`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`, `PI_OFFLINE=1` plus existing network guards. No real account or conversation data. Separately consented operator acceptance is described below.

## Targeted

```sh
./node_modules/.bin/vitest run tests/unit/conversation-router.service.test.ts tests/unit/optional-output.service.test.ts tests/unit/optional-output-settings.view.test.ts tests/unit/whatsapp-ng.message-end.test.ts --maxWorkers=2
./node_modules/.bin/vitest run tests/unit/phone-control.rpc.test.ts -t '\(classify(-terminal)?\)' --maxWorkers=2
```

Expected (see [contract](contracts/autonomous-forwarding.md)):

1. Real Pi entry: synthetic `sendMessage(..., { triggerTurn: true })` → autonomous eligibility (control origin stays `unknown`) → one text to owner.
2. Group destination → one text to the group; removed/paused group → none.
3. Exactly proven `sendUserMessage` wake-ups (including cron-style `followUp` + `expandPromptTemplates`) → one autonomous send with consent; none with terminal-only consent. Terminal/WhatsApp mixed with background or unproven/transformed input → no autonomous send. Terminal forwarding remains separately enabled and owner-only.
4. Off, disconnected, account/owner change → none; enabling sends no earlier work.
5. > 64 KiB → none plus notice; unknown delivery → no retry.
6. Voice/Mirror destination → still text.
7. Group decline → settings unchanged.
8. Steer into an active terminal run and a terminal run that also consumes a queued custom message → no autonomous send; compare with terminal-only consent to verify unchanged existing routing/terminal forwarding. See R1a addendum evidence in [research](research.md); the original four-scenario observation remains historical.

## Full

```sh
npm test -- --maxWorkers=2 && npm run lint && npm run typecheck && git diff --check
```

## Separate operator acceptance

The operator confirmed the private-owner live-session cron ON/Off checks on 2026-11-11; see [recorded evidence](tasks.md#operator-confirmed-private-owner-cron-receipt-2026-11-11) and [Off check](tasks.md#operator-confirmed-background-forwarding-off-check-2026-11-11). These are not additional automated or cross-platform results.

For a separately authorized repeat: manually reload the existing owning Pi instance, keep WhatsApp connected, choose **Replies → Optional outputs → Background answers → Owner’s private chat (default)**, then schedule one harmless session-scoped one-shot job while Pi is idle. Its final marker should reach the owner automatically without a send tool. Set **Background answers → Off**, keep WhatsApp connected and repeat with a distinct marker: it should appear only in Pi. Do not start a second real WhatsApp connection or automatically retry a failed/unknown send.

Group delivery, mid-run revocation, other extension integrations and broader live/platform/package qualification remain unverified. Headless user/project cron jobs and cron's RPC-resume fallback are outside this extension-provenance path.
