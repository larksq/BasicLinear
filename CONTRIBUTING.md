# Contributing

BasicLinear welcomes contributions under the repository's `AGPL-3.0-only`
license. Keep each change focused and include the validation needed to show its
behavior.

## Development workflow

Use Node 24 and the npm version declared in `package.json`. Describe the
problem, scope, and validation in the proposed change. Run:

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

These suites run against the isolated `demo-basiclinear` Firestore emulator.

Changes to release controls must also run:

```sh
npm run test:release-audit
npm run test:secret-audit
npm run audit:secrets
npm run audit:release
```

## Change requirements

- Add focused tests for changed behavior and broader tests when a shared contract changes.
- Keep database migrations append-only and preserve workspace isolation, revision conflicts, export/import compatibility, and recovery behavior.
- Do not submit copied source, logos, private assets, authenticated reference captures, account data, credentials, or text whose provenance cannot be established.
- Record the origin and rights basis for every new image, font, icon set, and user-visible copy source in the release provenance manifests.
- Do not weaken accessibility, responsive behavior, keyboard operation, security boundaries, or deterministic build inputs to make a check pass.
- Treat implementation completion, release readiness, and validated product outcomes as separate claims.

Security vulnerabilities must follow [SECURITY.md](SECURITY.md), not a public issue.
