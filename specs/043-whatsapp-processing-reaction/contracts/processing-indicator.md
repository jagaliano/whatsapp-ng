# Contract: ProcessingIndicator (internal service)

`src/services/processing-indicator.service.ts`

## Constructor ports

- `react(key: WAMessageKey, emoji: '⏳' | ''): Promise<{ success: boolean }>` — wraps `ReactionSender` with the active socket
- `isCurrent(context): boolean` — `WhatsAppService.isSessionContextCurrent`
- `log(message: string): void` — metadata-only

## Methods

| Method | Called from | Effect |
|---|---|---|
| `start(key, context, admissionCurrent?)` | message callback after hand-off | Create record if absent, current and below the 500-record capacity; fire ⏳ add. At capacity: no record, no egress, one metadata log |
| `markConsumed(key)` | router `onConsumed` | Move record into current run set |
| `finishRun()` | `agent_end` | Remove ⏳ for all consumed records |
| `settle(key)` | router `onRetired` (pending withdrawn/expired/admission-invalid) | Remove ⏳ for one record |
| `supersede(key)` | `send_reaction` before its send | Mark superseded; no future automatic egress; never waits or egresses |
| `observeOwnReaction(key, text)` | existing reaction intake/lifecycle, verified own actor, after reconciliation | `⏳` ignored as echo; other text or `''` supersedes |
| `settleAll()` | session switch/start resets | Remove ⏳ for every record if current |
| `discardAll()` | Off, `session_shutdown`, graceful shutdown (logout is fenced by generation, see research R3) | Drop records; no egress |

Captured admission is rechecked immediately before egress. All methods are synchronous, never throw and never await egress. No retries; failures log once.

## User-visible contract

- ⏳ appears on the exact admitted WhatsApp message; removed when its request ends.
- No ⏳ for ignored, history, duplicate, own-echo, phone-command or terminal input.
- Indicator failure never changes reply delivery.
- An explicit reaction on the same message or a verified own-account phone reaction takes best-effort precedence: no automatic egress follows it, but an already-in-flight ⏳ add may still land later.
