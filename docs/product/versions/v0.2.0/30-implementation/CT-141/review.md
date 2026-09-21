# CT-141 independent implementation review

## Independent Review 1 dispatch

Status: **PENDING**. CT-141 remains In Progress at revision 5 on the existing shared `S3 — Implementation` milestone until a distinct read-only reviewer returns a formal PASS with no P0–P3 finding.

The candidate implements one digest-bound operations policy, deterministic per-instance rate and abuse limits before stateful identity or PM work, redacted admitted/rejection telemetry, bounded Firestore queries and workspace export, an exact authenticated Google Pub/Sub budget boundary, idempotent and chronology-safe budget ledgers, a two-phase paid-Checkout stop gate, rebuilt cost-per-paid-seat guardrail evidence, whole-database isolated-restore evidence, server-only Firestore rules, and incident/runtime/backup runbooks. A same-interval review preserves warning/critical and stale budget state; only a strictly later interval can initialize a new zero-cost state.

Primary gates pass: focused 15 files/101 tests; official Firestore Emulator 1 file/6 groups after the expected restricted loopback EPERM and authorized rerun with clean shutdown; full regression 110 files/703 tests; all 11 workspace typechecks; full build at 1,953 local and 30 isolated hosted modules with exact favicon/hosted-JS/hosted-CSS references 3/3; production dependency tree; offline supported-runtime audit 0; diff/JSON checks; and the built three-instance load probe with exact credential/workspace stops, four redacted rate-limit signals, and no raw identifier in telemetry.

The fresh online npm audit was attempted once after the restricted registry DNS failure, then policy-blocked because it would disclose project dependency metadata to npm. It was not retried or circumvented and no fresh online-audit claim is made. The independent review must evaluate the exact sealed dependency inputs, permitted offline result, direct supported-runtime tree, and this limitation rather than infer registry passage.

The reviewer must verify the 482-file candidate seal and every cited semantic/raw Control Tower backup before and after; fresh-read CT-141 and all dependencies through the project-local v0.8 API; rerun every required gate; and independently probe rate-limit atomicity and redaction, pre-identity ordering, bucket exhaustion/clock regression, duplicate and divergent budget replay, out-of-order convergence, actual-spend thresholds, same-interval reset resistance, activation expiry/staleness/tamper, billing provider-call races, cost-report workspace/source/dimension completeness, query/export overflow with no partial output, restore inventory/chronology/isolation/tamper, provider-template relations, direct-Firestore denials, package/audit boundaries, and prohibited scope.

Any P0–P3 finding keeps CT-141 In Progress and requires bounded remediation plus a new seal and independent review. A PASS makes only I-209 implementation output eligible for the primary agent's revision-checked Done update. It does not qualify P-T209, establish O-203/O-204, activate a live budget/PubSub/Cloud Armor policy, prove a provider backup or restore, deploy Firebase/Cloud Run/Stripe, accept the combined release, or provide legal/privacy/security approval.

## Independent Review 1 result

Status: **FAIL**. Severity: P0 0, P1 0, P2 0, P3 1. CT-141 remained In Progress and the failure was recorded through the project-local v0.8 API at revision 6.

The reviewer verified the candidate and API boundaries before and after: 482/482 sealed files; all three raw, embedded-semantic, and recomputed-semantic backup pairs; CT-141 revision 5 In Progress on shared S3; and all six cited dependencies Done. Every required automated gate passed, including focused 15/101, official emulator 1/6, full 110/703, 11 typechecks, full build, hosted references 3/3, supported dependency tree, offline runtime audit 0, and the exact three-instance redacted load fixture.

The sole finding was completion-time clock-regression containment. `HostedOperationsControl.complete()` reused the strict admission clock, the HTTP `finally` did not contain that throw, and the production server discarded the rejected handler promise. The independent built reproduction emitted HTTP 200, then regressed the clock beyond tolerance and observed `OPERATIONS_UNAVAILABLE` with zero telemetry. Admission-time regression returned generic 503 but its rejection event was likewise suppressed by the regressed clock. This was a P3 availability/telemetry defect, not an authorization or data-isolation bypass.

All other adversarial boundaries passed: pre-identity atomic limits and redaction; duplicate, divergent, and out-of-order budget messages; same-interval warning preservation; two-phase Checkout stopping; complete one-micro cost evidence; 25,001-record export rejection with no partial output or writes; restore inventory, chronology, isolation, and tamper handling; provider/package/privacy relations; Firestore denial; and prohibited scope.

## Review 1 remediation

The remediation separates strict admission time from bounded telemetry time. Admission still fails closed with generic 503 on a regression beyond five seconds. Completion instead falls back to the already-trusted admission timestamp, emits exactly one redacted event with zero bounded duration, and cannot throw after an authoritative response. Admission-failure telemetry falls back to the last trusted timestamp so the generic 503 has one event. The top-level hosted server now contains any otherwise-unexpected handler rejection and redacts it.

Focused source and HTTP regressions prove authoritative 200 plus one completion event, generic admission 503 plus one rejection event, no raw network/credential values, and generic top-level 503/close behavior without rejected-value disclosure. A repeatable built probe is `scripts/tests/ct141-completion-clock.mjs`. Review 2 must independently close the original counterexample and recheck every Review 1 boundary before CT-141 can become Done-eligible.

## Independent Review 2 dispatch

Status: **PENDING**. CT-141 is revision 7 In Progress on the shared S3 milestone. The 491-file Review 2 candidate includes the exact Review 1 request/result evidence, both remediation source paths, four focused regression additions, the built completion probe, both revision-checked failure/dispatch requests, and all five cited semantic/raw Control Tower backups.

Primary remediation evidence passes: focused 16/105; built completion and original load probes; official emulator 1/6 with clean shutdown; full 111/707; all 11 typechecks; full build at 1,953 local and 30 isolated hosted modules; hosted references 3/3; supported dependency tree; offline runtime audit 0; exact policy/package relations; and diff/JSON checks. Review 2 must independently rerun these gates, reproduce every completion/admission/top-level rejection variant, retain every Review 1 adversarial boundary, verify 491/491 files and all five backup pairs before and after, and report no P0–P3 finding.

## Independent Review 2 result

Status: **FAIL**. Severity: P0 0, P1 0, P2 0, P3 1. CT-141 remained In Progress and the result was recorded through the project-local v0.8 API at revision 8.

Review 2 independently closed the Review 1 defect across post-response regression, invalid and throwing clocks, admission regression, sink/stderr failure, synchronous and asynchronous handler rejection, already-started response, response transport containment, and correlation-factory failure. Its sole new finding was an ordering gap: the admission catch called `writeJson` before `recordAdmissionFailure`, so a throwing 429/503 `writeHead` or `end` reached the top-level containment boundary without emitting the required rejection event. Limits, counters, identity calls, state, containment, and privacy remained correct; telemetry evidence alone was missing.

Every other required and retained gate passed, including 16/105 focused tests, built probes, emulator 1/6, full 111/707, all 11 typechecks, the 1,953/30 dual build and 3/3 hosted references, dependency/offline-audit/config/universe checks, budget and activation chronology, cost precision, overflow no-partial behavior, restore validation, Firestore denial, privacy, and excluded scope. Final integrity remained 491/491 and five of five backup pairs.

## Review 2 remediation

The 429/503 response write is now wrapped in `try/finally`, with `recordAdmissionFailure` executed exactly once in the bounded `finally`. A new full-handler/top-level-boundary matrix covers rate-limit 429 and clock-regression 503 with both `writeHead` and `end` failures. All four paths preserve the pre-rejection counter snapshot, call no identity/provider/repository work, emit one redacted status-correct event, disclose no private rejected value, and terminate through the server boundary without duplication.

The built `ct141-completion-clock.mjs` probe now includes the same four transport cases. Review 3 must close the exact Review 2 counterexample and retain all Review 1/2 automated, integrity, operations, provider-truth, privacy, and prohibited-scope boundaries.

## Independent Review 3 dispatch

Status: **PENDING**. CT-141 is revision 9 In Progress on shared S3. The Review 3 boundary seals 498 files and seven Control Tower backup pairs, including both historical review requests/results, both bounded remediations, the four-case full-handler test, and the expanded built probe.

Primary gates pass: focused 17/109; original load plus expanded completion/transport probes; emulator 1/6 with clean shutdown; full 112/711; 11 typechecks; 1,953/30 dual build and hosted references 3/3; dependency tree; offline audit 0; policy/template/config relations; and diff/JSON/universe checks. Review 3 must close both historical telemetry counterexamples, rerun every retained boundary, preserve 498/498 and seven of seven semantic/raw backup integrity, and report no P0–P3 finding before implementation-output acceptance.

## Independent Review 3 result

Status: **PASS**. Severity: P0 0, P1 0, P2 0, P3 0. CT-141 became implementation-output Done through the project-local v0.8 API at revision 10 after the reviewer returned the formal decision and the revision-9 precondition succeeded.

The reviewer verified 498/498 candidate hashes and all seven raw, embedded-semantic, and independently recomputed-semantic Control Tower backups before and after. Fresh API readback remained CT-141 revision 9 In Progress on shared S3 with CT-133/134/135/138/139/140 Done until the primary agent performed the authorized completion update.

Both historical findings are closed. Completion-time regression is no-throw and emits exactly one status-200 event at the trusted admission timestamp with zero duration; admission-time regression remains a generic 503 with one last-trusted-time event. Every 429/503 by `writeHead`/`end` transport-failure variant emits one status-correct redacted event, preserves counters and domain state, calls no downstream identity/provider/repository/service work, discloses no rejected value, and is contained without duplication.

All retained gates and probes passed: focused 17 files/109 tests; original load and expanded built transport probes; official emulator 1/6; full 112/711; all 11 typechecks; 1,953 local/30 hosted build with 3/3 references; dependency tree; offline audit 0; response/sink/factory failure containment; pre-identity atomic admission; budget framing, OIDC, replay and ordering; same-interval stop preservation; two-phase Checkout; one-micro cost completeness; 25,001-record export failure without partial output; restore inventory, chronology and isolation; Firestore denial; package/provider-template truth; privacy; prohibited scope; and the exact executable/evidence universe.

This PASS closes only I-209 implementation output. It does not qualify P-T209 or P-T210, establish O-203/O-204, activate live budget, Pub/Sub, Cloud Armor, Firebase, Stripe, provider backup/restore, or deployment state, accept the combined release, establish a fresh online registry audit, or grant legal/privacy/security approval.
