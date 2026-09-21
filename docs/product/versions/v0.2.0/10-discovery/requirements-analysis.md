# Requirements analysis

## Functional requirements

| ID | Priority | Requirement | Source | Outcome |
|---|---|---|---|---|
| R-201 | Must | Serve the Vite web product from supported Firebase Hosting with trusted Cloud Run/Functions handlers while preserving the separate local-first product mode. | E-201, E-207, E-216 | O-201 |
| R-202 | Must | Authenticate hosted users with Firebase Authentication's Google provider and create no password credential store. | E-201, E-204 | O-201 |
| R-203 | Must | On first owner bootstrap, create one workspace, owner membership, and one-time 30-day Pro trial atomically; show exact start/end dates. | E-201, E-206 | O-201, O-203 |
| R-204 | Must | Namespace every hosted record by workspace and deny any read or mutation without active membership and allowed role. | E-205 | O-202, O-204 |
| R-205 | Must | Let an owner create, resend, revoke, and inspect expiring email invitations; accept each valid invitation once after matching Google sign-in. | E-201, E-205, E-206 | O-202 |
| R-206 | Must | Support only `owner` and `member`; only the owner manages invites, members, tokens, billing, and workspace settings. | E-201, E-205 | O-202, O-204 |
| R-207 | Must | Allow zero or one assignee per issue and require the assignee to be an active member of the same workspace. | E-201, E-205 | O-202 |
| R-208 | Must | Let active members create, edit, soft-delete, and list comments with immutable author and timestamp history. | E-201, E-205 | O-202 |
| R-209 | Must | Offer USD $2 per active user monthly and USD $12 per active user yearly; pending invitations are not billable seats. | E-201, E-209 | O-203 |
| R-210 | Must | Derive Pro/Free entitlement only from trusted trial and Stripe state; after unpaid expiry, preserve data and restrict the workspace to one active writer. | E-201, E-209 | O-203 |
| R-211 | Must | Publish a versioned `/api/v1` REST contract for PM entities with OpenAPI 3.1.1, cursor pagination, stable errors, and explicit workspace scope. | E-201, E-213 | O-204 |
| R-212 | Must | Authenticate external calls with revocable, expiring, scoped personal tokens stored only as hashes; browser calls use Firebase ID tokens. | E-210, E-212 | O-204 |
| R-213 | Must | Expose a current Streamable HTTP MCP server whose PM tools share API schemas, authorization, revision, rate-limit, and audit behavior. | E-201, E-210, E-211, E-212 | O-204 |
| R-214 | Must | Ship a reusable PM skill that documents safe MCP/API operation and contains no agent runtime or code-review workflow. | E-201, E-212 | O-204 |
| R-215 | Must | Record durable actor, source (`web`, `api`, or `mcp`), timestamp, workspace, entity, and before/after semantics for mutations. | E-203, E-212 | O-202, O-204 |
| R-216 | Must | Make mutation retries idempotent and revision-safe across web, REST, MCP, invite acceptance, and billing webhooks. | E-206, E-211, E-212 | O-204 |
| R-217 | Must | Enforce Firebase budgets, request/rate limits, usage telemetry, trial-abuse controls, and cost-per-paid-seat reporting before billing activation. | E-207, E-208 | O-203, O-204 |
| R-218 | Must | Export one workspace's authoritative hosted records in a documented versioned format without cross-workspace leakage. | E-203, E-205 | O-204 |
| R-219 | Must | Pass cross-workspace, role, token, invite, webhook, origin, replay, enumeration, and downgrade security tests. | E-205, E-210, E-212 | O-204 |
| R-220 | Must | Omit AI agents, code reviews, repository/PR data, presence, custom roles, non-Google SSO, SCIM, attachments, mentions, and notifications. | E-201 | O-201, O-204 |

## Quality standards

The hosted core must preserve v0.1's keyboard/accessibility expectations. Security checks use Firebase Emulator Suite rules tests plus trusted-handler contract tests. REST and MCP must return the same authorization and revision outcomes for equivalent operations. Billing acceptance must cover timezone boundaries, duplicate/out-of-order webhooks, seat changes, failed payment, cancellation, and trial expiry. Cost evidence must use observed Firebase and Stripe data rather than a fixed estimate.

## Traceability and decision boundaries

Every Must requirement maps to at least one Planning issue, concrete test, and outcome. Requirements R-209 and R-210 preserve the sponsor's prices and trial length; changing them requires sponsor direction. T-VALIDATE-PRICING may recommend a change or stop, not silently apply one. R-213 does not authorize arbitrary AI actions: MCP callers receive exactly the same bounded permissions as a human user.
