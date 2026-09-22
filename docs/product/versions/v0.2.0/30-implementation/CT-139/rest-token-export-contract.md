# CT-139 REST, personal-token, and export contract

## Boundary

CT-139 implements I-207 inside the accepted combined v0.1 local plus v0.2 hosted product boundary. It reuses the shared `S3 — Implementation` milestone. The authority is the project-local Control Tower v0.8 store; provider projection remains disabled and `not_synced`.

The slice publishes a product-management-only REST API, an owner-operated personal-token lifecycle, and a deterministic workspace export. It does not add an autonomous agent runtime, source-code review, repositories, pull requests, remote MCP, OAuth, billing purchase through REST, deployment, or local/cloud synchronization. MCP and its reusable skill remain CT-140. Rate limits, deployment budgets, restore drills, and deployed-artifact controls remain CT-141. Integrated P-T207/P-T210 qualification remains CT-142.

## REST surface

`GET /api/v1/openapi.json` publishes OpenAPI `3.1.1` with JSON Schema 2020-12 semantics. Every `/api/v1/workspaces/{workspaceId}` operation requires `Authorization: Bearer <personal-token>`, an exact workspace path, and its declared scope.

The bounded route set is:

- workspace: read;
- projects: list, create, read, and optimistic update;
- milestones: list/create within a project, read, and optimistic update;
- issues: list, create, read, update, and single-assignee update;
- comments: list, create, read, edit, and soft-delete;
- members: list active members and remove a member;
- invitations: list, create, resend, and revoke;
- billing: read the existing trusted billing summary only;
- export: read the canonical workspace export.

No REST route creates or revokes another personal token. Token management is a Google-authenticated browser-owner operation. No REST route creates a Checkout or changes a subscription.

Request objects reject undeclared fields. Every REST mutation—including a PUT assignment, no-field delete, or invitation action—requires exactly one `Content-Type` header whose media type is `application/json` (with only an optional UTF-8 charset); no-field operations use an exact empty JSON object, so a zero-byte body is never equivalent to `{}`. Before stateful credential authentication, the route validates the uncollapsed Authorization, content type, content length, idempotency, and revision header views, the applicable idempotency/revision form, the bounded nonempty body size, and JSON framing. A zero-byte, missing, duplicate, unsupported, malformed, or oversized boundary fails without changing the token lifecycle, token-use audit, idempotency, or PM state. A mutation requires one `Idempotency-Key` between 16 and 160 non-whitespace characters; provider-backed member/invitation operations retain their narrower safe-character boundary. An optimistic update additionally requires one `If-Match: "rev-N"`; entity responses return the current `ETag`. Success, replay, error, method, and precondition responses are declared in OpenAPI. Error bodies contain only a stable machine code, safe message, correlation ID, and an optional numeric current revision. Application responses and Node parser-level client errors use the redacted JSON/correlation boundary with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

Collection GET endpoints accept only `limit` from 1 through 100 and an opaque cursor. The cursor is a signed, versioned payload bound to the exact workspace, collection or parent collection, last returned ID, and page size. Duplicate collection query keys, changed page size, signature changes, missing anchors, cross-workspace reuse, and cross-resource reuse fail with `INVALID_CURSOR`; undeclared query parameters on collection or entity routes and all query parameters on mutations fail with `INVALID_REQUEST`. The service enumerates the complete trusted collection before creating a page, so record 1,001 is not hidden by an internal 1,000-record cap. CT-141 owns production rate/size budgets; this contract makes no large-workspace performance claim.

## Personal access tokens

Only an active workspace owner using a verified Google browser session may list, create, or revoke personal access tokens. A personal token cannot authorize token creation or revocation.

The fixed audience is `basiclinear-api-v1`. An owner selects one or more explicit allowlisted scopes:

- `workspace:read`;
- `projects:read`, `projects:write`;
- `milestones:read`, `milestones:write`;
- `issues:read`, `issues:write`;
- `comments:read`, `comments:write`;
- `members:read`, `members:write`;
- `invitations:read`, `invitations:write`;
- `billing:read`;
- `workspace:export`.

Expiry is an exact whole-day duration from 1 through 365 days. The current owner UI offers 30, 90, or 365 days and defaults to a least-privilege read set. The raw credential has a versioned high-entropy format and is returned only on the first successful create. A replay returns the public record with `rawToken: null`. The UI shows the raw value once, offers copy/download controls, warns against chat, issues, comments, logs, or source control, and lets the owner dismiss it. A synchronous browser download failure revokes the temporary object URL and tells the owner to select and save the one-time token manually.

Firestore stores the token ID, workspace, creator, name, public prefix, sorted scopes, audience, SHA-256 credential digest, exact duration, created/expiry/last-used/revoked timestamps, revision, and an HMAC binding. It never stores the raw credential. Token and idempotency records reject missing, extra, cross-boundary, malformed, future, or HMAC-modified fields. Create replay is valid only while the HMAC-bound token remains the exact revision-1 creation outcome with no use or revocation timestamp; use or revocation turns the old create key into a conflict without returning a current or historical secret. All hosted HMAC secrets—including billing, invitations, collaboration, project-management idempotency, personal-token lifecycle, and cursor signing—must be pairwise distinct at service startup.

Authentication binds the credential to its encoded and requested workspace, audience, digest, expiry, revocation state, required scope, creator membership, declared workspace action, source `rest`, and opaque token reference. Digest checks use constant-time comparison for well-formed stored digests, and a missing-record path performs a fixed-size comparison before returning the same generic authentication failure. A successful authorization updates the HMAC-bound last-used state and writes a privacy-safe `token.use` audit. Revocation is transactional and denies the next authentication attempt. Removal of the creator from the workspace also denies subsequent use. A Free workspace permits a browser owner to revoke an existing token but denies new automation-token creation and all personal-token writes.

## Project-management state and audit

Projects and milestones use exact stored schemas, workspace-bound IDs, normalized bounded text, canonical timestamps, optimistic revisions, HMAC-bound idempotency records, and transaction-time membership/entitlement checks. Issues, assignment, comments, invitations, member removal, and billing reuse the already accepted CT-136 through CT-138 services rather than reimplementing their semantics.

Successful mutations write source-tagged audit records with actor kind/reference, workspace, request ID, timestamp, entity type/ID, before/after revision, result, action, and per-field before/after SHA-256 evidence. Raw idempotency keys, token values, invitation token digests, comment bodies, and submitted private text are not written to audit evidence. A retry never creates a duplicate. If later lifecycle changes make the original result no longer exact, the retry fails closed instead of returning a fabricated historical state.

## Canonical workspace export

Only the active workspace owner may export. Browser export uses the verified Google principal; REST export additionally requires `workspace:export`.

The response media type is `application/vnd.basiclinear.workspace-export+json;version=1`. Its data schema is `basiclinear.workspace-export.v1` and contains, in deterministic ID order:

- the exact public workspace record;
- active and removed memberships with lifecycle timestamps;
- sanitized invitation owner views, without current or historical token digests;
- projects and milestones;
- issues, including project/milestone placement and one assignee;
- active and soft-deleted comments.

The exporter verifies workspace ownership, lifecycle chronology, parent references, one active owner matching the workspace owner, unique membership user IDs, membership state, invitation state, project/milestone placement, issue placement, comment parentage, and exact trusted schemas in one repository transaction. Every project/milestone/issue creator, non-null assignee, and comment author must resolve to an exported active or removed membership. Any malformed, orphaned, foreign-reference, or future trusted record fails closed.

The envelope includes `sha256`, computed over a recursive key-sorted canonical serialization of the inner `data` object. Array order is deterministic. Repeated exports of unchanged trusted data are byte-for-byte equal as objects, survive JSON round-trip, and reproduce the digest independently. The pretty-printed browser download includes the envelope; its file-byte hash is not the canonical inner-data digest.

The export deliberately excludes personal tokens and digests, token/idempotency records, invitation link secrets and token ledgers, mutation/authorization audits, product measurement events, provider/customer/subscription/Checkout/webhook records, server secrets, local SQLite data, and every foreign-workspace record.

## Firestore and HTTP boundary

Trusted writes remain server-only. Direct authorization accepts only the exact in-memory membership projection or one of the two exact persisted membership schemas; extra fields and invalid lifecycle combinations deny access. Firestore applies the same exact persisted membership-key and lifecycle boundary, including canonical fixed-width UTC timestamps and lifecycle chronology. Direct workspace, project, and milestone gets require their exact public schemas, canonical identifiers and bounded normalized text; project/milestone timestamps must be canonical and ordered, and milestone target dates must be real calendar dates. Firestore denies invitation, billing, token, PM idempotency, token idempotency, event, audit, issue, comment, legacy workspace-subcollection, and legacy nested-project records. Exact root project/milestone document gets remain available to active members, while every direct project/milestone collection list is denied because Firestore query rules cannot safely guarantee the complete exact record shape; application lists use the trusted API. Malformed exact-get records and all direct client writes fail closed.

The hosted HTTP handler rejects a non-allowlisted browser `Origin` before identity or token processing. Requests without an `Origin` remain usable by non-browser bearer clients. Stable errors and response headers never echo the bearer token, request body, server secret, stored digest, foreign workspace, or provider reference.

## Qualification and claims

The implementation candidate is eligible for Done only after a distinct, read-only reviewer verifies the sealed file set before and after, reruns the required gates, exercises adversarial token/cursor/export/state cases, and reports no P0–P3 finding. CT-139 completion does not itself qualify P-T207 or prove O-204; O-204 remains `baseline_needed` until the later REST/MCP parity observation window. No deployment, public activation, provider mutation, legal/privacy/security approval, or combined release acceptance is claimed.
