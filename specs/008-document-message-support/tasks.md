# Implementation Tasks: Implement Document Message Support

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


**Branch**: `008-document-message-support`
**Feature**: Implement Document Message Support
**Spec**: [specs/008-document-message-support/spec.md]
**Plan**: [specs/008-document-message-support/plan.md]

## Implementation Strategy

We will follow an incremental approach, starting with the foundational environment checks and storage setup, followed by the core reception and saving logic (MVP), and finally the agent notification.

- **MVP**: Successfully save an incoming WhatsApp document to disk.
- **Full Feature**: Agent is notified and can process the saved document.

## Phase 1: Setup

- [x] T001 Create initial storage directory at `.pi-data/whatsapp/documents/`

## Phase 2: Foundational

- [x] T002 [P] Verify `pdftotext` availability at extension startup in `<legacy-entrypoint>`
- [x] T003 [P] Define `DocumentMetadata` interface in `src/models/whatsapp.types.ts`

## Phase 3: User Story 1 - Receive and Save Document [US1]

**Goal**: Automatically download and save documents sent via WhatsApp.
**Independent Test**: Send a PDF to the bot and verify it appears in `.pi-data/whatsapp/documents/` with a sanitized, unique filename.

- [x] T004 [US1] Implement detection of `documentMessage` in the message callback in `<legacy-entrypoint>`
- [x] T005 [US1] Implement media download logic using `downloadContentFromMessage` from `@whiskeysockets/baileys` in `<legacy-entrypoint>`
- [x] T006 [US1] Implement filename sanitization (regex-based) and unique naming (timestamp prefix) in `<legacy-entrypoint>`
- [x] T007 [US1] Implement file saving logic to the designated documents directory in `<legacy-entrypoint>`

## Phase 4: User Story 2 - Notify Agent [US2]

**Goal**: Inform the Pi agent about the received document so it can process it.
**Independent Test**: Send a document and verify the agent receives a text notification with the file path and metadata.

- [x] T008 [US2] Implement notification message formatting using the contract defined in `specs/008-document-message-support/contracts/agent-notification.md` in `<legacy-entrypoint>`
- [x] T009 [US2] Deliver notification to the agent via `pi.sendUserMessage` with `deliverAs: "followUp"` in `<legacy-entrypoint>`

## Phase 5: Polish & Integration

- [x] T010 Add detailed console logging for document lifecycle in `<legacy-entrypoint>`
- [ ] T011 Verify end-to-end flow: User sends PDF -> Bot saves it -> Agent reads it via `bash pdftotext`

## Dependencies

1. **Phase 3 (US1)** depends on **Phase 1** (directory must exist) and **Phase 2** (metadata types).
2. **Phase 4 (US2)** depends on **Phase 3** (file must be saved before notifying).

## Parallel Execution Examples

- **T002** and **T003** can be performed in parallel as they touch different files and don't depend on each other.
- While implementing **US1** in `<legacy-entrypoint>`, the setup of the storage directory (**T001**) can be done independently.
