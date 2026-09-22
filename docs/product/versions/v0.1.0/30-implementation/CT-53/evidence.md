# CT-53 Milestone-Aware Issue View Evidence

## Verdict

`IMPLEMENTED_AWAITING_DATABASE_AND_BROWSER_VERIFICATION`. Milestones are now queryable once per workspace and are first-class issue filter, grouping, list-property, board-property, URL, and saved-view values. Focused contracts, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. PostgreSQL execution and rendered desktop, tablet, and mobile interaction verification remain open.

## Implemented Contract

- `GET /api/v1/workspaces/:workspaceId/milestones` reads the ordered workspace catalogue inside the existing membership and RLS context, including project identity and derived progress.
- Issue-view grouping and visible-property schemas accept `milestone`; the default view remains backward compatible and does not force a sixth property into existing layouts.
- Milestone filter options are ordered deterministically and labeled `Project / Milestone`; archived options retain an explicit suffix.
- List grouping distinguishes assigned, no-milestone, archived, and missing assignments without dropping records. The list reserves a milestone column with single-line truncation.
- Board cards use the selected property set for priority, assignee, project, milestone, labels, and due date. The status remains available nonvisually, and one named fixed-height metadata group prevents card resizing.
- URL parsing and serialization preserve milestone grouping and properties. Saved-view summaries label the grouping, and migration 010 expands the persisted state constraint without rewriting migration 006.
- The synthetic fixture supplies the workspace milestone route for owner and guest scenarios while preserving guest read-only capability projection.

## Automated Verification

| Check | Result |
|---|---|
| Focused domain, milestone helper, saved-view, geometry, board, and table contracts | 6 files, 34 tests passed |
| Complete unit regression | 34 files, 212 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,930 modules; CSS 79,386 bytes; saved views 9,989 bytes; projects 36,838 bytes; issues 121,520 bytes; index 278,984 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | Owner and guest shells, sessions, and workspace milestone catalogues returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. CT-53 changes a database constraint, a workspace/RLS repository query, an API route, and the saved-view persistence contract; those paths remain unaccepted until the isolated PostgreSQL suite executes.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 / R-005 | The existing project milestone model supplies the workspace catalogue, project-qualified names, archive state, position, and derived progress. |
| R-008 | Issue views now filter, group, and expose milestone assignments in list and board layouts. |
| R-010 | URL and saved-view round trips preserve milestone group and property state. |
| R-104 | Empty and missing states are named, board metadata is grouped and labeled, and status remains available to assistive technology. |
| R-110 | Stable list tracks and fixed board metadata geometry are source-tested; rendered breakpoint and zoom verification remains pending. |

## Review Corrections

1. TypeScript exhaustiveness review exposed the saved-view grouping formatter, which now labels Milestone explicitly.
2. URL restore previously discarded milestone grouping and properties; both enumerations now match the canonical contract.
3. The database check constraint retained the old grouping set. Forward migration 010 now permits persisted milestone-grouped views.
4. The board's hard-coded footer ignored selected properties. One shared property strip now renders only the chosen metadata without changing card height.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures. Exercise list and board layouts; milestone grouping; project-qualified filters; selected and deselected milestone properties; duplicate names; no assignment; archived and missing assignments; saved-view reload; URL back/forward; workspace changes; horizontal board scrolling; pointer hover; keyboard focus; loading and error states. Prove labels remain unambiguous, guest controls remain read-only, list and card geometry does not shift, selected metadata is complete, and there is zero overlap, clipped focus, unintended wrapping, duplicate IDs, console warning, or console error.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-53, complete CT-12, approve CT-13, pass database-backed P-T06 through P-T13, pass rendered P-T10/P-T11/P-T13/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
