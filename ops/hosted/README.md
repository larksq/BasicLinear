# Hosted operations

Updated September 22, 2026. The public BasicLinear origin is
**[basiclinear.qiaosun.me](https://basiclinear.qiaosun.me/)**. Its DNS record,
Vercel binding, and HTTPS response are verified.

The frontend runs on Vercel and calls a trusted Cloud Run API. Firebase
Authentication supplies identity; Firestore stores hosted workspace data.
This is separate from the local Node/SQLite edition and does not synchronize
a local database automatically.

## Environment separation

The checked-in [development](environments/development.json) and
[production](environments/production.json) manifests define separate Firebase
projects, Firestore databases, authentication configuration, service
identities, Cloud Run services, and Vercel projects.

| | Development | Production |
| --- | --- | --- |
| Frontend | [Development app](https://basiclinear-development.vercel.app/) | [Public app](https://basiclinear.qiaosun.me/) |
| Vercel project | `basiclinear-development` | `basiclinear-online` |
| Cloud Run service | `openlinear-hosted-api-dev` | `openlinear-hosted-api` |
| Current payment provider | Creem test mode | Creem live configuration |

The canonical production URL is the BasicLinear custom domain. Development is
the environment for test mutations. Cloud Run and Firebase resource identifiers
retain their existing infrastructure names; they do not define the public
product identity. Building this repository does not create or configure provider
resources.

The browser and service validate their selected environment and Firebase
project bindings. The Vercel frontend contains public browser configuration;
server credentials stay in Secret Manager and the API uses Application Default
Credentials. The frontend routes `/api/**`, `/oauth/**`, `/mcp`, and supported
discovery paths to its matching trusted backend.

Deploy production with `ops/hosted/vercel-production.json` and development
with `ops/hosted/vercel-development.json`. The root `vercel.json` is the
production-safe default, so a deployment cannot accidentally route the public
site to the development API.

## Billing and operational readiness

Both manifests now select `paymentMode=creem` and `stripeConnected=false`.
Earlier CT-141/CT-143 records describe the previous Stripe contract and
verification setup; use the [Creem billing runbook](../../docs/operations/creem-billing-runbook.md)
for current provider configuration and observed tests.

Production paid checkout activation remains blocked by the first-customer
review. Existing no-charge verification grants remain in place. A successful
provider sandbox test and deployed live credentials do not establish an
end-to-end live workspace payment test. Check the app's Billing page for the
current workspace entitlement and availability.

`operations-policy.json` remains bound to the application policy digest. The
service enforces per-instance limits; deployment ingress and outer abuse
controls need their own operational verification. Paid activation requires
trusted review and fresh budget state. Budget alerts notify operators; they
do not cap spending.

## Runbooks

- [Runtime and telemetry](../../docs/operations/hosted-runtime-runbook.md)
- [Backup and restore](../../docs/operations/hosted-backup-restore-runbook.md)
- [Budget incidents](../../docs/operations/hosted-budget-incident-runbook.md)
- [Creem billing](../../docs/operations/creem-billing-runbook.md)
- [Current product and release status](../../docs/status.md)

Deployments and screenshots are implementation evidence. The source release is
validated by the current technical release audit.
