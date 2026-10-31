# Source validation — 2026-10-31

Platform: macOS x86_64, Node v26.13.0/npm 11.20.0, existing dependencies. No install or configuration/version changes. Checks used disposable HOME/USERPROFILE/APPDATA/LOCALAPPDATA/PI_CODING_AGENT_DIR, an allow-listed credential-free environment, English locale and the existing external-network guard (synthetic loopback/IPC remains permitted).

## Confirmed cause and correction

The parser recognized ASCII Markdown horizontal rules but passed standalone Unicode rule glyphs to the spoken copy. The coordinator then passed those characters to the selected speech adapter unchanged. One alternative in the existing standalone-rule regex now replaces those lines with paragraph separation; display/saved text and other safeguards are unchanged. Existing coverage omitted Unicode decorative equivalents.

Synthetic tests cover eleven horizontal glyphs, spaced/quoted/mixed rules and CRLF, original display, short/inline dashes, dates/abbreviations/approximation, meaningful mixed lines, input bounds and code/table/link/indentation rejection. Coordinator cases verify cleaned provider input in Voice/Both/audio-Mirror and original Both text. No user's conversation was copied into fixtures.

## Commands and results

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2 tests/unit/whatsapp-text.test.ts tests/unit/final-output.service.test.ts` before production change | Exit 1: seventeen expected rule-leakage failures/149 passes. Distinct failing baseline retained locally. |
| Same affected command after one regex alternative | Exit 0: 166 passed/two files, no skips. |
| `npm test -- --maxWorkers=2` | Exit 0: 1576 passed/84 files, no skips; includes existing synthetic production-entry RPC fixtures. |
| `npm run lint` | Exit 0. |
| `npm run typecheck` | Exit 0; entry/source scope, not separate test typechecking. |
| `git diff --check` | Exit 0. |
| Static Markdown/member/secret review | Seven changed Markdown files/54 relative links and anchors valid; ten intended changed/new public files, zero Gitleaks findings. |

Twenty new cases were added. The three preservation/bounds cases already passed before correction; seventeen cases specifically exposed the missing cleanup. Baseline and passing logs have separate labels, not overwritten failed evidence.

## Limits and handoff

This confirms formatting leakage and its source correction, not the origin or elimination of every token in a WhatsApp transcription. Audible synthesis and transcription are separate evidence tiers. No real session dump, auth/keys, live provider, WhatsApp send, synthesis server, download, transcript generation or audio listening ran. No universal pronunciation, date expansion, fact-checking or summarization is claimed.

Dependency audits, new package qualification, new Linux/Windows checks and independent review were not rerun: this is a narrow unreleased source change with no dependency/entry/lifecycle changes. Prior dated evidence is not recast as fresh qualification. The owner subsequently authorized a local commit only, after source validation; no push/publication or live effects. Operator-controlled reload/listening remain separate decisions; do not reload the owning live Pi process from an agent turn.
