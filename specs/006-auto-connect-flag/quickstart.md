# Quickstart Update: Auto-Connect Flag

## Automatic Startup
To have the WhatsApp extension connect as soon as you launch Pi, use the `--connect` or `-c` flag:

```bash
pi -e ./whatsapp-pi.ts --connect
```

## Manual Mode (Default)
Standard launch requires you to manually connect via the `/whatsapp` menu:

```bash
pi -e ./whatsapp-pi.ts
```

## Behavior Notes
1. **Precedence**: The CLI flag overrides any "disconnected" status saved from a previous session.
2. **Safety**: If you haven't logged in yet, `--connect` will simply show a notification "Manual login required" instead of showing a QR code.
3. **Retries**: If the first attempt fails, the system will automatically try to connect 3 more times before stopping.
