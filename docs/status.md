# Project status

OpenLinear is a `v0.1.0` release candidate. This page separates implemented
product behavior from release decisions that still require a qualified human.
Control Tower's local v0.8 store is the authoritative task record.

## Done

- One-owner, one-implicit-workspace/team local scope is enforced.
- Projects, milestones, issues, relations, comments, activity, saved views,
  list/board views, search, filtering, grouping, keyboard commands, responsive
  layouts, and Light/Dark/System themes are implemented.
- SQLite durability, backup, canonical transfer, restart readback, revision
  conflict handling, archive/restore/purge flows, and the operator CLI are
  implemented.
- The current candidate has passed the independent functional, visual,
  accessibility, and protected-performance checks recorded by CT-131.
- The repository has AGPL-3.0-only metadata, a third-party notice inventory,
  contribution/security policies, deterministic build inputs, and local-only
  runtime controls.

## Not done

- Multi-user collaboration, invitations, multiple teams/workspaces, hosted
  accounts, Google/OIDC/OAuth, cloud sync, email, or external identity.
- Linear API/MCP/UI integrations, Docker, PostgreSQL, background jobs,
  webhooks, native mobile clients, or a hosted deployment.
- Public release publication and contribution intake.

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
