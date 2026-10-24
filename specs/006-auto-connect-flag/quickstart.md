# Quickstart Update: Auto-Connect Flag

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Automatic Startup
To have the WhatsApp extension connect as soon as you launch Pi, use the `--whatsapp` or `-w` flag:

```bash
pi -e ./whatsapp-ng.ts --whatsapp
```

## Manual Mode (Default)
Standard launch requires you to manually connect via the `/whatsapp` menu:

```bash
pi -e ./whatsapp-ng.ts
```

## Behavior Notes
1. **Precedence**: The CLI flag overrides any "disconnected" status saved from a previous session.
2. **Safety**: If you haven't logged in yet, `--whatsapp` will simply show a notification "Manual login required" instead of showing a QR code.
3. **Retries**: If the first attempt fails, the system will automatically try to connect 3 more times before stopping.
