# Consistent settings menus

## Authorized scope

On 2026-11-02 the owner authorized implementing the menu usability audit and an independent native Claude Opus 5.5 review. Preserve the pending [owner-guidance correction](../052-owner-menu-guidance/spec.md); this work is not a release, real-settings change, provider call or owning-Pi reload.

## Requirements

- Voice starts with **Set up replies for a chat**, chat management, **Advanced speech settings**, global disable and Back. Setup selects an existing allowed transport target, an explicit output mode, any required group/destination consent, then reports the effective mode and whether replies remain paused. Preserve PN/LID identity, gateway targets, allow lists and per-chat overrides.
- Enabling speech is a shared profile operation: its consent explains that retained defaults/other chat overrides may resume. Never silently enable speech by approving a destination, silently resume a paused chat, infer group consent or make a preview/send.
- Advanced contains backend, one active-provider voice control, speed/format, shared default and explicit preview. Remote setup supports an explicit protocol and either a named voice/reference or the compatible server's own default voice, without placeholder IDs or implicit fallback.
- Back returns to the parent menu; cancelled selection/input/editor closes the active settings request without an error/retry. A declined confirmation changes nothing. Reuse the original captured authority across nested/recursive navigation, and refresh displayed state on return. Expired requests cannot display new dialogs or mutate settings through stale choices.
- Phone `/voice` refusals identify the missing group opt-in, destination approval or shared speech enablement and point to the actual chat-setup workflow. Text mode remains available without new consent; phone commands never enable speech or authorize destinations.
- Record failing regressions before production changes. Validate mocked views and the real production entry using isolated credential-free RPC fixtures. Preserve cancellation, revision checks, no-automatic-resend semantics and explicit send confirmation.

## Acceptance

A fresh user can configure Mirror for one known chat without traversing backend controls. Configuration never synthesizes or sends a preview/disclosure/WhatsApp reply by itself. Existing trusted managed-server startup/health synchronization remains separate and unchanged. Existing advanced capabilities remain accessible. Back/Cancel and expired authority are covered across Voice, Owner, optional outputs, contacts, groups, history and composition. Source validation and reviewer evidence are distinct from a pending operator reload/live check.
