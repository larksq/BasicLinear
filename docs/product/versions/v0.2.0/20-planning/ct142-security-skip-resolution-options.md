# CT-142 sponsor resolution options for the required security skip

Status: decision options only; no sponsor choice is inferred or applied.

## Current evidence

CT-142 independently passed the bounded nonsecurity owner/member/billing-fixture/REST/MCP journey. The sponsor directed Codex to skip security testing because the prohibited work conflicted with the active safety boundary. The structured exception is valid as a skip, but the Testing contract correctly prevents it from becoming a pass for R-204, R-219, or full P-T210.

The choice below is a product/release-scope decision, not a testing convenience. Neither option allows Codex to claim a security result that was not produced.

## Option A — preserve the full public paid-launch contract

Recommended when the intended v0.2 release remains a general multi-tenant, publicly available, paid hosted product.

- Keep R-204, R-219, P-T210, O-204/G-204, CT-142, CT-13, and public payment activation unchanged.
- Obtain an authorized external security-review result covering the accepted tenant, role, invite, token, webhook, origin, replay, enumeration, downgrade, and Firestore boundary.
- Import only the signed result and evidence digest; Codex does not perform the prohibited testing.
- Run a separate independent reconciliation of full P-T210.
- CT-142 may become Done only if the external evidence passes and the exact acceptance map validates.

Consequence: preserves the planned public paid scope and its protection claims, but requires qualified external work before release approval.

## Option B — revise v0.2 to an allowlisted verification release

Use only if the sponsor intentionally narrows the release boundary rather than claiming a full public launch.

- Accept CT-142's independently passed nonsecurity evidence as the complete Testing gate for an allowlisted, no-charge verification release.
- Keep Checkout, subscriptions, provider payment creation, open self-service signup, and general public multi-tenant rollout disabled.
- Preserve R-204 and R-219 as unqualified planned work owned by an external security reviewer. Do not mark them passed or remove their outcome/guardrail history.
- Revise P-T210 to `P-T210-V` for the verification boundary. The existing full P-T210 remains unpassed historical intent for public rollout.
- CT-13 may approve only the verification release and must explicitly prohibit security, public paid-launch, legal/privacy, and outcome claims.
- O-204/G-204 remain pending or inconclusive; no cross-workspace security result is inferred.

Consequence: permits lifecycle closure for the deployed verification product while preserving a hard gate before general public or paid activation. It does not satisfy the original full public paid-launch contract.

## Invalid option

“Treat the skipped test as passed” is not available. A sponsor exception authorizes omission; it does not produce evidence, validate a guardrail, or grant security approval.

## Required sponsor record

The sponsor must record exactly one choice in `ct142-security-skip-sponsor-decision.json` with the exact decision artifact SHA-256, decision date, actor, selected option, rationale, and accepted consequences. Until then CT-142 remains yellow and In Progress.
