# Data model: Terminal menu polish

No persisted data, settings schema, archive format or wire format changes. The "entities" here are in-memory string contracts.

## Translation key (`src/i18n.ts`)

- **Fields**: key (`keyof typeof fallback`), English fallback value, optional pt-BR/es/fr values, `{placeholder}` set.
- **Rules**:
  - Every in-scope key has a value in all four locales ([labels.md](contracts/labels.md)), unless it is a documented exception.
  - A translation uses exactly the placeholders of its English value.
  - Removed keys have no remaining source reference.
- **Classes**: *terminal label* (option, heading, hint, terminal notice), changeable; *preserved string* (consent, authorization, review, transmitted or phone text), frozen except for [citations](contracts/citations.md).

## Settings category

- **Fields**: internal ID (`SettingsCategory` union plus `'Voice'`), display key (`menu.category.*` / `voice.menu`).
- **Rules**: the ID is used for navigation (`resumeCategory`, Recents parent, `handleCommand`). Only the display label is shown or cited. The ID-to-label mapping is one-to-one per locale.

## Panel exit

- **Fields**: panel, destination (baseline), label key (`menu.close` or `menu.back.*`).
- **Rules**: the destination never changes. For caller-dependent panels, the caller supplies the label key. See [navigation.md](contracts/navigation.md).

## Hinted dialog

- **States**: `select` / `input` / `editor` inside a settings request → title rendered with a second line `menu.hint.esc`. Esc closes the request (baseline). `confirm` / `custom` → no hint, unchanged.

## Action-matching label

- **Definition**: a fixed label compared with the host's returned string to choose an action (`MenuHandler.showSettings` switch, panel `if` chains, Voice `selected === t(…)`).
- **Rules**: computed from the same `t()` call that renders it. Unique within its comparison scope ([identity rules](contracts/navigation.md#identity-rules)).
