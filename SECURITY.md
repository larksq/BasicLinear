# Security policy

## Supported versions

The current `0.1.0` tree is a pre-release candidate. After publication, the
latest released minor version will receive security fixes. Older versions will
be assessed case by case until a longer-term support policy is published.

## Reporting a vulnerability

Do not open a public issue or include exploit details in public project
artifacts. Use [GitHub private vulnerability reporting](https://github.com/larksq/basiclinear/security/advisories/new).
Include the affected version or source revision, deployment topology,
reproduction steps, impact, and any known workaround. Exclude real user data
and credentials.

Maintainers should acknowledge the report privately, establish severity and
scope, coordinate a fix and disclosure window, and publish a security advisory
when affected users need action.

## Credentials and repository checks

Run `npm run audit:secrets` before proposing or publishing changes. It scans
reachable Git history, the index when staged changes exist, and tracked plus
non-ignored working files. Findings report locations and rule names without
printing secret values. CI runs the same check with checksum-pinned Gitleaks.
See [the release guide](docs/operations/open-source-release.md) for installation.

Keep actual environment files, service-account keys, browser traces, databases,
backups, and generated private review exports outside the published source.
Git, Docker, and Vercel exclusions protect common local paths, but do not remove
anything already committed. Firebase browser configuration identifies a project;
server credentials and signing secrets must remain in a secret manager.

If a real credential is committed, revoke or rotate it first. Removing it from
the latest tree is insufficient: assess all affected branches, tags, artifacts,
and previously shared copies before deciding whether history cleanup is needed.
