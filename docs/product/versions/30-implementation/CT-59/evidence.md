# CT-59 Team Saved-View Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Team workspaces now expose the existing saved-view library as a URL-authoritative third destination. Workspace visibility and ownership remain server-authoritative, while Open and Build view preserve the selected team as fixed Issues scope. Focused and complete regression, all-workspace typecheck, fixture syntax, production build, and a deterministic team-view HTTP matrix pass. Rendered desktop, tablet, and mobile verification remains open.

## Implemented Contract

- `views` is a valid team destination beside Issues and Projects. The breadcrumb, switcher, active state, direct route, and Back/Forward state all derive from the allowlisted URL team.
- The global Views rail item remains a workspace escape. It clears team and surface-local state even when the current destination is also Views.
- Team Views queries the unchanged workspace saved-view endpoint. Records retain private/workspace sharing and owner semantics; the UI does not claim or persist team ownership.
- The team page heading names the current team and describes the records as reusable workspace views. The description is programmatically associated with the section.
- Open view routes to Issues with the exact saved-view ID and active team. Build view routes to a clean team Issues collection without a saved ID.
- The active team remains an outer system scope in Issues. Existing saved-view team clauses are removed before that route scope is reapplied, so a reusable view cannot override navigation context.
- Views stays hidden behind final-geometry loading while a requested team is unresolved. Invalid, removed, or incompatible team parameters canonicalize to global Views only after the workspace allowlist resolves.
- Team or workspace route epochs remount the library, preventing query, lifecycle mode, edit dialog, mutation feedback, or focus state from crossing context boundaries.
- The three-control switcher uses stable equal tracks on desktop and stable 30px icon controls at the responsive boundary.
- The synthetic fixture exposes two teams and two saved views, including a workspace view with a deliberately conflicting stored team clause. No production API, schema, repository, authorization, RLS, migration, or recovery behavior changed.

## Automated Verification

| Check | Result |
|---|---|
| Focused navigation, team scope, layout, and table-semantics tests | 4 files, 34 tests passed |
| Complete unit regression | 38 files, 242 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Production build | 1,932 modules; CSS 80,986 bytes; saved views 10,177 bytes; projects 41,680 bytes; issues 123,654 bytes; index 285,158 bytes; editor 402,713 bytes; runtime 589 bytes; archive 529 bytes; HTML 663 bytes; no chunk warning |
| Deterministic fixture host checks | 6 of 6 passed after sandbox-bound launch/request failures were rejected as product evidence: HTML 200; session 200; two teams; two saved views; QA issues 2; ENG issues 1 |
| Database integration | Not rerun for this web-only slice; production API, repository, schema, authorization, RLS, migration, and recovery paths are unchanged |
| Rendered browser captures | 0; deferred under the existing browser-policy denial |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 / R-011 | Team Views is URL-authoritative, workspace-allowlisted, history-restorable, and cleaned on invalid context. |
| R-008 / R-010 | Existing list/board saved-view state opens exactly while the active team remains fixed outside user-authored filters. |
| R-104 | Native buttons, a named segmented group, associated heading/description, and stable table semantics preserve keyboard and assistive-technology access. |
| R-110 | Team scope survives Open and Build view; global Views is a deterministic escape and context changes remount local state. |

## Review Corrections

1. Adding a `teamId` field to saved views was rejected because it would falsely convert reusable workspace records into team-owned records and require an unnecessary schema/API migration.
2. Filtering the saved-view catalogue by each record's stored team clause was rejected because views with no team condition or a different condition must remain reusable under the active team.
3. Routing Open view through the global Issues helper was rejected because it discarded the URL-authoritative team and silently broadened scope.
4. Leaving the global Views rail item active inside team Views was rejected because two simultaneous active navigation destinations would obscure the scope escape.
5. Rendering the library while a requested team was still resolving was rejected because stale global content could appear before allowlist canonicalization.
6. Keeping a two-column switcher after adding Views was rejected because content-dependent tracks would shift control geometry. Three equal tracks retain stable dimensions.
7. Sandboxed bind/connect failures were rejected as product failures or passes. Only the managed-host six-check matrix is claimed.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, exercise Product Quality and Engineering Systems Views across direct links, reload, Back/Forward, team switcher navigation, global Views escape, invalid and removed teams, Open view, Build view, a saved view with a conflicting team clause, owner/member/guest roles, active and archived modes, search, edit and lifecycle dialogs, loading, empty, offline, and recoverable error states. Prove URL, breadcrumb, active rail and switcher state, workspace ownership copy, fixed issue scope, focus recovery, accessible names, responsive containment, and history remain synchronized with zero stale content, overlap, clipped focus, positive overflow, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-59, complete CT-12, approve CT-13, pass rendered P-T10/P-T11/P-T13/P-T18/P-T19, authorize release, or validate O-001 through O-003.
