# CT-143 hosted product audit — 2026-08-27

Scope: current deployed development workspace compared with the user-supplied Linear issue-detail reference. This audit covers the product-management surface only; agents, code review, repository, and payment execution remain outside scope.

## Current-run evidence

- `audit-current/01-current-workspace.png` — deployed issue detail.
- `audit-current/02-current-projects.png` — deployed project list.
- `audit-current/03-current-project-detail.png` — deployed project detail.
- `audit-current/04-current-invite.png` — deployed invite/settings flow.
- `audit-current/05-current-issues-list.png` — deployed issue list.

## Findings

1. **P1 — Workspace information architecture is incorrect.** The Workspace section repeats Issues/Projects while the reference exposes Projects/Views/More. The team section is also missing Home, Views, and Cycles.
2. **P1 — Issue detail is not a workable issue record.** The page has only an editable title and comments. It lacks a durable description, resources, sub-issues, and a true activity timeline.
3. **P1 — Invite people opens settings instead of the focused invitation dialog.** It accepts only one address per workflow and makes the primary collaboration action look like administration.
4. **P1 — View options is visibly interactive but produces no menu or state change.** The same pattern appears in property rows: small native selects make the chevron affordance unreliable and visually unlike the reference.
5. **P2 — Issue layout is materially unlike the reference.** Content is too wide and sparse, the properties rail is over-separated, core record content is missing, activity is promoted into an oversized composer, and the top issue actions lack the compact Linear hierarchy.
6. **P2 — Several visible pages are placeholders rather than connected workflows.** Inbox is a filtered issue list, team navigation is duplicated, Views is absent, and milestones are exposed as a project form rather than a usable cycle/timeline surface.

## Required implementation boundary

- Restore Linear-like IA for Workspace and Product team navigation.
- Add persisted issue description, ordered resources, parent/sub-issue relationship, and issue activity readback.
- Add working Views and Cycles pages derived from real workspace data.
- Replace inert/native property affordances with full-row accessible dropdown menus.
- Move Invite people into a focused multi-email modal while keeping invitation state management in People settings.
- Rebuild issue detail to match the supplied reference hierarchy and density.
- Verify every visible navigation item, menu, modal, form, edit, and recovery path in Chrome on development and production.

## Resolution

- Workspace navigation now exposes Projects, Views, and More; the Product team exposes Home, Issues, Cycles, Projects, and Views.
- Issue records persist description, parent/sub-issue relationships, ordered resources, durable activity, and comments.
- The issue canvas and right properties rail now follow the supplied Linear hierarchy and density.
- Invite people opens a focused multi-email modal; People settings retain lifecycle management.
- View options and all five issue-property arrows open functional, accessible menus. The Product and workspace switcher arrows also operate across their full trigger rows.
- Chrome QA found and closed invite-modal overflow and a double-counted comment audit in the Activity badge.
- Development real data and production readback passed on the final Cloud Run and Vercel deployments. Security/adversarial testing remained skipped by maintainer direction.

Status: resolved in implementation; `design-qa.md` concludes `final result: passed`. A separately authorized CT-143 independent review remains the next Control Tower gate.
