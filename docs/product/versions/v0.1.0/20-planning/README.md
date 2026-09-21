# v0.1.0 Sprint Planning

This package converts the validated [Discovery handoff](../10-discovery/handoff.md) into a dependency-closed delivery plan. The machine boundary is `planning-package.json`; the human-readable artifacts below own accepted intent and implementation detail.

## Artifacts

- [Product requirements document](./prd.md)
- [Architecture](./architecture.md)
- [UX design](./ux-design.md)
- [Risk analysis](./risk-analysis.md)
- [Acceptance criteria](./acceptance-criteria.md)
- [Backlog](./backlog.md)
- [Sprint plan](./sprint-plan.md)
- [Quality review](./quality-review.md)
- [Critical QA](./critical-qa.md)
- [Implementation handoff](./handoff.md)

## Planning decision

Readiness is **yellow**. CT-76 narrows supported v0.1 UX to one owner and one implicit workspace/team; CT-77 replaces CT-1 for workflow-scope evidence. CT-79 supersedes the Docker/PostgreSQL architecture with one pinned Node 24 loopback process and one embedded SQLite file. CT-78 removes unsupported collaboration controls, CT-80 migrates persistence, CT-81 collapses the runtime, and CT-82 replaces CT-21 as the independent operational gate. The missing O-002 baseline remains nonblocking for implementation only; `CT-3` still blocks `CT-13` and public release.

Control Tower's local v0.8 database owns issue status, dependencies, milestones, and revisions. Repository documents own intent. No Linear provider task, API, MCP, or projection is used.
