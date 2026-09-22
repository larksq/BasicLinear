# BasicLinear documentation

This directory contains the maintainers' technical and product documentation.
The root [README](../README.md) covers the online app, local installation,
features, and current screenshots. The live site is
[basiclinear.qiaosun.me](https://basiclinear.qiaosun.me/).

## Start here

- [Local architecture](./architecture.md) explains the local runtime, package
  boundaries, request flow, and persistence model.
- [Local configuration](./configuration.md) lists supported environment variables,
  default paths, security constraints, and local data ownership.
- [Status](./status.md) records the local v0.1 candidate, deployed online v0.2
  implementation, product boundaries, and current technical release readiness.
- [Recovery runbook](./operations/recovery.md) covers backup, export/import,
  verification, restore, upgrade, and rollback.
- [Hosted operations](../ops/hosted/README.md) covers the online environments,
  provider configuration, and links to runtime, recovery, and billing runbooks.
- [Local v0.1 evidence](./product/versions/v0.1.0/README.md) and
  [online v0.2 evidence](./product/versions/v0.2.0/README.md) contain the governed
  discovery, implementation, and testing records.
- [Release preparation](./operations/open-source-release.md) covers secret
  scanning and the technical publication checks.
- [Screenshot capture notes](./screenshots/README.md) record the build and
  sample-data sources used in the README.

## Documentation rules

- Root README instructions must work from a fresh checkout with Node 24 and
  npm 11.
- Distinguish local Node/SQLite instructions from hosted Firebase/Firestore,
  Vercel, and Cloud Run instructions. Historical planning artifacts do not
  override current configuration or establish that a service is deployed.
- Product status must distinguish implemented behavior, tested evidence,
  planned work, and current technical release checks.
- Never store credentials, browser profiles, private workspace exports, or
  unredacted user data in this tree.
