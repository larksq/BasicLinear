# CT-63 Issue Board Cross-Column Move Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Active issue cards can now move directly across status, priority, assignee, project, and milestone columns through a pointer grip. The existing contextual Edit properties workflow is expanded to all five properties and remains the complete keyboard alternative. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and the stateful HTTP contract pass. Rendered desktop, tablet, and mobile pointer, focus, announcement, accessibility, and geometry verification remains open.

## Implemented Contract

- Every active card in a grouped board reserves one pointer-only grip. Grouping by none, archived issues, read-only roles, and an in-flight move expose no active drag behavior.
- Only a primary mouse gesture or a primary touch/pen gesture can start. Pointer capture binds one pointer ID, and a six-pixel threshold prevents a click or tap from becoming a move.
- Document hit-testing resolves the column under the pointer. A target is highlighted only after the same pure helper that builds the final request accepts that group for the source issue.
- Status targets must belong to the issue team. Priority targets use the canonical enum. Assignee targets must identify one workspace member or Unassigned.
- Active project targets must belong to the issue team and clear any milestone. No project clears both fields. Active milestone targets must resolve uniquely to an active same-team project and update both IDs. No milestone retains the current project.
- Unknown, duplicate, inactive, cross-team, same-group, archived, canceled, lost-capture, and stale-revision paths fail closed. Grouping by none intentionally introduces no direct movement, and this slice does not invent within-column ordering.
- A valid drop revalidates against current visible records and submits the existing revision-bearing issue update request. Successful completion refreshes every affected issue/project/milestone cache. Failure refreshes server state before recovery.
- Pickup and the first target are announced together so React batching cannot erase the pickup state. Later target changes, cancellation, pending commit, committed group, and failure are also announced.
- Committed cards receive a stable-ID, virtualization-aware scroll and focus request. If the current filter removes the card, focus returns to the named board instead of disappearing.
- `Shift+F10` opens the existing issue action menu. Edit properties now covers status, priority, assignee, project, and milestone, including project-scoped milestone options and revision-safe diff-only submission.
- Fixed 24px grip, 14px selection, and 24px action tracks reserve card-header geometry. Target feedback uses an inset shadow and background, so no column or card dimensions change.
- The deterministic `issue-board-move` fixture persists valid updates, returns query/detail readback, clears milestone assignment on project-only moves, rejects invalid pairs with `422 INVALID_ASSIGNMENT`, and rejects stale writes with `409 REVISION_CONFLICT`.

## Automated Verification

| Check | Result |
|---|---|
| Focused move, row-action, board-accessibility, and layout tests | 4 files, 35 tests passed |
| Complete unit regression | 41 files, 273 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,935 modules; CSS 82,794 bytes; saved views 10,177 bytes; projects 50,980 bytes; issues 132,567 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Stateful fixture host checks | 15 of 15 passed after sandbox bind/connect results were rejected as product evidence: HTML/session 200; two projects and two milestones; two initial revision-3 issues; status update 3 to 4; persisted query readback; cross-project milestone pair 4 to 5; persisted detail readback; stale 409 plus unchanged state; project-only milestone clearing 3 to 4 plus readback; invalid pair 422 plus unchanged state |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Pointer and keyboard property paths persist status, priority, assignee, project, and milestone through the existing issue update contract. |
| R-008 | Direct board moves use the active grouping model and preserve canonical group semantics without adding hidden ordering state. |
| R-010 | `Shift+F10` Edit properties remains a complete keyboard alternative; cancellation, conflict, announcement, and focus recovery are explicit. |
| R-104 | The visual grip adds no redundant tab stop; the existing menu/dialog path is named, keyboard reachable, and paired with polite status updates. |
| R-105 | Fixed card action tracks and inset column feedback preserve deterministic board geometry. |
| R-110 | Team, project, milestone, duplicate, archive, no-op, capture-loss, invalid-assignment, and stale-revision paths fail closed. |

## Review Corrections

1. Native HTML drag events were not introduced because touch/pen parity, explicit pointer capture, and deterministic cancellation use the established Pointer Events model.
2. Whole-card dragging was rejected because cards already own open, focus, selection, context-menu, and nested-control behavior. One explicit grip isolates direct manipulation.
3. Mutating on pointer down was rejected. Pickup requires the six-pixel threshold and a valid release target.
4. Trusting visual column identity alone was rejected. The pure helper validates the target during hover and again immediately before mutation.
5. Moving only `milestoneId` across projects was rejected. A milestone move pairs its owning project; a project move clears milestone state.
6. Cross-team status or project targets remain visible in a global board but are not valid drop targets for the source issue.
7. A pointer-only action without keyboard parity was rejected. Edit properties now includes project and milestone in addition to status, priority, and assignee.
8. Separate pickup and target state writes in the first pointer-move event were rejected because React batching could hide pickup. The first announcement includes both states.
9. DOM-only focus lookup was insufficient for a virtualized target column. The target column now scrolls by stable issue identity before focus; a filtered-out card falls back to the board.
10. Refreshing only project-scoped milestone queries was incomplete because issue moves can change workspace milestone progress. The shared refresh now invalidates both scopes.
11. The sandbox bind and connect denials were rejected as product failures or passes. Only the managed-host 15-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, verify mouse, touch, and pen emulation; primary and non-primary mouse buttons; sub-threshold movement; status, priority, assignee, project, and milestone targets; global-board cross-team rejection; No project and No milestone; grouping by none; archived and read-only exclusion; pending-state exclusion; pointer cancellation and capture loss; horizontal and column scrolling; stale revision and invalid assignment recovery; `Shift+F10` Edit properties parity; pickup, target, cancel, commit, and failure announcements; target-card and filtered-board focus recovery; selection, open, and action-menu isolation; fixed target feedback; zero layout shift, overlap, clipped focus, page-level positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-63, complete CT-12, pass rendered P-T08/P-T10/P-T11/P-T12/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
