# Research: Localize System Messages to en-US

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Findings: Portuguese Strings for Localization

The following strings have been identified for translation/replacement:

### 1. `<legacy-entrypoint>`
- `Mensagem de` -> `Message from`
- `[Áudio Transcrito]` -> `[Transcribed Audio]`
- `"Sessão compactada com sucesso! ✅"` -> `"Session compacted successfully! ✅"`
- `"Abortado! ✅"` -> `"Aborted! ✅"`

### 2. `src/services/audio.service.ts`
- `'[Transcrição vazia]'` -> `'[Empty transcription]'`
- `[Erro na transcrição: ...]` -> `[Transcription error: ...]`

### 3. `src/ui/menu.handler.ts` (Code Comments)
- `// Exibe o nome se existir, senão apenas o número` -> `// Display name if it exists, otherwise just the number`
- `// Extrai o número entre parênteses ou o que sobrar depois de "Remove "` -> `// Extract the number between parentheses or what remains after "Remove "`

### 4. `src/services/whatsapp.service.ts` (Audit)
- Status messages (Pairing, Connected, etc.) are already in English.

## Decisions & Rationale

- **Decision**: Direct replacement of hardcoded strings.
- **Rationale**: The project doesn't currently require a multi-language i18n framework. Simple US English localization meets the requirements with minimal complexity.
