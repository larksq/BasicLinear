# CT-136 implementation review

## Review 1 — FAIL; remediation complete

Independent reviewer `/root/ct136_independent_review`, distinct from `codex-primary`, verified all 45 sealed hashes before and after checks and returned FAIL. CT-136 remains In Progress and is not Done-eligible.

Review 1 found two P1 and two P2 defects:

- the invitee UI reused one acceptance idempotency key across identities and links, so a wrong-account attempt made the documented correct-account retry return `INVITATION_CONFLICT`;
- a valid resend/accept after the original seven-day window could make G-202 reconcile against the original opaque-ID-sorted send and throw `UNRECONCILED_AUDIT`;
- coordinated trusted-record expiry extension and foreign id/workspace values in an idempotency record were not rejected, allowing day-nine acceptance or raw-token replay; and
- the sealed manifest omitted the direct O-202 consumer `packages/hosted/src/outcome-report.ts`, where the integration defect existed.

All standard checks still passed, which demonstrates why the adversarial independent gate is required.

### Remediation

- Acceptance idempotency is now scoped by link digest and authenticated identity in the trusted service, while the browser session key is scoped by invitation and UID and clears after an email mismatch. Wrong-account/correct-account and old-link/new-link reuse now converge without collision.
- G-202 now selects the latest send whose seven-day window actually contains the acceptance and reconciles every send audit. The first eligible invitation remains the O-202 cohort anchor, so a late resend does not rewrite the outcome denominator or window.
- Invitation/token records enforce exact seven-day duration, ordered lifecycle timestamps, send-count/revision state, current-token creation/expiry/version, and exact idempotency path ID/workspace/operation plus exhaustive outcome/token shape. Coordinated expiry extension and foreign id/workspace replay fail closed.
- Review 2 expands the seal to include `packages/hosted/src/outcome-report.ts`, the retained Review 1 request, and the full direct evidence boundary.

### Review 2 — FAIL; remediation complete

The same independent reviewer verified the expanded 47-file seal before and after every check, independently closed all four Review 1 counterexamples, and still returned FAIL on two new adversarial defects:

- P1: trusted acceptance time was sampled before the transaction. A regressed clock—or a transaction retry using an earlier captured time—could activate a seat while persisting `acceptedAt`/`updatedAt` before `lastSentAt`, leaving a record that failed its next read.
- P2: a superseded token record had no server-authenticated immutable binding. Replacing only its workspace/invitation linkage with another resent invitation could pass the older-token branch and disclose the foreign workspace name and invited email during anonymous inspection.

All required Review 2 gates were green: 47/47 pre/post hashes, focused 7-file/54-test matrix, official emulator 1-file/6-group matrix, full 83-file/554-test suite, all 10 typechecks, production build with 7/7 assets, supported-runtime audit at zero vulnerabilities, and clean diff/JSON/excluded-scope checks. Those results do not override the lifecycle/privacy failures.

Session CT-136-S3 closes both counterexamples:

- create, resend, revoke, and acceptance sample trusted time inside each transaction callback after reads; any time earlier than the stored invitation or membership lifecycle fails before a write, and a simulated retry proves the committed attempt resamples time;
- every token ledger record carries a secret-keyed HMAC over an unambiguous tuple of digest, workspace, invitation, version, creation, and expiry; constant-time verification precedes every lifecycle branch, so rebinding current or superseded tokens fails without preview disclosure; and
- direct regressions cover regressed acceptance/resend/revoke with no seat/evidence change, a two-attempt transaction retry committing only the second timestamp, and cross-workspace superseded-token rebinding with no foreign email/name leakage.

### Review 3 — FAIL; remediation complete

The independent reviewer verified all 48 sealed hashes before and after the prescribed gates, closed all six earlier findings, and returned FAIL on one new P2 lifecycle-integrity defect. The focused 7-file/57-test matrix, official emulator, full 83-file/557-test suite, all 10 typechecks, production build with 7/7 hosted references, runtime audit at zero vulnerabilities, and diff/JSON checks were green. Token state/field probes passed 11/11.

The remaining counterexample placed the already-stored workspace, owner membership, hosted user, and trial at `2026-12-01T00:00:00Z`, then sampled create time one second earlier. Create still persisted an invitation and event before the workspace lifecycle began and labeled the workspace ineligible for its trial.

Session CT-136-S4 closes that gap:

- create parses the exact authoritative workspace, hosted-user, entitlement, and owner-membership records, checks their cross-record bootstrap anchors, and rejects any transaction time earlier than any source timestamp before idempotency replay or mutation;
- create, resend, and revoke reread active owner authority and workspace ownership inside the mutation transaction, so removal after the initial CT-135 authorization decision denies with no invitation lifecycle change; and
- direct regressions prove the Review 3 pre-bootstrap clock and create/resend/revoke owner-removal races produce no invitation, token, idempotency, event, audit, or seat mutation.

### Review 4 — FAIL; remediation complete

The reviewer verified all 49 sealed hashes before and after the complete gate matrix, confirmed all seven historical findings remained closed, and returned FAIL on one P2 replay-integrity defect. Every prescribed automated, emulator, type, build, asset, audit, diff, JSON, privacy, scope, owner-race, and manifest check otherwise passed.

The create transaction checked replay time only against bootstrap authorities. A create at `00:00:02` followed by the same request at `00:00:01` returned `changed=false` and the same raw secret. Replacing the current token record's HMAC binding with a divergent value produced the same replay result because that branch did not read the token ledger.

Session CT-136-S5 closes that final replay gap:

- create includes the expected token record in its initial transaction reads, verifies its HMAC and invitation relation, requires invitation/idempotency/token creation times to agree, and rejects time regression before any raw-secret return;
- resend validates the exact expected token and replay time before returning its retry-safe secret, while revoke and acceptance validate their current token/lifecycle before a safe replay; and
- direct regressions cover regressed create replay, create replay with a divergent HMAC binding, and resend/revoke replay with a divergent token ledger, asserting unchanged snapshots and no secret in errors.

### Review 5 — FAIL; remediation complete

The independent reviewer verified all 50 sealed hashes before and after the full gate, closed all eight historical findings, and returned FAIL on one P2 replay-integrity defect. The focused 7-file/62-test matrix, official emulator, full 83-file/562-test suite, all 10 typechecks, production build with 7/7 hosted references, supported-runtime audit at zero vulnerabilities, and diff/JSON/privacy/scope checks all passed.

An accepted invitation at `00:00:03` still replayed successfully after only its idempotency `createdAt` was changed to `00:00:02`. The replay branch checked only that this unauthenticated timestamp did not exceed the new transaction time; it did not bind the record to the accepted invitation, used token, accepted identity, or active membership lifecycle.

Session CT-136-S6 closes the record-level and outcome-level gaps together:

- every invitation idempotency record now carries a server-authenticated HMAC over its complete schema, path identity, operation, request reference, invitation, token digest, outcome, and creation time; any field change fails constant-time verification before replay;
- acceptance replay validates the authentic outcome against current trusted lifecycle facts: `accepted` requires the exact invitation acceptance/update time, accepted UID/email, used token, and active membership, while mismatch, expiry, revocation, supersession, and already-accepted outcomes retain their required temporal/state relations; and
- direct regressions reproduce the Review 5 timestamp mutation with unchanged state/no secret disclosure, reject an authentic accepted record against a contradictory acceptance lifecycle, and prove retry behavior for every authentic non-success acceptance outcome.

### Review 6 — PASS

The independent reviewer verified the final 51-file seal before and after every check and found no actionable P0–P3 issue. The exact Review 5 `00:00:03 → 00:00:02` accepted-idempotency mutation now fails closed with unchanged state, two unchanged active seats, and no secret or private disclosure.

Independent adversarial coverage passed:

- 40/40 single-field idempotency changes across create, resend, revoke, and accept;
- 6/6 acceptance outcomes across later valid lifecycle changes, including resend, correct acceptance, and membership removal;
- all nine historical Review 1–5 counterexamples;
- focused 7-file/65-test, official emulator 1-file/6-group, full 83-file/565-test, all 10 typecheck, build/7-reference, runtime-audit-zero, diff, and JSON gates; and
- Planning plus CT-133/134/135 dependencies, privacy, O-202/G-202, UI/accessibility, excluded scope, and manifest completeness.

Decision: CT-136 implementation output is eligible for Done after a fresh revision-checked project-local Control Tower mutation/readback. This PASS does not qualify P-T204 or establish deployment, release, billing, legal/privacy/security approval, or O-202/O-204 achievement.

## Implemented output

The candidate adds an owner-managed seven-day invitation state machine, digest-only one-time secrets, explicit pending/expired/revoked/accepted/superseded states, atomic exact-email Google acceptance, and absent/removed-to-active membership transitions. Pending invitations never create membership records. Correct concurrent/retried acceptance converges on one active member and one first-acceptance event.

The shared CT-135 service authorizes owner operations for web, future REST, MCP, and personal-token principals. Create checks the trusted hosted-user email even when no caller email is supplied. Every mutation uses bounded, fully HMAC-bound idempotency and a Firestore transaction, samples time within each transaction attempt after reads, and rejects lifecycle time regression before writes. Token/invitation workspace, digest, version, expiry, HMAC binding, acceptance-outcome replay, and lifecycle invariants fail closed on ledger divergence.

The trusted HTTP service exposes owner list/create/resend/revoke and token-held inspect/accept routes. Raw tokens occur only in create/resend response bodies and invited-flow POST bodies, while browser links keep them in fragments. Rules keep invitation, token, idempotency, event, and audit records server-only.

The hosted UI shows all pre-acceptance facts required by Planning, distinct recovery states, Google sign-out/retry, pending-seat copy, and keyboard-reachable owner controls with explicit revoke confirmation. It adds no notification, custom-role, SSO, SCIM, billing, assignment/comment, agent, code-review, repository, or pull-request surface.

## Current remediated evidence

- Review 5 remediated invitation/measurement/config/HTTP/web/repository suite: 7 files, 65 tests passed.
- Official Firestore emulator: 1 file, 6 scenario groups passed and shut down cleanly.
- Review 5 remediated full regression: 83 files, 565 tests passed.
- All 10 workspace typechecks passed.
- Production build passed; all 7 hosted HTML asset references resolve.
- Supported hosted-runtime audit reports 0 vulnerabilities.
- Diff, JSON, and bounded prohibited-capability checks pass.

The tests cover retry-safe create, replay-time and replay-ledger integrity, complete idempotency-record authentication, outcome-specific accepted replay, valid retries for all non-success acceptance outcomes, authoritative bootstrap-clock ordering, in-transaction owner removal, per-attempt trusted time, clock-regression rejection, exact seven-day expiry, resend rotation and supersession, cryptographically authenticated token records, cross-workspace superseded-token rebinding, applicable-resend G-202 reconciliation, revoke, malformed/unknown secrets, wrong-email non-consumption and correct-account retry with one client key, new-link reuse, correct replay, concurrent acceptance, removed-member reactivation, owner/member and web/REST/MCP/token authorization, trusted-record self-invite protection, coordinated expiry and idempotency-record tampering, token-ledger divergence, response/privacy redaction, HTTP body/identity/error contracts, web recovery copy, and direct Firestore denial of private records.

## Review focus

The independent reviewer should try to break cross-workspace and owner-only authorization; recover raw secrets from storage/evidence/URLs; replay or cross-link token versions; accept after resend/revoke/expiry or with the wrong Google account; add more than one membership/seat under concurrency; bypass self-invite checks through non-browser principals; exploit idempotency reuse; make Firestore partial writes; leak unrelated workspace facts; or expose excluded product capabilities.

## Outcome boundary

O-202 and O-204 remain `baseline_needed`. Passing implementation checks does not establish P-T204, production readiness, legal/privacy/security approval, billing correctness, public release approval, or an outcome result.
