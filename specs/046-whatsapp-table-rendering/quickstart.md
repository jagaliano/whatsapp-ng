# Quickstart: Validate Table Projection (046)

Isolated environment per AGENTS.md "Validation" (disposable HOME/`PI_CODING_AGENT_DIR`, `WHATSAPP_NG_LOCALE=en`, synthetic data). No real account, provider or network.

## Automated

```sh
npx vitest run tests/unit/whatsapp-table.test.ts tests/unit/whatsapp-text.test.ts tests/unit/whatsapp-ng.extension.test.ts tests/unit/phone-control.rpc.test.ts tests/unit/final-output.service.test.ts
npm test -- --maxWorkers=2
npm run lint
npm run typecheck
git diff --check
```

## Scenarios (see [contract](contracts/table-projection.md), [data model](data-model.md))

1. Golden basic box and emoji fallback match exactly; second pass leaves both unchanged.
2. Width 28 → box; 29 → labeled. 5 columns → labeled. `café`, `e`+U+0301 boxed; standalone U+0301, CJK, emoji → labeled.
3. Alignment `---`, `:---`, `---:`, `:---:` (odd spare right).
4. Empty/duplicate headers, short rows, both-empty pairs.
5a. Link label of 511 units projected, 512 literal (text and cells); nesting depth 3/4/5 matches legacy.
5. Escaped pipes (1/2/3 backslashes), `` `a|b` `` (legacy run, not original input), `` `a\|b` ``, link with escaped pipe, bare URL with `**`.
6. Unsafe: interior tab, lone CR, bidi control, lone surrogate, triple backticks → legacy run.
7. Unstable labeled line (code `**x**`, cross-cell markup, tilde-fence-looking line) → legacy run. (Labeled lines always contain ` · `, so never delimiter-shaped.)
8. Header-only, adjacent tables, wide body row, delimiter-shaped body row → whole run legacy; blank-separated tables independent; mismatch → normal scan.
9. Fenced/unmatched-fence/indented/`>`/`#`/list lines → no extraction.
10. CRLF and no-final-newline endings preserved; closing fence inherits last line's ending.
11. Later unclosed prose span → original input.
12. Output exactly 65,536 → rendered; 65,537 → original; input 65,536/65,537 and NUL guards distinct; long repeated header × many rows → original within timeout; 50,004-unit input with 10,000 columns and 5,000 short rows → original, no padded rows, within timeout.
13. Mocked entry: `send_wa_message` renders table; `send_wa_media` caption keeps `f385a24` output.
13a. Actual Pi RPC entry (synthetic model/transport, offline `.txt` document branch, network guards): same two outcomes on recorded sends; zero network attempts.
15. Malformed/mixed/surrogate-heavy inputs: no exception; repeated calls identical.
16. Frozen legacy fixtures: `tables: false` output never longer than input.
17. `package.json` and `package-lock.json` unchanged.
14. Speech-eligibility tests in `final-output.service.test.ts` unchanged and passing.

## Manual (operator)

Portrait-phone font/alignment of the box on real WhatsApp clients — operator acceptance, not established by unit tests.
