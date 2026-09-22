# CT-140 MCP, OAuth, and reusable-skill contract

## Boundary

CT-140 implements I-208 within the accepted combined v0.1 local plus v0.2 hosted product boundary and reuses the shared `S3 — Implementation` milestone. The authority is the project-local Control Tower v0.8 store; provider projection remains disabled and `not_synced`.

This slice adds a remote, product-management-only MCP surface, its OAuth authorization bridge, an explicit browser consent flow, and the packaged `basiclinear-product-management` skill. It does not add an autonomous agent runtime, source-code or repository access, pull requests, code review, personal-token administration, subscription purchase, local/cloud synchronization, deployment, or public activation. REST remains CT-139. Operational abuse limits, budgets, restore controls, and deployed-runtime telemetry remain CT-141. Integrated P-T208/P-T210 qualification remains CT-142.

## Stable stateless transport

BasicLinear implements the stable MCP `2026-07-28` Streamable HTTP profile at one `POST /mcp` resource. It deliberately has no protocol session identifier and no standalone GET event endpoint. `GET /mcp` is method-not-allowed. Every JSON-RPC request is one independent POST, and a tool call returns one request-scoped SSE response. For `tools/call`, request-abort and response-close tracking begins before asynchronous OAuth authentication, initializes from the live request/response state, and is rechecked before headers and immediately before application work. A close observed anywhere in that pre-work interval returns without invoking the selected service; listeners are removed on every exit. The server does not claim rollback after application work begins.

The client must advertise both `application/json` and `text/event-stream` with nonzero, syntactically valid quality values. Media-range parameters are parsed rather than discarded: the optional UTF-8 charset must match the actual representation, unsupported constraints do not match, and malformed, empty, duplicate-quality, or post-quality parameters fail closed. The request media type is exact JSON with only an optional UTF-8 charset. Duplicate framing, authorization, content-negotiation, protocol, method, name, or recognized mirrored-parameter headers fail closed. Bodies are strict UTF-8 JSON and are limited to 64 KiB.

Every request carries `_meta['io.modelcontextprotocol/protocolVersion']` and schema-valid `_meta['io.modelcontextprotocol/clientCapabilities']`. Client implementation identity is optional; when present, its name, version, optional display fields, website URI, and icons are validated. Known client capability objects and extension names are validated while the capability object remains open for future standard fields. Metadata keys follow the MCP two-segment naming grammar. The deprecated logging level and an optional progress token remain accepted when schema-valid.

`Mcp-Protocol-Version` must exactly equal the body version, and `Mcp-Method` must exactly equal the JSON-RPC method. `tools/call` additionally requires `Mcp-Name`, and the recognized workspace mirror `Mcp-Param-Workspace-Id` must equal the explicit `workspaceId` argument. Header/body disagreement returns HTTP 400 with `-32020`. An aligned but unsupported protocol version returns HTTP 400 with `-32022` and exact `supported` and `requested` data. Unknown methods return HTTP 404 with `-32601`. Notifications are outside this selected stateless profile.

`server/discover` is public and mandatory. It reports only the current version, the tools capability, bounded cache metadata, PM-only instructions, and `_meta['io.modelcontextprotocol/serverInfo']`. `tools/list` and `tools/call` require a valid MCP OAuth access token. Every successful result includes `resultType: complete` and server identity. Tool definitions use JSON Schema 2020-12, explicit workspace arguments, accurate read-only/destructive/idempotent/open-world annotations, and structured output. Tool calls return schema-conforming `structuredContent` plus a compatibility text block; application failures remain redacted structured tool errors.

## OAuth resource and authorization server

The resource metadata is available at both `/.well-known/oauth-protected-resource` and the resource-specific `/.well-known/oauth-protected-resource/mcp`. Authorization-server discovery is at `/.well-known/oauth-authorization-server`. The issuer is the exact configured HTTPS origin, or literal loopback HTTP in local development. The protected resource and token audience are the exact `${origin}/mcp` URI.

Public clients register through bounded dynamic client registration. Registration accepts and validates MCP's `application_type` values `web` and `native` while retaining the same exact HTTPS-or-literal-loopback redirect safety boundary; omission remains accepted for older non-OIDC clients. It accepts one to eight redirects, authorization code plus refresh token grant types, the code response type, and no client secret. Duplicate top-level registration keys fail closed. BasicLinear does not fetch Client ID Metadata Documents in this release, avoiding an unbounded server-side metadata-fetch/SSRF surface.

Authorization requires:

- exact registered redirect matching without URI normalization aliases;
- one explicit workspace ID and one sorted, duplicate-free allowlisted scope set;
- an opaque client state value that is preserved exactly;
- authorization code with PKCE S256;
- the exact MCP resource parameter;
- a current verified Firebase/Google identity on the BasicLinear consent route;
- an active workspace membership and role-compatible scopes;
- explicit allow or deny on a screen showing the Google account, non-unique client name plus immutable client ID, exact redirect, workspace, scopes, and expiry.

Approved and denied redirects preserve `state` and include the exact issuer. Authorization requests expire after 10 minutes and one-time authorization codes after 5 minutes. Codes are bound to their request, client, redirect, workspace, user, scope set, PKCE challenge, resource, and chronology. A code can be exchanged only once. Approved consent replay returns the deterministic prior decision only to the same currently active user while the code remains unused and the trusted clock is strictly before its expiry; exact-expiry, expired, consumed, missing, or cross-bound code state fails closed. The browser tells the user to start a new client authorization request when the old flow can no longer be returned safely.

Access tokens expire after exactly 10 minutes. A token family expires after exactly 30 days. Refresh tokens rotate on every successful use; reusing a replaced refresh token revokes the whole family. Refresh may downscope but cannot re-expand. A refresh is rejected when fewer than 10 minutes remain in the family so the service never returns an immediately unusable access token. Explicit revocation accepts an access or refresh token and revokes the complete family. Token responses are non-cacheable and include `Pragma: no-cache`.

Raw authorization codes, access tokens, and refresh tokens are never stored. Firestore stores SHA-256 digests and HMAC-bound exact-schema clients, requests, codes, grants, families, and token records. The service verifies exact fields, bindings, cross-record identity/scope/resource relations, exact durations, lifecycle states, and chronology before returning a credential or accepting a replay. The grant identifier includes the current membership revision, so removal and later reactivation cannot revive an old grant. Current workspace and active membership state are reread for exchange, refresh, and access authentication. Direct Firestore access to every OAuth ledger collection is denied.

An unauthenticated or REST-personal-token MCP call returns a redacted HTTP 401 with Protected Resource Metadata discovery and a minimal scope hint. A valid MCP token lacking a tool scope returns HTTP 403 with an `insufficient_scope` challenge. A foreign workspace argument returns a generic 403 without revealing whether that workspace exists. The MCP token is never forwarded to Firebase, Stripe, or another downstream system.

## PM-only tool surface

The tool allowlist contains exactly 27 names:

- workspace: `workspace.get`, `workspace.export`;
- projects: `project.list`, `project.get`, `project.create`, `project.update`;
- milestones: `milestone.list`, `milestone.get`, `milestone.create`, `milestone.update`;
- issues: `issue.list`, `issue.get`, `issue.create`, `issue.update`, `issue.assign`;
- comments: `comment.list`, `comment.get`, `comment.create`, `comment.update`, `comment.delete`;
- members: `member.list`, `member.remove`;
- invitations: `invitation.list`, `invitation.create`, `invitation.resend`, `invitation.revoke`;
- billing: `billing.get`.

Each tool requires an explicit workspace and its documented OAuth scope. The current grant is bound to one workspace. Owner-only behavior remains enforced by the existing application authorization service even when a client asks for a scope. `billing.get` is observation only. There is no billing purchase/change, token administration, arbitrary data, agent, code-review, source-repository, or pull-request tool.

The adapter calls the same CT-136 through CT-139 application services as browser and REST flows. It preserves their exact authorization, entitlement, optimistic revision, idempotency, lifecycle, privacy, and deterministic read semantics. MCP principals use `source=mcp`; mutation audits therefore distinguish MCP from REST without storing bearer credentials, invitation secrets, raw idempotency keys, or submitted private bodies. Tool errors expose only stable service codes and safe messages.

## Packaged skill

`skills/basiclinear-product-management` is a validated Codex skill with a user-facing agent manifest and bounded references. It instructs a client to complete MCP OAuth, discover the server, operate only the returned tools, use an explicit user-selected workspace, read before writing, preserve revisions, and reuse an idempotency key only for an identical retry.

The skill requires fresh explicit user confirmation immediately before `comment.delete`, `member.remove`, or `invitation.revoke`. It treats invitation links as one-response secrets, directs interrupted mutations to retry with the same key, and forbids workspace probing, scope expansion, agents, code/repository/PR work, token administration, arbitrary data access, and subscription purchase. The tool map is checked against the exact 27-name implementation allowlist.

## HTTP, privacy, and qualification boundary

The hosted handler checks an exact allowlisted browser `Origin` before OAuth, identity, token, or MCP processing. Requests without `Origin` remain available to non-browser OAuth clients. Responses use no-store/nosniff and opaque correlation identifiers except intentionally public, non-user-specific discovery metadata, which is cacheable for one hour. Errors do not echo bearer credentials, Google tokens, codes, refresh tokens, secrets, stored digests, foreign workspace details, or provider identifiers.

CT-140 is eligible for implementation-output Done only after a distinct read-only reviewer verifies the sealed file/input universe before and after, reruns focused, emulator, regression, typecheck, build, dependency, audit, skill, protocol, OAuth, parity, privacy, Firestore, and prohibited-capability checks, and reports no P0–P3 finding. Completion does not itself qualify P-T208, prove O-204, activate a public server, deploy Firebase, create a live OAuth client, or provide legal/privacy/security/release approval.
