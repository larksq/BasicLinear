# CT-134 implementation review

## Primary self-audit

The primary implementation session checked the complete CT-134 mutation boundary and the following adversarial cases:

- two tabs use different retry keys but converge on one UID eligibility record, workspace, owner membership, and trial;
- a later request with a changed server clock cannot grant another trial;
- the trial is exactly 30 consecutive days across a daylight-saving boundary and uses ISO-8601 UTC timestamps;
- password-provider, unverified-email, malformed identity, weak retry key, missing bearer token, hostile browser origin, unsupported route, and unsupported method cases fail closed;
- injected bootstrap fields and bodies over 1 KiB are rejected before identity verification or transaction work;
- the raw Firebase token and retry key do not appear in success or failure responses, and Firestore failures are redacted as server errors rather than misreported as authentication failures;
- the Firestore transaction writes the exact private eligibility, user, workspace, membership, and entitlement paths;
- the local HTML entry remains separate, no local-owner session is called by the hosted entry, and no automatic local upload or synchronization behavior exists;
- Firebase Hosting rewrites only API, MCP, and OAuth paths to one trusted service and the hosted bundle's referenced assets resolve; and
- no autonomous, code-review, repository, or pull-request surface is shipped.

The supported production dependency profile retains direct Firestore while omitting unused optional Cloud Storage and has a zero-vulnerability audit. The optional development tree advisory is recorded for CT-141 packaging enforcement and is not concealed as a clean full-tree audit.

## Independent gate

### Review 1 — FAIL

Reviewer `/root/ct134_independent_review`, distinct from `codex-primary`, verified the sealed 31-file manifest and all required checks, then reproduced one P2 origin bypass. The handler accepted an HTTP origin for an HTTPS host and accepted a hostile origin when the request supplied a matching `X-Forwarded-Host`. CT-134 was not eligible for Done.

### Remediation

Session CT-134-S3 removed all host and forwarded-host trust from browser-origin validation. Any request carrying `Origin` must now match a complete canonical deployment allowlist entry; scheme, host, and port are part of the decision. HTTPS is mandatory except for literal loopback emulator origins. Regression fixtures cover the exact scheme downgrade and forwarded-host spoof, a multi-valued forwarded host, duplicate origin headers, an unlisted direct Cloud Run origin, and an exact allowed origin.

### Review 2 — PASS

The same distinct read-only reviewer verified all 33 sealed hashes before and after the build. The original wrong-scheme and forwarded-host counterexamples now return 403. Independent probes also rejected port mismatch, spoofed or multi-valued forwarding metadata, duplicate and `null` Origin values, an empty allowlist, and an unlisted direct Cloud Run origin. Exact canonical allowlist matches return 201, and authenticated non-browser requests without `Origin` remain supported as documented.

The reviewer reran the targeted 5-file/22-test suite, full 79-file/521-test suite, all workspace typechecks, the production build and seven-asset probe, the supported-runtime audit at zero vulnerabilities, and diff validation. It regression-reviewed identity, revocation, transaction, trial, request, privacy, local/hosted separation, dependency, and prohibited-scope boundaries and found no P0–P3 issue.

Status: PASS. CT-134 is eligible for Done after this decision is recorded in the implementation handoff and a fresh revision-checked project-local Control Tower mutation/readback succeeds. O-201, O-203, and O-204 remain baseline-needed.
