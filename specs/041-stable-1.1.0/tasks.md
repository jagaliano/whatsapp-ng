# Stable promotion tasks

Derived from [plan.md](plan.md). This is the tracked pre-commit checkpoint; later results belong to receipts bound to its actual commit.

- [x] S041-1: confirm explicit stable/latest authorization, clean baseline, absent stable version and authenticated listed maintainer after operator login.
- [x] S041-2: promote version/channel using the guarded command and update current release guidance without runtime/dependency changes.
- [ ] S041-3: validate/scan the release diff and commit/push coherent source.

After committing: run clean-commit preparation, exact-artifact and isolated consumer/Pi qualification, and main CI. Then invoke the guarded authorized publication once; verify registry integrity/latest and unchanged next, followed by exact-registry-artifact installation. Preserve actual results in the stable completion/attempt receipts rather than modifying this source checkpoint after preparation. Publication failure or uncertainty does not authorize retry, attempt-marker deletion, tag manipulation or a replacement package version.
