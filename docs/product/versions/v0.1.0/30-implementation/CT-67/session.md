# CT-67 Implementation Session

- Issue: `CT-67`, stable ID `c59c0f3e-5915-452b-a3a1-75a7afb3d5ca`, starting revision `2`, intended checkpoint revision `3`.
- Session: `CT67-IMPL-20260820T210933Z`.
- Actor: `codex-issue-inline-properties`.
- Mode: code-mutating implementation checkpoint.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Replace the issue detail's shared property-save batch with minimal revision-bearing inline property commits. Keep title, rich description, and resources as one explicit content draft while preserving that draft through property success and recovery.

## Execution

1. Added pure unique-option and minimal-patch helpers for status, priority, assignee, due date, project, milestone, and label changes.
2. Split title, rich description, and resources into a content-only form with explicit save and retained conflict recovery.
3. Converted issue properties to controlled inline changes with stable pending, confirmed-revision, validation, and conflict feedback.
4. Serialized content, property, and archive revision mutations. Property readback never resets the content-editor key or resource draft.
5. Included current archived project and milestone records for display, rejected them as new assignments, loaded milestones with archived context, and cleared milestone in every project-change patch.
6. Added focused option/request/source tests and a stateful fixture with strict minimal-shape validation, exact conflict metadata, invalid assignment rejection, and detail/list/query convergence.

## Verification

- Focused tests: 4 files / 42 tests passed.
- Complete regression: 45 files / 311 tests passed after one stale capability-test literal correction.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Production build: 1,938 modules, no chunk warning.
- Release-audit regression: 1 file / 2 tests passed.
- Integration runner: 7 files / 17 tests discovered and skipped without a configured test PostgreSQL URL; no database-sensitive path changed and no new database pass is claimed.
- Stateful HTTP fixture: 32 of 32 named checks passed at port 4193 after the sandbox bind result was rejected.
- Rendered browser captures and assertions: 0.

## Environment Retry Record

The first complete regression run had one failure in an existing capability source-contract assertion that expected the archive control to wait only for the archive mutation. The stronger implementation serializes archive against content and property revision mutations. The assertion was updated to that accepted behavior, and the complete 45-file / 311-test suite reran cleanly.

The normal fixture launch on port 4193 failed with sandbox `listen EPERM`. The managed production fixture then launched on the same port and passed the complete stateful host matrix. This was an environment retry, not a product-code correction.

## Browser Boundary

The active security policy denies the approved browser surface. No alternate browser surface was used. Desktop, tablet, and mobile rendered property editing, dirty-content retention, focus, keyboard, accessibility, overflow, and geometry claims remain explicitly unaccepted.

## Handoff

CT-67 remains In Progress at intended revision `3`. CT-12 must ingest this checkpoint while retaining its browser blocker; CT-13 must refresh its deterministic release preflight against the reconciled candidate. No outcome or release claim is made.
