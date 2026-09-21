# Technical investigation

## Recommended system boundary

Use Firebase Hosting for the existing Vite web application, Firebase Authentication with the Google provider, Cloud Firestore as the hosted authority, and trusted Cloud Functions/Cloud Run handlers for invitations, billing, token issuance, REST, and MCP. Firebase App Hosting's guaranteed framework adapters are Next.js and Angular; forcing the Vite monorepo through an unsupported adapter or framework conversion is outside this release. Use the maintained Stripe payments extension or equivalent verified webhook integration for subscription state. The existing local SQLite runtime remains a separate supported product mode; v0.2.0 does not attempt bidirectional live sync.

Every hosted document is namespaced by `workspace_id`. A membership collection maps Firebase UID to `owner` or `member`. Firestore rules deny by default and validate membership for client-readable collections. Server-only collections hold invite-token digests, subscription/customer references, entitlement transitions, API-token hashes, and idempotency records.

## Data and concurrency

Core hosted records are users, workspaces, memberships, invites, projects, milestones, issues, comments, activities, entitlements, subscriptions, API credentials, and product events. Issues retain optimistic revisions. Comments retain immutable author identity and soft-delete state. Invitations and membership acceptance use one-time digests and atomic transactions. Assignment accepts zero or one active member in the same workspace.

Firestore transactions protect invite acceptance, seat changes, entitlement transitions, and revisioned mutations. Stripe webhooks are signature-verified, idempotent, and the only source allowed to activate paid entitlement. Browser claims are never trusted for price, trial eligibility, role, seat count, or subscription state.

## Trial and billing state machine

First successful owner bootstrap creates exactly one 30-day trial keyed to the Firebase UID. No card is required. Invited-member login does not create a second trial for that workspace. Pending invites are unbilled; accepted active memberships are seats, including the owner. Monthly billing is `$2 × active seats`; annual billing is `$12 × active seats`, in USD before applicable taxes.

At trial expiry, an active paid subscription keeps Pro. Without one, the workspace enters Free mode with one active writer. Additional memberships and all data remain visible, but collaboration writes and automation writes are disabled until the owner subscribes or reduces the workspace to one active member. No automatic data deletion is part of v0.2.0.

## API, MCP, and skill boundary

Publish `/api/v1` under OpenAPI 3.1.1 with cursor pagination, idempotency keys, optimistic revisions, consistent errors, and explicit workspace scope. Browser calls use Firebase ID tokens. External clients use owner-created, hashed, scoped personal access tokens with expiry and revocation; raw tokens are shown once.

Expose a Streamable HTTP MCP endpoint backed by the same application service and authorization checks. Tool definitions use JSON Schema inputs and outputs plus accurate read-only/destructive/idempotency annotations. The tool set covers workspaces, projects, milestones, issues, assignments, comments, invitations, and read-only subscription state. It contains no agent, repository, pull-request, code-review, arbitrary SQL, billing purchase, or token-administration tools.

Ship a reusable `openlinear-product-management` skill that teaches compatible assistants how to choose the REST or MCP surface, require workspace scope, respect revisions, and request confirmation before destructive task actions. The skill is documentation and orchestration guidance; OpenLinear does not host or run AI agents.

## Feasibility cautions

- Trusted Cloud Run/Functions handlers require Blaze; Firebase Hosting, Firestore, build artifacts, logs, and compute must have budgets and alerts before production traffic.
- Firestore rules are necessary but not sufficient; Admin SDK handlers must repeat authorization checks.
- Current MCP authorization is richer than a static token. Scoped personal tokens are a bounded bridge and require T-SECURITY-MCP compatibility/security validation.
- Trial abuse, account deletion, tax, refunds, proration, and failed-payment recovery require explicit state tests.
- Remote access eliminates the v0.1 loopback trust boundary. All hostile-origin, cross-workspace, replay, and enumeration cases must be re-specified.

## Prototype list

Planning should prototype only the risky contracts: Google bootstrap plus trial creation, cross-workspace rule denial, one-time invitation acceptance, Stripe webhook idempotency, and a single issue-list/create flow through REST and MCP. UI polish outside the canonical owner/member journeys waits for those proofs.
