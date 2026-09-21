# CT-3 combined v0.1 + v0.2 qualified boundary review

Status: reviewer procedure; no qualified decision is recorded by this document.

## Boundary

This is one qualified review of the combined OpenLinear local and hosted candidate. It does not provide legal advice and does not infer trademark, privacy, security, payment, terms, data-handling, clean-room, or release clearance. Codex must not invent the reviewer, qualification, jurisdiction, disposition, or residual-risk acceptance.

The exact request binds the historical v0.1 license, identity, clean-room, source, asset, copy, and third-party evidence together with the accepted v0.2 Discovery/Planning package, hosted implementation/testing manifests, deployed environment boundary, and explicit test gaps. Hashing an artifact is not evidence that its claims passed.

## Required review scopes

1. **License, identity, trademark, and trade dress.** Decide whether `AGPL-3.0-only`, project identity `Scopefold`, requested product identity `OpenLinear`, independent expression, existing reference quarantine, contribution terms, and public comparative-claim limits are acceptable in the stated jurisdictions.
2. **Local and hosted authority.** Review the separation between local SQLite authority and the isolated Firebase development/production authorities, including Google identity, owner/member roles, invitations, assignments, comments, export, and recovery.
3. **Commercial and payment boundary.** Review the exact one-time 30-day Pro trial, $2 per active user monthly and $12 per active user yearly prices, pending-invite exclusion, Free fallback, taxes/terms disclosures, Stripe test/live separation, and the fact that current verification accounts bypass payment with Checkout disabled.
4. **Privacy, security, and data handling.** Review Firebase, Google, Stripe, REST, MCP, skill, audit, retention, and hosted-operations boundaries. The sponsor-directed R-204/R-219 security skip remains untested and cannot be converted into security clearance by this packet.
5. **Automation and scope.** Review the PM-only REST, MCP, and reusable skill surfaces and the explicit exclusion of AI agents, code review, repositories, pull requests, synchronization, presence, custom roles, SSO/SCIM, attachments, mentions, and notifications.
6. **Evidence limitations.** Distinguish technical output, independent nonsecurity UAT, deployment evidence, qualified boundary approval, accountable release approval, and product outcomes. None is a substitute for another.

## Procedure

1. Verify `combined-qualified-review-request.json.sha256`, then recompute every evidence artifact hash and the request's `evidence_set_sha256`.
2. Confirm CT-3 through the project-local Control Tower v0.8 API. Do not use Linear or mutate the task through a provider UI.
3. Review every scope above using a real qualified reviewer and record jurisdictions and limitations.
4. Create a separate acceptance record only if the reviewer actually decides. Use the exact request SHA-256.
5. Use `accepted` only when every required scope is accepted. Otherwise use `remediation_required`, identify exact rejected/deferred scopes, and provide bounded remediation.
6. CT-3 may become Done only after a valid acceptance is reconciled through a revision-checked local API update. CT-13 remains a separate accountable release decision.

## Acceptance shape

```json
{
  "schema_version": "qualified-combined-boundary-acceptance-v1",
  "issue": "CT-3",
  "status": "accepted",
  "reviewer": {
    "name": "REQUIRED_REAL_NAME",
    "role": "REQUIRED_ACCOUNTABLE_ROLE",
    "qualification": "REQUIRED_SCOPE_QUALIFICATION"
  },
  "reviewed_at": "YYYY-MM-DDTHH:MM:SSZ",
  "jurisdictions": ["REQUIRED_REVIEW_JURISDICTION"],
  "request_sha256": "REQUIRED_64_CHARACTER_SHA256",
  "accepted_scopes": [
    "license_identity_clean_room",
    "local_hosted_authority",
    "commercial_payment_boundary",
    "privacy_security_data_handling",
    "pm_automation_and_exclusions",
    "evidence_and_claim_boundary"
  ],
  "limitations": "Required public limitations and residual-risk decisions."
}
```

For a non-acceptance, set `status` to `remediation_required`, list `accepted_scopes`, list `remediation_scopes`, and provide a non-empty `remediation` description. A valid rejection is evidence; it does not clear CT-3.
