# Hosted runtime and telemetry runbook

## Deployment invariants

- Cloud Run service `openlinear-hosted-api`, region `us-central1`, maximum three instances, concurrency 40, timeout 30 seconds, zero minimum instances.
- Ingress is `internal-and-cloud-load-balancing`; Firebase Hosting and the reviewed external load balancer are the public route. The default service URL must not bypass Cloud Armor.
- Application limits are fixed 60-second windows per instance. The deployment-wide ceiling is therefore bounded by the configured three-instance multiplier; the outer edge rule covers distributed IP abuse.
- Server credentials are separate Secret Manager values. The operations, billing, invitation, collaboration, PM, REST cursor, personal-token, and MCP OAuth secrets must all differ.

## Readiness and rollback

The MCP discovery documents link to `/mcp-guide.html`, a public static setup guide shipped with the web build. It must be reachable at the configured public origin without a session; its commands use that deployment’s MCP endpoint.

`GET /health/ready` requires successful configuration parsing, operations admission, and a read of `_health/readiness` in the configured Firestore database. The document need not exist; the probe writes no data. Missing probe configuration, denied access, and database errors return a redacted HTTP 503. Reads have a two-second HTTP deadline, successful results are cached for five seconds, and concurrent probes share one read. After a timeout, readiness stays unavailable until the outstanding read settles and a fresh probe succeeds. `GET /health/live` checks only the running HTTP process and bypasses dependency and operations admission checks. Use liveness for process restarts and readiness for dependency availability.

A configuration or telemetry repository problem fails closed for paid activation. Roll back to the last sealed image if error rate, latency, rejected legitimate traffic, or billing reconciliation breaches the reviewed threshold. Do not weaken Origin, authorization, tenant, provider-signature, idempotency, or revision checks during an incident.

## Workspace exports

The owner-only workspace export includes teams, team memberships (including left
memberships), workflow statuses, cycles, and saved views alongside issues,
projects, milestones, comments, sanitized invitations, and workspace memberships.
Configuration records count toward the existing collection and total export
limits. References, record shapes, and timestamps are validated before returning
the snapshot. Known legacy issue defaults are included deterministically without
writing to storage; missing custom configuration fails the export. The OpenAPI
document describes every exported collection and the issue configuration fields.

## Telemetry review

Restore evidence must cover every collection group in `hostedOperationsPolicyV1.backup.requiredCollectionGroups`, including workspace configuration, observation/idempotency records, issue sequences, verification access, and Creem checkout attempts. The entire-database backup remains unfiltered. Adding a persisted collection requires updating this inventory and regenerating signed operations review/restore evidence for the new policy digest; prior evidence does not authorize the changed policy.

Use structured Cloud Logging fields and Cloud Trace correlation. Alert on sustained 5xx, 429 ratio by route class, budget-notice authentication failures, stale budget state, provider webhook failures, query-budget failures, and billing activation blocks. Retain request telemetry for 30 days and signed budget/restore evidence for 400 days. Access should be least privilege and audited.

The HTTP handler records admitted requests and application rate-limit or operations-control rejections. Parser-level `clientError` responses are deliberately minimal and redacted; Cloud Run/load-balancer request logs provide the outer framing signal. Origin rejection occurs before credential use and before application admission.

## Sources

- [Cloud Run structured logging and trace correlation](https://docs.cloud.google.com/run/docs/logging)
