# C3 optional tool images and terminal answers

**Later review:** Exact Sonnet 5.5 independently reviewed C2/C3; the parent corrected three confirmed findings and validated 1078 tests. See [review and diagnostic dispositions](c2-c3-review.md). Earlier no-review statements below describe the implementation checkpoint, not the current review status.

## Scope and owner decision

Implemented in `/Users/jagaliano/workspace/whatsapp-ng-release`, preserving A/B/C1/C2 work. The owner selected **verified owner's private chat only** for optional terminal forwarding. Neither feature is enabled automatically; no real settings were changed. C2's prior owner-confirmed native group mention/reply result remains separately scoped in [its record](c2-validation.md).

## Implemented contract

- Terminal `/whatsapp` → **Optional outputs** uses the existing menu/dialog APIs. Each enabled image tool requires explicit confirmation. Terminal forwarding requires a connected account, a configured allowed private owner and a workspace-information warning/confirmation. No model tool or phone command enables either feature.
- Additive global `optionalOutputs` settings live in existing `SessionManager` configuration. Tool names and owner/account consent are validated, defensive copies are returned, guarded atomic writes share the existing queue, malformed originals survive unrelated saves, and owner changes clear terminal consent. No login/archive migration or dependency changes.
- Preferences are captured at actual input consumption. Enabling midway cannot export prior work. Each projection requires current account/runtime, routing/admission, connection, pause and settings authority; terminal routing additionally revalidates owner/destination and its captured pause/admission key. Owner groups, group-only-binding bypasses, gateway redirects, previous-chat fallbacks, unknown/mixed input and reconstructed history cannot authorize terminal forwarding.
- Auto-images require matched start/end events for an individually selected exact tool name, a successful completed image content block and a verified WhatsApp-owned frame. No URLs, paths in text/details, arbitrary filesystem discovery, partial updates, error outputs, thinking or terminal screenshots are projected. This does not create a screenshot tool: a selected tool must actually return inline image content.
- At most **4 images / 25 MiB aggregate per consumed input**, **32 inspected result blocks**, **256 pending tool references**, and **4 outstanding uploads** across inputs. SHA-256 image hashes are reserved before awaits; repeated/parallel image results and delivery-unknown outcomes are not replayed. Source bytes are strict canonical base64 with supported image MIME/signature matching; `OutgoingMediaService.prepareImage()` privately stages them, then uses the existing validation/thumbnail/immutable-snapshot path. Staging is removed before return; the upload snapshot remains until sender settlement, including a deferred unknown result.
- Terminal forwarding projects only eligible completed assistant text, at most **64 KiB**, to the explicitly consented owner/account. It does not assign a WhatsApp target to local input or affect the normal terminal answer. No raw thinking/tool-result streams, images, voice synthesis, stats or extra model calls are added. Existing explicit-text/in-flight/unknown send suppression prevents a second owner answer. Sent text follows normal WhatsApp archive retention; consent is not a redaction guarantee for assistant answers containing workspace information.
- Both paths reuse owned-send purpose/outcome tracking, account/session guards, cancellation and secret-free history recording. Settings changes revoke unsent work; abort/reset never retries it. Already-issued network effects cannot be recalled, and acceptance is not recipient delivery proof.

## Executed validation

All tests used temporary HOME/agent directories, `PI_OFFLINE=1` and a minimal environment without inherited credentials. No production settings/auth files were read or changed.

- New service tests failed before implementation because the new service did not exist. This is a new-feature baseline, not a claimed pre-existing defect. Local receipt: `.pi/cache/c3/baseline-results.json`.
- Parent inspection found that the initial terminal limit counted UTF-16 units instead of UTF-8 bytes. A non-ASCII answer regression failed before correction (`utf8-baseline-results.json`); the final implementation uses `Buffer.byteLength` and the regression passes. This is a parent correction, not an independent reviewer verdict.
- `npm test -- tests/unit/optional-output.service.test.ts tests/unit/optional-output-settings.view.test.ts tests/unit/session.manager.test.ts tests/unit/outgoing-media.service.test.ts tests/unit/whatsapp-ng.message-end.test.ts tests/unit/menu.handler.test.ts --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c3/focused-results.json` → **139 passed / 6 files**, no failures/skips.
- `npm test -- --maxWorkers=2 --reporter=json --outputFile=/Users/jagaliano/workspace/whatsapp-ng-release/.pi/cache/c3/full-results.json` → **1072 passed / 78 files**, no failures/skips.
- `npm run lint`, `npm run typecheck`, `git diff --check` → exit **0**.
- `npm pack --dry-run --offline --ignore-scripts --json` → exit **0**, **55 files**, no tests/cache/auth/runtime payload. This is a contents dry run, not a new tarball/clean consumer install qualification.
- Manifest and lockfile digests match the pre-C3 snapshot. No build script exists; no build was run. No new install, dependency audit or cross-platform qualification was performed because dependencies are unchanged and those operations were not requested.

The full suite includes **seven actual production-source `pi -e` RPC scenarios**, two added for C3. They use synthetic WhatsApp sockets/provider streams, fresh generated test auth and blocked network:

- **Images:** source UI confirms one tool, its two identical image blocks produce one privately prepared group image, terminal image tasks remain local even after tool opt-in, and the ordinary final group explanation is still delivered. Exactly six ordinary fixture provider requests across three two-turn tasks; no extra model call. No actual screenshot or WhatsApp upload occurred.
- **Terminal:** consent is enabled while an earlier input is paused after native consumption; that answer is not exported. A new terminal answer reaches only the configured private owner, a WhatsApp group answer stays in its group, and a later local answer stays local after disabling forwarding. Exactly four ordinary fixture provider requests; zero network attempts.
- Earlier control, poll, stats, group-admission and self-LID echo fixtures remain green. These are source/native lifecycle tests, not live rendering/delivery certification.

Unit coverage also checks invalid/group consent, preserved malformed configuration, guarded/stale commits, owner change-and-return revocation, dialog refusal/missing owner/stale session, URL/path/error exclusions, deduplication, byte/count bounds, deferred snapshot settlement, cross-input outstanding-upload bounds, stale preparation disposal, complete-final eligibility and uncertain explicit-send suppression. Real image preparation verifies private file mode and staging/snapshot cleanup.

## Live gate — terminal PASSED; automatic images OPEN

The owner subsequently exercised terminal forwarding and its disable path. The terminal request `C3 terminal test: reply exactly C3-OK` produced `C3-OK`; after disabling forwarding, `Reply exactly C3-OFF` produced `C3-OFF`. The owner confirmed “Yes all fine” against the instructed expectations: the enabled answer remained local and reached the private owner, not the test group; the disabled answer stayed local. This is owner-attested client acceptance, not independent delivery telemetry.

The terminal-forwarding/disable live gate is closed for that bounded scenario. Automatic image projection and terminal-image isolation remain open. No independent review, automatic live test, additional settings mutation, commit, push or publication is claimed. No reminder/send is scheduled automatically.

**Owner-deferred:** The owner explicitly postponed the remaining automatic-image test. Automatic image projection and terminal-image isolation remain OPEN, not failed or accepted. A harmless generated 256×256 four-colour PNG is retained locally at `.pi/cache/c3/live-public-image.png`; it has not been uploaded. Resume only on an explicit owner request, after confirming current settings and allowed destination. The intended test enables only `read`, uses a native mention from another participant in the configured group, reads this fixture without any explicit WhatsApp sending tool, and checks one automatic image plus an explanation. Then verify a terminal image read stays local. Do not schedule a reminder, send the fixture, enable/disable settings or reload automatically. Terminal-forwarding/disable acceptance remains unchanged.

Remaining owner-controlled checks (terminal steps are retained for reproducibility):

1. Reload the existing instance normally; do not create a competing connection. Confirm **Optional outputs** is initially off.
2. For terminal text, use the connected configured private owner and explicitly confirm forwarding. Ask a harmless terminal question; check one answer reaches that private owner, not the group. Do not run private workspace tasks during the trial. Disable forwarding afterwards and confirm another local answer stays local.
3. For images, explicitly approve one known tool that returns inline image blocks. In a verified allowed WhatsApp-owned request, use only a harmless public/generated image and check one image plus the normal explanation. Check a terminal run does not forward that tool's images. Disable image projection afterwards if not wanted.
4. Record only observed client results. Other tool formats, other clients/groups, live cancellation/unknown-delivery behavior and broader platforms remain unverified unless separately exercised.
