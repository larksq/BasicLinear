# CT-141 hosted operations, abuse, recovery, and cost contract

## Boundary

CT-141 implements I-209 inside the accepted combined v0.1 local plus v0.2 hosted product boundary and reuses the shared `S3 — Implementation` milestone. Project state remains authoritative in the project-local Control Tower v0.8 store; provider projection is disabled and `not_synced`. This slice does not create a version-specific milestone or use the Control Tower UI.

The implementation adds reviewed application limits, redacted request telemetry, an authenticated Google Cloud budget-notice boundary, a fail-closed paid-activation gate, cost-per-paid-seat guardrail evidence, whole-database backup/isolated-restore evidence, and operator runbooks. It does not add an AI-agent runtime, code review, source-repository or pull-request behavior, arbitrary data access, local/cloud synchronization, or an operations administration API. The checked-in Google Cloud and Firebase documents are exact templates marked not applied; no provider, deployment, budget, Pub/Sub, Cloud Armor, backup, restore, Stripe, or production state is claimed.

## One sealed operations policy

`hostedOperationsPolicyV1` is a recursively frozen, caller-copied policy with canonical SHA-256 digest `3caa75ff6462bfa9ea9dcf04af8df5d4274a2e81843a4ee1b3f0755087838cd5`. `ops/hosted/operations-policy.json`, Cloud Run, Cloud Armor, budget, backup, code, tests, and runbooks must preserve the following exact relations:

- at most three Cloud Run instances, concurrency 40 per instance, 120 aggregate concurrent requests, and a 30-second request timeout;
- fixed 60-second application windows, at most 20,000 tracked buckets per instance, and a five-second clock-regression tolerance;
- global, network, credential, and workspace limits selected by route class; all fingerprints are domain-separated HMAC-SHA-256 values and raw network addresses, credentials, workspace IDs, emails, bodies, and provider secrets are never written to application telemetry;
- page size at most 100, a trusted transaction-list ceiling of 10,000, a canonical workspace-export ceiling of 25,000 records and 5,000 issue/comment queries, ordinary JSON bodies at most 65,536 bytes, Stripe webhooks at most 262,144 bytes, and budget pushes at most 32,768 bytes;
- a USD 25 pilot budget with 50%, 80%, and 100% thresholds, a 24-hour activation-review lifetime, and budget-signal freshness of at most 36 hours;
- variable hosted cost no greater than 50% of recognized paid revenue for activation, with a report no older than 720 hours;
- 30-day structured request telemetry and 400-day signed budget/restore evidence retention;
- an entire-database backup inventory containing every current hosted collection group, including private trial/token ledgers, OAuth ledgers, billing/idempotency/audit ledgers, PM data, and the operations ledgers themselves.

Any policy relation, unsupported environment value, missing production Cloud project, wrong public budget audience, reused server secret, malformed provider reference, or unbounded repository configuration fails construction or activation. Caller-owned mutable policy and binary-secret inputs are copied before use.

## Admission, abuse, and telemetry

Every request that reaches the hosted application handler passes exact browser-Origin rejection first and then synchronous operations admission before Firebase identity, personal-token use, OAuth authentication, MCP authentication, PM service work, provider verification, or repository mutation. Parser-level Node `clientError` traffic remains outside the application handler and is covered by the load-balancer/Cloud Run request log boundary. Origin rejection deliberately occurs before credential handling and before application admission.

The inner limiter classifies health, public read/write, authenticated read/write, provider webhook, OAuth, and MCP routes. It applies every applicable bucket atomically: a rejected candidate increments none. Clock regression beyond tolerance and invalid control state detected during admission return a generic 503; quota or bounded-bucket exhaustion returns a generic 429 with a bounded `Retry-After`. Once a response is authoritative, completion cannot retroactively replace it: completion telemetry is no-throw and uses the already-trusted admission timestamp with a bounded zero duration if the completion clock regresses. The checked Cloud Run maximum means a distributed caller can consume at most three times an application per-instance limit. Therefore the candidate also requires an external load balancer, a serverless NEG, internal-and-load-balancer-only Cloud Run ingress, and the reviewed Cloud Armor IP rules before public traffic. Cloud Armor is an outer defense, not a replacement for authorization or the deterministic application limit.

Admitted requests and operations-control rejections emit exactly one structured event containing only correlation ID, route class, method, status, outcome, duration, HMAC fingerprints, optional validated Cloud Trace ID, and the limited flag. Admission-failure telemetry uses the last trusted control timestamp when the rejected condition is clock regression and runs in a bounded `finally`, so a throwing 429/503 response transport cannot skip the event. A telemetry-sink outage never changes an already-authoritative response and reports only a bounded component/correlation error to stderr. The production server contains any otherwise-unexpected handler rejection: it emits a generic redacted 503 before headers, or only closes an already-started response, and never includes the rejected value. Request bodies, raw IPs, bearer values, Google tokens, invitation links, emails, workspace IDs, Stripe secrets, and provider identifiers are prohibited.

Trial abuse remains identity-bound rather than surveillance-bound: Google/Firebase UID with revocation checking, the server-only `_ownerTrialEligibility/{uid}` lifetime ledger, and one eligible 30-day trial per UID remain authoritative. Public/network write limits add pressure protection. CT-141 does not introduce email/device fingerprinting or weaken CT-134 trial chronology.

## Query and export budgets

The production Firestore collaboration, invitation, and billing adapters always issue a `limit(maximum + 1)` query and fail closed if the extra record exists. Callers cannot raise the configured ceiling. Memory repositories reproduce the same fail-closed ceiling, and PM, collaboration, invitation, personal-token, and billing services pass or inherit it.

Project and milestone reads stop above 10,000 records. Workspace export reads memberships, invitations, projects, milestones, and issues inside one transaction, stops above 10,000 in any group, stops above 5,000 issue/comment subqueries, and stops above 25,000 canonical records in total. Comment reads are sequential and bounded by the remaining record budget plus one. An overflow returns a generic unavailable result and never emits a partial export. Existing cross-workspace, cross-reference, privacy, authorization, and canonical-digest checks remain unchanged.

## Authenticated budget notice and paid activation

Google Cloud budget notifications are alerts, not a hard cap and not synchronous spend control. The template uses a dedicated Pub/Sub push subscription with a service-account OIDC token and an exact audience equal to the public budget endpoint. The handler accepts only one bounded JSON media/body framing, strict UTF-8, no duplicate JSON keys, the exact Pub/Sub envelope/attribute set, canonical base64, and the exact Google budget payload. It parses and validates the entire bounded body before credential use, then verifies Google issuer, exact audience, exact verified service-account email, numeric subject, issued/expiry chronology, and bounded token age. Duplicate authorization, malformed media/framing, an untrusted identity, unknown fields, or a provider-reference mismatch changes no operations ledger.

Budget messages are HMAC-bound to the current activation review, provider references, subscription, message ID, interval, amounts, thresholds, chronology, and policy. Re-delivery of an identical message is idempotent even when receipt time changes; the same message ID with divergent content fails closed. An older delivery can be retained as evidence but cannot regress current state. Current severity uses the greater of provider threshold fields and independently computed actual cost divided by the exact USD 25 budget.

Paid Checkout requires a signed current activation review, an allow cost report, matching environment/policy/provider references, trusted chronology, and fresh non-warning budget state. Billing checks this after owner authorization and again immediately before provider Checkout creation. Missing, malformed, expired, future, stale, warning, critical, cross-activation, or repository-unavailable evidence maps to a generic billing-unavailable stop before Stripe creation.

A later review in the same budget interval rebinds but preserves the current cost, severity, and original observation time; it cannot clear a warning/critical state or refresh a stale notice. It also cannot change the budget identity inside that interval. Only a strictly later reviewed budget interval can initialize a new healthy zero-cost state. This prevents review rotation or state replay from rolling back the active stop signal. Existing subscriptions and infrastructure do not stop automatically; the incident runbook owns accountable manual action.

## Cost-per-paid-seat guardrail

The report builder accepts a reviewed exact set of paid workspace IDs plus normalized CT-133 economics records. Every workspace must have at least one variable-cost and one Stripe recognized-revenue record for the exact period; every record must have consistent paid seats, a unique dimension and source reference, and a retrieval time from period end through report generation. The workspace set must equal the economics workspace set. Integer micro-USD totals, per-seat values, workspace/economics digests, and a ceiling-rounded basis-point ratio are rebuilt by the service before activation is signed. Even one micro-dollar beyond the 50% guardrail stops activation.

Production accepts only `production_baseline`; local fixtures may use `synthetic_fixture`. The report is explicitly `guardrail_only_no_outcome_claim`. It neither establishes O-203 nor proves price viability, profitability, provider completeness, or a mature observation window. O-203 remains baseline-needed and retains its CT-133 measurement contract.

## Backup and isolated restore evidence

The checked policy uses an entire-database Firestore managed/PITR export. Managed export/import requires a billed provider configuration and can incur reads/writes; export is not claimed to be an exact point-in-time snapshot. A restore point must be a whole UTC minute no later than request time and no more than seven days earlier. Filtered collection exports are not accepted because nested subcollections and new collection groups could be omitted.

Restore evidence requires distinct HMAC-bound source and `restore-drill-` destination projects, exact chronology from export request through verification, the complete sorted policy inventory, equal positive source/restored document counts, equal canonical manifest SHA-256 values, passed application smoke and rules-isolation checks, and destination deletion scheduled after verification and within seven days. The entire evidence record is HMAC-bound and idempotent; divergent reuse fails closed. Production stores only `provider_drill` evidence. Local `synthetic_fixture` evidence proves validation code only and does not claim that a backup, import, deletion, RPO/RTO, or recovery operation occurred. Production in-place import is never authorized by this contract.

All operations ledgers and the existing private owner-trial ledger are explicitly denied to browser Firestore reads, lists, creates, updates, and deletes. Server transactions remain the only application path.

## Runbooks and qualification boundary

The runtime, budget/abuse incident, and backup/restore runbooks preserve provider limitations, release-stop conditions, privacy fields, exact configuration relations, and accountable manual steps. Provider setup must use a reviewed API or infrastructure workflow; the templates do not authorize UI-only setup or direct edits to signed Firestore records.

CT-141 is eligible for implementation-output Done only after a distinct read-only reviewer verifies the complete sealed file/input universe before and after; reruns focused, official-emulator, full-regression, all-workspace typecheck, build, dependency, audit, configuration, load, replay, cost, activation, query, restore, privacy, and prohibited-capability gates; adversarially probes same-interval reset, duplicate/out-of-order notices, pre-identity limits, overflow/partial output, cross-record tamper, and secret/redaction boundaries; and reports no P0–P3 finding.

Completion does not itself qualify P-T209, establish O-203 or O-204, activate a live budget or edge policy, prove a provider backup/restore, deploy Firebase/Cloud Run/Stripe, accept the combined release, or provide legal/privacy/security approval. Integrated P-T209/P-T210 and combined acceptance remain CT-142.

## Provider references

- [Google Cloud budget notifications](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications)
- [Google Cloud budget limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Pub/Sub push delivery](https://docs.cloud.google.com/pubsub/docs/push)
- [Firestore export and import](https://firebase.google.com/docs/firestore/manage-data/export-import)
- [Cloud Run structured logging](https://docs.cloud.google.com/run/docs/logging)
- [Cloud Armor rate limiting](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
- [Cloud Armor with serverless services](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor)
