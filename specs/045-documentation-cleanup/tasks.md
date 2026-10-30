# Tasks

- [x] D045-1: read README, all three guides and all seven plans 038–044; identify stale status and ignored 039 plan.
- [x] D045-2: shortened README, three guides and plans 040/041/043/044; retained concise 038/042 and ignored historical 039. Added explicit client-key export after a failing inheritance check; retained corrected HF/codec/default-voice/Mirror instructions.
- [x] D045-3: example construction/syntax and missing/single/non-exported client-key checks passed in Bash/Zsh; 182 local links/anchors (103 incoming) and whitespace passed. All 150 captured source/config hashes unchanged.

## Validation scope

Read all 11 requested documents/plans in full. Their word count fell from 25,119 to 20,042 (20.2%); this includes the unchanged ignored 039 plan. New cleanup records/index are outside that comparison. The ignored plan was not force-added.

Local example checks used disposable HOME/cache, synthetic credentials, a fake native executable and blocked external egress. Descriptors/client objects exercised current parsers; prefetch commands were syntax/argument-checked only. The client-export check failed before the documentation correction and passed afterward. Source/config hashes, changed-link targets and incoming anchors were checked against a pre-edit baseline; `git diff --check` passed.

No runtime test/lint/typecheck suite was rerun: this task changes Markdown only. No server, model download, live speech, settings change, delegation, dependency or Git/release action occurred. Private validation helpers are not shipped reproducible scripts.
