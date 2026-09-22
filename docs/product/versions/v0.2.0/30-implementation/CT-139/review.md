# CT-139 independent implementation review

## Independent Review 1

Status: **FAIL**. Severity: P0 0, P1 1, P2 5, P3 3.

The distinct read-only reviewer verified the original 156-file seal and all three semantic/raw Control Tower backup pairs before and after, fresh-read CT-139 revision 4 and its accepted dependencies through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

Required automation passed: focused 9 files/81 tests, Firestore Emulator 1 file/6 groups, full regression 98 files/651 tests, all 11 workspace typechecks, production build at 1,953 local and 30 hosted modules with 3/3 hosted references, supported dependency tree, offline runtime audit 0, diff/JSON/OpenAPI-reference/prohibited-scope/built-secret checks. The review makes no fresh online-audit claim; it verified the inherited byte-identical CT-138 Review 8 audit boundary.

The candidate is not Done-eligible because:

- Firestore authorization accepts a membership with extra fields and a legacy nested-project collection rule can list an arbitrary document containing a private field.
- Token-create idempotency replays the current token after later use or revocation instead of requiring the exact revision-1 creation outcome.
- REST JSON mutations accept unsupported media types, and Node-collapsed duplicate Authorization headers are not rejected.
- Export does not require creator, assignee, and comment-author references to resolve to an exported active or removed membership.
- The evidence seal omits material full-regression, typecheck, and build inputs.
- Export responses use generic JSON instead of the declared versioned vendor media type.
- Entity routes accept undeclared query parameters.
- Raw-token download failures have no bounded user recovery message.

Review 2 must reproduce each counterexample against a substantially expanded seal, rerun every required gate, verify all original adversarial boundaries, and return no P0–P3 finding before CT-139 can move to Done. P-T207, O-204, public API activation, MCP/OAuth, deployment, legal/privacy/security approval, release acceptance, and excluded agent/code-review/repository/PR capabilities remain unclaimed.

## Review 1 remediation and Review 2 dispatch

Status: **INDEPENDENT REVIEW 2 PENDING**. CT-139 remains In Progress at revision 6 on shared `S3 — Implementation`.

Every Review 1 finding has a source-level and executable remediation:

- Server authorization accepts only the exact in-memory membership projection or the exact base/expanded persisted membership schemas. Firestore validates exact persisted keys and lifecycle state before using a membership, and legacy workspace/nested-project subcollections are direct-client deny-only.
- Token-create replay requires the signed token to remain the exact unused and unrevoked revision-1 creation outcome; create→use→replay and create→revoke→replay return `TOKEN_CONFLICT` without repository mutation or secret recovery.
- REST reads the uncollapsed distinct/raw header view, rejects duplicate sensitive headers, requires one JSON media type on every mutation before credential use (including exact empty-object actions), and rejects undeclared or duplicate route queries.
- Both browser and personal-token exports return the versioned vendor media type. The OpenAPI success content key matches it.
- Export verifies unique membership user IDs, the matching active workspace owner, and a membership-ledger reference for each project/milestone/issue creator, non-null assignee, and comment author. Active and removed memberships remain valid historical references.
- The raw-token download path revokes its temporary object URL after synchronous failure and gives the owner a manual select-and-save recovery message.
- Review 2 seals the complete workspace-owned `apps`, `packages`, `scripts`, `ops`, root configuration, and relevant v0.2/CT evidence input universe used by the required focused, emulator, full-regression, typecheck, build, dependency, and artifact checks. Generated build output, dependency installation, the live CT store, Git internals, user `outputs`, and the Review 2 request itself remain intentionally unsealed and are verified through named checks or excluded from the candidate.

Primary remediation verification passed: focused 9 files/84 tests; official Firestore Emulator 1 file/6 groups with clean shutdown after the expected restricted loopback failure and authorized rerun; full regression 98 files/654 tests; all 11 workspace typechecks; production build with 1,953 local and 30 isolated hosted modules; supported dependency tree; offline supported-runtime audit 0; diff check; and CT-139 JSON parsing. The dependency inputs remain byte-identical to the independently registry-audited CT-138 Review 8 candidate; this dispatch makes no new online-audit claim.

The revision-checked project-local API transition from CT-139 revision 5 to revision 6 created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T19-19-35-219Z-527db59f-ffe0-4693-b6d4-c8b05470f539.json`, with embedded semantic SHA-256 `d1f621a8f502d1eb000f25b65bcec2ef26a80e04c7485c5e5ccb4a3012ec127f` and raw-file SHA-256 `39ab85f882b251e6e9021a623622709e72e405279e4b42bb6ec3fac2c62d53a2`. Projection remains disabled and `not_synced`; no Linear service or Control Tower UI was used.

## Independent Review 2

Status: **FAIL**. Severity: P0 0, P1 1, P2 2, P3 2.

The same distinct read-only reviewer verified the expanded 395-file seal and all five semantic/raw Control Tower backup pairs before and after, fresh-read CT-139 revision 6 and the accepted CT-135/CT-137/CT-138 dependencies through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

All prescribed gates otherwise passed: focused 9 files/84 tests, Firestore Emulator 1 file/6 groups plus adversarial clean-shutdown probes, full regression 98 files/654 tests, all 11 workspace typechecks, production build at 1,953 local and 30 hosted modules with 3/3 hosted references, supported dependency tree, offline runtime audit 0, diff/JSON/OpenAPI/privacy/prohibited-scope/manifest checks. Review 2 independently closed all nine Review 1 counterexamples.

The candidate remained not Done-eligible because:

- Firestore exact-shape membership, project, and milestone reads accepted noncanonical timestamps, reversed PM chronology, and an impossible milestone target date.
- PUT assignment omitted the pre-credential JSON-media guard.
- Duplicate `Idempotency-Key` and `If-Match` framing was rejected only after stateful token authentication advanced the token record and wrote a token-use audit.
- Duplicate collection pagination keys returned `INVALID_REQUEST` instead of the contracted `INVALID_CURSOR`.
- Node parser-level malformed-request responses bypassed the JSON, `no-store`, and `nosniff` boundary.

The revision-checked failure recording kept CT-139 In Progress and advanced it from revision 6 to 7. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-04-32-284Z-539dd5b2-e4b8-4166-9805-e5bc025a1f4b.json`, with embedded semantic SHA-256 `54a9e055958910f3c3bf100c85d2c2b5aaea2b3ecd91ad47baec690a3adf8312` and raw-file SHA-256 `827f88dae6ccaa3a1aa1e20b48cce669e38b1fd3867f60ae29f75c5be7936c06`.

## Review 2 remediation and Review 3 preparation

Status: **REMEDIATED; REVIEW 3 DISPATCH PENDING**. CT-139 remains In Progress at revision 7 on shared `S3 — Implementation`.

- Firestore rules now enforce exact public workspace/project/milestone schemas; canonical generated IDs; bounded normalized text; real calendar dates including leap-year handling; fixed-width UTC millisecond timestamps; and membership/PM lifecycle chronology. The official emulator denies noncanonical membership timestamps, malformed/reversed project timestamps, impossible target dates, malformed milestone timestamps, extra-field workspaces, extra-field memberships, and every prior private/legacy path while preserving valid owner/member gets.
- A declared REST-mutation preflight now covers POST, PATCH, PUT, and DELETE routes. It validates the uncollapsed sensitive-header view, route-specific idempotency and revision forms, media type, body length, bounded stream size, and JSON framing before stateful token authentication. Parsed bodies are request-scoped and reused by the route, so validation does not consume or reinterpret the command.
- Collection duplicate `cursor`/`limit` keys now take the stable `INVALID_CURSOR` path; undeclared query keys retain `INVALID_REQUEST`.
- The hosted Node server installs an explicit `clientError` boundary that closes the socket with a redacted correlated JSON 400 response, exact byte length, `Connection: close`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. A real raw TCP duplicate-`Content-Length` probe reproduced the complete response and no parser input echo.

Primary remediation verification passes: focused 10 files/86 tests; official Firestore Emulator 1 file/6 groups with clean shutdown; full regression 99 files/656 tests; all 11 workspace typechecks; production build at 1,953 local and 30 isolated hosted modules with 3/3 hosted references; supported dependency tree; offline supported-runtime audit 0; and the raw parser probe. The dependency inputs remain byte-identical to the registry-audited CT-138 Review 8 boundary; no new online-audit claim is made.

Review 3 must verify the new complete seal and all semantic/raw backups, fresh-read CT state, reproduce every Review 1 and Review 2 counterexample, rerun the full required gate set and original adversarial matrix, and report no P0–P3 finding. P-T207, O-204, public API activation, MCP/OAuth, deployment, legal/privacy/security approval, release acceptance, and excluded agent/code-review/repository/PR capabilities remain unclaimed.

The revision-checked Review 3 dispatch advanced CT-139 from revision 7 to 8 without changing its In Progress status or shared S3 milestone. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-19-59-448Z-596f5cc1-da8a-4fda-8cb5-5485c389c9a5.json`, with embedded semantic SHA-256 `c2b9b7888c248dbce684828cf4c636649f5b1a65dec747bc2660ab2ddbbc0712` and raw-file SHA-256 `25f3737d25365a2b0bbbf435b0e83f77dfca1977783d986b0395b6ed1da7fc3b`. Projection remains disabled and `not_synced`; no Linear service or Control Tower UI was used.

## Independent Review 3

Status: **FAIL**. Severity: P0 0, P1 0, P2 1, P3 0.

The same distinct read-only reviewer verified the 403-file seal and all seven semantic/raw Control Tower backup pairs before and after, fresh-read CT-139 revision 8 and the accepted CT-135/CT-137/CT-138 dependencies through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

All prescribed gates otherwise passed: focused 10 files/86 tests, Firestore Emulator 1 file/6 groups with clean shutdown, full regression 99 files/656 tests, all 11 workspace typechecks, production build at 1,953 local and 30 hosted modules with 3/3 hosted references, supported dependency tree, offline runtime audit 0, diff/JSON/manifest checks, and the parser-error plus other malformed-framing probes. Every Review 1 and Review 2 counterexample remained closed.

The candidate remained not Done-eligible because a zero-byte body on a mutation with a required OpenAPI request body was converted to `{}` during preflight. Stateful personal-token authentication therefore advanced the token record and wrote token-use audit state before the route rejected the missing required fields. Whitespace-invalid JSON already failed without mutation; the gap was specific to zero bytes.

The revision-checked failure recording kept CT-139 In Progress and advanced it from revision 8 to 9. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-37-41-568Z-ef8ce716-a06b-489a-bbcd-34a07eafa820.json`, with embedded semantic SHA-256 `fa37d5b9a979214d8f387bb84fbd6b7802601ea8317eabf3a17274b94c46ff2f` and raw-file SHA-256 `7268a1919eadc9507014f4989d1741251b3440dc99db8fe12d731230482d193e`.

## Review 3 remediation and Review 4 preparation

Status: **REMEDIATED; REVIEW 4 DISPATCH PENDING**. CT-139 remains In Progress at revision 9 on shared `S3 — Implementation`.

The shared pre-authentication JSON reader now rejects a zero-byte body as `INVALID_REQUEST` instead of manufacturing an empty object. Because every declared REST mutation has a required JSON request body—including no-field actions whose exact body is `{}`—the rule applies uniformly before personal-token authentication.

An exact 13-route regression covers every declared POST, PATCH, PUT, and DELETE mutation. Each request declares zero bytes, receives HTTP 400, and leaves the complete repository snapshot byte-for-byte unchanged, including personal-token revision/last-use state, token-use audit, idempotency records, and PM entities.

Primary remediation verification passes: focused 10 files/87 tests; official Firestore Emulator 1 file/6 groups with clean shutdown after the expected restricted loopback failure and authorized rerun; full regression 99 files/657 tests; all 11 workspace typechecks; production build at 1,953 local and 30 isolated hosted modules with 3/3 hosted references; supported dependency tree; offline supported-runtime audit 0; and diff/JSON/asset checks. Dependency inputs remain byte-identical to the registry-audited CT-138 Review 8 boundary; no new online-audit claim is made.

Review 4 must reproduce the Review 3 zero-byte case across the complete mutation map, verify all Review 1 and Review 2 counterexamples remain closed, rerun the full required gate set and original adversarial matrix, and report no P0–P3 finding. P-T207, O-204, public API activation, MCP/OAuth, deployment, legal/privacy/security approval, release acceptance, and excluded agent/code-review/repository/PR capabilities remain unclaimed.

The revision-checked Review 4 dispatch advanced CT-139 from revision 9 to 10 without changing its In Progress status or shared S3 milestone. It created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T20-41-59-283Z-7c40fec5-6376-43e8-a9fc-b66f59841f6a.json`, with embedded semantic SHA-256 `354e18a6685c4104ca9ef6aa6f4bcd7ca0acfb1379f8274c5bf8df3ff874e9fd` and raw-file SHA-256 `4f4aa5ed38a909faa3ee07376901ff6a097f1ea4e1f494ff672ed3ef9399c506`. Projection remains disabled and `not_synced`; no Linear service or Control Tower UI was used.

## Independent Review 4

Status: **PASS**. Severity: P0 0, P1 0, P2 0, P3 0.

The same distinct read-only reviewer verified the complete 409-file seal before and after, recomputed all nine embedded-semantic and raw Control Tower backup checksum pairs exactly, fresh-read CT-139 revision 10 plus Done dependencies CT-135 revision 7, CT-137 revision 9, and CT-138 revision 19 through the project-local v0.8 API, and changed no file, task, provider, deployment, or external state.

Every required gate passed: focused 10 files/87 tests; official Firestore Emulator 1 file/6 groups; full regression 99 files/657 tests; all 11 workspace typechecks; production build at 1,953 local and 30 isolated hosted modules with 3/3 exact hosted references; supported dependency tree; offline supported-runtime audit 0; diff/JSON/input-universe checks. Dependency inputs remain byte-identical to the independently registry-audited CT-138 Review 8 boundary; this review makes no fresh online-audit claim.

Independent adversarial evidence closed the complete 13-route zero-byte-body defect before authentication with byte-identical repository state while preserving each exact `{}` action. It also passed the retained raw framing/parser/duplicate-header matrices; 90 personal-token, idempotency, lifecycle, scope, concurrency, and tamper probes; 40 exact-query checks; all 26 OpenAPI operations, 15 scopes, and 345 references; exact 1,001-record cursor enumeration and replay/forgery boundaries; export reference corruption, canonical digest, privacy, and removed-member history; Firestore rules; configuration; UI recovery; manifest completeness; and prohibited agent/code-review/repository/PR/MCP/OAuth scope scans.

CT-139 is implementation-output Done-eligible. This PASS does not qualify P-T207, claim O-204 success, activate a public API, add MCP/OAuth, deploy production, approve release/legal/privacy/security posture, or authorize excluded product scope.

The revision-checked project-local API then transitioned CT-139 from revision 10 In Progress to revision 11 Done on the existing shared `S3 — Implementation` milestone. The transition created `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-25T21-10-02-655Z-dfbed8f8-28d6-4100-a473-98343e50fa05.json`, with embedded semantic SHA-256 `785f1c074d6a82ecf043ac2d7196c50a7fbc8bd5f1a009947d6411bb6f1a8b00` and raw-file SHA-256 `b314da973b22d0b1e310eed1da32520359231f1b340930075ac3687400143188`. Fresh API readback confirmed CT-139 revision 11 Done and CT-140 revision 2 Todo on the same S3 milestone, with projection disabled and `not_synced`. No Linear service or Control Tower UI was used.
