# Source index

Observed on 2026-08-24 unless noted. Vendor documentation supports capability and constraint claims; it does not prove BasicLinear product outcomes.

| Evidence | Source | Type | Verification | Material use |
|---|---|---|---|---|
| E-201 | Maintainer request in this Codex task | user note | Verified | Version scope, trial, prices, collaboration, API/MCP/skills, exclusions |
| E-202 | [`pmo/product-definition.md`](../../../../../pmo/product-definition.md) | local document | Verified | Current local-owner product boundary |
| E-203 | [`pmo/requirements.md`](../../../../../pmo/requirements.md) | local document | Verified | Current requirements and explicit multi-user deferral |
| E-204 | [Firebase: Authenticate using Google with JavaScript](https://firebase.google.com/docs/auth/web/google-signin) | official URL | Verified | Google provider and popup/redirect feasibility |
| E-205 | [Firebase: Role-based access control](https://firebase.google.com/docs/firestore/solutions/role-based-access) | official URL | Verified | Membership-aware reads, writes, comments, and role checks |
| E-206 | [Firebase: Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions) | official URL | Verified | Atomic membership, entitlement, assignment, and counter changes |
| E-207 | [Firebase: Understand App Hosting costs](https://firebase.google.com/docs/app-hosting/costs) | official URL | Verified | Blaze requirement, no-cost allowances, variable cost exposure |
| E-208 | [Firebase: Firestore pricing](https://firebase.google.com/docs/firestore/pricing) | official URL | Verified | Read/write/delete/index/storage charging model |
| E-209 | [Firebase Extension: Run Payments with Stripe](https://extensions.dev/extensions/stripe/firestore-stripe-payments) | official extension URL | Verified | Checkout, subscription, customer, and webhook feasibility |
| E-210 | [MCP 2026-07-28: Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | official specification | Verified | HTTP authorization and protected-resource boundary |
| E-211 | [MCP 2026-07-28: Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) | official specification | Verified | Current remote transport, protocol-version headers, request behavior |
| E-212 | [MCP 2026-07-28: Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) | official specification | Verified | Tool schemas, annotations, access control, rate limits, audit guidance |
| E-213 | [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) | official specification | Verified | Machine-readable REST API contract |
| E-214 | [Linear pricing](https://linear.app/pricing) | official vendor URL | Verified | Hosted incumbent price reference; observed Basic at $10/user/month |
| E-215 | [Plane pricing](https://plane.so/pricing) | official vendor URL | Verified | Open-source/cloud substitute and per-seat price reference |
| E-216 | BasicLinear repository inspection at `928767e` | repo inspection | Verified | Existing Node/SQLite, implicit-owner, no-login implementation boundary |

## Source cautions

Pricing pages and protocol specifications can change. Recheck E-207 through E-215 at release review. Firebase and Stripe documentation establishes technical feasibility only. The maintainer's $2/$12 prices remain authoritative product input even if competitors change their own pricing.
