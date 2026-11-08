# Contract: terminal-path citations (FR-014a)

Text that is shown on the phone or transmitted to WhatsApp and that cites a terminal `/whatsapp > …` path or a terminal label. Only the cited segments listed here change. All other characters stay byte-identical to `8f32898`.

Segment mapping (from [labels.md](labels.md#root-categories-and-state-words)):

| Baseline segment | en | pt-BR | es | fr |
| --- | --- | --- | --- | --- |
| `Voice` (category) | Voice | Voz | Voz | Voix |
| `Chats / Owner` (category) | Chats / Owner | Conversas / Proprietário | Chats / Propietario | Discussions / Propriétaire |
| Owner / Recents segments | already localized via `voice.owner` / `menu.root.recents`; unchanged | | | |

## Localized texts (`src/i18n.ts`)

| Key | Locale | Before → after (cited segments only) |
| --- | --- | --- |
| `voice.authUnknown` | pt-BR | `/whatsapp > Voice` → `/whatsapp > Voz`; `/whatsapp > Chats / Owner > Proprietário` → `/whatsapp > Conversas / Proprietário > Proprietário` |
| | es | `/whatsapp > Voice` → `/whatsapp > Voz`; `Chats / Owner >` → `Chats / Propietario >` |
| | fr | `/whatsapp > Voice` → `/whatsapp > Voix`; `Chats / Owner >` → `Discussions / Propriétaire >` |
| `voice.authNoOwner` | pt-BR, es, fr | `Chats / Owner >` → localized category, as above |
| `voice.authDenied` | pt-BR, es, fr | same two substitutions as `voice.authUnknown` |
| `service.whatsapp.qrWelcomeMessage` | pt-BR | both `Chats / Owner >` → `Conversas / Proprietário >`; trailing `em Voice.` → `em Voz.` |
| | es | both `Chats / Owner >` → `Chats / Propietario >`; trailing `en Voice.` → `en Voz.` |
| | fr | both `Chats / Owner >` → `Discussions / Propriétaire >`; trailing `dans Voice.` → `dans Voix.` |

English values of all four keys are unchanged: the English labels Voice, Chats / Owner, Owner and Recents do not change.

## Phone `/voice` setup reply (`src/services/whatsapp-command.router.ts:210`)

- Before: `` `… Use terminal /whatsapp > Voice > ${t('voice.setupChat')} and select this chat. …` ``
- After: `` `… Use terminal /whatsapp > ${t('voice.menu')} > ${t('voice.setupChat')} and select this chat. …` ``
- English output is byte-identical. In pt-BR, es and fr, the segment `Voice` becomes the localized category, matching the already-localized `voice.setupChat` that follows it. The surrounding English wording is unchanged.

## Unchanged (English-only, cite unchanged English labels)

- `DENIED` in `src/services/whatsapp-command.router.ts:18`
- the repair errors in `src/services/session.manager.ts:458` and `src/services/speech-settings.ts:24`
- tool descriptions and prompt guidelines in `whatsapp-ng.ts`

## Verification

`tests/unit/owner-menu-guidance.test.ts` derives each route from the rendered menu titles per locale and asserts that it appears in each localized text above. Extend it to cover the Voice route, the trailing Voice citation in the welcome message and the router reply. The [preserved-string comparison](../quickstart.md#3-preserved-string-comparison) confirms that nothing else in these texts changed.
