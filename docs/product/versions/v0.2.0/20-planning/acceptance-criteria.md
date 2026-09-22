# Acceptance criteria

## I-201 — measurement foundation

- Given an eligible owner or workspace event, when it is recorded from web, REST, or MCP, then a versioned event includes actor, workspace, source, timestamp, eligibility fields, and no raw token or comment body.
- Given Firebase and Stripe cost records, when the reporting fixture runs, then O-201 through O-204 populations and G-201 through G-204 are reproducible from documented queries.

## I-202 — hosted foundation and Google bootstrap

- Given an eligible new Google user, when first sign-in completes twice through retried tabs, then exactly one user, workspace, owner membership, and 30-day trial exist.
- Given the Vite production bundle, when the Firebase Hosting fixture builds, then static assets resolve and `/api/**`, `/mcp`, and OAuth routes rewrite only to the trusted service; local SQLite remains independent and never uploads automatically.
- Given any shipped route/schema/copy, then no agent or code-review capability appears.

## I-203 — tenant authorization and roles

- Given owner, member, removed member, unrelated user, and unauthenticated callers, when each attempts every protected read/mutation through rules and trusted handlers, then only the exact allowed workspace/role cases succeed.
- Given a removed membership, when any existing browser/API/MCP credential is reused, then protected access fails and the audit records the denial without data leakage.

## I-204 — invitations and membership

- Given an owner invite, when it is resent, revoked, expired, replayed, accepted by the wrong Google email, or accepted correctly, then each state is distinct, safe, and idempotent.
- Pending invitations never increase active seat quantity; successful acceptance does exactly once.

## I-205 — assignment and comments

- An issue accepts zero or one same-workspace active-member assignee and rejects removed or foreign users atomically.
- Active allowed users create, edit, list, and soft-delete comments; immutable author/timestamp and activity history survive edits and concurrent conflicts.

## I-206 — trial, subscription, and entitlement

- Checkout displays exact monthly/annual per-active-seat totals and never trusts client price or quantity.
- Signature-verified duplicate and out-of-order webhook fixtures converge on one correct entitlement.
- At unpaid trial expiry, one active writer remains, extra members and automation writes pause, and all data stays readable/exportable.

## I-207 — REST, tokens, and export

- OpenAPI 3.1.1 validates all `/api/v1` PM routes, pagination, idempotency, revision, scope, and error objects.
- A token is shown once, stored only as a hash, limited to its workspace/scopes/expiry, and immediately denied after revocation.
- Workspace export round-trips the supported schema and contains no foreign-workspace record.

## I-208 — MCP and PM skill

- Current-protocol Streamable HTTP list/call requests return schema-valid PM tools/results and reject unsupported versions or malformed metadata safely.
- OAuth Protected Resource Metadata and authorization-server/OIDC discovery, PKCE, exact redirect/resource/audience validation, consent, expiry, refresh rotation, and revocation pass; PAT-only remote MCP and token passthrough fail closed.
- Equivalent REST and MCP tasks produce identical durable state, permission results, revision conflicts, and audit semantics.
- The packaged skill passes its tool map and prohibited-capability scan; it asks for confirmation before destructive operations.

## I-209 — operations and cost controls

- Budgets, alerts, rate limits, abuse signals, query/index budgets, redacted logs, backup/export runbooks, and cost-per-paid-seat reporting have reviewed evidence.
- Load and replay fixtures stay inside planned quotas or stop the release with a measured reason.

## I-210 — integrated acceptance

- One owner signs in, creates work, invites one member, assigns an issue, receives a member update/comment, starts a test subscription, exercises equivalent REST/MCP operations, revokes a token, exports data, and observes correct downgrade behavior.
- The full R-201–R-220 matrix passes across desktop/mobile, keyboard/accessibility, security, billing, recovery, REST, MCP, and scope-exclusion checks.
- Completion records implementation quality only; O-201 through O-204 remain pending until their observation windows mature.
