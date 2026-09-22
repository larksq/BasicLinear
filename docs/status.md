# Project status

Updated September 22, 2026. BasicLinear has a `v0.1.0` local release candidate
and a deployed `v0.2.0` online implementation. Its public origin is
[basiclinear.qiaosun.me](https://basiclinear.qiaosun.me/), with DNS and HTTPS
verified.
This page separates implemented product behavior, deployed services, and
release status. Control Tower's local v0.8 store remains the
maintainers' task record.

## Local edition

- One-owner, one-implicit-workspace/team local scope is enforced.
- Projects, milestones, issues, relations, comments, activity, saved views,
  list/board views, search, filtering, grouping, keyboard commands, responsive
  layouts, and Light/Dark/System themes are implemented.
- SQLite durability, backup, canonical transfer, restart readback, revision
  conflict handling, archive/restore/purge flows, and the operator CLI are
  implemented.
- CT-131 records the earlier independent local functional, visual,
  accessibility, and protected-performance review; it is historical evidence,
  not a new review of the combined source tree.
- The repository has AGPL-3.0-only metadata, a third-party notice inventory,
  contribution/security policies, deterministic build inputs, and local-only
  runtime controls.

## Online edition

- The public homepage and authenticated app are deployed at
  [basiclinear.qiaosun.me](https://basiclinear.qiaosun.me/?app). Sign in with
  Google to open or create a workspace.
- Hosted workspaces, owner/member roles, teams, invitations, assignments,
  comments, activity, subscriptions, inbox, and due-time reminders are implemented.
- Personal API tokens, the versioned REST API, OAuth-authorized MCP, and
  in-app client connection guidance are implemented.
- The React frontend runs on Vercel; the trusted API runs on Cloud Run with
  Firebase Authentication and Firestore. Development and production are separate.
- Current payment configuration uses Creem. Paid checkout activation remains
  blocked by the first-customer review described in the
  [billing runbook](operations/creem-billing-runbook.md). Deployment and a passing
  sandbox provider test do not establish a completed live paid-entitlement test.

See [hosted operations](../ops/hosted/README.md) for current configuration and
[v0.2.0 product evidence](product/versions/v0.2.0/README.md) for scope and history.

## Product boundaries

- Local SQLite data and hosted Firestore workspaces do not automatically sync.
- The local edition remains single-owner; hosted collaboration requires the
  online service and its provider configuration.
- Native mobile clients, cycles/sprints, real-time presence, attachments,
  mentions, custom roles, and enterprise identity are outside the current
  [hosted scope](product/versions/v0.2.0/UAT-SCOPE.md).
- Final open-source release publication and public contribution intake use the
  technical release checks below.

## Latest repository validation

The release audit records the secret scan, dependency inventory, build-input
hashes, provenance, and clean-host runtime evidence. The README screenshots
were recaptured on September 21; [capture provenance](screenshots/README.md)
distinguishes the live homepage from the local build's sample data.

## Release readiness

The current public release audit is `READY` with 13 passing checks, 0
technical failures, and 0 blocked checks. It verifies:

- BasicLinear identity anchors and removal of the legacy public name.
- Third-party notices, binary asset provenance, and public-copy provenance.
- License metadata, private-path controls, secret indicators, and required
  contribution and security documents.
- Reproducible local build inputs and the clean-host, network-denied runtime
  result.

The pipeline does not require a maintainer, reviewer, or external approval. Each
published commit must still pass the current technical audit and secret scan.
