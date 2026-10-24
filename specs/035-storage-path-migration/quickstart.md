# Quickstart: Migrate Extension Storage Path

> Historical pre-namespace record. Identifier-only references are normalized for this maintained tree; dated results/checksums still describe their original artifacts. Legacy names and paths are mapped in [README.md](../../README.md#fork-and-legacy-names); current namespace work is specified in feature 038.


## Goal
Verify WhatsApp-NG stores local data under the new agent extension home and preserves existing data.

## Setup
1. Start with an install that still has data in `<legacy-original-data-root>`.
2. Ensure `<legacy-previous-data-root>` does not exist yet.

## Verify Migration
1. Start the extension.
2. Confirm the new storage root is created.
3. Confirm existing auth, config, recents, and logs are still available.
4. Confirm new writes now appear only under `<legacy-previous-data-root>`.

## Verify Clean Install
1. Remove both storage roots.
2. Start the extension.
3. Confirm only the new storage root is created.

## Expected Result
- No manual folder copy required.
- Legacy data remains usable.
- New runtime data uses the new path.
