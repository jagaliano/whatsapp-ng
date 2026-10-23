# Security policy

## Private reporting

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/jagaliano/whatsapp-ng/security/advisories/new). This repository's private-reporting setting was enabled and verified during M1.

Do not put credentials, QR codes, auth directories, API keys, phone numbers, private message bodies or unredacted logs in public issues. Provide a minimal synthetic reproduction, candidate commit/version and relevant Pi/Node/OS versions. Do not attach real auth or conversation archives, even to a private report.

Ordinary non-sensitive bugs belong in [issues](https://github.com/jagaliano/whatsapp-ng/issues). Maintenance and responses are best effort, with no SLA.

## Current candidate and limitations

There is no published or supported stable `whatsapp-ng` npm release yet. The `1.1.0-rc.1` candidate remains private pending remaining artifact qualification and separate release approval. Pre-publication npm identity, verified email and write-protecting 2FA were checked; no package name reservation, first publication or production certification is implied. macOS/Linux with Node 26.x and Pi 1.3.0 are qualification targets, not blanket artifact certification; Windows remains unverified.

All allowed chats share one Pi context. This is a trusted-user extension, not a multi-tenant privacy boundary. Retained data contains conversation content; filesystem permissions are not encryption at rest.

Baileys is an unofficial personal-account transport. Protocol changes, platform policies, account restrictions and upstream security defects remain risks. Use one active extension/process per auth profile; archive locking does not establish transport exclusivity.

M2 migrated the LiteParse/Sharp and stale development-tool paths; fresh full/production npm audits reported zero findings in the tested candidate tree. This is time-scoped advisory evidence, not native-binary or platform certification. See [DEPENDENCIES.md](DEPENDENCIES.md) for the exact setup, retained GPL components and limits. See [LICENSING.md](LICENSING.md) and [the approved release gates](https://github.com/jagaliano/whatsapp-ng/blob/chore/fork-release-readiness/specs/037-maintained-fork-readiness/plan.md).

If a session appears compromised, stop the extension/services and review linked devices through WhatsApp. Do not publish sensitive evidence or delete/migrate state automatically as a recovery procedure.
