# Discovery handoff to Sprint Planning

## Recommendation

Proceed to a bounded v0.2.0 plan for one hosted workspace, owner/member roles, Google sign-in, a no-card 30-day Pro trial, basic invite/assignment/comment collaboration, the sponsor's $2 monthly and $12 annual per-active-seat prices, and a PM-only REST/MCP/skill surface.

## Accepted boundaries

- Firebase-hosted authority is separate from the local SQLite authority; no live bidirectional sync.
- One workspace per owner account, one owner, active members, one assignee per issue.
- Pending invitations are unbilled; accepted active memberships are seats.
- Trial eligibility is one-time per new owner UID; invited users do not restart a workspace trial.
- Stripe is the recommended billing integration; no provider account, price, credential, or production webhook is created in Planning.
- Personal access tokens are the v0.2.0 external-client bridge pending T-SECURITY-MCP.
- AI agents and code review are absent from data models, navigation, API, MCP, and skills.

## Residual evidence gaps

User urgency and all four baselines are partial. Product Lead owns T-VALIDATE-PRICING; Security Lead owns T-SECURITY-MCP; Product Analytics owns T-BASELINE-201 through T-BASELINE-204. These gaps permit architecture and implementation planning but prohibit claims of market demand, conversion, unit economics, security acceptance, or achieved outcomes.

The normalized package must validate before Planning binds it. Planning must preserve the outcome objects unchanged, provide complete requirement/issue/test traceability, and stop at the Implementation gate.
