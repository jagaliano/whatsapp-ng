# LID identity clarity and voice incident

## Diagnosis

The referenced session showed successful explicit `send_wa_message` calls for audio requests. Those sends intentionally cover the owning chat and suppress automatic finalization, which owns automatic speech. Keep this duplicate-prevention contract; do not silently add a second text/voice send.

The historical preferences also contained a bogus phone-JID entry made from LID digits. However, global mode and both overrides were Mirror. Replacing that entry's suffix alone does not change the effective policy. The session did not establish a live resolver failure or that the Voice picker created the malformed entry. Verified PN/LID matching and explicit LID selection already work; legitimate phone-keyed preferences should not be removed just because the observed transport uses LID.

Confirmed ambiguity: incoming prompt labels discarded JID domains, and manual Owner entry accepted bare digits as phone identifiers. Digits alone cannot distinguish a phone from a LID; no heuristic or alias inference can safely repair that.

## Owner-approved fix

- Preserve complete transport JIDs in direct/group sender labels. These remain display content, never routing/authorization evidence.
- Manual Owner input requires a valid +E164 phone number or a full person JID; reject ambiguous bare digits and malformed phone input before confirmation or persistence. Keep explicit LID/phone selections and clearing behavior.
- Update English, Portuguese, Spanish and French input/error guidance. Preserve the shared normalizer's legacy phone-number semantics for existing programmatic callers.
- Do not modify the resolver, preferences, login, provider consent, explicit-send suppression or live process. No automatic migration/deletion of existing preferences.

## Validation actually run

- Isolated characterization using real helpers and Voice/Owner UI: verified phone preferences apply to LID, bogus same-digits phone remains distinct, historical rekey leaves Mirror unchanged, explicit LID survives the picker; pre-fix manual bare digits were accepted.
- Actual production-entry `pi -e` self-LID RPC: with global Text, verified-phone override Mirror and bogus same-digits-phone override Text, `/status` reports Mirror. Synthetic auth/transport, blocked network and no model inference/speech request. This characterization also remains in the maintained RPC test.
- Seven regressions failed before production correction: three namespace-bearing header checks and four ambiguous/invalid manual Owner inputs. Added positive checks for +E164, full phone/LID JIDs and LID preservation in both pickers.
- `python3 .pi/cache/lid-voice-diagnosis/run-gates.py focused`: **203 passed**, lint/typecheck passed.
- The first full run exposed two older assertions expecting domain-stripped headers; their expected display strings were updated to the intended full JIDs, without weakening ownership assertions.
- Final `python3 .pi/cache/lid-voice-diagnosis/run-gates.py full`: **1137 passed / 79 files**, zero failures/skips; `npm run lint` and `npm run typecheck` passed. `npm pack --dry-run --json --ignore-scripts`: **57 entries**, no tests/runtime caches. `git diff --check` passed and nothing was staged. Manifest/lockfile and shared normalizer bytes are unchanged. Exact command arrays/results, pre-fix source snapshots and filtered diagnosis are retained under `.pi/cache/lid-voice-diagnosis/`.

No dependencies changed. No independent reviewer or universal platform qualification is claimed for this small fix. No live WhatsApp settings, credentials or conversation archive were inspected/changed by this fix; only relevant filtered historical Pi session facts were inspected. No messages/provider requests, reload, Git delivery or publication were performed.

## Optional owner-controlled self-chat check

After the owner's chosen source reload, a new self-chat request should show its full JID in the Pi prompt. In terminal Owner manual entry, bare digits should show an actionable error without changing the existing owner; cancel/back afterward. Do not clear valid phone preferences or retype a LID as a phone. For speech, use a short voice note with Mirror enabled and let the automatic answer deliver—no text-send tool. Existing approved destination/modes remain unchanged; no other participant is required. Group/separate-participant live checks stay deferred as requested.
