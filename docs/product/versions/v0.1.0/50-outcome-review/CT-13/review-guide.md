# CT-13 Accountable Release Review

Status: reviewer procedure; no approval recorded

## Boundary

This procedure prepares and validates an accountable release decision. It does not select a public identity, provide legal advice, approve provenance, authorize a release, or validate an outcome.

The final reviewer must be a real person who is qualified for the scope they accept. Codex and the preparation scripts must not invent reviewer identity, qualification, jurisdiction, review time, or acceptance.

CT-13 acceptance does not override either upstream gate:

- CT-3 must separately record the qualified license, identity, trade-dress, screenshot, reference-measurement, clean-room, contribution, asset, and notice disposition. The current OpenLinear final-product name remains uncleared.
- CT-12 must separately accept the required current Chrome UAT, accessibility, responsive, and visual matrices. The latest independent P-T21 result binds only historical revision `f7c3625`; residual P-T18, third-party P-T19, authorized live P-T20 System verification, distinct CT-117 review, and fresh qualification for exact product revision `d524c5c` remain open.

## Review Sequence

1. Resolve CT-3 and CT-12, record any remediation in project-local Control Tower, and commit the resulting candidate. Do not use Linear for task authority.
2. Run `npm run prepare:release-provenance`. This preserves an existing approval only for an unchanged, complete entry and returns changed or malformed entries to `pending`.
3. Review every record in `ops/release/asset-provenance.json` and `ops/release/copy-provenance.json`. An approved record needs `review_status: "approved"` and a non-empty `reviewer`; the manifest needs `status` and `review_status` set to `approved` only when every record is approved.
4. Review `THIRD_PARTY_NOTICES.md` and `ops/release/third-party-notices.json`, including installed dependencies with only declared-license evidence and dependencies absent from the inventory host. Record `status: "approved"`, `review_status: "approved"`, and a non-empty `reviewer` only after the shipped-artifact notice obligations are accepted.
5. Commit the reviewed manifests, ensure `git status --porcelain` is empty, then run `node scripts/prepare-release-review.mjs`. The command writes only `ops/release/review-request.json`; it never creates acceptance.
6. Inspect the generated request. It binds the candidate source digest and the exact CT-3, CT-12, policy, license, package, lockfile, dependency, build, notice, asset, and copy evidence hashes. Every non-final audit row is included with its current status.
7. If the request is acceptable, manually create `ops/release/review-acceptance.json` using the contract below. Use the exact request-file SHA-256 printed by the preparation command.
8. Run `npm run audit:release`. A missing acceptance remains `BLOCKED`. A missing, malformed, incomplete, or stale request or acceptance is `FAIL`. `READY` is possible only when every audit row passes.

## Acceptance Contract

The required scope array is deliberately exact and ordered. Placeholder values below are not acceptance and must be replaced by the reviewer.

```json
{
  "schema_version": "release-review-acceptance-v1",
  "issue": "CT-13",
  "status": "accepted",
  "reviewer": {
    "name": "REQUIRED_REAL_NAME",
    "role": "REQUIRED_ACCOUNTABLE_ROLE",
    "qualification": "REQUIRED_SCOPE_QUALIFICATION"
  },
  "reviewed_at": "YYYY-MM-DDTHH:MM:SSZ",
  "jurisdictions": [
    "REQUIRED_REVIEW_JURISDICTION"
  ],
  "request_sha256": "REQUIRED_64_CHARACTER_SHA256",
  "accepted_scopes": [
    "asset_provenance",
    "copy_provenance",
    "public_identity_and_clean_room",
    "public_release_candidate",
    "third_party_notices"
  ],
  "notes": "Optional public limitations or remediation references."
}
```

The audit verifies the request file against the current source and evidence before verifying acceptance. Changing candidate source, policy, test results, decision records, notices, build inputs, or provenance invalidates the request. Changing the request invalidates its acceptance. The generated request and human acceptance are excluded from the candidate digest to avoid a circular hash, but both remain part of the public source walk and private-artifact scan.

## Current State

No acceptance file exists. The accountable review remains open. Do not tag, push, publish, announce, or claim O-005 until the current audit is `READY` and the local Control Tower issue is reconciled by its accountable owner.

## Current State Refresh: 2026-08-23

CT-12 Testing is independently passed for exact revision `5a33d28be383b7651a4b0d6156534aa12cc423fa` on the bounded one-owner local surface. CT-3 remains a Todo qualified identity/legal gate. The current P-T22 audit is `NOT_READY` at 8 PASS / 0 FAIL / 6 BLOCKED; no accountable acceptance file exists. This procedure remains non-approving.
