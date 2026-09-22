---
title: "First Release"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# First Release

## Release outcome

The first release succeeds when one technically capable owner can start BasicLinear locally and complete the approved project, milestone, issue, find/focus, and recovery workflow in the automatically provisioned workspace and team without a critical functional, local-security, accessibility, or recovery failure. The release must feel coherent under repeated daily use, not merely demonstrate isolated forms. Its accepted visual fixtures should preserve the reference product's spatial discipline while remaining an independent design.

## In scope

The release contains a desktop-first responsive web application served by one loopback Node 24 process, one embedded SQLite application file, an automatically provisioned owner and internal workspace/team context, statuses, projects, project milestones, issues, priorities, labels, implicit owner context, due dates, issue relations, comments, activity, list and board views, filters, grouping, ordering, personal saved views, command palette, keyboard issue creation, bounded scan search, export, backup, restore, and migration tooling.

The supported UI does not expose workspace or team switching/creation, member administration, invitations, role selection, sharing controls, non-owner assignment, login, OIDC, or remote-access configuration. Internal scope IDs remain in canonical transfer metadata; PostgreSQL roles/RLS and two-workspace runtime fixtures are historical evidence, not v0.1 architecture.

Project overview combines summary, properties, resources or links, rich description, milestones, and progress. Issue lists support compact grouped rows and configurable property visibility. Issue detail supports rich description, properties, project and milestone context, relations, resources, comments, and an activity stream. Milestone progress is derived from linked issue states and remains visible in project context.

## Out of scope

Cycles, initiatives, goals, AI agents, code review, customer objects, billing, advanced analytics, native mobile apps, native desktop packaging, marketplace integrations, Slack automation, email ingestion, SAML provisioning, multi-region active-active deployment, and public extension APIs are excluded. The first release does not promise compatibility with Linear's private APIs or a live bidirectional Linear sync.

The product does not ship Linear trademarks, logos, proprietary typefaces, copied icons, private workspace screenshots, copied text, or reconstructed source. “Pixel-level” is an acceptance method for approved clean-room layout fixtures, not a license to reproduce protected identity.

## Capabilities

**C1 Owner bootstrap.** The owner runs one local command and receives one automatically provisioned owner profile, internal workspace/team context, and usable default statuses without account or administration choices.

**C2 Project and milestone planning.** The owner creates, edits, archives, restores, filters, and searches projects; defines ordered milestones with dates and descriptions; attaches issues; and sees deterministic progress.

**C3 Issue execution.** The owner creates an issue from the command palette or context, edits title and rich description, changes status and properties, assigns project and milestone, creates relations, comments, and follows activity. Owner identity is implicit.

**C4 Views and navigation.** The owner switches among list and board layouts, groups and orders records, hides or reveals properties, saves personal views, searches, opens details while retaining context, and uses documented keyboard paths.

**C5 Ownership and operations.** The owner/operator exports authoritative data, creates and verifies an online backup, restores into a compatible local release, runs migrations, inspects health, and recovers from interrupted startup without record loss.

## Acceptance

Acceptance uses a seeded, non-private reference dataset and a fixed viewport/browser matrix. Every core workflow must pass end-to-end tests and manual usability review. Approved visual fixtures must remain within the Planning-approved pixel-difference threshold after masking intentionally distinct branding and volatile content. Keyboard-only execution must reach every core action with visible focus and correct announcements. Local-security tests must prove loopback-only bind, strict Host/Origin/CSRF behavior, safe data paths, and fail-closed imports.

The release cannot claim parity from a single screenshot. Acceptance covers creation, inline editing, saved state, filtering, grouping, side-panel context, browser refresh, concurrent revision conflict, soft deletion and restore, export/import, backup/restore, responsive behavior, and error recovery. Performance targets use controlled hardware and seeded data volumes defined in Planning.

## Dependencies

The release depends on accepted Discovery outcomes and requirements, a clean-room reference and branding policy, a selected open-source license, a stable SQLite schema and canonical PostgreSQL-export migration, a local-origin security design, a rich-text storage contract, an accessibility-tested component set, and deterministic visual-test infrastructure. No Google/OIDC credential, database credential, setup token, container runtime, or external service is a v0.1 input.

Workflow scope no longer depends on five interviews: CT-77 completed the large-sample statistical ranking. Product acceptance still depends on controlled workflow measurements, independent rendered and accessibility checks, and valid outcome windows. Public release uses the technical audit for identity anchors, clean-room controls, screenshots, copy, third-party notices, provenance, and attribution.

## Rollout

Rollout begins with a temporary-data-dir developer fixture, then a private personal-use alpha, then clean local-user-account trials, then a release candidate. Each step requires migration and rollback evidence. Alpha owners receive a fixed upgrade path and explicit backup instructions. Telemetry is absent from v0.1.

The release candidate freezes data schema changes except for defects that block acceptance. A signed manifest records source revision, migration version, pinned Node/runtime identity, dependency lockfile, release-artifact hashes, test results, visual baselines, known limitations, and restore evidence. Public publication occurs only after the release owner accepts functional, quality, security, legal, and outcome-readiness evidence.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register supports core workflow selection through CT-77's Stack Overflow, PMI, GitLab/Omdia, and Atlassian statistics; official product documentation; open-source competitor repositories; Node/SQLite; Playwright; and WCAG 2.2. Historical authenticated observation and the superseded PostgreSQL architecture remain labeled rather than promoted into the current decision.
