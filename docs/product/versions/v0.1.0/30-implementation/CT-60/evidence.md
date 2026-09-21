# CT-60 Project View Configuration Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Projects now support URL-authoritative grouping, collapsed groups, and configurable visible properties while preserving server query scope and API ordering. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and a deterministic project-view HTTP matrix pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- Project list URLs round-trip `group`, `properties`, and `collapsed` beside existing search, filter, archive, order, direction, density, project detail, tab, and milestone state.
- Grouping is allowlisted to none, status, priority, lead, or team. Status and priority groups use workflow semantics; named groups sort deterministically and place missing values last.
- Collapse keys are group-qualified, duplicate-free, bounded to 32, and validated against the active grouping. Malformed values restore no collapsed groups.
- Visible properties are allowlisted to status, priority, lead, team, start date, target date, and progress. Invalid or duplicate payloads restore the accepted default set, while the explicit `none` sentinel supports the minimal Project plus Actions grid.
- One canonical property order drives header cells, data cells, loading geometry, and the CSS grid. Responsive styles no longer hide positional columns with `nth-child`; the named data region provides horizontal reachability.
- Group headers are named row headers with expanded state and record counts. Data groups preserve rowgroup semantics and keep the action column aligned.
- Roving keyboard focus is flattened from expanded groups only. Group collapse cannot target an unmounted row, and manual ordering stays disabled when a grouped presentation is active.
- Existing workspace and team filters remain server inputs. Grouping and property state are client presentation only and cannot broaden scope.
- The synthetic `project-view` fixture provides two teams and three projects spanning planned/in-progress, urgent/high/medium, assigned/unassigned, two dates, and three progress values. Existing team-route behavior is unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused project navigation, view configuration, layout, table-semantics, and team-scope tests | 5 files, 37 tests passed |
| Complete unit regression | 39 files, 251 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,933 modules; CSS 81,293 bytes; saved views 10,177 bytes; projects 47,804 bytes; issues 123,670 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | 6 of 6 passed after sandbox-bound bind/connect results were rejected as product evidence: HTML 200; session 200; two teams; three projects; QA projects 2; ENG projects 1 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Projects exposes deterministic status, priority, lead, and team groups with exact counts and collapse state. |
| R-010 / R-011 | List state is URL-authoritative, allowlisted, history-restorable, and bound to one stable responsive grid. |
| R-104 | Native grouping/property controls, rowgroup/rowheader semantics, expanded state, and expanded-row roving focus preserve keyboard and assistive-technology structure. |
| R-110 | Workspace/team query scope remains outside presentation state; malformed state fails closed and cannot broaden the collection. |

## Review Corrections

1. Grouping on the server was rejected because the accepted gap is presentation state and the current API already supplies ordered, scoped project records.
2. Using raw group labels as collapse keys was rejected because duplicate names and renamed teams or members would make restoration ambiguous. Keys are qualified by grouping and stable identifiers where available.
3. Accepting partially valid property lists was rejected because a malformed shared URL could silently hide required context. The whole payload restores the accepted default set.
4. Preserving collapsed keys after changing grouping was rejected because cross-group keys are invalid and can create unreachable focus targets. Group changes clear collapse state.
5. Allowing manual reorder in a grouped view was rejected because visual neighbors may not be API neighbors. Reorder remains available only in the ungrouped, unfiltered manual-order state.
6. Responsive `nth-child` hiding was rejected because user-selected properties could disappear while their headers and loading tracks diverged. The data region now scrolls horizontally with one shared template.
7. Sandbox bind/connect failures were rejected as product failures or passes. Only the managed-host six-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise none, status, priority, lead, and team grouping; collapse and expand each group; all property combinations including `none`; direct load, reload, Back/Forward, workspace and team transitions; search/filter/archive/order/density combinations; keyboard row navigation, selection, context menus, and focus after collapse; loading, empty, offline, and recoverable-error states. Prove header/data/loading alignment, group semantics, stable counts, route canonicalization, focus reachability, horizontal data-region access, accessible names, responsive containment, zero clipped focus, zero page-level positive overflow, zero duplicate IDs, and zero console warnings or errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-60, complete CT-12, pass rendered P-T06/P-T11/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
