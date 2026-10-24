# Quickstart Update: Verbose Mode

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Running in Verbose Mode
To see detailed trace data from the WhatsApp connection, add the `-v` or `--verbose` flag when launching the extension:

```bash
pi -e ./whatsapp-ng.ts -v
```

## Running in Quiet Mode (Default)
Standard launch provides a clean terminal output, showing only critical status updates:

```bash
pi -e ./whatsapp-ng.ts
```

## Log Levels
- **Verbose**: Shows full socket JSON traces from Baileys.
- **Quiet**: Suppresses socket traces; shows connection status and Agent activity only.
