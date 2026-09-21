# CT-64 Implementation Session

- Issue: `CT-64`, stable ID `7d534d1d-485b-416f-97eb-c61687840644`, starting revision `2`, intended checkpoint revision `3`.
- Implementation session: `codex-issue-bulk-edit` / `CT64-IMPL-20260820T191327Z`.
- Scope: complete the existing issue bulk-selection workflow with project, milestone, and due-date actions while retaining status, priority, assignee, archive, and restore behavior.
- Request boundary: one pure helper rejects empty or duplicate selections, unknown or ambiguous identities, cross-team statuses/projects, archived projects/milestones, inconsistent project/milestone pairs, and invalid dates. Every accepted item retains its visible `expectedRevision`.
- Assignment boundary: project changes clear milestone assignment unless one explicit valid milestone is paired; milestone selection pairs its active same-team owning project; No project clears both fields; No milestone preserves each issue's current project; and Clear due dates submits `null` explicitly.
- Selection boundary: only choices valid for every selected issue are rendered. Stale status, assignee, project, and milestone drafts reconcile when selection eligibility changes. Fully successful batches clear the selection and draft; conflicted and failed rows remain selected for retry.
- Accessibility boundary: every control has a programmatic name, all pointer actions use native keyboard-reachable controls, the clear-date mode exposes pressed state, one visible polite status announces aggregate results, and pending or read-only states disable mutation controls without hiding context.
- Mutation boundary: the existing bulk endpoint remains authoritative. Successful completion refreshes issue, activity, project, and milestone caches. The implementation changes no production contract, route, repository, authorization policy, RLS policy, migration, or recovery path.
- Fixture boundary: `fixture=issue-bulk-edit` exposes two same-team projects, two cross-project milestones, and two revision-3 issues. It persists accepted batches and per-item partial results, rejects stale revisions and invalid assignment pairs, applies project-only milestone clearing, and returns query/detail readback.
- Automated result: four focused files and 34 tests pass; all 42 files and 282 tests pass; all eight workspaces typecheck; fixture syntax passes; and the 1,936-module production build passes without a chunk warning.
- Runtime result: the sandboxed fixture launch failed with `EPERM`; the managed fixture started on port 4189 as session 12743. Sandboxed localhost connections were rejected as environment evidence, and all 25 managed-host checks passed.
- Browser boundary: no screenshot or rendered assertion is claimed because the approved browser surface remains denied by the active security policy. No alternate browser surface was used.
- Product boundary: bulk label replacement is not exposed because the shared replacement patch cannot express safe add/remove semantics across heterogeneous selected issues.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. Provider projection is disabled and no Linear API, MCP, or UI was used for tracking.
- Status boundary: CT-64 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-003 remain pending.
