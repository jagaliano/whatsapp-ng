# whatsapp-ng development guidance

Applies to this repository. Keep changes small, evidence-backed and consistent with the existing services. Preserve unrelated work and do not commit, push, tag, publish, create external issues, delegate work or activate automation without explicit authorization.

## Sources of truth

- [README.md](README.md): installation, product behavior and the public capability overview.
- [docs/reference.md](docs/reference.md): current configuration, routing, history, media, startup/Off, privacy and migration contracts.
- [docs/crispasr.md](docs/crispasr.md): optional local CLI/server setup and compatibility limits.
- [docs/releases.md](docs/releases.md): local release commands, artifact verification and separately gated GitHub/npm publication.
- [DEPENDENCIES.md](DEPENDENCIES.md), [SECURITY.md](SECURITY.md) and [LICENSING.md](LICENSING.md): dependency/native-tool evidence, security boundaries and attribution.
- [ROADMAP.md](ROADMAP.md): implemented versus proposed work. Proposed variables and integrations are not implemented features or execution permission.
- [specs/README.md](specs/README.md): design/decision-record index; recent extension validation also lives under [specs/039-extension-improvements/](specs/039-extension-improvements/). Historical plans, checkboxes, package names and validation counts describe their own checkpoints, not current runtime or release readiness.
- [.specify/memory/constitution.md](.specify/memory/constitution.md): OOP, clean code, SOLID, strict TypeScript and simplicity. Its workflow requires every change to be documented in corresponding specification and plan files, with tasks derived from the plan. Records belong under `specs/<feature>/`; report missing or ignored required records rather than treating them as a waiver or inventing retroactive evidence. Record deviations in the plan's Complexity Tracking section. Amending that rule requires an explicit constitutional decision.

This file is hand-maintained. Spec Kit agent-context steps must not regenerate it without specific approval. Inspect generated prompts, missing scripts/markers and Git hooks before invoking a workflow: automatic hook settings are not permission to create/switch branches, commit or publish. Flag conflicts instead of running those steps. `.devin/rules/specify-rules.md` is a legacy generated snapshot, not verified current guidance. Generic setup steps and handoff metadata do not authorize unrelated config/dependency edits or actions outside the current request. Templates cannot waive required regression tests or replace the existing verified-owner and no-silent-provider-fallback boundaries.

Read the relevant owner, callers, mirrored tests and configuration before editing. Verify operational claims against current source/tests and `package.json`; distinguish a documentation defect from a requested runtime change. Do not rewrite historical evidence as though it were a new validation run.

## Stack and repository map

- Development baseline: Node 26.x and Pi 1.4.0. Resolve exact dependency versions from `package.json` and `package-lock.json`, not old specifications.
- Runtime: TypeScript ES modules, Baileys (`baileys`, not the historical scoped package), Pino, QR support, LiteParse and optional speech backends.
- Pi supplies SDK/TUI/TypeBox runtime peers. Preserve the existing wildcard peers and development aliases; do not bundle shadow host copies or change dependencies without authorization.
- `whatsapp-ng.ts` is the source entrypoint and composition root for Pi hooks, tools and `/whatsapp`. There is no build script or generated `dist` runtime.
- `src/services/`: cohesive owners for socket/auth lifecycle, identity/routing, storage, commands, media, speech, reporting and optional outputs.
- `src/ui/`: navigation and terminal views; `src/models/`: message/archive contracts; `src/i18n.ts`: localized copy.
- `tests/unit/`: service, contract and integration tests; `tests/fixtures/`: synthetic socket/model/Pi adapters; [tests/manual/prerelease-acceptance.md](tests/manual/prerelease-acceptance.md): bounded operator acceptance.
- `scripts/release.mjs` and `.github/workflows/`: explicit release tooling and CI. Service/tmux/PowerShell helpers are not proof of platform qualification.

Use the existing class/service boundaries and narrow interfaces. Keep production code strictly typed and local ES-module imports consistent with the `.js` import convention. Avoid new frameworks, dependencies, one-use abstractions and unrelated reformatting.

## Runtime invariants

### Identity, authority and lifecycle

- All allowed chats share one Pi session/context. Conversation routing is not per-chat privacy isolation; an allowed contact/group is not automatically the phone owner.
- Preserve `ConversationRouter` consumed-input ownership, ambiguous-input refusal and transport targets. Do not reconstruct a recipient from displayed LID digits or replace ownership checks with a mutable last-chat guess.
- Preserve full message keys, verified PN/LID relationships and group participants where required. Keep account/profile boundaries in routing, quotes, archives and history.
- Use `OwnerAuthorization` and existing currentness/revision checks for guarded configuration. Recheck cancellation and captured account/session/owner/admission authority across asynchronous boundaries and immediately before commit or egress.
- Keep `WhatsAppService` start/stop/logout and generation-aware teardown coherent. Hold transport/auth ownership through pending credential I/O; never borrow a lease or steal an unknown lock.
- Explicit Off retains login/history/preferences and fences pending WhatsApp work. Preserve its process-local behavior across reload/session replacement and the distinction between saved auto-connect preference and an explicit online flag. See the operating reference rather than duplicating a startup state machine.
- Menu navigation must retain its captured authority and refresh current options; Back must not silently renew an expired request or mutate settings.

### Storage and privacy

- Default data root: `~/.pi/agent/extensions/whatsapp-ng/`, resolved by `src/services/storage-path.ts`; settings are in `config.json`, archives under `archive/`, and media under `whatsapp-medias/`. Group-specific auth stays isolated.
- `SessionManager` owns config persistence. Preserve atomic/currentness checks, cooperative writer coordination and failure behavior; do not bypass it with ad hoc config writes.
- Keep config, archive and transport locks distinct. Corrupt, unsupported, interrupted or uncertain state is not permission to reset data, delete locks, merge credentials or silently adopt another profile.
- Whole-root namespace migration uses the existing explicit-source guarded migration path and requires owning processes to stop. Never hot-move a live auth/archive root. Follow [migration and recovery](docs/reference.md#migration-and-recovery).
- Never read, print, copy or commit real auth/session keys, QR material, `.env` values, provider keys, conversation dumps or runtime caches as test/review evidence. Use synthetic data and key-variable names, not secret values.
- Keep diagnostics metadata-only and bounded; preserve historical logs rather than claiming they were redacted. Private filesystem permissions are not encryption, and archive retention does not erase Pi transcripts or downloads.

### External effects

- API acceptance is not recipient delivery. After transmission starts, unknown outcomes must not trigger automatic resends or speculative fallback; preserve stable message IDs and settlement-owned snapshots.
- Uploads require explicit user intent, validated local paths and existing byte/time/resource bounds. Mentioning a path is not permission to upload it. Keep user originals untouched.
- STT/TTS configuration stores credential environment-variable names. Backend configuration is not destination/group speech consent. Preserve endpoint validation, the deliberate plain-HTTP opt-in boundary and no silent provider fallback.
- System FFmpeg, local Whisper/CrispASR, OCR tools and models are operator-managed. Do not install binaries, download models, start speech servers, send previews or make live provider/WhatsApp calls merely to inspect configuration or validate documentation.

## Validation

Declared source checks:

```sh
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
```

- Add a failing regression before fixing a confirmed defect, then run the affected suite and the broader checks at a stable gate. `vitest.config.ts` restricts discovery to `tests/**/*.test.ts`; keep caches/review copies out of discovery.
- `tsconfig.json` checks the entrypoint and `src`, not tests. Lint covers `whatsapp-ng.ts`, `src/**/*.ts`, `src/**/*.mjs`, `scripts/**/*.mjs` and `tests/**/*.ts`; it does not cover fixture `.mjs` files or shell/PowerShell helpers. Do not present typecheck alone as test/fixture validation.
- Use disposable HOME and `PI_CODING_AGENT_DIR`, also isolating `USERPROFILE`, `APPDATA` and `LOCALAPPDATA` on Windows. Use synthetic accounts/files and an allow-listed credential-free environment with `WHATSAPP_NG_LOCALE=en`; the isolated validation setup in `scripts/release.mjs` is the reference, not permission to run release preparation. `PI_OFFLINE=1` is not a network sandbox: use existing network guards and mock socket/provider boundaries.
- For Pi lifecycle/tool/menu changes, exercise the actual entry with `pi --no-extensions -e ./whatsapp-ng.ts` in an isolated environment, or the existing production-entry RPC fixtures. Do not reload or terminate the owning live Pi process from an active agent tool turn.
- Inspect skips in native-tool tests; unavailable FFmpeg/Tesseract/addons do not count as successful compatibility evidence. Do not download a model or use a real account to turn a skipped check into a pass.
- Record exact commands/results, source/artifact scope, platform and skipped work. Source tests, static review, package qualification and operator-confirmed live behavior are distinct evidence tiers.
- Run `git diff --check` and check changed Markdown links/anchors. After documentation-only edits, report static validation and any runtime tests not rerun; do not imply fresh runtime or audit evidence.

Install/reinstall dependencies only when authorized, using the [lockfile/lifecycle-disabled policy](DEPENDENCIES.md#maintainer-reproduction). Release preparation/publication is a separate action, not an ordinary test command. A clean production audit does not certify the host SDK, native binaries or system tools; preserve dated findings and limitations until reassessed.

## Documentation and delivery

Keep public behavior in the README/reference, developer rules here, open proposals in the roadmap, completed impact in the changelog and dated decisions in specs. Prefer links over duplicated instructions, rolling test counts or copied reviewer transcripts. Preserve upstream/dependency attribution and historical record provenance.

For reviews, use the requested model/provider with no silent fallback, a clear file/ref scope and read-only tools unless edits are explicitly authorized. Exclude real state and private local handoffs. Report actual coverage, including historical/template documents only scanned or sampled; do not claim every document was deeply reviewed when it was not.

Before handoff, preserve unrelated changes, summarize touched paths and validation, and distinguish a pending operator reload/live check from completed implementation. Leave Git/release actions and real-state operations to explicit authorization.
