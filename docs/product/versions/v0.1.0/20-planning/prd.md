# Product Requirements Document

## Product statement

BasicLinear is the internal working name for a free, self-hostable work-management system that lets one technically capable owner plan projects and milestones, execute issues, and review progress with reference-grade speed and information density. It is an independent clean-room implementation with distinct identity and no Linear runtime, synchronization, API, MCP, source, asset, or paid-service dependency.

`v0.1.0` succeeds when the owner can start one loopback process, receive the automatically provisioned owner and internal workspace/team context, complete the canonical project/milestone/issue/find/recovery workflow, preserve data through export and SQLite backup/restore, and pass the accepted trust and clean-room gates. The version is a coherent daily-use core, not a feature catalog.

## Users and jobs

| User | Primary job | Critical failure |
|---|---|---|
| Technical owner | Define projects and milestones; capture, navigate, update, relate, and review issues; read progress | Routine work is fragmented, slow, or loses context |
| Owner/operator | Start, upgrade, back up, restore, and inspect the local runtime | Operation requires Docker, a database server, an undisclosed cloud service, or loses data |
| Security/release reviewer | Verify local-origin and filesystem protection, provenance, accessibility, and release evidence | Private data, unsafe access, or unreviewed identity enters release |

The supported product has one owner, one workspace, and one team. CT-77's large-sample evidence and sensitivity analysis rank the workflow families; exact switching prevalence remains unknown. Implementation follows vertical, reversible slices and does not add collaboration administration, enterprise portfolio, billing, or integration infrastructure.

## Core workflow

1. The owner runs one documented command; the pinned Node process binds to loopback, creates or opens one SQLite file, and bootstraps the owner profile, internal workspace/team identifiers, and statuses without login or an external provider.
2. The owner creates a project, fills its overview, defines two ordered milestones, and sees derived progress.
3. The owner creates issues from global and contextual keyboard paths, edits rich descriptions and properties, assigns project and milestone, relates work, comments, and inspects activity.
4. The owner groups and filters a dense issue list, configures properties, saves a personal view, opens a context-preserving detail panel, edits an issue, and returns to the unchanged list state.
5. The owner/operator exports canonical data, creates and verifies a backup, upgrades or restarts, restores into a supported target, and verifies the round-trip digest.

The canonical UAT uses synthetic content, fixed start/end rules, and source-identified evidence. No private workspace record is a fixture.

## Functional scope

### Owner context and workflow

- One local owner profile and process-local same-origin browser session; no login, logout, password recovery, persistent session table, or OIDC.
- Automatic provisioning of internal workspace/team identifiers, team-scoped issue identifiers, and configurable workflow statuses with defaults.
- No workspace/team switching or creation, membership administration, invitations, role selection, sharing scope, or non-owner assignee controls in supported v0.1 runtime or UX.
- Internal scope identifiers remain in application metadata and canonical transfer records for stable identifiers and one-time migration compatibility.

### Projects and milestones

- Project create, read, update, archive, restore, search, filter, and order.
- Name, summary, status, priority, lead, start/target dates, icon/color token, resources, rich overview, and derived progress.
- Ordered project milestones with description, target date, linked issues, and deterministic progress.
- Project overview that combines properties, resources, overview content, milestones, related issues, progress, and activity without decorative nesting.

### Issues and activity

- Stable issue identifier, title, rich description, status, priority, implicit owner context, due date, labels, project, milestone, comments, and resources.
- Blocking/blocked-by, related, duplicate, and parent/sub-issue relations with inverse integrity and invalid self-relation rejection.
- Recoverable archive/trash for routine deletion and explicit elevated purge.
- Transactionally paired activity entries with actor, time, field, and before/after semantics.

### Views and navigation

- Dense list and board views, grouping, ordering, filtering, configurable properties, bulk selection, and saved views.
- Project and issue search over identifier, title, description, and labels within the implicit workspace, with predictable ranking.
- Global command palette, global/context issue creation, list navigation, selection, property changes, detail toggle, and Escape recovery.
- Side-panel and full-detail modes that retain filter, grouping, scroll, selection, and focus state.

### Ownership and operation

- Versioned canonical export/import and SQLite online backup/restore with record and relation digests.
- Explicit migrations, compatibility checks, pre-upgrade backup requirement, health endpoints, and actionable failure output.
- Non-interactive operator commands for checks, migrations, seed, recovery, export, backup verification, and restore.
- One pinned Node 24 process serves built web assets and `/api` from loopback with outbound network denied; no Docker, proxy, database server, database credential, setup token, or external service is required.

## Protected qualities

- **Local security:** zero confirmed data disclosures or mutations through a remote listener, hostile browser origin, unexpected Host, unsafe data path, symlink, or corrupt import.
- **Conflict safety:** stale mutations return explicit conflicts; retries cannot silently overwrite state or duplicate activity.
- **Recovery:** release-candidate export/import and backup/restore trials preserve all canonical records and relations.
- **Accessibility:** core workflows meet WCAG 2.2 AA criteria in scope, work keyboard-only, and have no serious automated violations.
- **Performance:** Planning-approved p75 budgets are measured on controlled hardware and seeded data after `CT-4`; no threshold is invented here.
- **Visual fidelity:** approved clean-room fixtures meet per-screen screenshot budgets on pinned environments with independently designed branding.
- **Portability:** no Linear, Google, Docker, database server, paid host, account credential, or external service is mandatory at runtime.
- **Public integrity:** source, build, license, attribution, provenance, contribution, security, and private-evidence audit rows all pass before publication.

## Exclusions

Multi-user accounts, additional workspace/team UX, invitations, roles, sharing, non-owner assignment, remote access, multi-process database use, hosted deployment, and live presence are excluded and require later Discovery. Cycles, initiatives, goals, AI agents, code review, customer records, billing, advanced analytics, native desktop/mobile packages, marketplace integrations, Slack/email automation, SAML/SCIM, multi-region deployment, public extension APIs, and Linear synchronization are also excluded. Calendar, timeline, templates, generic import, attachments, and public webhooks remain future candidates.

## Outcome contracts

Planning carries O-001 through O-005 byte-for-content unchanged from Discovery. The authoritative objects and hashes are in `planning-package.json`. O-002 remains `baseline_needed`; `CT-2` measures it. Implementation may proceed under the accepted-contract nonblocking rule, but no efficiency threshold can be accepted or claimed from implementation evidence.

## Release gates

Implementation entry requires a valid Planning package and exact allowed Control Tower scope. CT-80 must prove SQLite persistence and canonical migration before CT-81 retires the supported Docker/PostgreSQL path. CT-82 independently proves clean local start, upgrade, backup, restore, rollback, and offline operation before CT-12 can close. Outcome Review waits for each original observation window. Public release additionally requires `CT-3`, `CT-13`, zero critical security/data-loss findings, current restore evidence, and complete clean-room audit. “BasicLinear” cannot appear as a cleared public brand until `CT-3` accepts it or replaces it.
