# BasicLinear open-source release

This guide prepares a technical release candidate for BasicLinear. The release
pipeline runs entirely from current build, test, provenance, dependency,
secret-scan, and runtime evidence; it does not wait for a named maintainer,
reviewer, or external approval.

## Secret scan

Install the [Gitleaks 8.30.1 CLI](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
for your platform and verify the release archive against its published checksum.
Place `gitleaks` on PATH or set `GITLEAKS_BIN` to the executable's absolute path.
CI pins the Linux archive's SHA-256 directly in its workflow.

```sh
npm run test:secret-audit
npm run audit:secrets
# Optional local, redacted evidence; this directory is excluded from publication.
npm run audit:secrets -- --report .local-data/release/secret-scan.json
```

The audit checks every reachable commit, staged content when present, and
tracked or non-ignored working files. It rejects shallow history, unresolved
index entries, symlinks, submodules, and private publication paths. Do not
publish a ZIP of the working directory or force-add `.env`, `.vercel`,
`.control-tower`, `.playwright-mcp`, `.local-data`, backups, or `outputs`.

## Verify the candidate

Use the Node and npm versions declared in `.nvmrc` and `package.json`:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:release-audit
npm run test:secret-audit
node --test scripts/tests/public-search.test.mjs scripts/tests/analytics-privacy.test.mjs
npm run audit:secrets
git diff --check
```

The default test run excludes the Firestore emulator suite. Hosted changes also
need the provider checks in the hosted runbooks. A local build does not prove
production credentials, payment setup, or cloud permissions.

## Refresh technical evidence

```sh
node scripts/prepare-release-metadata.mjs
npm run prepare:third-party-notices
npm run prepare:release-provenance
npm run audit:release
```

The generated manifests must be complete and hash-bound to the current
candidate. Run the secret scan again after staging so the exact index is
checked, then commit the candidate.

## Publication checklist

- Confirm `npm run audit:release` reports `READY`.
- Confirm a current clean-host, network-denied runtime result for the frozen
  release.
- Confirm the public repository, security-reporting route, and BasicLinear
  public origin are reachable.
- Inspect the complete staged diff and rerun the full-history secret scan.
- Run CI on the exact revision before creating the release and attaching
  artifacts.
