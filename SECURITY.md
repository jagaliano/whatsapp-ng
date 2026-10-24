# Security policy

## Private reporting

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/jagaliano/whatsapp-ng/security/advisories/new), which is enabled for this repository.

Do not put credentials, QR codes, auth directories, API keys, phone numbers, private message bodies or unredacted logs in public issues. Provide a minimal synthetic reproduction, candidate commit/version and relevant Pi/Node/OS versions. Do not attach real auth or conversation archives, even to a private report.

Ordinary non-sensitive bugs belong in [issues](https://github.com/jagaliano/whatsapp-ng/issues). Maintenance and responses are best effort, with no SLA.

## Current candidate and limitations

`whatsapp-ng@1.1.0-rc.1` is an experimental prerelease targeting the `next` tag, not a supported stable release.

Development targets Node 26.x and Pi 1.4.0. Recorded source validation passed 585 tests on macOS with two workers, including native PDF/OCR and media-conversion checks. Earlier Linux package tests used Pi 1.3.0 and do not establish support for the updated package. Live tests cover selected direct-chat behavior, including WhatsApp voice transcription through Groq; Windows, service installers and broader group/history/receipt behavior remain unverified.

Remote STT is an explicit opt-in through `sttEndpoint`, `sttModel` and `sttEnv`. This uploads admitted WhatsApp voice-note audio to the configured provider; disclose that data flow to trusted chat participants and review the provider's retention/billing policy. `sttEnv` is only the key's environment-variable name; never put an API key in that field or an endpoint URL. Remote requests reject non-HTTPS URLs, embedded credentials, query strings/fragments and redirects; errors omit provider bodies/headers. File/response bounds, timeouts and best-effort session cancellation do not retract audio already uploaded. New private audio scratch files are removed after normal success/failure, but abrupt process termination can leave them behind. Local CLI preparation/transcription is bounded to ten minutes, cancelled on session change, and waits for child closure before scratch cleanup; the native addon does not have that child-process cancellation guarantee. Incoming image/video/document downloads are capped at 25 MiB. Newly created download directories/files use `0700`/`0600` and exclusive unique filenames; existing files and directory permissions are not retroactively changed. Existing archives and Pi conversations still retain transcription text under the normal shared-context policy. Tests include a synthetic speech upload and a real WhatsApp voice note transcribed through Groq. These limited checks do not establish general recognition quality, compatibility with other providers or all WhatsApp routing behavior. See [audio configuration](README.md#audio-transcription).

All allowed chats share one Pi context. This is a trusted-user extension, not a multi-tenant privacy boundary. Retained data contains conversation content; filesystem permissions are not encryption at rest.

Baileys is an unofficial personal-account transport. Protocol changes, platform policies, account restrictions and upstream security defects remain risks. Use one active extension/process per auth profile. A separate transport lease and retired-auth I/O fences protect cooperating same-profile clients; archive locking alone does not. Old/uncooperative clients, cloned credentials and distributed/network-filesystem locking remain outside that guarantee. Stop previous clients before switching.

Auth adoption occurs only during requested connection under source/destination ownership, never as an offline-history side effect. Initialized profiles are not merged; legacy originals remain preserved. Private non-secret profile metadata blocks re-adoption after reset and implicit recovery from interrupted/unsupported state. Auth directories are `0700`; saved credentials/config/control files and archive snapshots are `0600`. Native key-file leaf modes may follow the umask, so their private directory is the confidentiality boundary. The pinned multi-file store is not a transactional database; individual file failures are not an automatic credential rollback or repair guarantee. See [auth recovery guidance](README.md#auth-adoption-and-recovery).

Dependency updates removed vulnerable PDF-processing and outdated development-tool dependencies, but known Pi SDK/host findings remain. The latest recorded full npm audit reports two affected packages (one high, one moderate) via Undici 8.10.2. The extension's production-only audit reports zero findings but excludes host-supplied packages and does not certify native binaries. The project is waiting for a patched Pi release; no local override, audit suppression or forced SDK downgrade has been applied. These findings are not resolved or certified harmless. See [DEPENDENCIES.md](DEPENDENCIES.md) for dependency versions, retained GPL components and audit details, and [LICENSING.md](LICENSING.md) for attribution.

If a session appears compromised, stop the extension/services and review linked devices through WhatsApp. Do not publish sensitive evidence or delete/migrate state automatically as a recovery procedure.
