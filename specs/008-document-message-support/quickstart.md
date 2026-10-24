# Quickstart: Testing Document Support

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Setup
1. Ensure `whatsapp-ng` is running and connected (`/whatsapp` to check).
2. Ensure `pdftotext` is installed on your system.

## Test Flow

### 1. Basic Reception
1. Send a PDF file named `test.pdf` to your WhatsApp bot.
2. Check the TUI logs for: `[WhatsApp-NG] Received document: test.pdf`.
3. Verify the file exists in `.pi-data/whatsapp/documents/`.

### 2. Agent Processing
1. Send another PDF.
2. Wait for the agent (Pi) to acknowledge receipt.
3. Ask the agent: "Can you read the content of the PDF I just sent and summarize it?"
4. Observe the agent using the `bash` tool with `pdftotext` to read the file.

## Expected Log Output
```text
[WhatsApp-NG] Downloading document from User...
[WhatsApp-NG] Document saved to ./.pi-data/whatsapp/documents/123456789_test.pdf
[WhatsApp-NG] Notifying agent about document...
```
