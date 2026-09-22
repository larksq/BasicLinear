# T-SECURITY-MCP — remote MCP authorization and transport checkpoint

Status: completed recommendation on 2026-08-25; implementation and client interoperability tests remain CT-140/CT-142 work.

## Recommendation

Conditional GO for remote MCP only if `/mcp` implements the stable `2026-07-28` Streamable HTTP protocol and OAuth 2.1 resource-server flow described below. BasicLinear selects the specification's stateless, request-scoped profile: a single POST endpoint, no server-sent session identifier, and no standalone GET event stream. NO-GO for a PAT-only remote MCP launch.

Owner-created, hashed, scoped personal access tokens remain appropriate for `/api/v1`. They may not be treated as a substitute for discoverable MCP authorization across general clients. The MCP surface should issue audience-bound OAuth access tokens after Firebase/Google user authentication and explicit BasicLinear consent, while reusing the same workspace scopes and application service as REST.

## Official protocol basis

- Streamable HTTP `2026-07-28` supports JSON-RPC requests over POST. Clients advertise both `application/json` and `text/event-stream`; a server may answer with JSON or a request-scoped SSE stream. BasicLinear deliberately omits protocol sessions and the optional GET event stream. [MCP transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- Servers must validate `Origin`; an invalid supplied Origin receives HTTP 403. Authentication is required for every protected operation. [MCP Streamable HTTP security warning](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#security-warning)
- HTTP authorization uses an OAuth 2.1 resource server, OAuth Protected Resource Metadata, authorization-server discovery, PKCE S256, the OAuth `resource` parameter, and exact token audience validation. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- Server discovery and tool discovery use the stable `server/discover`, `tools/list`, and `tools/call` contracts, including required protocol/capability metadata and mirrored `Mcp-Method`/`Mcp-Name` headers. Client identity is optional but validated when supplied; server identity is returned in each successful result's `_meta`. Header/body mismatch uses `-32020`; an aligned but unsupported protocol version uses `-32022` with exact `supported` and `requested` data. [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover), [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- Token passthrough and tokens issued for another resource are forbidden security patterns. Current guidance also calls out confused-deputy consent, redirect matching, CSRF/state, SSRF during discovery, session hijacking, scope minimization, and secure token storage. [MCP security best practices](https://modelcontextprotocol.io/docs/draft/tutorials/security/security_best_practices)

## Compatibility decision matrix

| Client capability | PAT-only endpoint | OAuth 2.1 + discovery endpoint | Decision |
|---|---|---|---|
| Manually configured static bearer token | Sometimes compatible, client-specific | Compatible when client permits a pre-issued access token | Not the release baseline |
| Standard remote MCP authorization discovery | Missing protected-resource and authorization-server flow | Compatible | Required baseline |
| Public client requiring PKCE | Unsupported | Compatible after PKCE metadata/readback | Required baseline |
| Audience/resource-bound token validation | Possible as a custom convention, not discoverable | Defined by MCP/OAuth flow | Required security control |
| Token revocation, expiry, and incremental scopes | Custom and client-specific | Standardized authorization behavior | Required |

## Required BasicLinear flow

1. An MCP client connects to `https://<host>/mcp`.
2. Unauthenticated protected requests receive HTTP 401 with appropriate resource metadata discovery; `/.well-known/oauth-protected-resource` identifies the BasicLinear MCP resource and authorization server.
3. The client discovers Protected Resource and Authorization Server metadata, supplies the exact MCP resource parameter, uses authorization code plus PKCE S256, and shows an explicit BasicLinear consent screen with the non-unique client name plus immutable client ID, redirect URI, workspace, and requested scopes. Public clients may use bounded dynamic client registration with validated `web` or `native` `application_type`; Client ID Metadata Documents are not fetched because this release has no safe metadata-fetch service.
4. Firebase Authentication performs Google user authentication. The BasicLinear authorization layer validates active workspace membership and owner-approved scopes before issuing a short-lived, audience-bound access token. Refresh rotation and revocation are server-owned.
5. `/mcp` validates audience/resource, expiry, token-family state, client/user/workspace scopes, membership state, Origin, protocol version, bounded request framing, and exact request metadata on every request. It never creates or echoes an MCP session identifier. Operational abuse and rate-limit controls remain the explicit CT-141 boundary.
6. The MCP adapter calls the same application service as REST and writes `source=mcp` audit records. It never forwards the MCP token to Firebase, Stripe, or another downstream API.

## Threat and test matrix

| Threat | Required control | CT-140/CT-142 evidence |
|---|---|---|
| Token issued for REST or another service reused at MCP | Exact audience/resource validation; no token passthrough | wrong-audience and passthrough rejection fixtures |
| Malicious Origin / DNS rebinding | Exact Origin allowlist; 403 on invalid supplied Origin | absent/valid/invalid Origin matrix |
| Authorization-code interception | PKCE S256, HTTPS, exact redirect URI | missing/wrong verifier and redirect tests |
| Confused deputy / stale consent | Per-client, per-workspace, per-scope consent; CSRF state | client substitution, state replay, consent-scope tests |
| Discovery SSRF | HTTPS-only allowlist and redirect/IP validation for any server-side discovery | loopback/private/link-local/redirect-chain fixtures |
| Removed member or revoked token retains access | Membership and revocation read on every protected operation | browser, REST, and MCP stale-credential matrix |
| Session fixation or cross-request replay | Stateless transport; ignore legacy session and `Last-Event-ID` headers; every SSE stream is request-scoped and closes after its response | legacy-header, closing-SSE, and cancellation-before-work tests |
| Schema or permission drift from REST | Shared service, shared JSON Schema, reciprocal audit fixtures | REST/MCP parity matrix |
| Unsafe MCP capability expansion | Explicit PM tool allowlist; no billing purchase, token admin, agents, code review, repos, or PRs | prohibited-capability scan |

## Scope resolution

This finding refines implementation, not product scope: the user-requested remote MCP capability remains PM-only, and REST PATs remain supported. CT-140 must add the standards-compatible OAuth bridge for MCP instead of exposing PAT-only remote access. No production authorization server, credential, consent grant, or provider configuration is created by this research checkpoint.
