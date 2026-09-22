---
title: "Product Definition"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Product Definition

## Value proposition

BasicLinear gives one technical owner an issue-and-project workspace they can own without surrendering the speed, density, and keyboard fluency that make a modern tracker useful. The value is not “a free clone.” It is a trustworthy independent system: runnable as one local process, transparent in its data model, reversible through export and backup, and refined enough for high-frequency daily use.

The first release optimizes the path from intent to owned state. The owner can capture work quickly, organize it into projects and milestones, expose status and dependencies, inspect progress, and operate the deployment without moving among disconnected modules or depending on a commercial service.

## User jobs

The supported owner needs to frame a project, state its outcome, define milestones, create and prioritize issues, relate and update work with minimal pointer travel, scan grouped work without losing list context, and operate reliable migrations and recovery. These are workflow modes of one user in v0.1, not separate product roles or membership types.

These jobs are recurrent and interdependent. A milestone that cannot accept issues is decorative; an issue that hides its project context is expensive to interpret; a project without progress evidence becomes prose. The product therefore treats project, milestone, and issue records as one connected workflow rather than three separate CRUD screens.

## Alternatives

Linear is the direct experience reference and the current substitute for teams that accept a proprietary hosted service. Plane is the strongest open-source category substitute for work items, cycles, modules, views, pages, and analytics. OpenProject provides broader enterprise planning, budgeting, time, wiki, and meeting capabilities. Taiga and Vikunja offer additional self-hosted agile and task-management paths. GitHub Projects can be sufficient when work is already centered on repositories.

BasicLinear does not need to beat every alternative on feature count. It must demonstrate that a narrower core can be faster to understand, easier to self-host, and more faithful to the interaction qualities sought by the maintainer. If target users prefer a competitor after using the prototype, the project should narrow, reposition, or stop rather than masking that evidence.

## Differentiation

Differentiation has four testable parts. First is workflow fidelity: the approved core tasks should require no more than the accepted interaction-count and time delta from the reference. Second is spatial fidelity: navigation, row density, metadata placement, details panes, and focus behavior should remain stable across the approved viewport matrix while using independent design tokens. Third is ownership: the owner can self-host, export all authoritative records, restore a backup, and operate without a vendor account. Fourth is development transparency: requirements, outcomes, risks, and acceptance evidence stay in the repository and Control Tower.

The clean-room boundary is itself differentiating. Reference observation produces flow specifications, measurements, and generic layout constraints. Implementation uses original code, original copy, independently selected open-source components, and a distinct public identity. Private reference screenshots remain local research evidence.

## Product principles

1. **Speed is a system property.** Keyboard paths, optimistic updates, stable focus, low-latency filtering, and short navigation chains are designed together.
2. **Dense does not mean cramped.** Information appears where it supports a decision, with stable columns, legible contrast, and predictable disclosure.
3. **Context should survive navigation.** Lists, drawers, project sidebars, selected filters, and return focus preserve the user's place.
4. **Local ownership must be real.** Export, backup, restore, migrations, and self-hosting are release capabilities rather than documentation promises.
5. **Defaults carry the workflow.** A new workspace has usable statuses, priority semantics, and views without configuration labor.
6. **Every destructive action is recoverable when practical.** Soft deletion, undo, and explicit confirmation protect routine work.
7. **Accessibility and keyboard use share one model.** Focus order, announcements, shortcuts, and pointer interactions cannot diverge.
8. **Reference quality does not grant reference identity.** Brand, assets, wording, and code remain independent.

## Assumptions

The first release assumes a technically capable owner can run a locked Node 24 release and a desktop-first local web interface. One loopback process and one embedded SQLite file are the complete supported runtime. Docker, PostgreSQL, remote access, account login, Google/OIDC, multi-user collaboration, multi-team navigation, and presence are outside v0.1.

CT-77's large-sample statistics and sensitivity analysis support the approved workflow order. Controlled benchmark tasks, independent testing, and outcome windows test the product itself; interviews are not used to choose v0.1 scope. The maintainer has selected `AGPL-3.0-only` and the BasicLinear identity. The technical release audit verifies public identity, notices, provenance, and clean-room controls before publication.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register compares Linear's documented projects, milestones, issue creation, and display controls with Plane, OpenProject, Taiga, and Vikunja. It also records private interface observations and technical evidence from Node, SQLite, Playwright, and W3C. The CT-79 architecture amendment was accepted on 2026-08-21; inferred differentiation remains subject to product testing.
