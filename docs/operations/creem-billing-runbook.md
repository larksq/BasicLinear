# OpenLinear Creem billing

## Implementation and validation — 2026-09-14

The hosted backend supports `OPENLINEAR_PAYMENT_MODE=creem`. Existing monthly ($2 per active seat) and annual ($12 per active seat) USD plans are preserved. This follows talk2format's server-only Creem credentials, raw-body webhook signature verification, and real `www.creem.io/checkout/prod_…/ch_…` URL handling. OpenLinear uses recurring subscriptions rather than talk2format's prepaid packs.

Local validation: all 126 test files / 781 tests passed, full workspace build passed, and hosted environment manifest validation passed. Adapter tests use mocked API responses. Billing service tests exercise subscription activation, duplicate notices, seat changes, cancellation, and recovery for both providers. These are not evidence of an actual Creem transaction.

Development is deployed with Creem test credentials in Secret Manager, two recurring test products, and an enabled webhook. Cloud Run revision `openlinear-hosted-api-dev-00015-nb2` uses image `creem-20260914-durable` (Cloud Build `e752c03a-7832-46bf-9951-f551da0694c7`). Production is now configured with live Creem credentials; existing verification grants remain unchanged. Paid checkout activation is still blocked as described below.

A real no-charge Creem sandbox checkout completed for two monthly seats ($4), subscription retrieval returned active, quantity changes 2 → 3 → 2 succeeded, and the isolated test subscription was canceled afterward. The deployed endpoint returned HTTP 400 for an invalid signature and HTTP 200 / processed=false for a correctly signed unknown-event probe. This was an isolated provider test, not a completed workspace entitlement test: the synthetic workspace has no trusted checkout record and must not receive access. Existing operations activation reviews and fresh budget signals remain required for app-generated paid checkout.

Sandbox observations corrected two assumptions: test checkout URLs use `/test/checkout/...`, and repeated `request_id` values returned different checkout IDs. The adapter now uses a durable Firestore `creemCheckoutAttempts` record before dispatch, remembers the returned checkout ID, and refuses to resend an ambiguous attempt.

Production custom domain `openlinear.qiaosun.me` is bound to Vercel project `openlinear-online`, authorized in Firebase Authentication, and allowed by the production backend (revision `openlinear-hosted-api-00012-67d`). The CNAME `openlinear` → `cname.vercel-dns.com.` was saved through the signed-in GoDaddy Chrome profile. Vercel reports `misconfigured=false`; HTTPS now returns HTTP 200 with a valid certificate and the production sign-in page loads in Chrome. Google sign-in completed as Qiao Sun (owner, Production), and the existing workspace and persisted issue data loaded successfully on the custom domain. The existing canonical return URL and budget audience stay on the working Vercel alias until DNS and browser sign-in are verified.

## Configuration

Use separate test and live resources. Never expose these settings through `VITE_` variables or browser bundles.

| Setting | Value |
| --- | --- |
| `OPENLINEAR_PAYMENT_MODE` | `creem` |
| `OPENLINEAR_CREEM_API_KEY` | Secret Manager reference; `creem_test_…` in development, live key in production |
| `OPENLINEAR_CREEM_WEBHOOK_SECRET` | Separate signing secret for the environment's webhook |
| `OPENLINEAR_CREEM_MONTHLY_PRODUCT_ID` | Recurring USD 200 cents, every-month |
| `OPENLINEAR_CREEM_ANNUAL_PRODUCT_ID` | Recurring USD 1200 cents, every-year |
| `OPENLINEAR_HOSTED_PUBLIC_ORIGIN` | Exact frontend origin, also present in `OPENLINEAR_HOSTED_ORIGINS` |

Use products with seat quantities and an explicit Creem tax mode. The adapter checks product, currency, price, period, environment, quantity, and workspace metadata against the trusted checkout record. Creem handles tax as merchant of record.

Development webhook: `https://openlinear-hosted-api-dev-957696487111.us-central1.run.app/api/v1/hosted/billing/creem/webhook`

Production webhook: `https://openlinear-hosted-api-1073376700903.us-central1.run.app/api/v1/hosted/billing/creem/webhook`

Register checkout.completed and subscription.active, paid, trialing, update, canceled, scheduled_cancel, expired, unpaid, past_due, paused. Webhooks use the `creem-signature` header. The service retrieves provider state again before granting access. A successful browser redirect alone never activates Pro.

## Complete the online rollout

1. Obtain the test API key and signing secret through a secure local file or scoped Secret Manager references. Create the two OpenLinear test products; do not reuse talk2format's prepaid products.
2. Bind the secrets and product IDs to the development Cloud Run service. Preserve all existing HMAC keys and environment settings. Build with `ops/hosted/cloudbuild-hosted.yaml` and deploy the tested backend image to `openlinear-hosted-api-dev` in `openlinear-dev-larksq`, `us-central1`.
3. Register the development webhook. Set development manifest fields `paymentMode=creem`, `creemConnected=true`, `creemMode=test`, `stripeConnected=false` only after the provider is connected.
4. Supply the existing operations activation review and fresh budget signal required by the service. Use a test workspace without an existing no-charge verification grant. Verification grants and activation controls must not be bypassed.
5. In the development frontend, create a monthly checkout and finish using Creem's documented test payment method. Confirm the signed webhook yields paid Pro with the server-calculated seat quantity. Replay the event and confirm one activation record. Add/remove a member and verify provider quantities and proration. Test annual checkout on a separate workspace, canceled/expired subscription behavior, invalid signatures, and wrong-environment events.
6. Record actual provider IDs and results in a private test report without credentials or customer data. Repeat the rollout with separate live products and webhook credentials in production only after sandbox verification. Do not make a real purchase as part of automated testing.

Existing operations activation controls remain mandatory; see `hosted-runtime-runbook.md` and `../../ops/hosted/README.md`. Switching the payment-mode variable alone does not authorize paid activation.

## Recovery limitations

Creem documents checkout retrieval by ID, but no checkout search or expiration endpoint. OpenLinear therefore refuses to replace an unresolved payable checkout, and refuses automatic recovery of an unknown timed-out attempt after its 24-hour window. An operator must reconcile such a checkout with Creem; do not clear the workspace checkout lock while a charge is possible. The 24-hour application return-link window is not proof that Creem has expired a checkout.

Checkout retries use a durable Firestore attempt ledger; `request_id` is only a tracking reference. Seat updates retrieve the current subscription, validate the original expected state, and skip a repeated update if the desired quantity is already present. The real sandbox verified seat changes and showed that request_id alone does not deduplicate checkout creation.

## References

- [Creem Checkout API](https://docs.creem.io/features/checkout/checkout-api)
- [Creem seat-based billing](https://docs.creem.io/features/seat-based-billing)
- [Creem webhooks](https://docs.creem.io/code/webhooks)
- [Creem request idempotency](https://docs.creem.io/skills/creem-api/REFERENCE)


## Configured test resources

- Monthly product: `prod_6TCM3GPwBeGQdJOwWJ2CxC`
- Annual product: `prod_IAzAgI9OxDEh0wgZq5n4G`
- Webhook: `wh_test_5CKiJbmanCA2eYDxE2IPJg` (11 checkout/subscription events)
- API secret: `openlinear-dev-larksq/openlinear-creem-test-api-key`, version 1
- Webhook secret: `openlinear-dev-larksq/openlinear-creem-test-webhook-secret`, version 1
- Completed isolated test checkout: `ch_67FVXhkDKSPydIrJ22HMzo`
- Canceled isolated test subscription: `sub_KaDeSdlbHzdyHUcBCoAa`

Next: finish a trusted workspace payment test once operations activation evidence is available. Custom-domain HTTPS and authenticated workspace access are verified. Separate live products and credentials are deployed as recorded below.


## Production deployment — 2026-09-14

- Backend revision: `openlinear-hosted-api-00012-67d`, serving 100% traffic.
- Image: `us-central1-docker.pkg.dev/openlinear-prod-larksq/openlinear/hosted-api:creem-20260914-durable`.
- Build: `77966284-0919-4c28-802d-7870f876742f`.
- Monthly live product: `prod_37LeHXYegstGEgOMmoenda` ($2/seat/month).
- Annual live product: `prod_4t1HwJuuQCmFVGTu7F0P1b` ($12/seat/year).
- Live webhook: `wh_adlhgmwmj9CZrpuiXF87k`, 11 checkout/subscription events.
- Secret Manager: `openlinear-creem-api-key:1` and `openlinear-creem-webhook-secret:1`, in `openlinear-prod-larksq`, accessible to the production runtime service account. Dedicated Creem key has checkout, product, and subscription read/write scopes.
- Production health returned 200; invalid webhook signature returned 400; valid signed unknown-event probe returned 200 / processed=false. The authenticated production workspace loaded after deployment. These checks do not constitute an actual live purchase or an end-to-end paid-entitlement test. No real charge was made.
- A $25/month project-filtered budget was created: `48ea3488-2a76-48c1-8faf-6453840897ac`. Alerts at 50%, 80%, and 100%, Pub/Sub topic `openlinear-budget-alerts`, subscription `openlinear-budget-push`. Billing publisher binding and OIDC token-creator binding are configured. Budget alerts are not a hard spending cap. Provider budget push deliveries were observed on 2026-09-14 at 08:05 UTC, but the endpoint returned 503; activation/budget ingestion is not yet complete.

Production Firestore has neither `operationsActivation/current` nor `operationsBudgetState/current`. The current code requires active paid seats and nonzero historical revenue before it can install an allowing activation report. This blocks the first paying customer. A first-customer launch rule was proposed to the user and is pending their decision; no activation evidence was fabricated and no guard was bypassed. Completion requires that decision, a trusted workspace checkout/payment test, while custom-domain HTTPS and authenticated browser verification have passed.

## Custom-domain authenticated verification — 2026-09-14

Google sign-in completed as the production owner. The existing workspace and persisted issue data loaded over HTTPS at `openlinear.qiaosun.me`. The Billing page returned “Billing is temporarily unavailable”; Cloud Run confirmed GET `/api/v1/hosted/workspaces/.../billing` returned 503 at 08:04:45 UTC. This failure was resolved by the deployment below. End-to-end paid checkout remains separately blocked by activation policy.

## Billing summary repair — 2026-09-14

The production accepted invitation includes the supported `teamIds` field, but billing used the older exact-key schema and rejected it with 503. Billing now accepts both legacy invitations and invitations containing a sorted, unique list of at most 20 valid team IDs. Malformed fields and unexpected keys still fail closed. No stored workspace records or verification grants were modified.

70 relevant billing tests passed, including eight new regression cases; both hosted packages built successfully. Cloud Build `99122839-dfc2-437e-b2c6-28b113cc6778` produced image `billing-team-invitations-20260914`. Production revision `openlinear-hosted-api-00013-g79` serves 100% of traffic. Readiness passed, and the authenticated custom-domain Billing page now displays Verification Pro, 2 active seats, 0 pending invitations, and the existing no-charge grant. Checkout remains disabled for this allowlisted workspace by design; global first-customer activation remains unresolved.
