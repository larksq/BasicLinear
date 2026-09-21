# Hosted budget and abuse incident runbook

## Boundary

This runbook covers the first OpenLinear Online candidate. Google Cloud budget notifications are alerts, not a spending cap. A `warning` or `critical` signed budget state blocks new Stripe Checkout creation in the application, but already-running infrastructure and existing subscriptions require an accountable operator response.

## Signals

- Budget state is `healthy` below 50%, `notice` at 50%, `warning` at 80%, and `critical` at 100% of the reviewed USD 25 pilot budget. The service computes severity from the greater of provider alert fields and actual cost divided by budget.
- Missing or invalid activation evidence, a signal older than 36 hours, a warning/critical signal, HMAC mismatch, chronology mismatch, or repository outage blocks new paid Checkout with a generic billing-unavailable response.
- Request telemetry includes route class, status, duration, opaque HMAC fingerprints, trace ID, and whether a limit fired. It excludes credentials, request bodies, emails, raw IPs, and workspace IDs.
- Page size is 100; a trusted Firestore transaction list stops above 10,000 records; export stops above 25,000 total records or 5,000 issue/comment queries.

## Response

1. Acknowledge the alert and record its message ID, publish time, cost interval, current budget ratio, environment, and application policy digest. Do not copy bearer tokens or provider secrets.
2. Confirm the Pub/Sub subscription and budget IDs by comparing their HMAC-bound references, then inspect Cloud Billing export by service, SKU, project, and label. Treat duplicate and out-of-order deliveries as expected.
3. At `notice`, identify growth by route class and provider category. At `warning`, leave new Checkout blocked, tighten the outer Cloud Armor rule in preview, and ask the Product Lead to decide whether to pause public acquisition. At `critical`, keep Checkout blocked, set Cloud Run maximum instances lower only if availability impact is accepted, and disable nonessential scheduled workloads.
4. Never delete customer data, cancel subscriptions, rotate customer tokens, or restore production merely to reduce cost. Those are separate authorized workflows.
5. Resolve only after a new reconciled cost report, reviewed provider references, and a fresh budget state are installed atomically. Record the decision and expiry; do not edit signed Firestore documents directly.

## Abuse response

For repeated 429s, group only by opaque network/credential/workspace fingerprints and route class. Check whether one app instance or the outer edge is carrying the traffic. Promote a Cloud Armor rule from preview only after verifying it does not block the authenticated Pub/Sub budget endpoint, Stripe webhook, OAuth discovery, or legitimate Firebase Hosting traffic. Preserve the application limit even when the edge rule is active.

## Sources

- [Google Cloud budget notifications](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications)
- [Budget behavior and limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Cloud Armor rate limiting](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
- [Cloud Armor with serverless services](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor)
