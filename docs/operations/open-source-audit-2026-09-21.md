# Open-source preparation audit — 21 September 2026

The secret audit found no live credentials in reachable Git history or the
publication candidate. Technical preparation is complete for review; publication
is still pending the repository's existing reviewer acceptances and final
repository/reporting setup.

## Scope and findings

- Base revision: `928767ea12c59aca28b94e9bcb91bca03eb1febe`; all 144 reachable
  commits were scanned. The candidate also includes the existing uncommitted
  local/hosted work and the preparation changes from this audit.
- Gitleaks 8.30.1 scanned history and tracked/non-ignored working files with
  archive and encoded-value inspection. The repeatable command additionally
  scans the index when staged changes exist and includes merge diffs.
- The initial default scan produced 9 historical and 218 working-file
  indicators. Inspection identified artifact SHA-256 values, a container image
  tag, and deterministic test credentials/identifiers. Narrow contextual
  exceptions preserve scanning of documentation and test files.
- No sensitive environment, service-account, private-key, or database path was
  found in the historical path inventory. `.env.example` contains empty secret
  fields and configuration examples.
- Two ignored `.vercel/.env.*.local` files contain cached `VERCEL_OIDC_TOKEN`
  JWTs with expiration timestamps on 27 August 2026. They were never committed
  and remain excluded from Git, Docker, and Vercel uploads. No token values are
  included in this report. Firebase browser configuration is distinct from a
  service-account credential.
- Generated review exports under `outputs/`, including frozen private-ledger
  material and a local dependency symlink, are now excluded from publication.
  Original local files were preserved.

Pattern scanning cannot prove that every possible secret is absent. Ignored
private state is outside the publication candidate; image pixels, provider-side
permissions, and asset rights require their separate reviews.

## Preparation changes

- Added `audit:secrets`, regression tests, and a full-history CI job using a
  checksum-pinned scanner. Reports expose locations, never secret values.
- Added private artifact exclusions to Git, Docker, Vercel, and release inventory
  policy. Force-added private paths fail the secret audit.
- Updated Tiptap to 3.31.3 and Firebase Admin to 14.4.0. A scoped Gaxios-to-UUID
  override pins UUID 11.1.1; a local multipart-request test verifies compatibility.
  Other locked transitive versions were preserved during the UUID repair.
- Restored missing lockfile license metadata for `limiter@1.1.5` from its
  installed legacy `licenses[0].type` declaration (`MIT`) and bundled
  `LICENSE.txt`. Package version and tarball integrity are unchanged; the
  license-file hash is included in the notices inventory.
- Fixed the hosted stylesheet test to match its lazy import and quoted the
  Firestore database example so the documented shell setup parses correctly.
- Updated public setup/contribution/security documentation and added a
  repeatable metadata preparation command. Refreshed dependency notices,
  build-input hashes, asset/copy inventories, and draft review requests without
  creating reviewer acceptance.

## Validation

| Check | Result |
| --- | --- |
| Locked dependency installation | Passed |
| Full npm audit, including optional dependencies | 0 vulnerabilities |
| Workspace typechecking | Passed |
| Application tests | 810 passed across 130 files |
| Release-audit contract tests | 10 passed |
| Secret-audit regression tests | 6 passed |
| Public-search and analytics-privacy tests | 8 passed |
| Local and hosted builds | Passed |
| Fresh local database startup and built UI | Both returned HTTP 200 |
| Environment example shell syntax | Passed |
| History and publication-candidate secret scan | Passed |

The Firestore emulator suite, real-provider checks, image-pixel review, and a new
independent clean-host qualification were not performed in this audit. Existing
historical qualification evidence is not a fresh acceptance of this candidate.

## Remaining publication work

The release audit still requires qualified identity/clean-room review,
asset/copy and notice approval, and accountable release acceptance. The source
revision must be frozen and independently qualified. No Git remote is configured;
the public destination and a functioning private vulnerability-reporting route
must be established before publication.

All preparation changes remain uncommitted alongside the existing work. No push,
history rewrite, release tag, deployment, or publication occurred. Follow the
[release guide](open-source-release.md) to freeze and review the final candidate.
Machine-readable scan evidence is stored locally in the ignored
`.local-data/release/` directory and can be regenerated with `npm run audit:secrets`.
