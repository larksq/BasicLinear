# CT-55 My Work Navigation Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The accepted My work destination now routes to the existing issue experience with a locked, server-authoritative current-user assignee scope. Direct URLs, navigation commands, detail routes, and browser history share one allowlisted workspace-view contract. Focused tests, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- My work is a primary workspace navigation item and a fixed command-palette option. Direct `?view=my-work` loads restore it through the same allowlist as Projects, Issues, Views, and settings surfaces.
- App-level `popstate` synchronization makes the URL authoritative when moving backward or forward across workspace destinations. The issue surface retains its existing detail-history behavior.
- Switching between Issues and My work removes stale issue identity, layout, grouping, ordering, density, archive, property, saved-view, search, collapsed-group, and filter parameters. Re-entering the same issue destination preserves its URL state.
- The My work route passes the authenticated session user ID into `scopeIssueViewState`. That helper removes every user-controlled assignee clause, preserves the remaining nested Boolean filter, and adds exactly one current-user assignee condition under an outer `and` group.
- The resulting full `IssueViewState` is posted to the existing membership-scoped query route. No client-side row filtering, count adjustment, cached broad result, new endpoint, or authorization shortcut was added.
- My work exposes list/board, grouping, properties, search, archive, density, bulk, detail, and create workflows from the shared issue surface. Its fixed assignee appears as applied context and is excluded from the editable filter-field choices.
- Saved-view create/update/archive controls remain on Issues. This prevents a user from saving a state that visually appears personal while omitting a hidden system scope.
- Issue creation from My work defaults the assignee field to the signed-in user. Owner/member capability checks and guest read-only behavior continue through the shared domain predicate and authoritative API.
- My work and Issues are keyed independently so clicking between them cannot leak selection, detail, saved-view, draft, scroll, or invalid-filter state across the route transition.

## Automated Verification

| Check | Result |
|---|---|
| Focused navigation, issue-scope, command, and layout tests | 4 files, 33 tests passed |
| Complete unit regression | 36 files, 220 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,931 modules; CSS 79,386 bytes; saved views 9,989 bytes; projects 36,838 bytes; issues 122,569 bytes; index 280,181 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | Owner/guest My work shells and sessions plus scoped issue query returned HTTP 200 at port 4181 |
| Database integration | Not rerun for this web-only slice; API, repository, schema, migration, RLS, and recovery code are unchanged |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | The shared issue surface retains complete issue properties and now defaults local My work creation to the signed-in assignee. |
| R-008 | My work reuses the server-authoritative list/board/filter/group/order/property model with an immutable assignee scope. |
| R-009 | Existing workspace search and issue query routes remain authoritative; no client-only result broadening was introduced. |
| R-010 | Navigation rail, command palette, direct URLs, detail URLs, and back/forward share stable route state. |
| R-104 | Current-page, heading, applied-filter, listbox option, and guest capability semantics are source-tested. |
| R-110 | Issue destinations are isolated without changing the existing responsive geometry; rendered breakpoint verification remains pending. |

## Review Corrections

1. A client-only `issues.filter(...)` approach was rejected because it would produce false counts and stale broad query results. The implementation composes the constraint into the existing server query AST.
2. A visible assignee filter that users could clear was rejected because it would make My work cease to be personal. The system constraint is removed from user state, re-added outside user filters, shown as fixed context, and excluded from filter editing.
3. Issue URL serialization previously hard-coded `view=issues`. It now receives the active issue destination, so My work detail navigation does not silently leave the route.
4. Workspace view state previously initialized from the URL but did not follow browser history. One app-level listener now restores the allowlisted destination while the existing issue listener restores issue-local state.
5. Adding a fourth fixed command required matching option counts, indices, result offsets, disabled-option navigation, and source contracts. Those values now share explicit focused coverage.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures. Exercise direct My work load; rail and command navigation; Issues/My work switching; back/forward; list and board; search; user filters including attempted assignee changes; archive state; create defaults; detail open/close and related navigation; owner bulk/quick actions; guest read-only controls; workspace transitions; reload; offline/error states; and longest member labels. Prove every returned row is assigned to the signed-in user, URL state and focus restore correctly, general Issues remains unscoped, guests cannot mutate, and there is zero overlap, clipped focus, unintended wrapping, positive horizontal overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-55, complete CT-12, approve CT-13, pass rendered P-T08/P-T10/P-T11/P-T13/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
