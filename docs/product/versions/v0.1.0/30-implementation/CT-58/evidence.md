# CT-58 Team Workspace Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The application now exposes session-allowlisted team workspaces whose Projects and Issues surfaces, contextual creation, filters, saved-view application, direct-record handling, and history are derived from one URL team parameter. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and a deterministic two-team HTTP matrix pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- The shell lists the selected workspace's teams in a stable `Your teams` rail. A team opens Issues by default; the topbar exposes an Issues/Projects segmented switcher and a workspace/team/view breadcrumb.
- Team IDs are accepted only from the current workspace team response. Inaccessible, removed, or incompatible parameters are cleaned after that allowlist resolves. Team routes never render a global Projects or Issues collection while resolution is pending.
- Same-view team Back/Forward changes increment a route epoch and remount the stateful view. Switching workspace or opening global Projects/Issues removes team and record context.
- Issue query state injects `teamId` as an outer system condition after deleting user-controlled team clauses. Saved views remain usable, but their team clauses are removed before the active URL team scope is reapplied.
- Team Issues use only the scoped projects, milestones, teams, and statuses. Bulk status controls, quick edit, filter values, detail options, and contextual creation cannot surface another team's workflow values.
- Team Projects append `teamId` to the existing project query. New projects submit the route team from a locked selector; editing retains the existing cross-team transfer capability and closes the detail if the update moves it outside the active team.
- Direct issue and project records are fetched only to validate their team. A mismatch is not rendered and the URL is replaced with the current team list state.
- The two-team fixture provides independent QA and ENG records. Its GET project filtering and POST nested issue-filter parsing prove the exact request boundary used by the client.
- No API route, service, repository query, schema, migration, capability, RLS, or recovery behavior changed.

## Automated Verification

| Check | Result |
|---|---|
| Focused navigation, scope, layout, and team contract tests | 4 files, 37 tests passed |
| Complete unit regression | 38 files, 239 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,932 modules; CSS 80,986 bytes; saved views 9,989 bytes; projects 41,680 bytes; issues 123,654 bytes; index 284,801 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | 6 of 6 passed after sandbox-bound launch/request failures were rejected as product evidence: HTML 200; two teams; QA projects 1; ENG projects 1; QA issues 2; ENG issues 1 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 / R-003 | Workspace teams are first-class navigable contexts for their Projects collections. |
| R-005 / R-008 | Team Issues compose a fixed server query scope outside user filters and retain list/board/saved-view workflows. |
| R-011 | Team, surface, record, filter, and history state are shareable and restored through one allowlisted URL contract. |
| R-101 | Team routes are selected only from current-workspace data; direct records from another team are rejected without rendering. |
| R-110 | Global navigation is a deterministic escape and team history preserves the user's exact scoped surface. |

## Review Corrections

1. Keeping team selection only in sidebar component state was rejected because reload, copied links, and Back/Forward would lose scope.
2. Treating team as a user-editable filter was rejected because saved views and URL filters could override or contradict navigation scope.
3. Rendering a global collection while the team allowlist loaded was rejected because it could reveal unrelated records before canonicalization.
4. Scoping list queries without validating direct record routes was rejected because a copied issue/project ID could render another team's detail.
5. Locking only creation while leaving status, project, milestone, bulk, and detail options global was rejected because cross-team values would remain actionable.
6. The initial mutation allowlist omitted affected workspace-navigation, state-semantics, and capability regression files. The local CT-58 checkpoint records those exact bounded test paths before parent reconciliation.
7. Sandboxed bind/connect failures were rejected as product failures or product passes. Only the managed host-network six-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise both teams across direct list/detail links, Issues/Projects switching, sidebar team switching, reload, Back/Forward, global escape, invalid and removed teams, saved views with conflicting team clauses, contextual issue/project creation, cross-team direct IDs, owner/member/guest roles, longest team names, list/board modes, dialogs, loading, empty, offline, and recoverable error states. Prove URL, breadcrumb, active rail state, query data, creation defaults, focus recovery, accessible names, responsive containment, and history stay synchronized with zero stale record flash, overlap, clipped focus, positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-58, complete CT-12, approve CT-13, pass rendered P-T04/P-T06/P-T08/P-T10/P-T11/P-T16/P-T18/P-T19, authorize release, or validate O-001 through O-004.
