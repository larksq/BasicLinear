# Requirements Analysis

## Scope model

The first release is one integrated local-owner workflow: start one loopback process; automatically establish the owner profile and internal workspace/team context; create a project and ordered milestones; create and relate issues; organize work through views, filters, grouping, and bounded search; preserve context while editing details; inspect activity and progress; then export, back up, and restore the authoritative SQLite file.

The requirement set separates user capabilities (`R-001` through `R-015`) from protected qualities (`R-101` through `R-110`). Every requirement links to registered evidence and at least one outcome. The acceptance text below is a Discovery placeholder; Sprint Planning must turn it into complete Given/When/Then criteria without weakening the source or outcome link.

## Functional requirements

| ID | Requirement summary | Sources | Outcomes | Acceptance placeholder | Planned validation |
|---|---|---|---|---|---|
| R-001 | One ephemeral local-owner browser session with no login, provider, secret, or network dependency | E-001, E-024, E-025 | O-001 | A fresh local runtime starts on loopback and preserves product data across a process restart. | Local-origin, restart, and workflow E2E |
| R-002 | Automatic owner/internal-scope bootstrap and default/custom statuses | E-001, E-009, E-025 | O-001, O-004 | First start provisions one owner profile, stable internal scope IDs, and statuses; administration, switching, login, and remote UI are absent. | Domain, storage, restart, and supported-surface E2E |
| R-003 | Project CRUD, archive/restore, metadata, search, order, and progress | E-002, E-006 | O-001, O-002 | Project state and derived progress survive refresh and filtering. | Integrated project workflow |
| R-004 | Ordered project milestones with description, dates, issues, and progress | E-004, E-008 | O-001, O-002 | Reordering and issue state changes produce deterministic milestone progress. | Milestone invariant and E2E tests |
| R-005 | Owner issue creation and editing with stable identifier and core properties | E-003, E-005, E-009 | O-001, O-002 | Keyboard and contextual creation persist core fields with implicit owner context and no non-owner assignee picker. | Issue API, keyboard, and E2E tests |
| R-006 | Blocking, related, duplicate, and parent/sub-issue relations | E-005 | O-001, O-004 | Valid inverse relations persist and invalid self-relations are rejected. | Domain invariant tests |
| R-007 | Durable activity for issue and project changes | E-004, E-005 | O-001, O-004 | Each accepted mutation records actor, time, field, and before/after semantics. | Transaction and activity tests |
| R-008 | List/board, grouping, ordering, filters, properties, bulk selection, saved views | E-003, E-010 | O-001, O-002 | A saved grouped view restores the same query and presentation state. | View contract and browser E2E |
| R-009 | Bounded project and issue scan search with predictable ranking | E-010, E-025 | O-001, O-002 | Identifier, title, description, and label scans return deterministically ranked owner-scope results at the accepted personal workload. | Search relevance, query-bound, and workload tests |
| R-010 | Command palette and keyboard paths for core actions | E-009, E-010 | O-002, O-003 | Every approved core action is reachable without a pointer and supports Escape recovery. | Keyboard matrix and timing study |
| R-011 | Context-preserving issue and project details | E-003, E-005 | O-002, O-003 | Closing details restores list filters, scroll, selection, and focus. | Browser state-preservation E2E |
| R-012 | Recoverable archive/trash and elevated irreversible purge | E-001 | O-004 | Routine deletion can be restored; purge requires explicit elevated confirmation. | Permission and recovery tests |
| R-013 | Versioned export and compatible backup/restore | E-001 | O-004 | A round trip preserves every authoritative record and relation digest. | Export and restore digest test |
| R-014 | One loopback Node 24 process and one embedded SQLite file with health and migrations | E-024, E-025, E-026 | O-001, O-004 | A clean local user starts one process without Docker/database server, survives restart and a tested upgrade, and runs outbound-denied. | CT-82 local runtime and migration rehearsal |
| R-015 | Distinct identity and independently created assets | E-001, E-002, E-003, E-004, E-005 | O-005 | The release audit finds no private reference artifact or unapproved identity element. | Provenance and release audit |

## Statistical priority

CT-77 ranks the integrated requirement families rather than changing their acceptance semantics. The stable top-three set is issue capture/lifecycle (`R-005`, `R-010`, `R-012`), find/focus (`R-008`, `R-009`, `R-011`), and project/milestone planning (`R-003`, `R-004`). Data ownership/recovery (`R-013`, `R-014`, `R-107`, `R-109`) and context/traceability (`R-006`, `R-007`) remain release-critical because migration cannot discard authoritative state or relationships.

The statistical sources add scope evidence: E-020 covers developer work/personal projects and adoption pressures; E-021 requires method neutrality across predictive, hybrid, and agile work; E-022 supports consolidated context and automation-ready contracts; E-023 supports goals, consistent tracking, and information retrieval. They do not weaken any product test or supply a task-time, usability, fidelity, security, or recovery result.

## Protected-quality requirements

| ID | Requirement summary | Sources | Outcomes | Acceptance placeholder | Planned validation |
|---|---|---|---|---|---|
| R-101 | Fail-closed loopback origin, listener, filesystem, and import boundary | E-024, E-025 | O-001, O-004 | Remote bind, hostile Host/Origin, missing CSRF, unsafe paths, corrupt input, and implicit multi-scope input expose or mutate no product data. | Local API, listener, path, and import adversarial suite |
| R-102 | Transactional, retry-safe mutations with optimistic revisions | E-024, E-025 | O-001, O-004 | Stale tabs and retried commands surface a conflict or idempotent result and never silently replace state. | Transaction, stale revision, and replay tests |
| R-103 | Planning-approved p75 interaction and render latency on seeded desktop data | E-002, E-003 | O-002 | The fixed workload remains inside the accepted budget on controlled hardware. | Browser performance trace |
| R-104 | WCAG 2.2 AA criteria in scope and keyboard-only core completion | E-018 | O-001, O-003 | Core workflows have visible focus, valid semantics, and no serious automated violation. | axe, accessibility snapshots, manual AT |
| R-105 | Per-screen clean-room screenshot budgets in pinned environments | E-015 | O-003, O-005 | Approved fixtures remain within their accepted structural thresholds. | Playwright screenshot comparisons |
| R-106 | Secret-safe structured logs, health, and actionable migration errors | E-001 | O-004 | Failure injection yields actionable, non-sensitive diagnostics and correct health state. | Redaction and failure tests |
| R-107 | Export/import and SQLite backup/restore preservation of identifiers, order, relations, text, time, and internal scope metadata | E-001, E-026 | O-004 | Restored canonical export and verified SQLite snapshot match the pre-backup digest. | Integrity check and round-trip digest comparison |
| R-108 | Build instructions, license, attribution, contributing, and security contact | E-011, E-012, E-013, E-014 | O-005 | The source-release manifest contains every required public artifact. | Release manifest audit |
| R-109 | No Linear, Google, paid host, database server, container, credential, or external service required at runtime | E-001, E-024, E-025 | O-004, O-005 | A network-denied one-process local release completes the core workflow and backup. | CT-82 network-denied E2E |
| R-110 | No overlap or silent information loss at approved viewports | E-002, E-003, E-004, E-005 | O-001, O-003 | Desktop, tablet, and mobile matrices keep controls and text usable. | Viewport screenshot and interaction matrix |

## Prioritization and exclusions

All listed requirements are `Must` because each supports the bounded first release or a release-blocking quality. Within user-facing work, CT-77 prioritizes issue lifecycle, find/focus, and project/milestone planning, followed by ownership/recovery and context/traceability. Architecture and security dependencies may still require a different implementation order. A disconnected screen does not satisfy a vertical slice.

Cycles, initiatives, goals, AI agents, code review, billing, advanced analytics, native clients, marketplace integrations, enterprise provisioning, multi-region deployment, and Linear synchronization are excluded from `v0.1.0`. Remote access, login/OIDC, multi-user accounts, workspace/team administration and switching, invitations, roles, sharing, non-owner assignment, and durable real-time collaboration require separate later Discovery. Generic import, attachments, templates, richer analytics, timeline, calendar, and public webhooks remain later candidates.

## Outcome separation

Requirements describe capabilities and constraints. Outcomes describe observable success: workflow completion (`O-001`), reference-relative efficiency (`O-002`), structural visual fidelity (`O-003`), data round-trip integrity (`O-004`), and clean-room release readiness (`O-005`). Passing a requirement test is necessary evidence but cannot by itself prove an outcome.

`O-002` remains `baseline_needed`: CT-2's automated diagnostic is not an accepted owner outcome observation. Planning may use the CT-77 workflow order but cannot claim relative efficiency or rendered usability from statistical evidence. The other four contracts use a verified zero-product bootstrap baseline and are ready for Planning handoff without changing their meaning.

## AI and automation boundaries

AI functionality is outside the release. Automation may generate fixtures, tests, drafts, and diagnostics, but a human authority accepts scope, license, public name, security controls, visual baselines, release evidence, and destructive operations. Generated code receives the same review and validation as human-authored code. Private reference content is never supplied to distributable models, fixtures, or assets.

## Change control

A requirement change records reason, source change, affected outcomes, acceptance impact, migration impact, and decision authority. Planning can clarify criteria and split work; it cannot silently delete a source, outcome, trust boundary, or excluded-scope decision. All executable work stays in Control Tower under exactly one milestone.
