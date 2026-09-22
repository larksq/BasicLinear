# CT-138 implementation review

## Candidate output

The candidate implements the bounded I-206 commercial-access slice for the hosted product. It preserves the original immutable Firebase bootstrap trial, adds trusted billing and entitlement records, exact monthly and annual per-active-seat choices, a Stripe Checkout/provider adapter, raw signed webhook handling, current-provider reconciliation, active-seat proration, data-preserving Free fallback, and an owner recovery path that can remove a non-owner member without deleting work.

The browser can choose only `monthly` or `annual`; all price IDs, unit amounts, currency, recurrence, customer/subscription/workspace binding, active-seat quantity, trial behavior, return origins, automatic tax, and proration are server-owned. One singleton Checkout lock per workspace prevents parallel tabs, keys, or plan choices from opening multiple provider sessions. Provider-confirmed expiry releases the lock, seat drift seals a just-created session before asking the owner to retry, and an idempotent same-key retry can recover a prepared lock after provider creation plus two persistence failures.

Webhook events are notices, not entitlement authority. The service verifies the unparsed bounded body with the provider SDK and a nonzero tolerance, stores one authenticated receipt, retrieves the current subscription, validates every binding including automatic tax, and converges duplicate or out-of-order delivery on current state. Only a correctly bound `active` subscription with a future paid-through boundary grants paid Pro. Inactive lifecycle notices persist the authoritative downgrade without attempting quantity proration. Replacement Checkout remains blocked for every recoverable/nonterminal prior subscription and is allowed only after coherent `canceled` or `incomplete_expired` state.

Free preserves tasks, comments, invitations, memberships, and workspace data. The verified active owner remains the only basic interactive writer; extra members, personal tokens, automation, new invitations, and assignment to another user pause. Existing invitations remain revocable. Workspace data is readable and eligible for the future CT-139 export path, but CT-138 correctly reports that export is not yet available. Active provider quantity changes use stable authenticated idempotency references bound to workspace, subscription, billing revision, and membership state.

## Independent Review 1 and remediation

Independent Review 1 verified its 118-file seal before and after and returned **FAIL**. It found two P1, three P2, and one P3 defects: replacement Checkout beside a recoverable unpaid subscription; a permanent prepared-lock failure mode; proration before recording inactive provider state; provider idempotency-key collisions across subscriptions and recurring member sets; missing automatic-tax validation/disclosure; and an export-availability overclaim.

The Review 2 candidate closes each counterexample:

- every nonterminal/recoverable prior subscription blocks replacement, preventing a later recovery from producing two provider subscriptions;
- same-key retry binds an idempotently returned open, expired, or completed provider session to the prepared lock, and an expired result releases a subsequent explicit choice;
- only active subscriptions receive prorated quantity updates, while inactive current-provider state is recorded directly;
- quantity-update references bind the exact subscription, billing revision, and membership fingerprint while remaining stable for the same retry;
- every provider subscription read/update requires automatic tax enabled, and the owner UI discloses automatic tax;
- billing summaries separate `exportEligible: true` from `exportAvailable: false`, with UI copy pointing to CT-139 without implying a current export operation.

Exact regression tests reproduce the dual-persistence lock, recoverable-subscription replacement, canceled-with-seat-drift notice, cross-subscription/repeated-membership idempotency, automatic-tax-disabled readback, and export-claim boundaries.

## Independent Review 2 and remediation

Independent Review 2 verified its 119-file seal before and after and returned **FAIL** with three P1 and one P2 findings. A completed provider session could remain permanently prepared/unbound when finalization failed and membership drifted; a retry after provider idempotency retention could create a later open session that failed chronology validation before cleanup; the Stripe adapter could prorate before rejecting automatic tax disabled; and a duplicate completed-Checkout notice could reject a supported current plan change for the same subscription.

The Review 3 candidate closes those exact boundaries:

- prepared records defer seat-drift handling until the provider state is known, and a single completed session is durably bound despite later membership drift so its signed notice can reconcile the authoritative current seat count;
- every provider attempt has an authenticated attempt number/time and an opaque exact-metadata Checkout reference; after the idempotency window, bounded paginated recovery discovers every prior session for that reference, expires open sessions, rejects multiple completions, and advances to a new provider attempt only when prior attempts are absent or expired;
- provider creation time is preserved separately from logical Checkout creation time, preventing later legitimate attempts from being rejected against an earlier attempt's expiry window while keeping chronology authenticated;
- the Stripe adapter validates the complete current subscription before mutation and explicitly preserves automatic tax in the quantity update;
- first activation still requires exact historical Checkout plan/price, while an already-completed Checkout binds later duplicate notices by immutable customer/subscription identity and permits convergence to another supported current provider plan/price.

Exact regressions cover the completion/expiry race plus membership drift, delayed provider-key pruning with an expired old session and a new bound attempt, zero mutation when the preflight subscription disables automatic tax, update-time automatic-tax preservation, and same-event monthly-to-annual current-state convergence.

## Independent Review 3 and remediation

Independent Review 3 verified its 120-file seal and all six CT backup checksum pairs before and after, reran every required gate, and returned **FAIL** with three P1 findings. Account-wide Checkout recovery stopped after 1,000 unrelated sessions; quantity reconciliation did not carry the service's exact expected subscription binding into the adapter's immediate pre-mutation read; and cleanup fallback could sign a provider creation timestamp that the canonical reader rejected as far-future.

The Review 4 candidate closes those exact counterexamples:

- provider recovery enumerates the complete already time-bounded Checkout window without a global-record cap, retains only exact opaque-reference sessions, and rejects empty or repeated cursors; a synthetic match at record 1,001 is returned after 11 pages;
- quantity updates carry customer, workspace, owner, plan, price, current quantity, active state, paid-through, and cancellation expectations into the adapter, which validates them before mutation and again on the returned state; the domain service independently blocks any divergent post-update identity before persistence;
- the primary and cleanup/fallback paths call one trusted-current-time chronology guard before writing provider creation time, so a far-future session is expired without an unreadable signed record and the valid prepared attempt later rearms.

Exact regressions cover six structurally valid between-read binding changes with zero provider update, a forged foreign post-update result with unchanged billing storage, cursor non-progression, record-1,001 recovery, far-future primary/fallback rejection, same/different-key behavior, and bounded rearm.

## Independent Review 4 and remediation

Independent Review 4 verified its 121-file seal and all eight CT backup checksum pairs before and after, reran every required gate, and returned **FAIL** with one P1 finding. A completed Checkout carrying a far-future provider creation timestamp correctly remained outside canonical chronology, but a completed provider session could not be expired. At 25 hours and on repeated retries recovery kept selecting that completion rather than rearming, while signed-notice reconciliation required a session binding that did not exist. The workspace could therefore have one provider subscription without Pro access and no safe path to another Checkout.

The Review 5 candidate closes the exact completion race without opening a second provider session:

- only an exact completed session may use the exceptional path; open and expired future sessions retain the strict rejection-and-rearm behavior;
- canonical Checkout chronology remains the trusted attempt time plus the bounded logical expiry, while a separate field stores only a tamper-evident digest explicitly labeled as untrusted provider chronology—the raw far-future timestamp is never stored as authoritative Checkout time;
- the session must match the authenticated prepared Checkout, singleton lock, workspace, owner, plan, price, and quantity before it is bound once, and binding alone never grants paid access;
- the verified signed notice freshly retrieves the exact current provider subscription and matches session, customer, subscription, workspace, owner, plan, price, and current active-seat state before completing the Checkout and billing ledger;
- if primary persistence failed and completed-session expiry was a no-op, the verified notice can create the missing binding transactionally from the prepared Checkout, while duplicate notices converge idempotently;
- same-key, different-key, 25-hour, and repeated retries keep one provider session and one provider subscription and never rearm blindly.

Exact regressions cover primary completed response, chronology-digest tamper, same/different keys, 25-hour and repeated retries, one provider session, signed-notice convergence, duplicate delivery, primary persistence failure, completed-session expiry no-op, and direct notice recovery without an intervening Checkout retry.

## Independent Review 5 and remediation

Independent Review 5 verified its 122-file seal and all ten CT backup checksum pairs before and after, reran every required gate, and returned **FAIL** with one P2 finding. Direct signed-notice recovery created the authenticated `ready` Checkout and session binding in its preflight transaction, while completion, paid billing, webhook receipt, and activation evidence were deferred to a second transaction. An injected failure between those commits left a bounded partial state. It granted no entitlement, disclosed nothing, created no second provider session, and later notices converged, but it violated the sealed transactional-once contract.

The Review 6 candidate makes the preflight recovery strictly read-only. It synthesizes and fully validates the exact recovered Checkout and binding for comparison, but writes neither. The final reconciliation transaction repeats the workspace, owner, session, customer, subscription, plan, price, quantity, chronology, lock, and current-provider checks; only that transaction creates the recovered session binding, completes the Checkout, writes the paid ledger and webhook receipt, and emits activation evidence.

The exact regression forces a provider seat reconciliation after read-only preflight and injects failure into final persistence. Storage remains byte-for-byte at the original authenticated `prepared` snapshot with zero session binding, billing, webhook, or activation. A later different valid notice followed by the original notice converges to one completed Checkout, one billing revision, one activation event, one provider session, and no second subscription.

## Independent Review 7 and config-workspace remediation

Independent Review 7 verified the 128-file seal and all fourteen semantic/raw backup pairs before and after, and again found no substantive billing defect. It returned **FAIL** with two P2 evidence findings. The config workspace owns an executable Vitest TypeScript test but declared no tsconfig/typecheck, while its package manifest exported a nonexistent `typescript.json`. The package manifest and test were also absent from the seal even though the Review 7 evidence correction depended on them.

Review 8 closes both defects structurally. `packages/config/typescript.json` now exists and exactly matches the root TypeScript policy; `packages/config/tsconfig.json` covers the workspace's executable tests; the workspace declares `typecheck`; and a four-test config regression proves the exported target, declared command, and root-policy equality. The root command now executes and passes all 11 workspace typechecks. All four config inputs, the root config and Vitest selector, Review 7 evidence, and all sixteen CT backup pairs are sealed.

## Primary verification for Review 8

- Config regression: 1 file and 4 tests passed.
- Focused billing boundary: 7 files and 51 tests passed.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown after the authorized loopback rerun.
- Full regression: 93 files and 633 tests passed.
- Exact workspace typecheck universe: 11 workspaces, 11 declared scripts, 11 of 11 passed.
- Production build: 1,953 local modules and 30 hosted modules; the supported dependency tree resolved; registry-backed runtime audit reported 0 vulnerabilities.
- Review 7 independently preserved every substantive atomicity, binding, lifecycle, privacy, scope, and historical billing probe; Review 8 must rerun them against the complete 137-file/16-backup seal.

## Independent Review 6 and evidence-contract remediation

Independent Review 6 verified the 123-file seal and all twelve semantic/raw CT backup pairs before and after, independently closed the exact Review 5 atomicity defect and every historical billing counterexample, and found no substantive implementation defect. It nevertheless returned **FAIL** with one P2 evidence-contract finding: the sealed request required `12 of 12 workspace typechecks`, while the exact root command can execute only the 10 scripts declared across 11 workspaces. The implementation checkpoint and CT record correctly said 10 of 10, but the sealed decision contract could not be satisfied as written.

Review 7 corrects the evidence universe without weakening it. `npm query .workspace` enumerates 11 workspaces. Ten declare `typecheck` and the root `npm run typecheck` executes all ten: `@basiclinear/api`, `@basiclinear/hosted-service`, `@basiclinear/web`, `@basiclinear/contracts`, `@basiclinear/db`, `@basiclinear/domain`, `@basiclinear/hosted`, `@basiclinear/operator`, `@basiclinear/test-fixtures`, and `@basiclinear/ui`. `@basiclinear/config` exports only `typescript.json`; it has no executable TypeScript surface or typecheck script. A fresh primary run passed all 10 declared scripts.

## Primary verification for Review 7

- Workspace enumeration: 11 total workspaces, 10 declared typecheck scripts, and one configuration-only JSON package.
- Exact root `npm run typecheck`: 10 of 10 declared workspace scripts passed.
- Review 6 independently passed focused 7/51, emulator 1/6, full 93/632, build 1,953/30 modules, 3/3 hosted references, dependency tree, registry audit 0, atomic failure injection, fourteen binding dimensions, all historical counterexamples, and diff/JSON/privacy/scope/manifest checks; Review 7 must rerun and preserve those results.
- Review 7 seals 128 files and all fourteen semantic/raw CT backup pairs; its own request remains intentionally self-unsealed.

## Primary verification for Review 6

- Expanded focused billing boundary: 7 files and 51 tests passed.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown after the required authorized loopback rerun.
- Full regression: 93 files and 632 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed: 1,953 local modules and 30 isolated hosted modules; favicon, hosted JS, and hosted CSS resolve 3 of 3 with no local/editor preload.
- The supported production dependency tree resolved, and a fresh registry-backed supported-runtime audit reported 0 vulnerabilities.
- `git diff --check`, CT-138 JSON validation, hosted-asset inspection, and prohibited-capability scanning pass before sealing.

## Primary verification for Review 5

- Expanded focused billing boundary: 7 files and 50 tests passed.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown after the required authorized loopback rerun.
- Full regression: 93 files and 631 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed: 1,953 local modules and 30 isolated hosted modules; favicon, hosted JS, and hosted CSS resolve 3 of 3 with no local/editor preload.
- The supported production dependency tree resolved, and a fresh registry-backed supported-runtime audit reported 0 vulnerabilities.
- `git diff --check`, CT-138 JSON validation, hosted-asset inspection, and prohibited-capability scanning pass before sealing.

## Primary verification for Review 4

- Expanded focused billing boundary: 7 files and 48 tests passed.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown after the required authorized loopback rerun.
- Full regression: 93 files and 629 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed: 1,953 local modules and 30 isolated hosted modules; favicon, hosted JS, and hosted CSS resolve 3 of 3 with no local/editor preload.
- The supported production dependency tree resolved, and a fresh registry-backed supported-runtime audit reported 0 vulnerabilities.
- `git diff --check`, CT-138 JSON validation, hosted-asset inspection, and prohibited-capability scanning pass before sealing.

## Primary verification for Review 3

- Expanded focused billing boundary: 7 files and 42 tests passed.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown after the required authorized loopback rerun.
- Full regression: 93 files and 623 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed: 1,953 local modules and 30 isolated hosted modules; all 3 hosted references resolve with no local/editor preload.
- The supported production dependency tree resolved, and a fresh registry-backed supported-runtime audit reported 0 vulnerabilities.
- Exact Review 2 regressions and the combined Review 1 matrix passed without a live provider, account, payment, deployment, or external mutation.
- `git diff --check`, CT-138 JSON parsing, prohibited-capability scanning, backup verification, manifest verification, and final API readback are required immediately before and after Review 3.

## Primary verification for Review 2

- Focused billing boundary: 7 files and 37 tests passed across the billing domain, collaboration/invitation integration, Firestore repository, HTTP surface, Stripe adapter, trusted config, and hosted billing UI.
- Official Firestore emulator: 1 file and 6 isolation groups passed with clean shutdown; all client access to entitlement, billing, Checkout, webhook, removal-idempotency, and related authority records is denied.
- Full regression: 93 files and 618 tests passed.
- All 10 workspace typechecks passed.
- Full production build passed: the local graph transformed 1,953 modules and the isolated hosted graph transformed 30 modules; all 3 hosted references resolve without local/editor preload.
- The supported hosted production dependency tree resolved, and a fresh registry-backed `npm run audit:hosted-runtime` reported 0 vulnerabilities.
- `git diff --check` passed. CT-138 JSON parsing, hosted-asset resolution, exact-scope scanning, and the expanded manifest are required immediately before dispatch and after independent review.

Adversarial coverage includes exact 30×24-hour chronology and no restart, price/quantity/body injection, same-key and cross-key retries, concurrent different-plan Checkout attempts, provider/session expiry, prepared-lock recovery, post-provider seat drift, initial/replacement subscription binding and singularity, duplicate and out-of-order events, inactive and past-due transitions, automatic tax, scheduled cancellation and paid-through boundaries, refund/charge non-authority, active-only proration, collision-free provider idempotency, invite acceptance/removal reconciliation failure, billing/live-seat mismatch write denial, malformed and cross-workspace signed records, HMAC field tampering, time regression, Free-mode principal/action matrices, data preservation, member-removal authorization and replay, HTTP origin/auth/body ordering, redacted errors, and privacy-safe product events/audits.

## Independent-review gate

The user explicitly authorized a separate independent reviewer for CT-138 through CT-142. Reviews 1 through 7 are preserved as immutable failure/remediation evidence. Independent Review 8 verified 137 of 137 sealed files and all sixteen semantic/raw backup pairs before and after, independently proved the real config export and exact 11-of-11 workspace typecheck universe, reran every required gate and historical counterexample, and returned **PASS** with no P0-P3 finding.

The revision-checked project-local API transition then moved CT-138 from revision 18 In Progress to revision 19 Done with projection still disabled/not_synced. This accepts I-206 implementation output only; P-T206 and the combined release remain unqualified.

## Deferred and claim boundaries

R-217 cost/budget configuration, load controls, and deployed-artifact enforcement continue in CT-141; CT-138 supplies billing and cost inputs plus the supported-runtime packaging boundary but does not claim that later operational gate. Export and REST tokens remain CT-139, MCP and the reusable skill remain CT-140, and integrated P-T206/P-T210 qualification remains CT-142.

No live Stripe or Firebase account, price object, customer, payment method, charge, refund, credential, provider terms acceptance, deployment, public billing activation, legal/privacy/security approval, release approval, or outcome result was created or claimed. O-201 and O-203 remain `baseline_needed`; implementation checks cannot establish them. AI agents, code review, repositories, and pull requests remain excluded.
