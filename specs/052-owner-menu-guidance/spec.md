# Owner authorization menu guidance

## Report and scope

The owner reports that `/voice mirror` is refused with guidance pointing to `/whatsapp > Owner`, which is not a root menu entry. Current source places Owner under **Chats / Owner**, separate from the root **Voice** view. The refusal text is shared by owner-only phone commands; it does not distinguish an unset owner from an actor mismatch.

Correct the user-facing navigation, not authorization policy. Do not inspect or change real owner/speech settings, infer a person's PN/LID relationship from displayed digits, appoint the sender automatically or relax verified-owner checks.

## Requirements

1. Phone-command denial names the actual terminal route `/whatsapp > Chats / Owner > Owner`. `/voice mirror` remains owner-only and cannot enable speech or bypass destination/group approval.
2. Existing owner-authorization notices and pairing welcome copy use the grouped navigation in English, Portuguese, Spanish and French. Keep the root category names as rendered by the actual menu, with translated submenu labels where applicable. Correct the adjacent Recents route in the same welcome message.
3. Tests reproduce stale guidance before the fix, verify denial has no mutation, check localized routes against the actual navigation function, and exercise the production entry in isolated Pi RPC with synthetic accounts/transport and blocked network.
4. The operating reference explains where to choose the owner and that allowed-chat admission is not owner authority; an unavailable verified identity mapping must not be guessed. No claim that this copy correction resolves an actual saved-owner mismatch.
5. No dependency, framework, authorization/storage/routing algorithm, real-state, live-provider or Git/release operation is included. A live reload and owner selection remain explicit operator actions.

## Subsequent review authorization

The owner subsequently requested one fresh native Anthropic Opus 5.5 review of these changes. Use the canonical registry model `anthropic/claude-opus-5-5`, high thinking and no fallback, with the existing read-only documentation reviewer and explicit repository/file scope. Review public source/tests and records only; no private state, commands, live calls, edits, delegation, reload or Git/release action by the reviewer. Parent verifies actual model/completion and source integrity and records findings without expanding the original runtime or operational scope. Commit/push remain unauthorized for this change.

## Acceptance

Affected regressions and the declared isolated source checks pass. Report exact commands, skips and evidence scope. Keep real WhatsApp/provider calls, listening tests, account/config access, model downloads and owning-process reloads out of validation.
