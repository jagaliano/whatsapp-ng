# Decorative separators in spoken replies

## Problem and evidence boundary

The owner supplied an answer containing standalone Unicode horizontal rules and an imperfect WhatsApp audio transcript, and requested a small speech-filter extension. An isolated synthetic source probe confirms `cleanSpeechText` forwards `────` lines, unlike existing Markdown `---` rules; the final-output coordinator passes that spoken copy to synthesis. Existing tests cover Markdown rules but not Unicode decorative equivalents.

This proves unwanted formatting can reach synthesis, not that every garbled transcription token was spoken by Fish or caused by a separator. No private session dump, live audio/provider call or news-fact assessment is needed or authorized as validation. Use synthetic prose, not the supplied conversation as a fixture.

## Requirements

- Remove standalone runs of at least three horizontal-rule glyphs (`─━╌╍┄┅┈┉═–—`), optionally separated by spaces/tabs, only from the spoken copy. Preserve paragraph separation using the existing Markdown-rule behavior.
- Retain ordinary prose, numbers, dates/abbreviations, names, approximation signs, URLs, short dash runs and inline punctuation. Do not rewrite pronunciations, summarize or expand dates heuristically.
- Keep original displayed/saved answers unchanged. Preserve code/table/link rejection, indentation safety, consent, routing, character/byte/deadline limits and delivery/fallback semantics.
- Add failing synthetic parser and final-coordinator regressions before changing production code. Verify Voice/Both/audio-Mirror provider input and unchanged Both text.
- No dependency, settings, version, Git/publication, live-reload or provider-operation permission is implied.

## Delivery decision

After source validation, the owner explicitly selected a local commit of the ten task files. Push, publication, reload and live synthesis remain unauthorized by that choice.

## Acceptance

Synthetic standalone rules never appear in prepared speech; meaningful punctuation survives; surrounding code/table/link content remains text-only where already required. Existing Markdown behavior remains intact. Focused and broader isolated source checks and static links/diff validation are recorded separately from unperformed live listening/transcription acceptance.
