# CT-135 workspace authorization contract

## Accepted slice

CT-135 implements I-203 only: the tenant and role portions of R-204, R-206, and R-219, validated by P-T203. It establishes the shared authorization boundary that later invitation, assignment, comment, billing, REST, and MCP work must call. It does not implement those later product flows, custom roles, SSO, SCIM, autonomous agents, code review, repository integration, or pull-request workflows.

## Canonical tenant authority

Firestore is the hosted authority. A protected request is scoped by an explicit opaque workspace ID and a verified principal; the service never infers workspace authority from a browser host, token owner alone, or an entity supplied without a workspace. The canonical membership lookup is:

```text
workspaces/{workspaceId}/memberships/{firebaseUid}
```

The stored membership must have schema version 1, the same workspace ID and user ID as the lookup, revision at least 1, status `active`, and exactly one supported role: `owner` or `member`. Missing, removed, malformed, custom-role, and foreign-workspace records all deny. Membership is read again on every authorization request; no browser, REST, or MCP credential caches membership authority.

Every client-readable hosted business record must carry `workspaceId` equal to its workspace path. The rules additionally verify the parent workspace of nested issue and project records. The safe read whitelist is limited to the workspace document, supported memberships, teams, projects, milestones, issues, comments, labels, statuses, views, and safe nested issue/project records. Identity metadata, trial/subscription entitlement, invitation secrets, token hashes, billing state, authorization evidence, and all other collections remain server-only.

## Role and action matrix

The shared service exposes one exhaustive action vocabulary. An active owner may perform every action. An active member may read the workspace and roster; read and write projects, milestones, issues, and comments; and execute already-authorized automation. Only an owner may manage workspace settings, invitations, memberships, personal tokens, billing, or export the complete workspace.

| Action group | Owner | Member |
|---|---:|---:|
| Workspace read | Allow | Allow |
| Active roster list | Allow | Allow |
| Project, milestone, issue, and comment read/write | Allow | Allow |
| Already-authorized automation execution | Allow | Allow |
| Settings, invitations, and membership administration | Allow | Deny |
| Token and billing administration | Allow | Deny |
| Complete workspace export | Allow | Deny |

The TypeScript union and matrix are closed at both compile time and runtime. Every request action is checked against the exhaustive vocabulary before role evaluation. An undeclared runtime value denies for both roles, and evidence records only the safe `unsupported` label rather than attacker-supplied action text. Unsupported stored roles are invalid rather than promoted.

## Trusted-handler boundary

`WorkspaceAuthorizationService` is the mandatory precondition for every future Firebase Admin handler. It validates the explicit workspace and principal, checks a personal token's credential workspace before any membership lookup, reads the exact current membership, applies the role matrix, and durably writes an authorization event plus audit record before returning a grant. An evidence-write failure fails closed. The writer uses one Firestore batch and stores both records inside the target workspace's server-only authorization collections.

The current browser proof route is:

```text
GET /api/v1/hosted/workspaces/{workspaceId}/access
```

It requires the same revocation-checked Google/Firebase bearer identity as bootstrap and the exact deployment-owned Origin policy from CT-134. The response exposes only the workspace ID, active role, and role-bounded capability names. Missing authentication returns a generic 401; removed, missing, malformed, unrelated, and foreign membership cases return the same generic 403; authorization infrastructure failure returns a redacted 503. No raw token, email, membership detail, foreign entity, or internal denial reason is returned.

REST personal tokens and MCP principals are represented without raw credentials. The only accepted evidence reference format is a server-generated `tokref_` prefix followed by exactly 32 lowercase hexadecimal characters; raw token formats, email addresses, uppercase variants, and arbitrary identifiers deny before membership lookup. Rejected input is never copied into evidence—the actor is the constant `patref:invalid`. CT-139 and CT-140 must resolve a credential, generate/store its opaque reference separately from the secret, and pass only that reference, explicit credential workspace, user ID, source, and requested action to this boundary.

## Firestore client boundary

Firestore rules deny by default. Active exact-workspace owners and members may read only the safe whitelist. A direct membership `get` additionally requires schema version 1, a supported role, revision at least 1, path ID equal to stored user ID, an allowlisted set of safe fields, and status `active` or owner-visible `removed`. Firestore membership collection queries are denied; the `membership.list` action is intentionally served through the trusted service so malformed or private roster fields cannot be returned by client rules. Removed, unrelated, custom-role, pending-status, unexpected-field, cross-workspace, unauthenticated, mismatched-record, and mismatched-parent reads deny.

All direct client creates, updates, and deletes deny, including owner writes. This is deliberate: privileged mutations use Firebase Admin and therefore must pass the shared trusted-handler authorization service, revision/idempotency checks, and domain invariants introduced by their owning implementation issue. The Admin SDK's ability to bypass Firestore rules is never treated as authorization.

## Audit and privacy

Each evaluated authenticated request creates a versioned `authorization.checked` event and a matching mutation-audit record with an opaque event/audit ID, request correlation, principal reference, target workspace/entity reference, safe action label, role decision, and privacy-safe internal denial classification. Raw bearer tokens, Firebase ID tokens, personal-token secrets, rejected token references, email addresses, undeclared action text, comment bodies, and Firestore error details are excluded. Denial evidence is server-only under Firestore rules. A membership lookup failure remains denied but is classified as authorization infrastructure unavailability, producing the same redacted 503 path as other authorization infrastructure failures rather than a misleading access-denied 403.

The authorization check records no protected disclosure or state change. Later business handlers remain responsible for their operation result and entity audit; they may not reinterpret a grant for another workspace, action, or request.

## Verification and evidence boundary

The in-memory and structural Firestore fixtures cover the complete owner/member action matrix, undeclared runtime actions, strict opaque token references, rejected email/credential-shaped references, removed and malformed roles, missing and foreign memberships, personal-token workspace mismatch, membership-store outage, stale credential reuse, evidence failure, exact membership lookup, atomic evidence paths, exact canonical Origin syntax, and safe HTTP responses. A supplied Origin must equal its canonical serialized origin exactly; userinfo, path, query, fragment, whitespace, and noncanonical variants deny before routing. The official Firebase rules-unit-testing harness runs against the local Firestore emulator and covers owner, member, removed, unrelated, custom-role, pending-status, unexpected-field, unauthenticated, cross-workspace, mismatched-record, mismatched-parent, denied roster queries, private collections, direct writes, and same-context post-removal cases.

This is implementation evidence only. O-202 and O-204 remain `baseline_needed`; no production tenant-isolation or outcome target is claimed.
