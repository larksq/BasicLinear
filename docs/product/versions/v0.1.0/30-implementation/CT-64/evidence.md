# CT-64 Bulk Issue Property Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Selected issues can now receive revision-safe project, milestone, and due-date changes alongside the existing status, priority, assignee, archive, and restore actions. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and a stateful HTTP contract pass. Rendered desktop, tablet, and mobile selection, keyboard, focus, announcement, accessibility, and geometry verification remains open.

## Implemented Contract

- The bulk toolbar exposes named Status, Priority, Assignee, Project, Milestone, and Due date controls plus Apply, Archive/Restore, and Clear selection commands.
- Status and project choices are limited to one common selected team. Mixed-team selections retain team-neutral priority, assignee, and due-date actions while exposing only universally safe project clearing.
- Project and milestone records must be unique, active, and same-team. Selecting a milestone pairs its owning project; selecting a new project clears milestone state unless a valid explicit milestone follows.
- No project clears both assignment fields. No milestone writes only `milestoneId: null`, preserving heterogeneous current projects. Clear due dates writes `dueDate: null`; an empty date input alone remains a no-op.
- Invalid calendar dates, duplicate selected IDs, empty selections, ambiguous records, cross-team targets, archived records, and inconsistent assignment pairs fail closed before the API call.
- Each selected issue contributes its current stable ID and `expectedRevision`. The existing API returns one result per item. Updated rows leave selection; conflicted and failed rows remain selected after refetch so a user can review or retry.
- Selection or workspace changes clear stale dependent draft values. Changing Project clears a stale Milestone immediately; eligibility reconciliation also clears stale Status, Assignee, Project, and Milestone choices.
- A fully successful mutation clears the draft. Aggregate `updated`, `conflicts`, and `failed` counts appear in one live status region. Pending and read-only modes preserve labels while disabling every mutation control.
- The toolbar wraps at constrained widths, retains 30px control geometry, and keeps the date input plus clear-mode control in one fixed grid.
- Bulk label replacement remains excluded because replacing every selected issue's label array would be destructive without a separate add/remove contract.

## Automated Verification

| Check | Result |
|---|---|
| Focused bulk-helper, capability, layout, and board-accessibility tests | 4 files, 34 tests passed |
| Complete unit regression | 42 files, 282 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,936 modules; CSS 83,622 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 137,841 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Stateful fixture host checks | 25 of 25 passed after sandbox bind/connect results were rejected as product evidence: HTML/session; two projects and milestones; two initial revision-3 issues; accepted paired project/milestone/date batch; query/detail readback; mixed updated/conflict response; current revision reporting; invalid-pair rejection and unchanged state; project-only milestone clearing; conflict retry; explicit due/project/milestone clearing; final persisted readback |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Bulk project, milestone, and due-date updates now persist through the same revision-safe issue contract as status, priority, and assignee. |
| R-008 | The existing list/board selection model now supports the remaining non-destructive assignment and date actions without hidden state. |
| R-010 | Every bulk action uses named native keyboard controls; clear mode, pending state, aggregate results, and retry retention are explicit. |
| R-104 | One live result region avoids duplicate announcements; read-only controls remain named and predictably disabled. |
| R-105 | Fixed-height controls and a bounded date grid preserve toolbar geometry while flex wrapping handles constrained widths. |
| R-110 | Mixed-team, duplicate, archive, invalid-date, invalid-pair, stale-revision, empty, and partial-result paths fail closed or remain recoverable. |

## Review Corrections

1. Passing raw select values directly to the API was rejected. One pure helper resolves and validates every identity before building a request.
2. Listing all workspace projects for a mixed-team selection was rejected because a shared project patch cannot be valid for more than one team.
3. Updating only `milestoneId` was rejected. Milestone selection always pairs the owning active same-team project.
4. Letting a project change inherit each issue's previous milestone was rejected. A project change emits `milestoneId: null` unless one valid explicit milestone is selected.
5. Treating an empty date input as destructive clearing was rejected. Clear due dates is a separate pressed command.
6. Clearing a milestone by also writing one project ID was rejected because selected issues may have heterogeneous projects. No milestone writes only the milestone field.
7. Dropping failed rows from selection was rejected. Only updated IDs leave selection; conflict and failure results retain their rows for retry.
8. Keeping successful draft values for the next unrelated selection was rejected. Empty selection and workspace changes reset the draft, while partial failure deliberately retains it.
9. Announcing the same result through visible and hidden status regions was rejected. The aggregate result owns one live region.
10. Exposing label replacement was rejected because the existing shared patch can only replace arrays and cannot express safe per-selection add/remove intent.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify list and board selection; mouse and keyboard selection; common-team and mixed-team options; project/milestone dependency updates; No project, No milestone, set date, Clear due dates, and keep-existing-date modes; successful, partial, conflict, invalid, pending, offline, archived, and read-only states; retained conflict selection and retry; one aggregate announcement; logical focus order; visible focus; toolbar wrapping; stable height within each viewport; date control containment; zero overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-64, complete CT-12, pass rendered P-T08/P-T10/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
