# Quickstart: QR Connect Welcome Message

## Goal

Validate that the agent sends a friendly self-message and prints "WhatsApp connected" exactly once after scanning the QR code, and that neither action fires during auto-reconnects or credential-restore connections.

## Scenario A — Fresh QR Pairing

1. Delete (or rename) the `.pi-data/` auth directory so no saved session exists.
2. Start the agent.
3. When the QR code appears in the terminal, scan it with the WhatsApp mobile app.
4. **Expected console output**: `WhatsApp connected` printed to stdout within 5 seconds.
5. **Expected WhatsApp message**: A welcome message arrives on the operator's own number (appears as a self-chat / "Saved Messages" conversation) within 5 seconds.
6. Confirm the agent continues to operate normally (status bar shows `| WhatsApp: Connected`).

## Scenario B — No Welcome on Credential-Restore

1. Ensure a valid saved session exists (complete Scenario A first).
2. Restart the agent without deleting auth data.
3. Observe that the agent connects without displaying a QR code.
4. **Expected**: `WhatsApp connected` does NOT appear in stdout.
5. **Expected**: No welcome self-message is sent to the operator's WhatsApp.
6. Confirm normal operation (status bar shows `| WhatsApp: Connected`).

## Scenario C — No Welcome on Auto-Reconnect

1. Connect the agent (Scenario B or Scenario A).
2. Simulate an unexpected disconnect (disable Wi-Fi briefly or block the process's network access).
3. Wait for the agent to auto-reconnect (status bar transitions `Reconnecting...` → `Connected`).
4. **Expected**: `WhatsApp connected` does NOT appear in stdout during the reconnect.
5. **Expected**: No additional self-message is sent.

## Scenario D — Re-pairing After Logout

1. Connect the agent.
2. Open the `/whatsapp` menu and select "Logoff / Delete Session", then confirm.
3. Start the agent again — a QR code will be displayed.
4. Scan the QR code.
5. **Expected**: `WhatsApp connected` IS printed (this is a fresh QR pairing).
6. **Expected**: A welcome self-message IS sent.

## Verification Checklist

- `WhatsApp connected` printed once per QR scan, never on reconnect/restore.
- Welcome self-message appears in the operator's own WhatsApp within 5 seconds of QR connection.
- If the send fails (test by revoking network mid-send), the agent stays connected and processes subsequent messages normally.
- Message text is non-empty and friendly (not a technical string).
