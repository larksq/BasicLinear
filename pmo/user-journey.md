---
title: "User Journey"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# User Journey

## Journey stages

The first-release journey has seven stages: start locally, establish the owner profile, orient, plan, execute, review, and recover. Startup turns a versioned release into one healthy loopback process and one SQLite file. First run automatically provisions one owner profile, internal workspace/team context, and default statuses. Orientation teaches through stable defaults rather than explanatory marketing. Planning creates a project and milestones. Execution captures and updates issues. Review scans views, dependencies, activity, and progress. Recovery handles mistakes, conflicts, restarts, export, and restore.

Each stage preserves context for the next. Default statuses make the first issue possible; project context proposes milestones; issue changes update project progress; saved views make review repeatable; activity and backup make recovery trustworthy. The user should not assemble this coherence manually.

## Happy path

The owner checks out or downloads a release and runs one documented local command. The process chooses or accepts an explicit user-data directory, binds only to loopback, creates the SQLite file and owner profile without contacting a vendor service, and provisions internal workspace/team context behind the product boundary. A default workflow appears with Backlog, Planned, In Progress, In Review, Done, and Canceled semantics. No environment file, login, OIDC provider, database server, or container is required.

The owner creates a project from the Projects view, enters a concise outcome and description, sets status, priority, start date, and target date, then adds ordered milestones. The project overview shows those properties, description, resources, milestone progress, and activity in one work surface. The owner presses the documented issue shortcut, creates issues without leaving project context, and assigns milestones from the composer.

The owner opens Issues, groups by status, filters to the project, and uses keyboard navigation to select an issue. Details open beside or over the list without losing scroll, grouping, filter, or selection. The owner changes status, priority, due date, labels, milestone, and blocking relations; writes a comment; and closes details back to the exact list position. Owner context is implicit and no assignee chooser appears. Project progress updates from committed issue state.

The owner opens a saved view for blocked work, inspects dependencies and activity, then opens project overview to understand milestone progress and scope. The owner/operator exports the workspace and verifies a scheduled backup. No step requires Linear, Google, or a paid service.

## Edge cases

The supported UX must handle duplicate project names, empty milestones, archived projects, deleted labels, long titles, rich descriptions, large issue groups, dates across time zones, stale browser tabs, unwritable or corrupt data paths, and rejected imports. Security and migration fixtures cover hostile browser origins, remote bind attempts, unsafe paths, interrupted writes, stale tabs, and explicit single-scope selection.

If the owner creates an issue outside project context, project and milestone remain optional rather than guessed. If a milestone is archived or removed, linked issues retain an auditable change and do not disappear. If two sessions or stale tabs edit the same record, the later writer receives an explicit conflict with current state and can reconcile rather than silently overwrite. If search returns no results, filters and scope remain visible.

## Recovery

Routine deletion goes to a recoverable archive or trash surface. Undo appears after immediate actions when reliable. Restoring a project or issue returns its stable identity and relations when dependencies still exist; missing optional references are reported. Irreversible purge and destructive restore require elevated confirmation and a fresh backup. Workspace deletion is outside the v0.1 UI.

Interrupted startup identifies the failing data path, schema step, or listener and the operator command that diagnoses it. A failed migration leaves the prior SQLite file selected with a verified backup and documented rollback path. Lost in-process change hints fall back to refetch without discarding local form content. Restart creates a new ephemeral browser session while preserving product data.

## Accessibility

Every core workflow is keyboard complete. Focus order follows the visible layout; drawers and dialogs trap focus only while modal; escape returns to the invoker; list selection and bulk selection are distinguishable; dynamic save, conflict, delete, restore, and filter results are announced. Shortcuts do not capture text-editor input unexpectedly and have command-palette equivalents.

Rows, status symbols, milestone progress, and priorities do not depend on color alone. Touch targets and focus indicators remain visible at supported zoom. Responsive layouts preserve reading order when properties move below content. Rich text exposes semantic headings, lists, links, and code. Reduced-motion preferences remove nonessential transitions without breaking state feedback.

## Validation

Journey validation uses the automatically provisioned workspace/team and a seeded owner workflow. Automated tests complete the happy path with mouse and keyboard variants, refresh between major steps, and assert stable identifiers and preserved context. Instrumented owner runs and independent UAT capture task success, time, errors, and recovery; online statistics, not interviews, own workflow-scope selection. Screen-reader checks cover navigation landmarks, issue creation, property updates, activity, conflicts, and restore.

Edge-case fixtures cover 10,000 issues, long multilingual content, empty states, hostile origins, network denial, stale revisions, archived dependencies, corrupt or multi-scope imports, and restore into a fresh compatible data directory. Journey acceptance requires the whole sequence, because local screen success can hide failures between project, milestone, issue, view, and recovery state.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register supports the journey through historical authenticated observation, official Linear documentation, Node/SQLite local-storage and backup capabilities, Playwright workflow/visual testing, and WCAG 2.2. CT-79 changes the technical direction but does not manufacture journey acceptance.
