---
title: "Requirements"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Requirements

## Functional requirements

| ID | Requirement | Source | Outcome |
|---|---|---|---|
| R-001 | The system shall start one local owner session on loopback without login, external identity, setup secret, or network access, and shall preserve product data across process restarts. | E-001, E-024, E-025 | O-001 |
| R-002 | First-run bootstrap shall automatically provision one owner profile, internal workspace/team identifiers, and configurable workflow statuses with usable defaults; workspace, team, membership, invitation, role, login, and remote-access administration are not exposed in v0.1. | E-001, E-009, E-025 | O-001, O-004 |
| R-003 | The owner shall create, read, update, archive, restore, search, filter, and order projects with summary, status, priority, lead, dates, and progress. | E-002, E-006, E-021, E-023 | O-001, O-002 |
| R-004 | A project shall contain ordered milestones with name, description, optional target date, linked issues, and derived progress. | E-004, E-008, E-021, E-023 | O-001, O-002 |
| R-005 | The owner shall create an issue with a stable identifier, title, status, rich description, priority, implicit owner context, due date, labels, project, and milestone; v0.1 exposes no non-owner assignee picker. | E-003, E-005, E-009, E-020, E-021 | O-001, O-002 |
| R-006 | An issue shall support blocking, blocked-by, related, duplicate, and parent/sub-issue relations with integrity checks that prevent impossible self-relations. | E-005, E-023 | O-001, O-004 |
| R-007 | Issue and project changes shall append actor, timestamp, field, and before/after semantics to a durable activity stream. | E-004, E-005, E-022, E-023 | O-001, O-004 |
| R-008 | Issue lists shall support list and board layouts, grouping, ordering, filtering, configurable properties, bulk selection, and saved views. | E-003, E-010, E-020, E-023 | O-001, O-002 |
| R-009 | The owner shall search project and issue identifiers, titles, descriptions, and labels within the implicit workspace with predictable bounded-scan ranking for the accepted personal workload. | E-010, E-020, E-023, E-025 | O-001, O-002 |
| R-010 | Keyboard commands shall support global search, issue creation, command palette, list navigation, selection, property changes, details toggling, and escape recovery. | E-009, E-010 | O-002, O-003 |
| R-011 | Details shall open without discarding list filters, scroll position, selection, or return focus. | E-003, E-005 | O-002, O-003 |
| R-012 | Routine deletion shall use recoverable archive or trash semantics; irreversible purge shall require explicit elevated action. | E-001 | O-004 |
| R-013 | The owner/operator shall export all authoritative records in a documented, versioned format and restore a compatible backup with identity and relation preservation. | E-001, E-020, E-022 | O-004 |
| R-014 | One pinned Node 24 process shall serve the web application and API on loopback using one embedded SQLite file, with a documented data path, health check, schema migration, restart, and no Docker or database server. | E-024, E-025, E-026 | O-001, O-004 |
| R-015 | The product shall use a distinct public identity and independently created design assets; private reference evidence shall never enter distributable assets. | E-001, E-002, E-003, E-004, E-005 | O-005 |

## Non-functional requirements

| ID | Requirement | Planned proof |
|---|---|---|
| R-101 | Local data access shall fail closed for non-loopback listeners, unexpected Host/Origin, missing CSRF, unsafe filesystem paths, corrupt imports, and implicit multi-scope selection. | Local-origin API matrix, path/import adversarial tests, listener inspection |
| R-102 | Every mutation shall be transactional, idempotent where retried, and protected by an optimistic revision or equivalent conflict contract. | Concurrent mutation fixtures and interrupted-request replay |
| R-103 | The seeded desktop issue view shall meet Planning-approved p75 interaction and render latency on controlled hardware. | Browser performance trace and CI budget |
| R-104 | Core screens shall meet WCAG 2.2 AA success criteria in scope, with keyboard-only completion and no serious automated accessibility violations. | axe, accessibility snapshots, manual screen-reader and keyboard test |
| R-105 | Approved clean-room visual fixtures shall remain within their per-screen screenshot-difference budgets on pinned browser, font, OS, and viewport environments. | Playwright `toHaveScreenshot` comparisons and reviewed diffs |
| R-106 | The application shall provide structured logs without secrets or private content, health endpoints, and actionable migration errors. | Log redaction tests and failure injection |
| R-107 | Export/import and SQLite backup/restore shall preserve record counts, stable identifiers, internal scope IDs, ordering, relations, rich text, timestamps, and owner metadata. | Integrity check and round-trip canonical digest comparison |
| R-108 | The public source distribution shall contain complete build instructions, license notices, dependency attributions, contribution guidance, and a security contact. | Release manifest audit |
| R-109 | The first release shall run without Linear, Linear API credentials, Linear MCP, Google, or any paid hosted service. | Network-denied end-to-end deployment test |
| R-110 | Responsive layouts shall avoid overlap and horizontal information loss at approved desktop, tablet, and mobile viewports; dense desktop remains the primary optimization. | Viewport screenshot and interaction matrix |

## Acceptance criteria

Each requirement receives Given/When/Then criteria during Sprint Planning. At minimum, R-003 through R-011 must be exercised as one integrated workflow: create project, add two milestones, create issues through keyboard and context entry, assign milestone and relations, group by status, save a filtered view, open issue details, edit properties, return to the preserved list, and confirm derived progress. Refreshing the browser must preserve committed state and expose unresolved optimistic conflicts rather than overwrite them.

R-101 is a local application security boundary, not a multi-user authorization claim. Its acceptance covers hostile browser origins, remote bind attempts, unexpected Host headers, missing or invalid CSRF, path traversal and symlinks, corrupt/tampered imports, multi-scope input without explicit selection, and backup/restore promotion. Historical two-workspace/RLS evidence applies only to the superseded PostgreSQL build. R-105 acceptance masks only branding and documented volatile regions; broad masks or thresholds that hide layout failure are prohibited.

## Traceability

Outcomes use these stable links: O-001 core workflow completion maps to R-001 through R-014; O-002 reference interaction efficiency maps to R-003 through R-011 and R-103; O-003 spatial and visual fidelity maps to R-003 through R-011, R-105, and R-110; O-004 ownership and data integrity maps to R-002, R-006, R-007, R-012 through R-014, and R-101/R-102/R-106/R-107/R-109; O-005 clean-room public readiness maps to R-015 and R-108.

Evidence references resolve in the centralized source register. Planning may refine wording and acceptance detail but cannot silently remove an outcome, source, or protected-quality obligation. A changed requirement must record the reason, affected outcomes, test impact, migration impact, and decision authority.

## Prioritization

`Must` requirements are R-001 through R-015 and R-101 through R-110 because each supports the defined first release or a protected-quality boundary. CT-77 ranks the user-facing families as issue lifecycle, find/focus, projects/milestones, ownership/recovery, then context/traceability. Implementation order may begin with lower-level dependencies, but disconnected polish cannot displace that scope order.

`Should` candidates after v0.1 include import from generic CSV/JSON, reusable templates, project updates, and richer progress analytics. Multi-user accounts, workspace/team administration, invitations, role management, non-owner assignment, and real-time presence require separate Discovery before they become supported UX. `Could` candidates include calendar views, timeline views, desktop packaging, and public webhooks. Excluded release features remain excluded even if an implementation library makes them appear inexpensive.

## Constraints

The repository cannot rely on proprietary source, assets, fonts, or hidden endpoints. Private Linear screenshots remain untracked. Control Tower local v0.8 owns live project work. The application must run locally on commodity hardware with reproducible locked dependencies and no mandatory cloud control plane. v0.1 has no required runtime secrets.

BasicLinear is the public product identity. The maintainer selected `AGPL-3.0-only`; the technical release audit verifies metadata, notices, provenance, and clean-room publication controls. Google/OIDC and remote authentication are deferred. First-release architecture assumes one owner, one automatically provisioned internal workspace/team context, one loopback process, and one SQLite authority. Internal workspace/team IDs remain in metadata and canonical transfer for identifier and migration compatibility; membership and role records are outside the local runtime.

## Validation

Validation combines unit tests for domain invariants, SQLite migration/transaction/recovery tests, local-origin and filesystem security tests, API contract tests, component accessibility tests, end-to-end owner workflows, keyboard tests, Playwright screenshot comparisons, accepted-scale scan/sort budgets, recovery injection, and independent UAT. Testing uses synthetic fixtures and seeded data, never private reference content. Online statistics select workflow scope; they do not substitute for product acceptance measurements.

Independent Testing maps every Must requirement to evidence and records environment, source revision, dataset, command, result, and artifact location. A test that merely confirms rendering is insufficient for a mutation requirement. A screenshot comparison is insufficient for accessibility. A successful local API response is insufficient for R-101 unless hostile-origin, remote-bind, unsafe-path, and invalid-import cases also execute.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register links requirements to maintainer input, official product and open-source sources, Node/SQLite, Playwright, WCAG 2.2, and CT-77 statistical evidence E-020 through E-023. E-016/E-017 document the superseded PostgreSQL direction; E-024 through E-026 support CT-79 feasibility only. None supplies product acceptance results.
