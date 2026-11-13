# Contract: Text-Message Table Projection

Observable contract of `formatWhatsAppText(text, options?)`. Normative rules are the spec's FR-001–FR-030; this file fixes the interface and representative input/output.

## Interface

```ts
export interface WhatsAppTextOptions { readonly tables?: boolean } // default true
export function formatWhatsAppText(text: string, options?: WhatsAppTextOptions): string;
```

- `tables: false` → output identical to `f385a24` for every input (used by `send_wa_media` captions).
- `tables: true` (default) → `f385a24` output except for accepted table segments, plus the output-size guard.
- Never throws; synchronous; no I/O.

## Outcomes per input

| Situation | Result |
|---|---|
| NUL, or input > 65,536 UTF-16 units | original input |
| raw unclosed inline code outside protected fences (incl. table lines) | original input |
| prospective output > 65,536 units | original input |
| valid safe table, 2–4 cols, supported chars, width ≤ 28 | box segment |
| valid safe table failing only box eligibility, labeled lines pass gate | labeled segment |
| anything else in a run | `f385a24` per-line projection of the whole run |

## Box segment

````text
```<header ending>
---<header ending>   (T044 fixed first line; not a frame row)
┌─…┬─…┐<header ending>
│ h │ h │<header ending>
├─…┼─…┤<header ending>
│ v │ v │<header ending>   (one per body row)
└─…┴─…┘<header ending>
```<last run line ending>
````

One padding space each side of every cell; alignment padding inside; centered odd spare on the right.

## Labeled segment

One line per body row: pairs joined by ` · `; pair = `H: v` | `H:` (empty v) | `v` (empty H) | `` (both empty); row's own ending.

## Golden examples

See spec "Golden Examples (approved)": basic box (width 15) and `A: 👋 · B: 日本語`.
