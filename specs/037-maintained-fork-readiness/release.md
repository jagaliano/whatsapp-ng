# M5 prepare-only release handoff

**State:** prepared, not published. The owner explicitly selected preparation only; `private: true` remains. M5 publication/registry verification is incomplete. No Git commit/push or registry publication was performed by this preparation.

## Candidate

- Identity: `whatsapp-ng@1.1.0-rc.1`; intended future tag `next`, not `latest`.
- Reviewed runtime base: `32f839b6ec9e63696f30db23694155abe505b85c`.
- Local guarded tarball: **38 entries**, SHA-1 **`c8cca54011df535ee3097f281eff4a837a5cc98d`**.
- Changes after the base are release documentation only. All packaged runtime/entry/manifest bytes match the M3/M4-qualified artifact; dependency and lockfile bytes are unchanged. The new checksum reflects updated README/security/licensing/changelog text, not a runtime change.
- MIT terms, upstream/owner attribution, third-party dependency inventory, support/security route and non-lossless rollback guidance are included. No caches, tests, specs, credentials, archives, dependency tree or service installer is packaged.

## Preparation evidence

- Fresh isolated `npm test`: **466 passed / 49 files, zero pending**; `npm run lint` and `npm run typecheck`: exit 0. No build script is declared.
- Source full/production and actual installed-consumer `npm audit`: **zero vulnerabilities**. This is time-scoped registry-advisory evidence, not native-code certification.
- On macOS / Node **26.12.1** / Pi **1.3.0**, actual Pi-managed local-tarball install/discovery/remove/reinstall and automatic RPC `get_state` passed: **7 object-schema tools, 1 command, zero loader errors/warnings and zero physical host-peer shadow copies**.
- Installed native-auth smoke generated/saved only fresh unlinked fixture credentials, verified private 0700/0600 modes, constructed no socket and removed the fixture. Synthetic HOME/agent directories protected real settings/auth; no live WhatsApp operation occurred.
- Prior Linux amd64 M3 runtime/native qualification and bounded M4 live evidence remain explicitly historical; this documentation-only tarball was not newly installed on Linux and no additional live-account testing was performed.
- Read-only public npm name lookup returned **E404**. It does not reserve the name or prove future first-create permission. No login/token/global configuration changes were made.

## Remaining authorized-release steps

1. Obtain explicit approval to publish publicly; preparation approval does not suffice.
2. Refresh namespace/version availability and authenticated npm identity/email/2FA/write readiness. Stop on permission/name conflicts; do not change identity or work around restrictions.
3. Make only the approved private-guard/release-documentation/guard-test changes, commit the approved release source, rerun required gates and pack again. Removing `private` changes the artifact: **the guarded checksum above must not be presented as the future published checksum**.
4. Only then publish the reviewed artifact explicitly under `next`, verify registry version/tag/integrity and install that exact registry artifact in a fresh Pi HOME without real credentials. Record the final artifact/commit and support/rollback limitations.
5. Keep stable promotion separate. An observation window has not yet been selected; the owner must choose it and accept compatibility/security/live limits before any stable/default-tag change. No automatic promotion or destructive data rollback.
