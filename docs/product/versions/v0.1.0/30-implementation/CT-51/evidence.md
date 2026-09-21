# CT-51 Saved-View Library Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. A first-class Views destination now exposes readable saved views as dense Personal and Workspace sections with active and archived lifecycle modes. Focused contracts, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered desktop, tablet, and mobile interaction verification remains open.

## Implemented Contract

- Views is a primary workspace navigation destination with workspace breadcrumb context and a collection-sized content surface.
- Personal and Workspace records are split by private and workspace sharing scope, filtered by active or archived lifecycle, searched across name, scope, and deterministic state summary, and sorted by case-insensitive name plus stable ID.
- Each record exposes its name, access and owner, layout, grouping, nested filter count, update time, and a full layout/group/filter/search/property/density/archive summary.
- Open removes stale issue selection and view-state parameters, clears stale issue history state, and routes to Issues using the exact `saved` identifier. Build view starts from a clean Issues route and preserves the existing Save view creation contract.
- Owners with `issue:write` can rename, change access, archive, and restore. Other readable views are open-only, and API authorization plus PostgreSQL RLS remain authoritative.
- Rename and access updates, archive, and restore submit the visible revision. Originating workspace IDs survive asynchronous completion, so cache refresh, announcements, dialog closure, and focus recovery cannot target a replacement workspace.
- Query failures remain visible with an explicit retry. Mutation failures remain beside their actionable surface. Loading and empty states preserve collection geometry and distinguish no views, an empty archive, and no search matches.
- The native table has a named scroll region, complete column headers, row headers, and Personal or Workspace row-group headings. Native labels name the edit dialog. Live results and stable focus recovery cover row-removing lifecycle mutations.
- Responsive rules retain View, Access, and Actions at every supported width; secondary state columns are removed in a fixed order without changing command geometry.

## Automated Verification

| Check | Result |
|---|---|
| Focused state, semantics, capability, route, and geometry tests | 4 files, 22 tests passed |
| Complete unit regression | 33 files, 203 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,929 modules; CSS 78,801 bytes; saved views 9,955 bytes; projects 37,258 bytes; issues 117,525 bytes; index 277,254 bytes; editor 402,713 bytes; runtime 589 bytes; HTML 663 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | Owner shell/session and guest session/membership returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. CT-51 changes no schema, service authorization contract, or RLS policy, but the full database-backed regression remains part of the pending canonical test matrix.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-008 | Saved view state and lifecycle are now a primary readable workspace collection while the existing Issues state and save workflow remain authoritative. |
| R-010 | Dense deterministic summaries, stable action geometry, ordered responsive column removal, and a named overflow region preserve scan and command reachability. |
| R-104 | Native table, header, row-header, row-group, form-label, live-region, keyboard command, and focus-recovery semantics are enforced by tests. |
| R-110 | Owner and guest fixture contracts are reachable. Rendered breakpoint, empty/error, and interaction verification remains pending. |

## Review Corrections

1. The edit dialog open state now derives from the same ownership plus `issue:write` predicate as its trigger and submit path.
2. Every mutation retains its originating workspace ID and suppresses stale completion effects after a workspace switch.
3. Opening a saved view clears both issue URL parameters and browser history state before the exact saved-view identifier is applied.
4. Archive and restore return focus to the stable mode control because the changed row leaves the current lifecycle collection.
5. Responsive columns are removed in a deterministic order while View, Access, and Actions remain reachable.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures with populated Personal and Workspace rows in active and archived modes. Exercise search, mode changes, Open, Build view, rename, private/workspace access changes, Archive, Restore, query retry, mutation failure, optimistic-revision conflict, role loss, and workspace switch. Prove exact saved-view routing, owner-only mutation controls, guest open-only behavior, confirmed announcements, focus recovery, keyboard reachability, and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-51, complete CT-12, approve CT-13, pass rendered P-T10/P-T11/P-T13/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
