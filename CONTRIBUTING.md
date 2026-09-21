# Contributing

This repository is in a governed pre-release stage. The sponsor selected `AGPL-3.0-only`, and the root and workspace metadata now declare that license. The public product identity and contribution intake route are still under qualified review, so outside contributions must not be solicited or merged yet.

## Development workflow

Use Node 24 and the npm version declared in `package.json`. Describe the problem,
scope, and validation in the proposed change. Maintainers can associate that
proposal with the private planning ledger; contributors do not need access to
that database. Run:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Hosted storage changes also require the Firebase CLI and a compatible Java runtime:

```sh
npm run test:hosted-rules
npm run test:hosted-transactions
```

These suites run against the isolated `demo-openlinear` Firestore emulator. The
transaction suite covers lazy defaults, retries, concurrent creation, and rollback.

Changes to release controls must also run:

```sh
npm run test:release-audit
npm run test:secret-audit
npm run audit:secrets
npm run audit:release
```

The release audit intentionally fails while a protected decision or required artifact is unresolved.
The secret checks require Gitleaks; installation and the release sequence are
documented in [the release guide](docs/operations/open-source-release.md).

## Change requirements

- Add focused tests for changed behavior and broader tests when a shared contract changes.
- Keep database migrations append-only and preserve workspace isolation, revision conflicts, export/import compatibility, and recovery behavior.
- Do not submit copied source, logos, private assets, authenticated reference captures, account data, credentials, or text whose provenance cannot be established.
- Record the origin and rights basis for every new image, font, icon set, and user-visible copy source in the release provenance manifests.
- Do not weaken accessibility, responsive behavior, keyboard operation, security boundaries, or deterministic build inputs to make a check pass.
- Treat implementation completion, release readiness, and validated product outcomes as separate claims.

Security vulnerabilities must follow `SECURITY.md`, not a public issue. Public contribution acceptance remains disabled until CT-3 clears the product identity and CT-13 accepts the release candidate and reporting route.
