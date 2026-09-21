# Sprint plan

No new version milestone or implementation target date is invented. Execute in dependency order inside the existing S3 — Implementation and S4 — Testing milestones, and treat each tranche as an evidence gate, not a time box.

## Tranche A — measurable hosted identity

I-201 defines event/audit/cost contracts. I-202 establishes Firebase hosting, Google identity, separate authority, and idempotent trial bootstrap. Exit requires deterministic local/emulator evidence; no production credentials are needed.

## Tranche B — safe collaboration and entitlement

I-203 proves tenant isolation before any collaborative feature. I-204 and I-205 then add invitation, membership, assignment, and comments. I-206 adds trial, Stripe test-mode subscription state, and Free fallback only after identity and membership are trustworthy.

## Tranche C — external operation and production controls

I-207 exposes the REST/token/export contract. I-208 adds MCP and the skill on top of that same service. I-209 closes budgets, rate limits, security, abuse, redaction, recovery, and unit-cost evidence.

## Tranche D — integrated acceptance

I-210 executes the complete owner/member/billing/API/MCP journey and R-201–R-220 matrix as CT-142 in S4 — Testing. The combined CT-13 release approval and CT-14 Outcome Review remain later shared gates for v0.1 and v0.2 together.

## Test strategy

Use schema and static checks for OpenAPI/MCP/skill contracts; unit tests for domain states; Firestore Emulator rules tests; adapter-contract tests for Auth/Stripe/REST/MCP; boundary tests for tenant, token, invite, trial, and webhook behavior; restart/idempotency tests; accessibility and responsive manual tests; and one integrated UAT matrix. Test data is synthetic and contains no real Google, email, token, or payment information.

## Human and provider boundaries

Creating a real Firebase project, enabling Google identity, registering OAuth clients/redirects, accepting service terms, adding billing, configuring Stripe, creating prices, or issuing production credentials requires separate runtime authority at the action point. Planning does none of those actions. T-SECURITY-MCP authorizes the standards-compatible design but not provider configuration. A pricing-change recommendation from T-VALIDATE-PRICING requires sponsor direction before altering $2/$12 or the 30-day trial.
