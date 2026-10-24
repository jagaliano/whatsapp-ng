# Namespace migration qualification and handoff

## Status

Implementation, package/platform qualification and focused exact-model re-review passed. The owning-process handoff and real atomic move are now verified offline: original root identity retained, old source absent, settings/three contacts preserved, 3,277 auth files, six media files, three archive files and one profile marker retained, private permissions verified. Credentials were not opened. Live connection/client verification was not performed. No Git delivery or npm publication is authorized; `private: true` remains. Earlier M3/M5 artifact hashes describe pre-namespace bytes and are superseded, not silently reused.

## Synthetic evidence

- Initial full renamed suite: 485 tests/51 files, then 496/51 with additional coverage. Final expanded suite: **502 tests/51 files, zero failures/skips**, independently on macOS and Linux amd64, Node 26.12.1 / Pi 1.3.0. `npm test`, `npm run lint`, `npm run typecheck` and shell syntax checks passed; `git diff --check` passed on the source tree. Test HOME/agent directories were synthetic.
- Actual migration uses the same directory identity and preserves opaque default/group auth bytes, settings, media, private permissions and log bytes. Real ArchiveFiles round-trip preserves archive UUID/profile/account scope and quote availability. Moving both the archive root and auth root preserves the relative profile hash; absolute-path-only transient runtime scopes restart normally.
- Migration failure blocks SessionManager, RecentsService, WhatsAppService, all seven tools and the command. Constructors defer filesystem writes. A malformed request, occupied root, active/stale runtime lock, symlink, interrupted profile, malformed configuration or incomplete native profile is preserved and refused, not replaced with defaults.

## Independent review and corrections

Initial exact-model review: run `e6fc5c5c-8c53-4b8e-9a42-b4d3b6d2f8a6`, mission `5978c92b-3a05-4940-a557-53b38dc4ad53`, verdict **BLOCK**. Requested medium thinking via the exact model suffix. Transcript assistant metadata confirms only `openai-codex/gpt-6.1-sol`; tool calls were read/find/grep/ls/watchdog_diff only. No configuration changes, commands, editing or fallback.

| Finding | Disposition and regression |
| --- | --- |
| P1: migration flag replayed on every session_start, failing after source disappearance | Process/destination startup outcome is retained across module/extension recreation. A successful migration is not replayed by new/resume/fork events; new requests and failed startup require a fresh process. Actual extension handler and real directory/module-recreation regressions added. |
| P1: service shutdown logger bypassed pending-migration guards and could create a conflicting canonical log | Service file logger checks the same synchronous storage readiness, including startup phase and pending ownership. Interrupted moved-root shutdown regression proves no canonical log is manufactured and recovery succeeds. |
| Parent-discovered group-marker edge case | Directory discovery matched group-profile marker filenames. Exclude the actual marker suffix from directory classification while retaining marker validation. Regression preserves marker bytes and group credentials. |

Reviewer-finding baseline: five failures before correction, including both original defects; targeted corrected run passed 51 tests. Group-marker baseline separately failed with unsafe-auth-directory error before correction. Final expanded full suite passed 502/51 on both platforms.

Focused run `56d4930c-c298-4bc0-b5fc-eef1cf67dc72`, mission `76ea9271-1311-43e4-8c28-a251517cb226`: **OK — No issues found.** Both P1 dispositions and the group-marker correction were independently confirmed. Transcript metadata again verifies only the requested exact model; calls were read/grep/watchdog_diff. No fallback, commands or edits.

## Final package and runtime checks

- **39-entry private tarball**, canonical entry and migration service present, license/policy notices included; every member matches source bytes. Host artifact SHA-1: `27d9bea3c37946175ac443f3e179b8cc2b695ec8`. Linux-built artifact SHA-1: `83fc5b8fe560d1e2c4c1db3284fd2035572ca706`; member paths, bytes and metadata match the host artifact despite compressed-file variance. Their complete uncompressed tar bytes are identical (SHA-256 `3a7cad099a92309f24746283ebbd5e4a3c629a458599b0dba74f5527f8704700`).
- Actual Pi-managed install/remove/reinstall, automatic discovery and explicit packaged-entry startup passed on both platforms: seven tools with object schemas, one `whatsapp` command, zero warnings/errors, zero peer shadow copies, no online flag or real auth access.
- Actual packaged RPC moved opaque synthetic auth/settings/media/group markers and preserved inode identity. Three `new_session` events each retained a functioning command handler. Failed moved-root startup/shutdown did not manufacture a log conflict; a fresh process recovered it. Network attempts: zero.
- Installed native fresh credentials accepted with private permissions and no socket. Native Baileys/media/auth/FFmpeg contracts are included in the full suite.
- `npm audit --json` and `npm audit --omit=dev --json`: repository and clean consumer both report zero vulnerabilities on both platforms.
- Two actual Pi RPC processes: one auth-opening/socket-constructing process; competitor explicitly rejected by the transport lease; zero network attempts or legacy-key adoption while owned.
- Linux used the previously approved pinned disposable amd64 image, no host mounts or auth data; the container was removed after evidence capture.

A qualification-harness assumption initially failed after otherwise successful startup: an untouched fresh installation does not persist default configuration until a mutation. The assertion was corrected to verify initialized private storage and no credentials, with no runtime source change; both complete qualification pipelines then passed. This was synthetic-only, not a production configuration incident.

## Remaining real-state handoff

Queue the explicit owner-authorized source only after a metadata-only ownership/conflict preflight. Stop all owning Pi processes/services, including the current process, then start the new entry cold. Verify settings/login/history/media/log preservation and obtain separately bounded live authorization. Do not terminate the owning user process automatically or reset/unlink authentication. Unknown/stale locks require explicit operator recovery, never automatic removal.

Real metadata-only preflight found the original three contacts, saved default auth, stable profile and six media files intact; the sole archive lock belongs to the current Pi process. Before queue preparation, a new destination appeared with only an unassigned profile marker and no credentials/configuration/history. The guard stopped before any request or state move. Its origin is not assumed.

The owner expressly approved preserving this unused initialization aside after full process exit. A private guarded cold-start launcher binds both directory identities, the unassigned marker and all 34 qualified runtime-file hashes; it rejects live owners, any locks, changed data/custom settings, symlinks or an occupied backup. It preserves the unused root as a sibling, then invokes the reviewed entry with the explicit source and exact saved session. The original full-state move is still performed only by the qualified runtime, not by the helper.

The launcher passed 12 synthetic tests and a final narrow exact-model read-only review, run `d90f0b56-5fa5-409a-94b4-dc495259a98f`: **OK — No issues found.** Actual model again verified as `openai-codex/gpt-6.1-sol`; only read calls occurred. Its real check-only invocation correctly refuses the still-running owner. Both real directories remain untouched, no migration request exists yet, and no authentication contents were read. Full-process exit, automatic cold-start move and offline post-verification subsequently passed via the preserved metadata snapshot. Only separately authorized live connection/client verification remains deferred. No global settings were changed.
