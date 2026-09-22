# CT-140 independent implementation review

## Independent Review 1

Status: **FAIL**. Severity: P0 0, P1 1, P2 3, P3 1.

The distinct read-only reviewer verified the original 431-file seal and all three embedded-semantic/raw Control Tower backup pairs before and after, fresh-read CT-140 revision 4 and CT-139 revision 11 through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

All prescribed mechanical gates passed: focused 5 files/20 tests; official Firestore Emulator 1 file/6 groups with clean shutdown after the expected restricted loopback failure and authorized rerun; full regression 103 files/675 tests; all 11 workspace typechecks; production build at 1,953 local and 30 hosted modules with 3/3 isolated hosted references; supported dependency tree; packaged-skill validation; offline runtime audit 0; and diff/JSON/workspace/input-universe checks. The review did not retry or circumvent the policy-blocked online registry audit.

The candidate is not Done-eligible because:

- Dynamic client registration rejects the MCP-required `application_type` field before the registration service is called, preventing conforming DCR clients from onboarding.
- Replaying an approved consent decision at or after the five-minute authorization-code expiry returns the same dead code while the ten-minute request remains live. The UI therefore offers an unusable client redirect rather than failing closed into a new authorization flow.
- The consent UI renders the non-unique client display name but not the immutable client ID, so two independently registered same-name clients are indistinguishable to the user.
- The audit evidence says all 14 package inputs belong to the registry-audited CT-138 Review 8 boundary, but only 7/14 are present there. All 14 match CT-139/current, and `.npmrc` is an additional exact CT-138/current audit input, so the inherited provenance must be narrowed rather than overstated.
- MCP `Accept` parsing discards non-`q` media parameters and malformed parameter syntax, allowing constrained or malformed media ranges to negotiate a bare JSON response.

The reviewer otherwise traced exactly 27 PM-only tools to the existing services and found no prohibited agent, code-review, repository, PR, token-administration, billing-purchase, or synchronization surface. Origin ordering, all seven direct-Firestore OAuth ledger denials, credential scans, skill safety, discovery-cache behavior, and the complete evidence-manifest boundary passed.

Review 2 must independently reproduce all five Review 1 counterexamples, rerun every required gate and the original adversarial matrix against a newly generated seal, and return no P0–P3 finding before CT-140 can move to Done. P-T208, O-204, public MCP/OAuth activation, live client/provider/deployment state, fresh online audit passage, combined-release acceptance, and legal/privacy/security approval remain unclaimed.

The revision-checked failure recording kept CT-140 In Progress and advanced it from revision 4 to revision 5. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-12-44-845Z-16b45c9c-bd2b-4dab-8742-97dbd736b75f.json`, with embedded semantic SHA-256 `312f32cd556f2000bb2edffafac232370608e20e8027034b9173ade0cd66aa99` and raw-file SHA-256 `b81ff5459c7cf5b34c99a7d6f66fe843e5b7b1dae50717e81c37812b57aedf0e`.

## Review 1 remediation and Review 2 dispatch

Status: **INDEPENDENT REVIEW 2 PENDING**. CT-140 remains In Progress at revision 6 on shared `S3 — Implementation`.

Every Review 1 finding has a source-level and executable remediation:

- Dynamic registration accepts and validates `application_type` values `web` and `native`, retains the exact redirect safety boundary, and rejects duplicate top-level JSON keys before registration.
- Consent view and deterministic replay validate the exact signed authorization-code record, require its unused revision-1 state, and require trusted time strictly before code expiry. Exact-expiry, expired, consumed, missing, or cross-bound records fail closed. The browser tells the user to start a new client authorization request.
- The rendered consent identity now displays the immutable client ID beside the non-unique client name; a server-rendered regression distinguishes two same-name registrations.
- `Accept` negotiation parses comma/semicolon structure without losing quoted syntax, validates token/quoted parameters and quality grammar, rejects empty or duplicate parameters, preserves representation constraints, and matches only the actual JSON/SSE charset representation.
- The audit evidence now limits inherited CT-138 Review 8 registry-audit provenance to eight exact inputs, including `.npmrc`. Seven other package manifests are separately attested only as byte-identical to CT-139 Review 4/current. No fresh online-audit claim is made or retried.

Primary remediation gates pass: focused 5 files/21 tests; official Firestore Emulator 1 file/6 groups with clean shutdown after the expected restricted loopback failure and authorized rerun; full regression 103 files/676 tests; all 11 workspace typechecks; production build at 1,953 local and 30 isolated hosted modules with 3/3 hosted references; supported dependency tree; packaged-skill validation; offline supported-runtime audit 0; and diff/JSON/asset checks.

The revision-checked Review 2 dispatch advanced CT-140 from revision 5 to revision 6 without changing its In Progress status or shared S3 milestone. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-23-02-617Z-d3fbaf92-ddfb-49e6-9e31-c9513b9cb910.json`, with embedded semantic SHA-256 `e2f76c5ce8d1b7d7ad616a73c4e335072acf0d8a1ff2434fa3af65860acd51ce` and raw-file SHA-256 `e2de8f08694d50b1c8c6df37e6163acc4645ac191d186c5bf96ec5acfe4d679e`. Projection remains disabled and `not_synced`; no Linear service or Control Tower UI was used.

Review 2 must verify the new complete seal and all five semantic/raw backups before and after, fresh-read CT-140 revision 6 and CT-139 revision 11, reproduce every Review 1 counterexample, rerun the complete required gate set and original adversarial matrix, and report no P0–P3 finding. P-T208, O-204, public MCP/OAuth activation, deployment, fresh online audit passage, legal/privacy/security approval, release acceptance, and excluded agent/code-review/repository/PR capabilities remain unclaimed.

## Independent Review 2

Status: **FAIL**. Severity: P0 0, P1 0, P2 1, P3 0.

The distinct read-only reviewer verified the 438-file candidate seal and all five embedded-semantic/raw Control Tower backup pairs before and after, fresh-read CT-140 revision 6 and CT-139 Done revision 11 through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

All five Review 1 findings were independently closed. The complete prescribed gates also passed: focused 5 files/21 tests; official Firestore Emulator 1 file/6 groups with clean shutdown; full regression 103 files/676 tests; all 11 workspace typechecks; production build at 1,953 local and 30 hosted modules with 3/3 isolated hosted references; supported dependency tree; packaged-skill validation; offline runtime audit 0; exact registry-audit ancestry; and diff/JSON/input-universe checks. The protocol, OAuth, tool/service parity, Firestore, privacy, skill, and prohibited-capability matrices exposed no other P0–P3 finding. No fresh online audit was attempted or claimed.

The candidate is not Done-eligible because cancellation is observed too late in the common `tools/call` path. The handler awaits OAuth access-token authentication before attaching the request-abort and response-close listeners. A client that closes while authentication is pending can therefore be missed, and the selected PM tool executes after authentication resolves. An actual built loopback probe returned one service call even though the connection had closed before authentication completed. The same common path includes mutation and destructive PM tools, so this is a P2 pre-work cancellation defect rather than a read-only response-delivery issue.

Review 3 must prove that abort/close tracking begins before asynchronous authentication, is initialized from the live request and response state, is rechecked immediately before response headers and application execution, and is cleaned up on every path. A delayed-authentication real-loopback regression must close the client, release authentication, and demonstrate zero service, audit, idempotency, and repository mutation. The complete Review 1 and Review 2 matrices, standard gates, evidence seal, backup checksums, and project-local API readbacks must remain green.

CT-140 remains In Progress. P-T208, O-204, public MCP/OAuth activation, live provider/deployment state, a fresh online audit, combined-release acceptance, legal/privacy/security approval, and excluded AI-agent/code-review/repository/PR capabilities remain unclaimed.

The revision-checked failure recording kept CT-140 In Progress and advanced it from revision 6 to revision 7. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-52-26-332Z-323bdf22-50da-4d84-89e8-dafa4c334a5f.json`, with embedded semantic SHA-256 `683b58653a9d751fe91968dff7ba0ee1ba3972743593cb4b437c9a16a13e5c99` and raw-file SHA-256 `8081a5a988201b7b3a8357d3e6d636494a9a166c342eaced020c21882378f44f`.

## Review 2 remediation and Review 3 dispatch

Status: **INDEPENDENT REVIEW 3 PENDING**. CT-140 remains In Progress at revision 8 on shared `S3 — Implementation`.

The `tools/call` handler now initializes cancellation from `request.aborted || response.destroyed`, attaches request-abort and response-close listeners before asynchronous OAuth authentication, and rechecks the tracked event plus both live properties after authentication, before SSE headers, and immediately before PM application execution. A cancellation also suppresses catch-path response writes, while `finally` removes both listeners on every return or error path.

The focused delayed-authentication mutation regression closes the exact Review 2 counterexample: it closes both request and response during the authentication await, then proves status and response writes remain empty, the PM mutation service is never called, the repository snapshot is unchanged, and both listener counts return to zero. A separate bounded built-handler loopback regression sends a valid `project.create`, destroys the real client socket while authentication is blocked, waits for the server-side close, releases authentication, and reports `closedBeforeAuthenticationResolved: true` with zero service calls, audit rows, idempotency records, and projects.

Remediation gates pass: focused 5 files/22 tests; official Firestore Emulator 1 file/6 groups with clean shutdown after the expected restricted loopback failure and authorized rerun; full regression 103 files/677 tests; all 11 workspace typechecks; production build at 1,953 local and 30 isolated hosted modules with exact 3/3 hosted references; supported dependency tree; packaged-skill validation; offline runtime audit 0; real-loopback cancellation; and diff/JSON/asset checks. No fresh online audit was attempted or claimed.

The revision-checked Review 3 dispatch advanced CT-140 from revision 7 to revision 8 without changing its In Progress status or shared S3 milestone. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T23-59-17-181Z-c97592cb-1b16-44ea-9d4b-6f5b22aaae9b.json`, with embedded semantic SHA-256 `296e4cf71269f686fcbad57220e99f3ac508c73ae1051dfcca902a14e3b9448b` and raw-file SHA-256 `1ed621961b7e15cd4c60d4ac4e6b54196bec55ecea92a2b52230fe5225a9c731`. Projection remains disabled and `not_synced`; no Linear service or Control Tower UI was used.

Review 3 must independently reproduce the delayed-authentication real-loopback close and already-aborted/destroyed variants, prove zero PM service/audit/idempotency/repository/response mutation and listener cleanup, retain all five Review 1 closures, rerun every required gate and original adversarial matrix, and verify the new complete 445-file seal and all seven semantic/raw backups before and after. Any P0–P3 finding keeps CT-140 In Progress. P-T208, O-204, deployment/public activation, fresh online audit passage, release acceptance, legal/privacy/security approval, and excluded agent/code-review/repository/PR capabilities remain unclaimed.

## Independent Review 3

Status: **PASS**. Severity: P0 0, P1 0, P2 0, P3 0.

The distinct read-only reviewer verified the 445-file candidate seal and all seven Control Tower backup checksum triplets before and after, fresh-read CT-140 revision 8 and CT-139 Done revision 11 through the project-local v0.8 API, and changed no file, task, provider, deployment, commit, or external state.

The Review 2 cancellation race is closed. The built real-loopback regression destroyed the client while authentication was blocked and returned `closedBeforeAuthenticationResolved: true` with zero service calls, audit rows, idempotency rows, or projects. An independent nine-variant built-handler matrix covered already-aborted and already-destroyed requests, events emitted before listener installation, close during authentication, close after headers but before work, success, validation failure, authentication failure, and listener cleanup. Every pre-work cancellation variant produced zero application or response mutation as applicable; the deliberate close after application work began retained the documented no-rollback boundary.

All five Review 1 findings remained closed. Dynamic registration, authorization-code chronology, immutable client-ID consent display, strict content negotiation, and narrow audit ancestry passed their independent counterexamples. The reviewer also compiled all 54 MCP input/output schemas, verified the exact 27 PM tools and shared protected execution site, traced shared-service authorization/idempotency/revision/audit parity, and found no prohibited agent, code-review, repository, PR, token-administration, billing-purchase, or synchronization capability.

All required gates passed: focused 5 files/22 tests; official Firestore Emulator 1 file/6 groups with clean shutdown; full regression 103 files/677 tests; all 11 workspace typechecks; production build at 1,953 local and 30 hosted modules with exact 3/3 isolated hosted references; supported dependency tree; packaged-skill validation; offline runtime audit 0 with exact narrow ancestry; real-loopback cancellation; and diff/JSON/input-universe checks.

The revision-checked project-local API completion advanced CT-140 from revision 8 In Progress to revision 9 Done on the existing shared `S3 — Implementation` milestone. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-26T00-23-01-367Z-57c8c8e5-7a20-42c4-a8c5-e7054a507f9c.json`, with embedded semantic SHA-256 `82100bab5827d25dd94514e15b179aff94c12eb0d893aa1a32f1e70c7a1d7387` and raw-file SHA-256 `d4d36f6272320ef852af712ae7ca9fa85238172436e022d300e74d84f23f17b2`. The completion readback is revision 9 Done with projection disabled and `not_synced`; no Linear service or Control Tower UI was used.

This closes I-208 implementation output only. P-T208, O-204, public MCP/OAuth activation, live provider/deployment state, fresh online audit passage, combined-release acceptance, and legal/privacy/security approval remain unclaimed. CT-141 owns operational budgets, abuse/rate limits, telemetry, restore drills, and cost controls; CT-142 owns integrated qualification.
