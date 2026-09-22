# CT-56 Project Navigation Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Project list state, project identity, the Overview/Issues/Activity tab, and milestone issue drill-down now share one canonical URL contract. Direct links, reload, project-row opens, created-project opens, command results, explicit Projects navigation, and browser history are represented in source and covered by focused tests. Complete regression, typecheck, production build, fixture syntax, and deterministic fixture host responses pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- `projectRouteFromSearch` accepts only named project statuses, priorities, archive modes, order fields, directions, densities, tabs, and UUID-shaped project or milestone IDs. Query text is bounded to 200 characters. A milestone is restored only when both a project and the Issues tab are valid.
- `projectNavigationUrl` writes exact list state plus detail context while retaining unrelated parameters such as a synthetic fixture selector. Empty optional list filters and every detail-only parameter that no longer applies are removed.
- Opening a project from a row, keyboard action, row menu, project creation, or command result creates a marked history entry. Subsequent local state changes replace that entry so one Back action returns to the originating list state rather than stepping through every filter or tab change.
- A project route loaded directly has no pushed-entry marker. Its explicit Projects control converts the current entry to the canonical list and restores an available row or the search field, so the return path remains operable without leaving the application.
- `popstate` reparses the complete project route, closes stale dialogs and menus, restores list controls and detail context, and returns focus by stable project ID when the route returns to a list.
- Clicking Projects in the rail or fixed command performs an explicit same-surface reset. The shell signals an already-mounted project surface to consume the new list URL, preventing its prior detail state from writing itself back over the reset route.
- Workspace transitions clear project identity, tab, milestone scope, bulk selection, menu state, announcements, and stored focus origins before replacing the URL with a canonical project list.
- The project milestone count control now writes a milestone ID into the Issues-tab route. Selecting Overview, Issues without a milestone, or Activity clears milestone scope.
- No new endpoint, client-side authorization rule, cache broadening, schema, migration, persistence contract, or RLS policy was introduced.

## Automated Verification

| Check | Result |
|---|---|
| Focused project route, workspace navigation, and layout-contract tests | 3 files, 22 tests passed |
| Complete unit regression | 37 files, 228 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,932 modules; CSS 79,386 bytes; saved views 9,989 bytes; projects 41,116 bytes; issues 122,569 bytes; index 280,207 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | Project list, Overview, milestone Issues, Activity, project API, and milestone API returned HTTP 200 at port 4181 |
| Database integration | Not rerun for this web-only slice; API, repository, schema, migration, RLS, and recovery code are unchanged |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Exact project list and detail context now survive direct URLs and history without changing project persistence or authorization. |
| R-004 | Milestone issue drill-down is a restorable project Issues-tab route and rejects incompatible route combinations. |
| R-010 | Row, command, created-project, tab, milestone, direct-link, reload, Back, and explicit-close paths share one canonical navigation model. |
| R-110 | Existing responsive project geometry is unchanged; source and host checks pass, while rendered breakpoint verification remains pending. |

## Review Corrections

1. Component-only project selection was rejected because it made direct project links, reload, and browser Back impossible. Project identity and the active tab now live in one allowlisted route.
2. Serializing only the selected project was rejected because Back would restore a default list rather than the user's query, filters, ordering, archive mode, and density. The marked detail entry carries the exact originating list state.
3. Calling `history.back()` for every explicit close was rejected because a direct project URL might leave the application. Only an app-pushed matching project entry goes back; a direct entry is replaced with the canonical list.
4. Clearing only React state when Projects was selected again was rejected because the still-mounted detail effect could rewrite the old URL. The shell now sends an explicit reset signal after pushing the list route.
5. Milestone drill-down as a transient object was rejected because it could not survive reload. The route stores a validated milestone ID and derives its display label from the authorized milestone response.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise owner and guest fixtures across list query/filter/archive/order/direction/density changes; pointer and keyboard row opens; command-result and created-project opens; direct Overview, Issues, milestone Issues, and Activity URLs; reload; Back/Forward chains; explicit Projects close; archive/restore; workspace transitions; invalid and unavailable IDs; loading, empty, offline, and error states; and longest project or milestone labels. Prove exact URL restoration, one expected history step, stable row/search focus return, correct `aria-current` tab state, guest read-only behavior, and zero overlap, clipped focus, unintended wrapping, positive horizontal overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-56, complete CT-12, approve CT-13, pass rendered P-T06/P-T11/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
