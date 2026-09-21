# Risk analysis

| ID | Risk | Likelihood / impact | Control and evidence | Owner | Gate |
|---|---|---|---|---|---|
| RK-201 | Cross-workspace data access through rules or Admin SDK | Medium / Critical | Deny-by-default rules, duplicated server authorization, adversarial matrix, zero-success guardrail | Security Lead | Release blocker |
| RK-202 | Duplicate workspace/trial through retries or multiple tabs | Medium / High | UID eligibility record, transaction, idempotency key, server clock | Backend Lead | I-202 acceptance |
| RK-203 | Invite token theft, enumeration, replay, or email mismatch | Medium / High | Hashed one-time token, expiry/revoke, generic errors, matching Google email | Security Lead | I-204 acceptance |
| RK-204 | Active-seat quantity diverges from membership | Medium / High | Transactional membership ledger, webhook reconciliation, owner-visible counts | Billing Lead | Billing activation blocker |
| RK-205 | Duplicate/out-of-order Stripe webhooks corrupt entitlement | Medium / Critical | Signature verification, event-id idempotency, monotonic state rules, replay fixtures | Billing Lead | Billing activation blocker |
| RK-206 | $2/$12 pricing is uneconomic | High / High | Cost-per-seat telemetry, budget alerts, T-VALIDATE-PRICING, G-203 | Product Lead | Public billing blocker |
| RK-207 | Trial/downgrade copy surprises users | Medium / High | Exact dates, no-card statement, seat definition, five-session comprehension test | Product Lead | Public billing blocker |
| RK-208 | PAT-only MCP is incompatible with standard remote-client authorization or tokens cross resource boundaries | Medium / Critical | T-SECURITY-MCP conditional GO: REST-only PATs plus OAuth 2.1 discovery, PKCE, consent, audience/resource validation, rotation/revoke, and no token passthrough at MCP | Security Lead | I-208 release blocker |
| RK-209 | REST and MCP semantics drift | Medium / High | Shared service/schema, parity matrix, reciprocal audit events | API Lead | I-208/I-210 acceptance |
| RK-210 | Firestore read amplification exceeds price model | Medium / High | Query/index budgets, pagination, load fixtures, billing export | SRE/FinOps | Billing activation blocker |
| RK-211 | Removed member retains stale access | Low / Critical | Membership checked per request, short token validation window, immediate rule denial | Security Lead | Release blocker |
| RK-212 | Scope expands into agents/code review | Medium / Medium | R-220 prohibited-capability scan across UI/API/MCP/skill | Product Lead | Planning and release gate |
| RK-213 | Hosted launch implies local/cloud sync | Medium / High | Separate-authority copy and no import/sync surface | Product Lead | UAT copy gate |
| RK-214 | Firebase/Stripe/MCP contracts change before launch | Medium / Medium | Pin versions, re-read official sources, compatibility tests | Architecture Lead | Release review |

No risk is accepted as outcome evidence. RK-201, RK-205, RK-206, RK-207, RK-210, and RK-211 prevent public billing/release even if implementation issues are otherwise complete.
