# CT-89 Implementation Session

- Issue: `CT-89`, stable ID `6da5c3bf-ecc4-471c-987c-ec3990823940`, created at revision `1`, implementation revision `2`, intended completion revision `3`.
- Session: `CT89-IMPLEMENT-20260821T094341Z`.
- Actor: `codex-release-tooling`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser, Google account, Docker, PostgreSQL server, database URL, or external identity was used.

## Finding

The release pipeline represented technical evidence completeness and accountable approval as one boolean. Consequently, complete but unreviewed notices, asset declarations, and public-copy declarations were reported as technical failures. The notice generator also left every lockfile record at `pending_artifact_classification`, and the provenance generator preserved any unchanged entry even when its approval fields were malformed.

## Implementation

1. Classified every non-link `node_modules` lock record from npm lock metadata into a bounded runtime, development, optional, or peer scope.
2. Bound the generated notice document, lockfile, canonical entry set, declared licenses, installation evidence, and local license/NOTICE files by SHA-256.
3. Generated non-empty origin, source reference, rights basis, size, and hash fields for every current asset and public-copy file.
4. Preserved only valid approvals for byte-identical entries; changed or malformed entries reset to `pending` with a null reviewer.
5. Split audit semantics into `FAIL` for missing, stale, malformed, unexpected, or unclassified evidence; `BLOCKED` for technically complete evidence awaiting review; and `PASS` only for non-empty accountable approval.
6. Added focused coverage for PASS, BLOCKED, FAIL, approval preservation, approval reset, deterministic dependency classification, and generator non-self-approval.

## Verification

- Focused release-evidence regression: 1 file, 6 tests passed.
- Complete application regression: 56 files, 389 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,946 modules; no warning.
- Syntax: all three release scripts and the focused test passed `node --check`.
- Generated notices: 252 records, 0 missing declared licenses, 0 unclassified records.
- Generated provenance: 82 assets and 43 public-copy files; all technically complete and all deliberately pending accountable review.
- Real P-T22 audit: expected `NOT_READY`, with 6 PASS, 0 FAIL, and 8 BLOCKED controls.

## Boundary

This session completes the deterministic release-evidence tooling defect. It does not approve third-party notices, assets, copy, public identity, trade dress, the requested product name, a source revision, independent P-T21 runtime acceptance, the release candidate, or any product outcome. CT-3, CT-12, CT-13, and CT-82 retain those gates.
