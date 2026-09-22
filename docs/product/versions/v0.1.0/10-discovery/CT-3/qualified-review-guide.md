# CT-3 Qualified Identity and Clean-Room Review

Status: reviewer procedure; no qualified decision recorded

## Boundary

This packet records a qualified review; it does not provide legal advice or infer clearance. Codex and the preparation script must not invent a reviewer, qualification, jurisdiction, opinion, or disposition.

The maintainer has selected `AGPL-3.0-only`, BasicLinear as project identity, and BasicLinear as the requested final product brand. The first two choices are implemented inputs, not qualified clearance. BasicLinear has an active exact-name project-management collision and incorporates Linear's company/application brand. A qualified reviewer must either clear the exact requested two-name model or require remediation. Capability to access an authenticated browser or account is not authorization and does not resolve this review.

## Procedure

1. Review the evidence listed in `ops/release/audit-policy.json`, including the exact license, decision record, name screen, clean-room policy, source register, provenance manifests, dependency inventory, notices, contribution policy, and security policy.
2. Record any missing evidence or required remediation as project-local Control Tower issues. Do not use Linear as task authority.
3. Commit all evidence changes and ensure `git status --porcelain` is empty.
4. Run `node scripts/prepare-qualified-identity-review.mjs`. It writes only `qualified-review-request.json` and never creates acceptance.
5. Verify the printed request SHA-256 and inspect every bound artifact and evidence state.
6. Manually create `qualified-review-acceptance.json` only after completing the review. Use the exact request hash and real reviewer details.
7. Run `npm run audit:release`. A valid qualified acceptance does not pass CT-3 until `result.json` is separately reconciled to the reviewed decision. A remediation-required record never clears the candidate.

## Accepted Contract

The following is a template, not acceptance. Every placeholder must be supplied by the qualified reviewer.

```json
{
  "schema_version": "qualified-identity-review-acceptance-v1",
  "issue": "CT-3",
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
  "dispositions": {
    "license_compatibility": "agpl_3_0_only_accepted",
    "project_identity": "basiclinear_cleared",
    "product_identity": "basiclinear_cleared",
    "trademark_and_trade_dress": "independent_expression_cleared",
    "clean_room_method": "restrictive_boundary_accepted",
    "existing_reference_evidence": "private_quarantine_accepted",
    "public_comparative_claims": "qualified_independent_evidence_only",
    "contribution_intake": "agpl_contribution_terms_accepted",
    "asset_copy_and_notices": "qualified_disposition_accepted"
  },
  "notes": "Optional public limitations or decision references without privileged advice."
}
```

## Remediation Contract

When any scope is not accepted, use `status: "remediation_required"`, set each rejected scope to `"remediation_required"`, keep accepted scope values exact, and add a non-empty string `remediation` field. This records a valid rejection but makes `public_identity_decision` fail until remediation is completed and a new evidence-bound request is reviewed.

Changing any bound document or manifest invalidates the request. Changing the request invalidates acceptance. The request and acceptance are excluded from the candidate digest to avoid circular hashing, but remain in the public source walk and private-artifact scan. CT-13 separately requires approved provenance manifests and accountable release acceptance; CT-12 separately owns current Chrome rendered acceptance.
