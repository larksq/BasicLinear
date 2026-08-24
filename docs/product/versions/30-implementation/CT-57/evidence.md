# CT-57 Workspace Navigation Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Workspace selection now shares the same URL and history authority as project and issue navigation. Direct links, reload, selector changes, newly created workspaces, optional OIDC account-link return, invalid workspace values, and Back/Forward restoration are represented in source and covered by focused tests. Complete regression, typecheck, production build, fixture syntax, and a deterministic two-workspace host matrix pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- `workspaceIdFromSearch` resolves a requested workspace only when its stable ID appears in the authenticated session allowlist. It otherwise uses an accessible fallback and never calls an external provider.
- `workspaceSelectionUrl` adds the canonical workspace ID while retaining non-workspace parameters. On a workspace switch it removes issue, project, tab, milestone, saved view, layout, grouping, ordering, density, archive, property, query, collapsed-group, filter, status, and priority state.
- Legacy direct links without a workspace parameter retain their route state and are canonicalized to the first accessible workspace. A nonempty inaccessible workspace value is canonicalized to a clean fallback route instead of applying its local record IDs in another workspace.
- Workspace selector changes push a clean entry with contextual issue/project history state removed. `popstate` restores the allowlisted workspace plus its saved surface route, and canonicalizes invalid entries in place.
- Stateful Projects, Issues/My work, and Views components are keyed by workspace. They reinitialize from the selected workspace route rather than carrying component state across tenant boundaries.
- Workspace transitions reset create/open signals, command state, dialogs, status editing, and workspace-scoped recents. Query keys and SSE subscriptions already include the workspace ID and continue to switch at the same boundary.
- Newly created workspaces are inserted into the authenticated session cache before their canonical route is pushed. Optional OIDC identity linking returns to the selected workspace overview.
- The synthetic fixture has two accessible workspaces. The secondary workspace exposes its own team/status/member data and empty work surfaces; requesting the primary project through that workspace returns a scoped 404.
- No production endpoint, client capability rule, cache broadening, schema, migration, persistence contract, or RLS policy was introduced.

## Automated Verification

| Check | Result |
|---|---|
| Focused workspace-navigation and layout-contract tests | 2 files, 20 tests passed |
| Complete unit regression | 37 files, 232 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,932 modules; CSS 79,386 bytes; saved views 9,989 bytes; projects 41,116 bytes; issues 122,569 bytes; index 281,557 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | 6 of 6 passed after one failed detached-launch attempt: HTML 200; two-workspace session; secondary team; empty secondary projects; cross-workspace project 404; primary project 200 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, migration, authorization, RLS, and recovery code are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 | The active authenticated workspace is now a restorable stable-ID route and newly created workspaces become the canonical selection. |
| R-011 | Workspace plus issue/project surface context now follows direct links and history; a real workspace change intentionally starts from clean workspace-local state. |
| R-101 | Only session-allowlisted workspaces can become active, and the two-workspace fixture rejects a primary project through the secondary workspace. |

## Review Corrections

1. Keeping workspace selection only in React state was rejected because reload, copied links, and browser history silently returned to the first workspace.
2. Adding a workspace parameter without clearing route-local state was rejected because issue, project, milestone, saved-view, filter, and contextual history values could be replayed against another workspace.
3. Trusting an arbitrary URL workspace ID was rejected. Selection is resolved only against the authenticated session allowlist; invalid values produce no membership probe.
4. Updating the URL without remounting stateful surfaces was rejected because same-view workspace changes could retain selected records, dialogs, or request signals. The workspace is now part of each surface key.
5. Preserving contextual history markers during a workspace switch was rejected because a later close could treat a foreign entry as an app-pushed detail. New workspace entries start with clean history state.
6. Treating the first failed host attempt as product evidence was rejected. The connection failure is recorded, the managed fixture was started, and the full matrix was rerun successfully.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise two accessible workspaces and one invalid workspace value across direct Projects, My work, Issues, Views, project detail, milestone Issues, and issue detail URLs; selector changes; reload; Back/Forward chains; new-workspace creation; OIDC link return where configured; owner/member/guest capabilities; loading, empty, offline, and error states; and longest workspace names. Prove the active workspace, URL, breadcrumb, role, data, recents, SSE subscription, focus, and empty/error surface remain synchronized with zero stale record flash, overlap, clipped focus, unintended wrapping, positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-57, complete CT-12, approve CT-13, pass rendered P-T04/P-T11/P-T16/P-T18, select a license or public identity, authorize release, or validate O-001 through O-005.
