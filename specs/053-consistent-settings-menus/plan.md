# Consistent menus implementation plan

Scope and acceptance: [specification](spec.md). Evidence and progress: [tasks](tasks.md).

1. Inspect UI owners, composition wiring, phone router, speech/config policies, mirrored tests and isolated production-entry fixtures. Preserve pending 052 files and snapshot their baseline. Confirm installed pi-subagents and exact native `anthropic/claude-opus-5-5` model; reviews are fresh, read-only, no fallback or nested delegation.
2. Add failing regressions for chat-first setup, enable/approval distinction, active-provider controls, compatible server-default voices, Back/Cancel, original authority across legacy recursion and precise phone refusals. Run affected suites in a disposable credential-free environment before fixes.
3. Reuse the existing navigation owner for consistent cancellation/currentness across child dialogs; retain its captured request on recursive Back navigation. Make Voice progressively disclose chat setup versus advanced settings; retain explicit consent and shared enablement semantics. Return explicit Back navigation from settings views. Update narrowly affected copy/docs and old-path tests.
4. Exercise actual-entry RPC with synthetic socket/provider boundaries and existing network guards. Run full declared test/lint/typecheck checks, inspect native skips, and check changed Markdown links/anchors plus whitespace.
5. Freeze the final public change scope and ask native Claude Opus 5.5/high for independent read-only review. Address confirmed findings with regressions, rerun decisive gates and record exact evidence and limitations. No commit, push, package/dependency changes, release or live-state operation.

## Proposed menu

- WhatsApp keeps its existing six categories.
- Voice: Set up replies for a chat; Manage chat replies and introductions; Advanced speech settings; Text-only everywhere / revoke speech consent; Back.
- Chat setup: known chat; Text/Voice/Voice + text/Mirror; required group and destination/shared-enablement review; effective saved status. Pauses remain paused.
- Advanced speech: backend/connection; active provider voice; speed; format where editable; shared default mode (overrides remain); explicit fixed-phrase preview; Back.
- Remote backend: explicit protocol; endpoint/model/key-variable name; named voice/reference or explicit compatible server-default voice. Values are staged and saved atomically after all inputs validate.
- Back climbs one level. Esc/cancel closes the settings request. Confirmations retain their decline/no-change behavior.

## Complexity Tracking

The existing navigation module may own a small scoped UI-port wrapper to unwind cancelled nested dialogs and fence each dialog before/after awaits. This addresses demonstrated cross-view reuse and legacy recursive Back paths without adding a service, dependency, global configuration or mutable last-request authority. Keep request state local/weakly keyed to its scoped context, not a process-wide current-menu variable. Existing speech/settings owners retain every policy and mutation.
