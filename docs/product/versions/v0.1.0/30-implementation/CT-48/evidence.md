# CT-48 Optional OIDC Evidence

## Verdict

`IMPLEMENTED_AWAITING_DATABASE_AND_BROWSER_VERIFICATION`. The application now has an optional standards-based OIDC flow with explicit local account linking, exact issuer-plus-subject login lookup, one-time browser-bound authorization requests, persistent identity recovery, and login/settings controls. PostgreSQL-backed execution and rendered desktop/mobile acceptance remain open.

## Implemented Contract

- OIDC is enabled only when issuer, client ID, and client secret are all configured. Production requires HTTPS; non-production HTTP is limited to loopback. Issuer credentials, query strings, fragments, and oversized configuration values fail startup validation.
- `openid-client` performs issuer discovery, authorization URL construction, authorization-code redemption, and ID-token validation. The request asks only for `openid` and uses PKCE S256, state, and nonce.
- A separate random browser binding is stored only in an HttpOnly, SameSite=Lax callback cookie. The database retains only state and binding hashes, plus the short-lived verifier and nonce. Consumption is atomic, expires after ten minutes, and rejects replay.
- Login initiation is an unauthenticated GET. Account-link initiation is an origin-protected POST requiring a valid local session. The callback requires the initiating local user session before creating a mapping.
- The mapping key is the exact validated `(issuer, subject)` pair. An unmapped identity fails closed with a local-login/link instruction. The application does not request or inspect an OIDC email claim.
- Local password authentication and operator recovery cannot be disabled. Provider discovery is lazy, never participates in readiness, and resets after a failed attempt so a transient outage can recover without process restart.
- Persistent `oidc_identities` records use default-deny forced RLS and security-definer functions. A local user may link at most one subject per issuer, and one issuer-plus-subject may belong to only one local user.
- Canonical database backups now bind identity mappings and their digests. Restore inserts mappings after users and verifies an exact readback. Sessions and `oidc_auth_requests` remain excluded and are explicitly reported as excluded by the operator CLI.
- The sign-in screen shows the provider action only when configured. Workspace authentication settings list the exact mapping, use POST to start linking, support revision-bound unlink, and always display the active local-password path.

## Automated Verification

| Check | Result |
|---|---|
| Focused config, OIDC primitive, and canonical-backup tests | 3 files, 12 tests passed |
| Complete unit regression | 30 files, 183 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,926 modules; CSS 72,887 bytes; projects 37,132 bytes; issues 111,867 bytes; index 271,702 bytes; editor 402,713 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | App shell, setup state, linked-identity collection, and session returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. The unexecuted matrix includes clean migration 009, application-role grants, forced-RLS access, exact issuer/subject mapping, state and binding mismatch, replay rejection, local-session continuity, unlink conflicts, restart persistence, backup/restore, authorization-request exclusion, and verified populated pre-009 upgrade.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-001 | Optional OIDC exists without changing unconditional local setup, password login, password rotation, or recovery. Unmapped identities fail closed and provider outage leaves local login available. |
| R-101 | OIDC tables are forced-RLS with no direct application table grants; narrowly scoped security-definer functions own request consumption and identity mapping. |
| R-102 | State, browser binding, PKCE verifier, nonce, short expiry, atomic consumption, SameSite cookies, origin-protected linking, strict local return paths, and secret-safe logs cover the accepted service security boundary. |
| R-106 | Setup reports optional provider state while the API maintains stable versioned schemas for listed identities and revision-bound unlink. |
| R-107 | Migration 009, canonical identity digests, backup/restore insertion, transient-request exclusion, and the pre-009 backup gate are implemented. PostgreSQL execution remains required. |
| R-109 | Issuer, client, secret, provider label, callback registration, Compose propagation, third-party notices, and local recovery behavior are documented and build reproducibly from the lockfile. |

## Review Corrections

1. Linking originally shared the GET authorization-start route. That allowed a logged-in browser to begin a state-changing link flow without the unsafe-method origin check. The final API uses POST `/api/v1/auth/oidc/link`, requires the local session, returns a provider URL, and lets the web client navigate only after the protected request succeeds.
2. The initial scope requested `profile` even though no profile field is used. The final request asks only for `openid`, minimizing released claims.
3. The initial lazy discovery cache retained a rejected promise. The final cache clears on failure so later attempts can recover after a provider outage while readiness and local login remain unaffected.
4. Return-path defense now rejects scheme-relative paths, backslashes, credentials, controls, and cross-origin resolution at the API boundary, with a matching database constraint for stored requests.

## Pending Database Matrix

Run the existing integration suite against an isolated PostgreSQL migration URL and application password. It must prove clean migration 009, grants and forced RLS under `basiclinear_app`, one-time state plus binding consumption, mismatched/replayed callback rejection, same-session link enforcement, exact issuer-plus-subject isolation, mapping conflicts, local login during provider failure, unlink revision conflicts, restart persistence, identity-bearing backup/restore, zero restored sessions and authorization requests, and a verified populated pre-009 backup before upgrade.

## Pending Browser Matrix

At `1440x900` and `390x844`, verify provider-disabled login, provider-enabled login, local login during provider failure, unmapped failure copy, successful link return, linked identity truncation, unlink confirmation, keyboard focus, screen-reader labels, query cleanup, longest provider/issuer/subject values, and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors. Use only a synthetic provider and synthetic identities.

## Privacy And Authority

All automated checks use repository source, local generated values, and a synthetic provider adapter. No authenticated Linear observation, Google account, provider credential, provider token, user email claim, or private workspace data enters the evidence. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-48, complete CT-12, approve CT-13, pass database-backed P-T03/P-T04/P-T05/P-T14/P-T16/P-T17/P-T21, pass rendered P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
