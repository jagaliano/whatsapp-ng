# RC2 preparation plan

Historical RC2 integration record, added after implementation. See [requirements](spec.md), [tasks](tasks.md) and [dated evidence/limits](validation.md); this is not authorization to repeat release actions.

1. Inspect the existing working tree and publication scripts. Keep `1.1.0-rc.2`; confirm it is absent from the public registry before preparing a new immutable candidate. Do not upgrade dependencies or alter npm tags.
2. Reproduce the reported npm pipeline in an isolated, credential-free CLI environment. Compare exact package lookup, search limits/narrowing and direct/filter Pi pages. Record public metadata without credentials or private account material.
3. Correct publication-relevant documentation: available channel versus source features, release examples/bootstrap state, dated evidence, startup/Off/Back acceptance and current record navigation. Leave generic workflow repairs and constitutional policy changes outside this release task.
4. Run isolated source tests, lint, typecheck, link/whitespace checks and fresh production/full-tree audits. Preserve accepted inherited SDK risk rather than applying unreviewed overrides or treating production-only auditing as host certification.
5. Inspect the complete diff, explicitly stage the intended runtime/tests/docs/read-only reviewer definition, and scan staged candidate content with redacted secret diagnostics. Commit using existing conventions; never stage private caches, credentials or unrelated files.
6. On clean committed source run `npm run release:prepare`: tests/lint/typecheck, production audit, pack, integrity check and publish dry-run only. Inspect tar members and validate the exact artifact in an isolated consumer/Pi environment without real auth, online flags or provider calls.
7. Push the authorized commit normally. Record the actual artifact commit/integrity and push result in the local completion handoff. Do not create tags, publish, change external trust/automation settings or retry unknown external mutations.

## Evidence ownership

[Validation](validation.md) holds dated source/review/discovery evidence. Post-commit artifact identity belongs to `.pi/cache/releases/prepared.json` and local acceptance output, not a shipped test script. Any tracked edit after preparation invalidates that receipt; prepare again. Commands are in the [release guide](../../docs/releases.md).

## Complexity Tracking

No new framework, dependency, storage/auth flow or parallel owner. This record follows implementation; earlier ignored/missing plans remain a governance gap, not a constitutional waiver.
