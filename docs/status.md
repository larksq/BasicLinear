# Project status

Updated September 21, 2026. OpenLinear has a `v0.1.0` local release candidate
and a deployed `v0.2.0` online implementation at
[openlinear.qiaosun.me](https://openlinear.qiaosun.me/).
This page separates implemented product behavior, deployed services, and
outstanding release decisions. Control Tower's local v0.8 store remains the
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

- The public homepage and authenticated app are deployed at the custom domain.
  [Open the app](https://openlinear.qiaosun.me/?app) and sign in with Google.
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
- Final open-source release publication and public contribution intake remain
  subject to the release reviews below.

## Latest repository validation

The [September 21 release audit](operations/open-source-audit-2026-09-21.md)
records the secret scan, dependency repairs, 834 passing checks, successful
local and hosted builds, and a local startup smoke test. The README screenshots
were recaptured on September 21; [capture provenance](screenshots/README.md)
distinguishes the live homepage from the local build's sample data.

## Open release gates

The current public release audit is `NOT_READY` with 8 passing checks, 0
technical failures, and 6 blocked review gates. The blocked gates are:

- CT-3 qualified legal/brand and clean-room acceptance.
- Working-name clearance derived from CT-3.
- Accountable review of third-party notices.
- Accountable binary-asset provenance review.
- Accountable public-copy provenance review.
- CT-13 accountable release-candidate acceptance.

The technical manifests are complete and hash-bound, but an implementation
agent must not invent reviewer identity, qualification, legal clearance, or
release acceptance. Until those decisions are recorded, the project must be
described as a pre-release candidate rather than a published production
release.
