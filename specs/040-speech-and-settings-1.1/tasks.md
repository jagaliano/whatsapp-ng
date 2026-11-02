# Tasks: Speech and settings improvements for 1.1.x

Derived from [plan.md](plan.md). All tasks are complete; IDs from the former records are kept in parentheses for traceability. Each regression was observed failing before its production change unless noted ([evidence](evidence.md)).

## Phase 1 — US1 Saved auto-connect and Back (1.1.0)

- [x] T001 Add strict default-off `autoConnect` preference, TUI/RPC startup gate, print/JSON opt-in and process-local Off persistence (R040).
- [x] T002 Serialize cooperative config writes; reject stale explicit choices; keep settings readable under unknown locks; regressions for cross-process writer and retained-lock initialization (R040, Opus findings).
- [x] T003 Return Back from Auto-connect to Connection then main menu; unit and actual `pi -e` RPC regressions (R040).

## Phase 2 — US2 Managed CrispASR servers (1.1.1)

- [x] T004 Inspect installed CrispASR 0.8.48 and pinned upstream `/health` / `/v1/models` source; settle connection-time activation, JSON descriptors and watchdog (M043-1).
- [x] T005 Failing synthetic tests: descriptors, independent roles, leases/ports, wrong backend/model, cancellation/staleness, sticky failure, parent SIGKILL (M043-2).
- [x] T006 Implement `ManagedSpeechService` and `managed-speech.worker.mjs`; wire Connect/auto-connect/Off/session/shutdown and SessionManager post-commit callback; verify worker is packaged (M043-3, M043-4).
- [x] T007 Opus review corrections F1–F4/Q2: server scope independent of turn router, SIGHUP trap, retirement settlement, transient probes, closing-window fences (M043-6..8).
- [x] T008 Three local native acceptance cases (STT, TTS, combined); disclose and record owner acceptance of auxiliary downloads (M043-9).

## Phase 3 — US3 Server-default voice (1.1.1)

- [x] T009 Failing config/merge, HTTP-omission, persistence/reopen and tool regressions (15 failures) (V044-2).
- [x] T010 Implement validation/merge, persistence allowlist, `configure_wa_tts` schema; actual-entry `server-voice` RPC case (V044-3, V044-4).
- [x] T011 Malformed-descriptor one-time notice after Opus F3 (two failing tests first); managed TTS + default-voice coverage; CrispASR guide examples and cache-preparation docs (V044-6..10).

## Phase 4 — US4/US5 Protected spoken replies and synthesis budget (1.1.2)

- [x] T012 Failing coordinator/entrypoint (17) and real-Pi `spoken-guard` RPC regressions (S047-1).
- [x] T013 Captured-protection query, shared mode resolver, canonical pre-send refusal, late alias / final-transport fencing via optional predicate argument (S047-2, S047-3).
- [x] T014 Opus F1: legacy-attachment eligibility via `router.canFinalize` (seven failing cases first); N1/N2 test hardening; N3 roadmap provenance (S047-7, R048-2).
- [x] T015 180-second `TTS_SYNTHESIS_TIMEOUT_MS`: three deterministic default-budget cases, failing against the old 60-second source copy (R048-7).

## Phase 5 — US6 Decorative separators (1.1.3)

- [x] T016 Twenty synthetic parser/coordinator cases (17 failing first); one regex alternative (S049-1..3).
- [x] T017 Opus notes: precise test naming, two 2,000/2,001 code-point boundary cases, raw versus cleaned budget wording (R050-2).

## Phase 6 — US7/US8 Owner guidance and settings menus (1.1.4)

- [x] T018 Failing phone-denial and four-locale navigation tests (10) plus `owner-guidance` RPC; string-only fix (O052-1..4).
- [x] T019 Failing Voice/menu/router regressions (10); chat-first Voice, Advanced settings, scoped Back/Cancel, precise phone refusals (U001–U004).
- [x] T020 Opus proposal and final reviews; three navigation/expiry/Recents findings fixed after four failing regressions; focused re-review OK (U005).

## Phase 7 — US9 npm 12 release tooling (1.1.4)

- [x] T021 Failing pack-result regressions (10) for npm 12 keyed object and malformed shapes; bounded parser fix preserving npm 11 (N001–N003).

## Cross-cutting

- [x] T022 Current behaviour documented in [README](../../README.md), [reference](../../docs/reference.md), [CrispASR guide](../../docs/crispasr.md) and [changelog](../../CHANGELOG.md).
- [x] T023 Consolidate former records 040–054 into this folder; release/documentation-only records folded into the changelog (2026-11-02).
