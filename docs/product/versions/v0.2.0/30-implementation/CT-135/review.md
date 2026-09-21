# CT-135 implementation review

## Primary self-audit

The primary implementation session reviewed the complete CT-135 mutation boundary and exercised these adversarial cases:

- every declared action for an active owner and active member, including all six owner-only control groups;
- missing, removed, unrelated, cross-workspace, malformed custom-role, and personal-token workspace-mismatch callers;
- the same browser credential and the same Firestore authenticated context before and immediately after membership removal;
- exact membership document scope, invalid workspace fields, mismatched nested parents, and foreign-workspace paths;
- owner and member safe reads, supported active-roster queries, owner-only removed-member visibility, and private collection denial;
- all direct browser writes, including exact-workspace owner writes;
- missing credentials, generic denial responses, evidence-store failure, raw token/email/internal-detail redaction, and exact Origin enforcement inherited from CT-134;
- one Firestore batch for authorization event/audit evidence and fail-closed behavior when durable evidence is unavailable; and
- prohibited autonomous-agent, code-review, repository-integration, and pull-request scope.

The official Firestore emulator suite is separate from the default unit suite so ordinary tests cannot silently substitute a mock for rules evaluation. The production runtime dependency audit remains zero-vulnerability with development and unused optional dependencies omitted as defined by CT-134.

## Primary decision

The implementation output is ready for a distinct read-only independent review. The primary session does not mark CT-135 Done and does not claim P-T203 or RK-201/RK-211 cleared until the sealed manifest and adversarial checks pass independently.

## Independent gate

### Review 1 — FAIL

Reviewer `/root/ct135_independent_review`, distinct from `codex-primary`, verified all 18 sealed hashes before and after review and completed every required check. Automated checks were green, but five adversarial findings block Done:

- P2: an undeclared runtime action such as `workspace.destroy` is granted to both active roles because the TypeScript action union is not enforced at runtime;
- P2: arbitrary personal-token references, including email or credential-shaped text, are accepted and persisted inside actor evidence instead of requiring a server-generated opaque-reference format;
- P2: Firestore membership reads expose malformed records with `pending` status or a `userId` different from the membership path;
- P3: membership-store read failures are evidenced but returned as a misleading 403 instead of the contract's redacted availability 503; and
- P3: malformed Origin values containing path, userinfo, query, or fragment normalize to an allowed origin and are accepted.

The targeted 3-file/18-test suite, official emulator 1-file/6-test suite, full 80-file/529-test suite, every workspace typecheck, production build, zero-vulnerability supported-runtime audit, whitespace check, prohibited-capability scan, and 18/18 post-check hashes passed. These green checks do not override the adversarial failures. CT-135 remains In Progress and must be remediated, resealed, and independently re-reviewed.

### Remediation

Session CT-135-S2 closed all five Review 1 counterexamples:

- every action is runtime-checked against the exhaustive vocabulary; undeclared action text denies for owner and member and is replaced by `unsupported` in evidence;
- personal-token evidence accepts only `tokref_` plus 32 lowercase hexadecimal characters; invalid email, raw-token-shaped, uppercase, and short inputs deny and are represented only by `patref:invalid`;
- Firestore direct membership gets now require schema version, safe fields, exact path/user identity, supported role, revision, and exact active/removed status; collection queries are denied and roster listing is routed through the trusted service;
- membership read exceptions produce privacy-safe denial evidence and the redacted authorization-unavailable 503 path; and
- Origin headers must equal their canonical serialized origin, rejecting path, userinfo, query, and fragment variants.

Regression coverage increased the targeted suite to 3 files/22 tests and the full suite to 80 files/533 tests. The official emulator remains 1 file/6 scenario groups with new assertions for pending status, alias/path mismatch, schema mismatch, unexpected private fields, and denied membership queries. All typechecks, the production build, seven hosted asset references, the zero-vulnerability supported-runtime audit, whitespace check, JSON validation, and prohibited-scope scan pass.

### Review 2 — PASS

Reviewer `/root/ct135_independent_review`, distinct from `codex-primary`, verified all 19 sealed hashes before the checks and all 19 again afterward. No actionable P0-P3 finding remains.

The reviewer independently confirmed that undeclared actions deny before membership lookup across owner/member, web/REST/MCP, and user/personal-token forms; 28 invalid token-reference variants deny without persisting supplied values; membership-store outages retain privacy-safe evidence and return the redacted 503 path; exact-Origin adversarial variants deny while the canonical allowlist and documented no-Origin bearer form work; and malformed membership documents and every client roster-query form deny in the official emulator while valid active and owner-visible removed gets remain correct. Reused credentials also fail immediately after membership removal.

Required evidence passed: targeted 3 files/22 tests, official Firestore emulator 1 file/6 expanded scenario groups, full 80 files/533 tests, all 10 workspace typechecks, the complete build with 7/7 hosted asset references, supported-runtime audit with 0 vulnerabilities, clean diff and JSON validation, prohibited-scope scan, and complete Review-1 remediation-delta reconciliation.

Decision: CT-135 is eligible for Done after this result is recorded, the formal handoff validates, and a fresh revision-checked project-local Control Tower mutation/readback succeeds. Review 1 remains retained as the historical failure and remediation trigger.

## Outcome boundary

O-202 and O-204 remain `baseline_needed`. Passing implementation checks does not establish a production baseline, qualified release approval, legal/privacy approval, or public deployment readiness.
