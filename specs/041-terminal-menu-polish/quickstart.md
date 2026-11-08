# Quickstart: validating terminal menu polish

This is a validation guide, not an implementation guide. It uses synthetic data only: no real account, saved settings, speech server, provider or WhatsApp send.

## Prerequisites

- Node 26.x and the existing `node_modules` (no install or reinstall).
- Run from the repository root. Baseline commit for comparison: `8f32898`.

## 1. Targeted regressions

```sh
npx vitest run tests/unit/terminal-menu-i18n.test.ts tests/unit/owner-menu-guidance.test.ts \
  tests/unit/settings-navigation.test.ts tests/unit/menu.handler.test.ts tests/unit/menu.handler.recents-grouping.test.ts \
  tests/unit/voice-settings.view.test.ts tests/unit/optional-output-settings.view.test.ts \
  tests/unit/message-detail.view.test.ts tests/unit/message-reply.view.test.ts \
  tests/unit/whatsapp-command.router.test.ts tests/unit/command-menu.service.test.ts tests/unit/command-menu.poll.test.ts
```

Expected:

- **Labels:** every row of [navigation.md](contracts/navigation.md) shows its exit label and reopens the baseline destination. Every in-scope key exists in en/pt-BR/es/fr, and labels are distinct per panel and across categories.
- **Hint:** hinted titles end with `menu.hint.esc`. `confirm`/`custom` titles are unchanged, and Esc still closes the request.
- **Citations:** each citation matches the rendered route in all four locales.
- **Phone surfaces:** phone router and command-menu suites pass unchanged.

## 2. Declared checks

```sh
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
git diff --check
```

Expected: all pass. Record counts, platform and any skips.

## 3. Preserved-string comparison

This is a one-off check and is not committed. Load `src/i18n.ts` from `8f32898` (`git show 8f32898:src/i18n.ts`) and from the working tree. For every locale, compare the values of preserved keys. The preserved set is all keys outside `menu.*`, `archive.menu.*`, `message.detail.hint.*` and the `voice.*` labels listed in [labels.md](contracts/labels.md).

Expected: the only differences are the [citation substitutions](contracts/citations.md) (SC-004). Consent, review and introduction bodies, `voice.disclosureText`, `VOICE_PREVIEW_PHRASE`, phone-menu strings and `METADATA_LOG_POLICY` are identical.

Also confirm with `git diff 8f32898 -- src/services` that the only service change is the router line in [citations.md](contracts/citations.md).

## 4. Production-entry smoke (isolated)

Use a disposable `HOME`/`PI_CODING_AGENT_DIR` and an allow-listed, credential-free environment, following the isolation in `scripts/release.mjs` without running release preparation. Then for each `WHATSAPP_NG_LOCALE` in `en pt-BR es fr`:

```sh
pi --no-extensions -e ./whatsapp-ng.ts
```

In `/whatsapp`, do not connect:

- Open every category and check labels, the exit label and the Esc hint.
- Press Esc in a child panel: the request closes.
- In Connection, open Auto-connect → its Back label → Back to main menu → Close settings.

Expected: no English leftovers beyond the [documented exceptions](contracts/labels.md#documented-exceptions-sc-002). Do not pair, connect or send. Live phone behavior is operator-confirmed, not covered here.

The equivalent automated production-entry validation is:

```sh
npx vitest run tests/unit/phone-control.rpc.test.ts -t "menu-polish:" --maxWorkers=2
```

These four cases launch the real entrypoint in the existing disposable, network-guarded RPC harness without connecting. They check categories, contextual Back, Close settings, input cancellation, unchanged config and zero socket/model/network activity. A visual TUI check remains operator work, not proof supplied by RPC.

## 5. Records

- **Diagrams:** `docs/menu-diagrams.md` uses the new English labels and hints, and its Back edges are unchanged.
- **Changelog:** `CHANGELOG.md` has an Unreleased entry.
- **Other docs:** the doc lines listed in [research R5](research.md#r5--english-wording-and-document-churn) are aligned.
- **Links:** changed Markdown links and anchors resolve.
