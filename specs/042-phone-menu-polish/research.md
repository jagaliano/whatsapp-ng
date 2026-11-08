# Research: Phone Menu Polish

## R1 Locale source
- **Decision**: Use existing global `t()` (`initI18n`, `WHATSAPP_NG_LOCALE` or `--whatsapp-ng-locale`; no automatic Pi/client language detection), resolved at send time.
- **Rationale**: Spec forbids new settings; terminal 041 uses the same resolver.
- **Alternatives**: per-chat or per-sender language — rejected (new setting).

## R2 /replies disclosure truncation
- **Finding**: `safeLabel` slices titles to 120 chars, so today's disclosure title is cut in both text and poll name.
- **Decision**: Add optional `body` to `CommandMenuService.create`; text = short title + sanitized body (control chars stripped, no 120 cap, limit 1,000 chars; over-limit bodies are rejected, never truncated, and tests prove every locale's worst case fits) + options + instruction. Poll name stays the short title.
- **Alternatives**: raise the global cap (affects all labels/polls; poll-name limits); send a separate message (adds an extra send before the menu, changes delivery shape) — rejected.

## R3 Current-selection marker
- **Decision**: Append localized suffix ` (current)` / ` (atual)` / ` (actual)` / ` (actuel)` to the label; ASCII-safe, works in poll options.
- **Rationale**: Glyphs (✓) render inconsistently and read poorly in screen readers; suffix keeps labels unique.
- **Applied to**: think level, voice mode, replies explain/caption, final stats on/off (toggle labels already express state), current model on page.

## R4 Toggle wording in /replies
- **Decision**: Keep paired explicit actions ("Turn on final stats" / "Turn off final stats") with current marker on the matching state; reporting toggles become "<Item>: turn on|off (now off|on)".
- **Rationale**: Preserves option count/order and action values.

## R5 Poll compatibility
- **Finding**: Poll votes are matched against frozen labels at creation (`command-menu.service.ts` aggregate by `optionName`). Localizing labels at creation is safe; locale switching mid-menu cannot alter a frozen menu.
- **Decision**: No poll logic change.

## R6 Allowed untranslated tokens
- Command names/arguments, model/provider ids (`modelLabel`), thinking level ids (`off|minimal|low|medium|high|xhigh|max`) shown alongside a localized description, "Pi", "WhatsApp".

## R7 Status values
- **Decision**: Map connection status and voice modes through existing `menu.status.*` keys for connection state and new `phone.mode.*` keys using 041 terminology for voice modes (phone text-only wording is explicit).

## R8 Help grouping
- **Decision**: Four groups: Information (`/help`, `/status`); Shared Pi session (`/stop (/abort)`, `/model`, `/think`, `/compact`, `/new`, `/replies`); This chat (`/voice`); WhatsApp and process (`/off`, `/quit`).
- **Rationale**: `/replies` changes shared settings, so it belongs with the shared session commands.

## R9 Long titles and shared-session guidance
- **Finding**: `/think` and `/model` titles embed the shared-session sentence; translated, they can exceed the 120-character title limit and be silently cut (also in poll names).
- **Decision**: Titles stay short; shared-session guidance and any other explanation go in the menu body (R2) for `/think`, `/model`, `/new`, `/off` and `/quit`. Tests assert raw fixed titles/labels ≤120 before sanitizing, so no translation is silently cut. Dynamic model labels retain their existing privacy/display cap; current markers reserve space inside that cap without changing the full action identifier.
- **Alternatives**: raising the cap or shortening the sentence per locale — rejected (poll limits; loses consent meaning).

## R10 Canonical terminology
- Status headings: "Shared Pi and WhatsApp" and "This chat". Help groups: "Information", "Shared Pi session", "This chat", "WhatsApp and process". The contract is canonical.
- Current marker applies to mutually exclusive choices; independent reporting toggles show their state instead.

## Implementation and validation (2026-11-08)

Source scope: macOS, Node 26.13.0, Pi 1.5.0; working tree based on `4f5388a` (1.1.6). This is source/fixture evidence, not release, installed-package or live-client qualification.

- Setup: existing Git ignores and `package.json#files` allowlist already cover dependencies, generated/private state and package scope. Flat ESLint and declared source globs cover the affected files. No ignore, dependency or global-config changes were needed; no build command exists.
- Baseline: credential-free disposable HOME/`PI_CODING_AGENT_DIR`, also isolating USERPROFILE/APPDATA/LOCALAPPDATA, with `WHATSAPP_NG_LOCALE=en` and `PI_OFFLINE=1`. `npm test -- --maxWorkers=2` passed **1,833 tests / 87 files**, no skips; `npm run lint` and `npm run typecheck` passed. Baseline i18n/router snapshots were kept in temporary files outside discovery.
- Test-first evidence: the seven fixed action snapshots passed before production edits; grouped help and body regressions failed first, then status sections, current markers/short titles and full disclosure failed for the intended reasons. Locale coverage initially failed 30 cases and the localized guard regression failed three. The initial help-token matcher also matched the `/model` substring in `provider/model`; it was corrected before the meaningful grouped-help failure. No fixture error is counted as product evidence.
- Body sanitization regression (T026) ran before T004, rather than waiting until US4, to honor test-first validation. English story regressions are centralized in `phone-menu-i18n.test.ts`; legacy router action/authority tests remain in place. T019 updated only the actual RPC assertions affected by friendly voice values and the shorter page title; all identity, action, count and settlement assertions remain.
- Final source review caught an introduced current-marker lookup failure with invalid saved speech preferences. Four new failures proved it; the lookup now treats current state as unknown without suppressing the original menu. Selection still fails without writing/enabling speech. Long-model tests retain full selected IDs while reserving marker space inside the old display cap. No new repair path was added.
- Four-locale scope: **116 new phone keys / 464 values**, equal placeholder sets; grouped help/status, every menu/action identity, current modes, independent reporting toggles, paging/search, unknown locale, invalid preferences, short replies and native gateway completion. Terminal-only notifications remain untouched.
- Manual glossary review: pt-BR, es and fr. pt-BR uses “configurações”, “contato” and “relatórios”; Spanish uses “ajustes”; French uses “réglages”. Command argument forms and thinking IDs (including the existing `max`) remain literal. Separate stats state words keep feminine agreement in pt-BR/es/fr. Existing 041 terminology is reused without changing any old key.
- One-off TypeScript-AST baseline comparison: **all 1,613 pre-existing translation values unchanged**; only `phone.*` keys added. Every combination of stats/files/interim/activity states plus the invalid-settings note fits the body limit: maximum lengths en **266**, pt-BR **387**, es **386**, fr **413** (limit 1,000). Bodies over the limit throw, never truncate.
- Targeted suite commands: `npx vitest run tests/unit/phone-menu-i18n.test.ts tests/unit/whatsapp-command.router.test.ts tests/unit/command-menu.poll.test.ts --maxWorkers=2` (invoked via the installed `./node_modules/.bin/vitest`, no package installation) passed **222 tests / 3 files** at the final gate. An earlier unfiltered four-suite gate including RPC passed 235 tests before the last coverage additions.
- Actual-entry smoke: `npx vitest run tests/unit/phone-control.rpc.test.ts -t "phone-polish:" --maxWorkers=2` (same installed binary) passed all four locales; 21 other scenarios were filtered, not missing-native-tool skips. The existing fixture gained one explicitly gated delivery hook. Each case loaded `whatsapp-ng.ts` via real Pi `-e`, created one synthetic socket, performed zero model starts/network attempts, preserved config on Cancel and committed the numbered reply-policy choice. Synthetic credentials were generated, never copied from real state.
- Encrypted native poll tests cover all four locales and a locale change after creation, preserving frozen option labels and selected actions. Production poll logic and opt-in are unchanged.
- Final isolated `npm test -- --maxWorkers=2`: **1,954 tests / 88 files passed**, no skips (**+121 tests / +1 file** versus baseline). Final `npm run lint`, `npm run typecheck` and `git diff --check`: exit 0. No source/test edits followed those final checks.
- Active LSP error probe: eight affected source/test paths, zero error diagnostics; five confirmed clean and three inconclusive (silent-on-clean server), not a blanket clean claim. The declared lint/typecheck/runtime gates above are the completed validation evidence.
- Changed Markdown links/anchors were checked locally (including explicit HTML anchors). Public docs updated: README, operating reference, phone diagram section and changelog. The manual acceptance guide was inspected but contains no old fixed phone labels needing edits.
- Scope checks: `whatsapp-ng.ts`, `src/ui/`, package manifest/lock, real settings and checklist files unchanged. No new commands, accepted arguments, model action IDs, dependencies, settings or terminal behavior. Preserved currentness/revision checks, option ordering and numeric/poll routing; no extra sends or retry paths.
- **Not run**: live WhatsApp or speech-provider calls, operator visual/client acceptance, owning-process reload, clean consumer install, new Linux/Windows qualification, audit/release preparation or publication. Git hooks stayed disabled; no branch/commit/push/delegation or automation activation. Checklist remains a read-only requirements-quality gate.
