# OpenLinear documentation

This directory contains the maintainers' technical and product documentation.
The root [README](../README.md) is the user-facing installation and usage
guide.

## Start here

- [Architecture](./architecture.md) explains the runtime, package boundaries,
  request flow, and persistence model.
- [Configuration](./configuration.md) lists supported environment variables,
  default paths, security constraints, and local data ownership.
- [Status](./status.md) records what the v0.1 release candidate implements,
  what remains intentionally out of scope, and which release gates are open.
- [Recovery runbook](./operations/recovery.md) covers backup, export/import,
  verification, restore, upgrade, and rollback.
- [Versioned product evidence](./product/versions/v0.1.0/README.md) contains
  the governed Control Tower discovery, implementation, and testing record.

## Documentation rules

- Root README instructions must work from a fresh checkout with Node 24 and
  npm 11.
- Runtime claims must match the supported local Node/SQLite implementation;
  historical Docker or PostgreSQL artifacts are evidence only.
- Product status must distinguish implemented behavior, tested evidence,
  planned work, and release-gated decisions.
- Never store credentials, browser profiles, private workspace exports, or
  unredacted user data in this tree.
