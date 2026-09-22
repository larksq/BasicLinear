---
title: "Research and Evidence"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Research and Evidence

## Research questions

Discovery investigated six questions. First, which Linear workflows are genuinely core for a credible first release? Second, which interaction qualities make the reference product feel fast rather than merely feature-complete? Third, which open-source alternatives already cover the functional category, and where does a fidelity-first product still differ? Fourth, can a narrow independent implementation support self-hosting, multi-workspace isolation, search, optimistic updates, and visual regression without inheriting an enterprise platform? Fifth, which claims lack direct user evidence? Sixth, which legal and brand boundaries must constrain visual parity?

## Method

The research combined maintainer-confirmed input, repository inspection, current official documentation, public open-source repositories, and historical read-only observation of an authenticated Linear workspace in Chrome. CT-77 added current online statistics from Stack Overflow, PMI, GitLab/Omdia, and Atlassian, with question denominators, represented populations, limitations, and vendor conflicts. Four historical private screenshots remain under `.control-tower/evidence/` and excluded from Git. No Linear API, MCP connector, mutation, or task projection was used.

Safety update, 2026-08-20: CT-3 review of Linear's current Terms of Service identified a material contractual question for authenticated observation performed to build a competitive product. Further authenticated observation is prohibited. Existing screenshots remain private and ignored; aggregate CT-2 measurements are quarantined from publication and comparative marketing. Public official documentation, standards, synthetic fixtures, independent product tests, and consenting user research remain permitted under the [CT-3 clean-room policy](../docs/product/versions/v0.1.0/10-discovery/CT-3/clean-room-policy.md). This update records a restrictive engineering control, not a legal conclusion.

Claims from vendor pages are treated as direct product descriptions, not proof of user satisfaction. Vendor-maintainered statistics are labeled and never provide the sole support for a workflow priority. GitHub repository descriptions establish public licensing and advertised scope, not production quality. Online statistics support a scope ranking but do not establish migration intent, exact switching effort, product usability, or legal clearance.

## Source register

| ID | Source and access | Type | Verification | Claim supported |
|---|---|---|---|---|
| E-001 | Maintainer goal in the Codex task, 2026-08-19 | confirmed input | verified | The requested product must be free and open source, preserve or improve Linear-level UX, cover projects, issues, and milestones, and use Control Tower rather than Linear for work tracking. |
| E-002 | Private authenticated Linear projects screenshot, 2026-08-19 | screenshot | verified, private | The reference projects view uses a persistent navigation rail, dense rows, inline health/priority/lead/date/issue/progress metadata, and a summary side pane. |
| E-003 | Private authenticated Linear issues screenshot, 2026-08-19 | screenshot | verified, private | The reference issues view groups compact rows by status and exposes priority, labels, project, due date, assignee, relations, and dates without card-heavy layout. |
| E-004 | Private authenticated Linear project overview screenshot, 2026-08-19 | screenshot | verified, private | Project overview combines document-like description, editable properties, resources, milestones, progress, and activity in one focused work surface. |
| E-005 | Private authenticated Linear issue-detail screenshot, 2026-08-19 | screenshot | verified, private | Issue detail keeps title, rich description, resources, activity, properties, project milestone, and dependency relations visible in a two-column work surface. |
| E-006 | [Linear Projects documentation](https://linear.app/docs/projects), accessed 2026-08-19 | official product docs | verified | Linear defines projects as outcome-oriented units containing issues and optional documents, with a single project per issue. |
| E-007 | [Linear Project Overview documentation](https://linear.app/docs/project-overview), accessed 2026-08-19 | official product docs | verified | The project overview includes summary, detailed description, resources, milestones, and a progress graph. |
| E-008 | [Linear Project Milestones documentation](https://linear.app/docs/project-milestones), accessed 2026-08-19 | official product docs | verified | Milestones organize project stages, accept issue assignment, support filters/grouping/reordering, and expose progress. |
| E-009 | [Linear Create Issues documentation](https://linear.app/docs/creating-issues), accessed 2026-08-19 | official product docs | verified | Issues require team, identifier, title, and status; keyboard creation and drafts are first-class workflow elements. |
| E-010 | [Linear Display Options documentation](https://linear.app/docs/display-options), accessed 2026-08-19 | official product docs | verified | Issue and project views support grouping, ordering, board/list layouts, and configurable property visibility. |
| E-011 | [Plane repository](https://github.com/makeplane/plane), accessed 2026-08-19 | official repository | verified | Plane offers open-source work items, cycles, modules, views, pages, and analytics under AGPL-3.0. |
| E-012 | [OpenProject repository](https://github.com/opf/openproject), accessed 2026-08-19 | official repository | verified | OpenProject provides a GPL-3.0 Community Edition with planning, roadmaps, task management, agile workflows, time/cost tracking, wikis, and meetings. |
| E-013 | [Taiga backend repository](https://github.com/taigaio/taiga-back), accessed 2026-08-19 | official repository | verified | Taiga is an MPL-2.0 open-source project-management platform with public installation and contribution documentation. |
| E-014 | [Vikunja repository](https://github.com/go-vikunja/vikunja), accessed 2026-08-19 | official repository | verified | Vikunja positions itself as an owned task manager, offers self-hosting, and licenses most code under AGPL-3.0-or-later. |
| E-015 | [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots), accessed 2026-08-19 | official technical docs | verified | Playwright supports deterministic screenshot baselines and pixel-difference thresholds when environments are controlled. |
| E-016 | [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), accessed 2026-08-19 | official technical docs | verified | PostgreSQL can enforce per-row visibility and mutation policies with default-deny behavior when row security is enabled without an applicable policy. |
| E-017 | [PostgreSQL full-text search](https://www.postgresql.org/docs/current/textsearch.html), accessed 2026-08-19 | official technical docs | verified | PostgreSQL supplies indexed text search primitives suitable for issue and project search before a separate search service is justified. |
| E-018 | [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/), accessed 2026-08-19 | standard | verified | WCAG 2.2 defines testable accessibility success criteria suitable for a keyboard-heavy web application. |
| E-019 | Repository inspection on 2026-08-19 before bootstrap | repository inspection | verified | No runnable product existed, so new-product capability baselines were zero. |
| E-020 | [Stack Overflow 2025 Developer Survey](https://survey.stackoverflow.co/2025/) with [technology](https://survey.stackoverflow.co/2025/technology) and [work](https://survey.stackoverflow.co/2025/work), accessed 2026-08-21 | official survey | verified | More than 49,000 developers across 177 countries provide large question-level samples for collaboration tools, work/personal tool counts, and adoption or rejection factors. |
| E-021 | [PMI Pulse of the Profession 2024](https://www.pmi.org/-/media/pmi/documents/public/pdf/learning/thought-leadership/pmi-pulse-of-the-profession-2024-report.pdf), accessed 2026-08-21 | official survey report | verified | 2,246 project professionals and 342 leaders across industries and regions report material predictive, hybrid, and agile method use. |
| E-022 | [GitLab 2024 Global DevSecOps Report](https://about.gitlab.com/resources/developer-survey/2024/), accessed 2026-08-21 | official vendor/Omdia survey | verified, conflict labeled | More than 5,000 professionals in 39 countries report toolchain-consolidation pressure and lifecycle automation. |
| E-023 | [Atlassian State of Teams 2024](https://www.atlassian.com/blog/state-of-teams-2024), accessed 2026-08-21 | official vendor survey and telemetry | verified, conflict labeled | 5,000 knowledge workers plus product telemetry report goal, tracking-consistency, duplicate-work, and information-retrieval friction. |
| E-024 | [Node.js 24.18 `node:sqlite`](https://nodejs.org/download/release/v24.18.0/docs/api/sqlite.html), accessed 2026-08-21 | official technical docs | verified | The pinned runtime provides file-backed SQLite, foreign-key enforcement, defensive mode, busy timeout, prepared statements, and an online backup wrapper; the module is release-candidate stability. |
| E-025 | [SQLite Appropriate Uses](https://www.sqlite.org/whentouse.html), accessed 2026-08-21 | official technical docs | verified | SQLite is designed for local application storage and application-file use; serialized application-server requests and single-writer workloads fit its stated boundary. |
| E-026 | [SQLite Backup API](https://www.sqlite.org/backup.html), accessed 2026-08-21 | official technical docs | verified | The online backup API creates a snapshot in another database file while bounding source locks and exposing explicit error handling. |

## Findings

The reference experience is a system of interaction rules, not a color palette. Dense rows, stable dimensions, persistent context, fast keyboard entry, inline property editing, filters, grouping, and side panels reduce navigation and mode switching. Projects are both data containers and living documents. Milestones remain lightweight but spatially present. Issue detail emphasizes action and relationships rather than decorative presentation.

Open-source alternatives prove that self-hosted issue and project management is an established category. They also increase the differentiation burden: feature presence alone is insufficient. BasicLinear must win on the combination of reference-grade ergonomics, narrower operational complexity, clean self-hosting, transparent data ownership, and a clean-room design implementation. A fork of a broad competitor could accelerate backend coverage but would inherit information architecture and styling assumptions that work against pixel-level interaction fidelity.

CT-79 replaces the earlier PostgreSQL/Docker hypothesis with a focused local application: one TypeScript/Node process, one embedded SQLite file, strict loopback-origin security, structured migrations, bounded scan search, online backup, and Playwright-driven interaction and screenshot baselines. E-016/E-017 remain accurate technical sources but no longer define the v0.1 architecture.

CT-77's weighted model ranks issue capture/lifecycle first, find/focus second, and project/milestone planning third. That top-three set is stable under default, equal, prevalence-heavy, and migration-risk-heavy weights. Data ownership/recovery and context/traceability follow but remain release-critical. Multi-user administration and AI/advanced analytics do not drive the one-owner v0.1 release.

## Implications

First-release scope should contain the complete vertical slice for one owner's project, milestone, issue, status, priority, label, relation, activity, saved-view, search, keyboard, and data-ownership workflow. It should not expose multi-user administration, cycles, initiatives, AI agents, code-review automation, customer management, billing, advanced analytics, or mobile-native clients. Those features can follow only after the core interaction and data model are trusted.

Visual acceptance must use independent tokens and open-source icons. Private reference screenshots historically informed internal measurements but are now quarantined from further use and cannot ship. The product needs a distinct public name, iconography, wording, and legal review before release. “BasicLinear” is a working repository name, not a cleared market identity.

## Evidence gaps

CT-1 is canceled; five interviews are not used to choose workflow scope. CT-77 supplies the broad statistical ranking but does not establish how many current Linear users would switch, which import formats dominate, which self-hosting friction is acceptable, or which switching deadline applies. CT-2's automated benchmark remains an internal diagnostic and does not validate the configured-owner O-002 outcome.

The maintainer selected `AGPL-3.0-only`, which best matches the stated goal of keeping hosted modifications open. The technical release audit covers declared metadata, notices, source-offer documentation, contribution policy, the BasicLinear identity, visual reference controls, screenshots, and asset provenance. It records technical evidence and does not make a legal conclusion.

## Research and evidence

The source register above is the centralized research record. It contains 26 evidence IDs across maintainer input, historical product observation, official product and repository sources, PostgreSQL history, Node/SQLite, Playwright, W3C, repository inspection, and four large-sample statistical sources. CT-77's detailed extraction is in [`docs/product/versions/v0.1.0/10-discovery/CT-77/`](../docs/product/versions/v0.1.0/10-discovery/CT-77/); CT-79's technical review is in [`docs/product/versions/v0.1.0/20-planning/CT-79/`](../docs/product/versions/v0.1.0/20-planning/CT-79/). Capability sources do not prove migration, recovery, performance, or outcomes.
