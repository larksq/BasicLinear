# Hosted runtime and telemetry runbook

## Deployment invariants

- Cloud Run service `openlinear-hosted-api`, region `us-central1`, maximum three instances, concurrency 40, timeout 30 seconds, zero minimum instances.
- Ingress is `internal-and-cloud-load-balancing`; Firebase Hosting and the reviewed external load balancer are the public route. The default service URL must not bypass Cloud Armor.
- Application limits are fixed 60-second windows per instance. The deployment-wide ceiling is therefore bounded by the configured three-instance multiplier; the outer edge rule covers distributed IP abuse.
- Server credentials are separate Secret Manager values. The operations, billing, invitation, collaboration, PM, REST cursor, personal-token, and MCP OAuth secrets must all differ.

## Readiness and rollback

Readiness requires successful configuration parsing, Firestore access, and operations-control construction. A configuration or telemetry repository problem fails closed for paid activation. Roll back to the last sealed image if error rate, latency, rejected legitimate traffic, or billing reconciliation breaches the reviewed threshold. Do not weaken Origin, authorization, tenant, provider-signature, idempotency, or revision checks during an incident.

## Telemetry review

Use structured Cloud Logging fields and Cloud Trace correlation. Alert on sustained 5xx, 429 ratio by route class, budget-notice authentication failures, stale budget state, provider webhook failures, query-budget failures, and billing activation blocks. Retain request telemetry for 30 days and signed budget/restore evidence for 400 days. Access should be least privilege and audited.

The HTTP handler records admitted requests and application rate-limit or operations-control rejections. Parser-level `clientError` responses are deliberately minimal and redacted; Cloud Run/load-balancer request logs provide the outer framing signal. Origin rejection occurs before credential use and before application admission.

## Sources

- [Cloud Run structured logging and trace correlation](https://docs.cloud.google.com/run/docs/logging)
