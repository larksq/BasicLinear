# CT-61 Issue View Configuration Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue list and board configuration now use one canonical property, collapse, history, saved-state, and grid model. Grouped virtual rows expose table semantics, while an ungrouped list omits its synthetic group row. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and a deterministic issue-view HTTP matrix pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- Issue URLs round-trip `properties` and `collapsed` beside the existing layout, grouping, search, filter, archive, order, density, saved-view, workspace, team, and detail state.
- Visible properties are allowlisted to priority, assignee, project, milestone, labels, and due date. One canonical order drives controls, headers, data cells, and loading geometry.
- The explicit `none` value preserves the minimal Select plus Status plus Issue plus Actions grid across reload and history. Unknown or duplicate property tokens reject the entire payload and restore the accepted default set.
- Collapse keys are qualified with the active grouping, bounded to 32, duplicate-free, and validated as status, priority, assignee, project, or milestone identifiers and accepted empty-state keys. Cross-group or malformed values restore no collapsed groups.
- Saved-view configuration is normalized through the same property and collapse rules before comparison or application.
- Grouping `none` mounts issue records without a synthetic `All issues` virtual row. Other groups expose a named expandable row header inside the table row group with an aligned `aria-colspan`.
- The virtual spacer is presentational so virtual issue and group rows remain the semantic children of the row group.
- Existing workspace and team filters remain server inputs. Property, grouping, and collapse state are client presentation only and cannot broaden scope.
- The synthetic `issue-view` fixture provides two teams and three issues spanning three statuses, two projects, assigned milestone and no milestone, two priorities, and two team-scoped query results.

## Automated Verification

| Check | Result |
|---|---|
| Focused issue configuration, milestone, loading-geometry, layout, and table-semantics tests | 5 files, 38 tests passed |
| Complete unit regression | 40 files, 259 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,934 modules; CSS 81,433 bytes; saved views 10,177 bytes; projects 47,804 bytes; issues 124,901 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | 6 of 6 passed after the sandbox bind result was rejected as product evidence: HTML 200; session 200; two teams; three issues; QA issues 2; ENG issues 1 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-008 | Issue list and board share one deterministic grouping, property, collapse, and geometry model. |
| R-010 / R-011 | View configuration is canonical across URL, reload, history, saved state, and direct links, including an explicitly empty property set. |
| R-104 | Grouped virtual lists expose rowgroup, row, rowheader, expanded-state, and aligned-column semantics; ungrouped lists do not add a false group. |
| R-110 | Workspace/team query scope remains independent of presentation state; malformed state fails closed and cannot broaden the collection. |

## Review Corrections

1. Encoding an empty property list as an empty query value was rejected because URL parsing cannot distinguish it from absent configuration. The explicit `none` sentinel preserves intent.
2. Accepting a valid subset of malformed property tokens was rejected because a shared URL could silently hide context. Invalid or duplicate payloads restore the whole accepted default.
3. Appending toggled properties in click order was rejected because header, cell, and loading geometry would vary for the same set. All property paths use one canonical order.
4. Raw collapse keys were rejected because they can leak across grouping changes and accept arbitrary values. Keys are qualified, allowlisted by active grouping, duplicate-free, and bounded.
5. Rendering an `All issues` group header for grouping `none` was rejected because it adds a false hierarchy and extra virtual row. Ungrouped mode renders issue rows directly.
6. Styling a group button without row semantics was rejected because the surrounding surface declares a table. Group records now expose row and rowheader relationships inside the rowgroup.
7. Moving grouping or properties into the issue API was rejected because this gap is presentation state and the API already returns authorized ordered records.
8. The sandbox bind failure was rejected as a product failure or pass. Only the managed-host six-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise none, status, priority, assignee, project, and milestone grouping; collapse and expand each group; all property combinations including `none`; malformed, duplicate, and cross-group URLs; direct load, reload, Back/Forward, workspace and team transitions; saved views; search/filter/archive/order/density combinations; keyboard row navigation, selection, context menus, and focus after collapse; loading, empty, offline, and recoverable-error states. Prove header/data/loading alignment, group semantics, stable counts, route canonicalization, focus reachability, horizontal data-region access, accessible names, responsive containment, zero clipped focus, zero page-level positive overflow, zero duplicate IDs, and zero console warnings or errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-61, complete CT-12, pass rendered P-T10/P-T11/P-T18/P-T19, approve CT-13, authorize release, or validate O-001 through O-003.
