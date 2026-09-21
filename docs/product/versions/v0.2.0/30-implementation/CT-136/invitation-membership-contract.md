# CT-136 invitation and membership contract

## Boundary

CT-136 implements only I-204: basic owner-managed invitations and the pending-to-active membership transition for OpenLinear Online. Firestore is the hosted authority; the local SQLite product remains a separate authority with no synchronization path. The shared CT-135 authorization service is mandatory for every owner operation and is reused by future browser, REST, and MCP principals.

Notifications, custom roles, SSO, SCIM, billing checkout, assignment, comments, product AI agents, code review, repositories, and pull requests are outside this slice.

## Trusted records

- `workspaces/{workspaceId}/invitations/{invitationId}` stores the normalized invited email, owner/workspace display facts, member role, explicit `pending | revoked | accepted` status, trusted timestamps, current token digest, send count, active-seat result, and revision.
- `_invitationTokens/{sha256}` stores only a SHA-256 token digest plus opaque workspace/invitation linkage, version, expiry, `current | superseded | revoked | used` state, and a server-authenticated HMAC binding over its immutable fields.
- `workspaces/{workspaceId}/invitationIdempotency/{opaqueId}` binds one operation and request reference to its invitation and safe outcome. A server-authenticated HMAC covers every schema, path, request, invitation, token, outcome, and creation-time field.
- Active and removed memberships remain `workspaces/{workspaceId}/memberships/{userId}` records governed by the CT-135 exact-workspace contract.
- Mutation events and audits are stored under trusted-only workspace collections. They contain opaque IDs and booleans, never the raw invitation secret, invited email, Google credential, or idempotency key.

Firestore rules deny every direct client read or write to invitation, token, idempotency, event, and audit records. The trusted service alone may use them.

## Token and state invariants

An invitation secret is `inv_` followed by 43 base64url characters. The trusted service derives a high-entropy retry-safe secret using an HMAC-SHA-256 server secret and exposes it only in the successful create/resend response. Only its SHA-256 digest is persisted. The same secret authenticates an unambiguous tuple of token digest, workspace, invitation, version, creation time, and expiry; possession of Firestore write access alone cannot rebind an older token record to another invitation. The server secret must contain 32–512 bytes and is never a `VITE_` variable.

Each send expires after exactly seven consecutive 24-hour days from trusted server time. Stored creation, last-send, update, expiry, acceptance/revocation, send-count, and revision relationships are validated together; moving both expiry fields cannot extend the window. Resend rotates the secret, marks the preceding token `superseded`, increments the invitation revision and send count, and establishes a new seven-day window. At most ten sends are allowed. Revoke marks the current token `revoked`. Acceptance marks it `used`.

For a latest token, digest, version, creation time, expiry, workspace, invitation, lifecycle state, and cryptographic record binding must agree with the invitation record. A superseded token must be an older non-current version and retain the valid immutable binding created for that exact workspace/invitation tuple. Idempotency record ID, workspace, operation, request reference, invitation, token digest, outcome, and creation time must match both the exact trusted document path and the record HMAC; operation/outcome/token-digest shape is exhaustive. Create and resend retry paths read the expected token inside the transaction, verify its HMAC and exact invitation relation, and require its creation time to match the idempotency record before returning a raw secret. Revoke and acceptance retry paths likewise validate the current token and all relevant replay timestamps before returning their safe result. Acceptance additionally revalidates outcome-specific lifecycle facts: successful acceptance must match the invitation acceptance time, UID/email, used token, and active membership; mismatch, expiry, revocation, supersession, and already-accepted outcomes must remain temporally and structurally possible for their token and current invitation state. Any divergent, unauthenticated, contradictory, or time-regressed trusted ledger fails closed with a redacted availability error, discloses no invitation preview, and never replays a raw secret.

Derived owner/preview state is one of `pending`, `expired`, `revoked`, `accepted`, or, for an older secret, `superseded`. Expiry is derived from trusted server time; it does not mutate membership.

## Operations

Owner operations require an active owner decision for the exact workspace:

- `GET /api/v1/hosted/workspaces/{workspaceId}/invitations`
- `POST /api/v1/hosted/workspaces/{workspaceId}/invitations`
- `POST /api/v1/hosted/workspaces/{workspaceId}/invitations/{invitationId}/resend`
- `POST /api/v1/hosted/workspaces/{workspaceId}/invitations/{invitationId}/revoke`

Create also checks the exact trusted workspace, hosted-user, entitlement, and active-owner membership records, so browser, future REST, MCP, and personal-token callers cannot bypass the self-invite or ownership rules by omitting or spoofing presentation-layer facts. The workspace creation, owner-membership creation, and immutable trial-start anchors must agree; the hosted-user update cannot predate the workspace; and the trial interval remains exactly 30 consecutive 24-hour days. Every mutation uses a bounded idempotency key and a Firestore transaction with all reads preceding writes. Create, resend, and revoke reread the active owner and authoritative workspace inside that same transaction, closing a removal or ownership-change race after the initial shared authorization decision. Mutation time is sampled inside each transaction callback after its reads, then checked against every relevant authoritative source, invitation, and membership lifecycle timestamp before replay or write; a pre-bootstrap/regressed clock or Firestore retry cannot commit an earlier record, disclose a replay secret, misclassify trial eligibility, or activate a seat. Acceptance scopes the trusted idempotency identity by workspace, invitation, current token digest, authenticated UID/email, and client key; the browser session key is independently scoped by invitation and UID. A wrong-account attempt or rotated link therefore cannot poison the correct-account/new-link retry.

The token-held invited-member operations are POST-only so the raw secret never appears in a request URL:

- `POST /api/v1/hosted/invitations/inspect`
- `POST /api/v1/hosted/invitations/accept`

Inspection is anonymous but requires possession of a valid secret and returns only the invited flow's required facts. Acceptance requires a freshly verified Google identity whose normalized email exactly equals the invited email.

## Atomic acceptance and seat meaning

Wrong-account, expired, revoked, superseded, and already-used attempts never activate a membership. A wrong-account attempt does not consume the current token, allowing sign-out and retry.

A valid acceptance transaction creates one active `member` record when absent or reactivates the same exact-workspace removed member with a new revision. An already-active membership is reused without adding another active seat. The invitation becomes accepted and the token becomes used in the same transaction. Concurrent or repeated correct acceptance converges on one active membership and one first-acceptance event.

Pending invitations are never memberships and therefore never increase active-seat quantity. `activeSeatAdded` is true only when the transaction changes an absent/removed membership to active. CT-138 owns subscription quantity and billing reconciliation.

## Evidence and recovery

Create/resend emits a versioned `invitation.sent` event and matching `invitation.send` audit. Acceptance attempts emit privacy-safe `membership.accepted` event/audit evidence with `emailMatched`, `validInvitation`, and `firstAcceptance`; the O-202 metric counts only the valid first acceptance. G-202 reconciles an acceptance against the latest applicable send window for the same invitation, while O-202 preserves the first eligible workspace invitation as its cohort anchor. Revoke emits an `invitation.revoke` audit. Evidence writes share the mutation transaction.

Unknown/malformed tokens are enumeration-safe. Authenticated invited users receive distinct recovery codes for wrong account, expired, revoked, superseded, and already accepted states without unrelated-workspace data.

The hosted UI keeps the raw invitation in the browser fragment, displays inviter, workspace, invited email, expiry, and `member` role before acceptance, offers Google sign-out/retry for mismatches, and gives owners keyboard-reachable create, copy, resend, and confirmed revoke controls. Copy states that pending invitations are not active or billed seats.

## Evidence boundary

The implementation and automated checks support an I-204 output review. They do not constitute P-T204 qualification, a production deployment/security/privacy approval, an active-seat billing result, or success for O-202/O-204; those remain baseline-needed until their governed observation windows and later gates mature.
