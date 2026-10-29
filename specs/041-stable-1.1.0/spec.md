# Stable 1.1.0 promotion

On October 29, 2026 the maintainer explicitly requested: “promote to 1.1.0 and publish as latest”. This supersedes RC2's prepare-only publication boundary, not its dated evidence or runtime contracts.

- Promote the reviewed source at `96c9670609fe716ac3e05055c5e2522b3911eb45` through the existing guarded version command. No runtime, dependency, keyword or permission changes.
- Synchronize package/lock version and `publishConfig.tag=latest`; update current install/release/changelog guidance while preserving historical records.
- Qualify a new immutable stable artifact from clean committed source. The RC2 receipt is not transferable to another version or commit.
- Verify maintainer authentication and absence of `1.1.0`; publish the prepared bytes exactly once through the normal npm terminal authentication/2FA flow.
- Verify registry integrity and `latest=1.1.0`; leave `next` unchanged. Do not retry an uncertain attempt.
- No Git release tag, GitHub release, automation activation, real WhatsApp/provider calls or new global dependencies are included.

Stable labeling does not expand the existing platform/live acceptance scope, remove inherited SDK/Undici findings, grant an SLA or guarantee search/catalog visibility. The operator was informed of these limits before choosing stable promotion. Fresh production audit findings or integrity/currentness failures still stop publication.
