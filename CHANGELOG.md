# Changelog

## 1.1.0-rc.1 candidate (unreleased)

Maintained continuation of [RaphaCastelloes/whatsapp-pi](https://github.com/RaphaCastelloes/whatsapp-pi), preserving original history and attribution.

- Carry the existing message-identity/routing, explicit media/native replies, and bounded conversation archive/history/lifecycle work through baseline `d415f0b`.
- Prepare `whatsapp-ng` identity and `next` prerelease metadata, while retaining a private-package publish guard.
- Declare Pi-supplied legacy host imports as wildcard peers rather than bundled runtime dependencies; retain development copies for checks.
- Add maintained-fork installation/switchback guidance and a private security-report route.
- Include the MIT license, the owner's supplied 2026 notice and yearless upstream attribution, based on the accepted upstream MIT declaration.
- Preserve `whatsapp-pi.ts`, existing commands/flags, storage/auth paths and profile/account identity. No transport upgrade or protocol patch.
- Track the owner-approved npm lock, pin transport rc14, and migrate LiteParse to 2.15.1 with lazy native PDF loading, per-document cleanup and preserved storage-only fallback.
- Align development SDK aliases with Pi 1.3.0 and update the existing test/coverage tooling; full/production npm audits report zero findings in the tested tree. Native/OCR contracts and setup limits are documented in [DEPENDENCIES.md](DEPENDENCIES.md).

- Add canonical-profile transport ownership, serialized lifecycle transitions and retired-auth I/O fences; stale/unknown locks fail closed rather than being automatically stolen.
- Move legacy auth adoption behind requested connection and source/destination ownership. Preserve originals, never merge initialized auth, and retain private adoption/reset metadata so logout or interrupted work cannot silently resurrect legacy credentials. Offline config/history migration remains available.
- Add synthetic ownership/adoption/fault regressions and a native rc14 first-rejection/FIFO-write contract. Keep private directories and explicit recovery boundaries; the multi-file auth store is not a transactional database.

Not published. The MIT licensing basis and pre-publication npm account-readiness gate are complete; the package name is not reserved. M4's recorded direct-chat checks include client-confirmed media/native quotes, persisted READ/PLAYED updates and a correlated two-record backfill reopened offline. These are limited observations, not blanket platform/stability claims; server acceptance alone is not recipient delivery/read. Remaining M3 artifact qualification and separate M5 publication approval are still required.
