# Release plan

1. Verify main/origin, source scope, npm version absence/authentication, hooks and publication-attempt state.
2. Run isolated checks/audits and scan the explicit public candidate. Commit approved feature/docs source on main so the guarded version command can run on a clean tree.
3. Run `npm run release:version -- 1.1.1`, update changelog/records and validate version-only package/lock edits. Commit and push reviewed source using existing conventions; no history rewrite or tag.
4. On clean committed source, run `npm run release:prepare`. Qualify the exact artifact in a disposable consumer with scripts disabled, no host peer shadow copies and blocked-network Pi startup.
5. Verify authenticated maintainer and structured version absence, publish prepared bytes once under latest, then verify registry version/integrity/tags and installed artifact behavior. Authentication/2FA stays in the operator's terminal, never chat.

## Complexity Tracking

Two commits are required because the existing version command refuses dirty source. No guard is bypassed. Post-commit artifact/publish outcomes belong to local receipts; changing tracked records afterward requires new preparation. Existing ignored/missing historical records and inherited dependency/platform limits are not waived by publication.
