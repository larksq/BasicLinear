# CT-137 implementation review

## Candidate output

The candidate adds the bounded hosted collaboration vertical slice: a strict issue/comment domain service, Firestore transaction adapter, trusted HTTP routes, runtime composition, responsive owner/member UI, direct-client-deny rules, and exact O-202 event integration. It does not introduce any excluded automation, agent, code-review, repository, pull-request, notification, attachment, reaction, mention, custom-role, billing, REST-token, export, or MCP feature.

The service requires shared CT-135 authorization, revalidates active transaction-time membership, restricts assignment to an active exact-workspace member, enforces owner assignment and assigned-member editing, applies optimistic revisions, preserves immutable comment authorship/time, and retains body-free deletion history. Retry records are completely HMAC-bound and reject request reuse, field tampering, lifecycle divergence, time regression, or a changed entity revision.

Events and audits are created atomically with domain changes. The exact accepted-member → assignment → assigned-member action → same-member comment chain uses one issue ID and canonical user references. Comment bodies are absent from measurement events, activity, errors, and audits; audit content changes are SHA-256 digests only.

## Primary verification

- Focused collaboration suite: 4 files, 16 tests passed (`collaboration-service`, `collaboration-http`, Firebase adapter, hosted web collaboration).
- Related hosted HTTP/config/foundation checks passed.
- Official Firebase Firestore emulator: 1 file, 6 isolation groups passed with clean shutdown.
- Full regression: 87 files, 582 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed for the trusted hosted service and both local/hosted web entries.
- Supported hosted-runtime audit: 0 vulnerabilities.
- `git diff --check` passed.

Focused adversarial cases cover concurrent retries, concurrent stale revisions, removed-member transaction races, removed/foreign assignment, member authority, author/owner comment moderation, immutable comment history, soft-delete tombstones, request-key reuse, idempotency field tampering, regressed membership time, malformed stored task fail-closed behavior, body redaction, exact request shapes, and trusted-API-only UI access.

## Independent-review gate

The user granted standing authority for a separate independent reviewer for CT-137 through CT-142. Review 1 verified the 62-file seal before and after and passed the backend authorization, concurrency, idempotency, privacy, Firestore, and real O-202-chain probes, but returned FAIL. It found one P1 incomplete-seal defect, two P2 owner/accessibility recovery defects, and one P3 unchanged-save feedback defect. CT-137 therefore remained In Progress at revision 5.

The remediation expands the next seal with all seven omitted direct runtime/build inputs, retains a removed assignee in the owner selector, gives inline comment editing an accessible label plus deterministic entry/return focus, and suppresses no-op task mutations with accurate feedback. Regressions cover each UI behavior. Review 2 must verify the expanded seal, rerun all required checks and historical counterexamples, and return explicit PASS with no actionable P0–P3 finding before Done.

Review 2 verified 70/70 hashes before and after, closed the removed-assignee, unchanged-save, comment-label/entry-focus, and Cancel-focus cases, and again passed the complete backend adversarial/O-202/privacy matrix. It nevertheless returned FAIL on two remaining findings: the hosted build seal omitted the direct UI token package/style and public favicon, and successful Save tried to restore focus while the remounted Edit button was still disabled. CT-137 remained In Progress at revision 6.

The Review 3 remediation retains the focus-restoration reference while a mutation is pending or the button is unavailable, retries after `pending` becomes false, and behaviorally verifies that no focus occurs while disabled and exactly one focus occurs after enablement. The next seal includes the omitted hosted assets plus the complete directly involved UI-package build inputs and prior Review 2 evidence.

Review 3 verified all 77 hashes before and after and closed every earlier product, accessibility, authorization, concurrency, privacy, Firestore, HTTP, idempotency, and O-202 counterexample. The real DOM harness confirmed entry focus, Cancel restoration, the disabled-button interval, and one delayed Save restoration. Review 3 nevertheless returned FAIL because the production Vite configuration still built local and hosted entries in one coupled graph: an in-memory change to unsealed local `index.html` changed hosted HTML references and hosted artifact hashes. The exact online npm audit was independently policy-blocked; the reviewer claimed only the clean offline audit/dependency tree. CT-137 remained In Progress at revision 7.

The Review 4 remediation gives production local and hosted builds distinct modes and input graphs. The local pass clears `dist`; the hosted pass preserves that directory but accepts only `hosted.html` as its graph input. A no-write regression builds hosted output twice, injects an in-memory local-entry mutation on the second run, verifies the mutation is never applied, and compares every emitted hosted filename and byte. The full build now transforms 1,953 local modules and only 30 hosted modules; generated `hosted.html` has 3/3 resolving references and no local/editor preload.

Primary post-Review-3 verification is green: focused 5 files/23 tests, official Firestore emulator 1 file/6 groups with clean shutdown, full 87 files/584 tests, all 10 typechecks, complete build, exact hosted reference probe, online supported-runtime audit with 0 vulnerabilities, and clean diff/JSON checks. Review 4 must independently reproduce the local-mutation invariance proof, verify the expanded seal, and close all historical cases before any Done transition.

Review 4 returned formal PASS with no P0–P3 finding. It verified all 78 hashes before and after, independently applied potent no-write mutations to both unsealed local entry inputs, observed the local graph change, and proved the isolated hosted graph fired neither mutation hook while preserving all three hosted filenames and bytes. It also passed focused 5/23, emulator 1/6, full 87/584, all 10 typechecks, the merged-output/Firebase inspection, the real DOM focus/recovery matrix, 60/60 signed-record tamper cases, 6/6 key-reuse conflicts, 6/6 replay-after-removal cases, rejected-mutation atomicity, HTTP redaction/security, direct Firestore denial, exact fixture-only O-202 linkage, privacy, dependency, backup, exclusion, and manifest-completeness checks.

The reviewer could not make an independent online audit claim because sandbox DNS failed and scoped registry access was policy-rejected. Its offline supported omit profile reported zero vulnerabilities and the dependency tree resolved; the primary registry-backed audit separately passed with zero. Review 4 makes CT-137 implementation output Done-eligible only. It does not qualify P-T205 or establish deployment, release acceptance, security/privacy/legal approval, or O-202/O-204 achievement.

## Outcome boundary

O-202 and O-204 remain `baseline_needed`. Green implementation checks do not qualify P-T205 and do not establish production deployment, security/privacy/legal approval, billing correctness, combined release approval, or outcome achievement.
