# CT-50 Contextual Issue-Row Action Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. List rows and board cards now expose one capability-aware contextual action menu and a revision-safe quick property editor. Focused contracts, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered desktop, tablet, and mobile interaction verification remains open.

## Implemented Contract

- List rows reserve a stable trailing action track and board cards reserve fixed action-header geometry. Hover, focus-within, coarse-pointer, and keyboard-invoked states do not resize the record.
- The overflow trigger, right-click, `ContextMenu`, and `Shift+F10` open one shared menu whose state lives above both virtualizers. The overflow trigger does not add a second sequential tab stop.
- `Open issue` is always present. Writable active issues add `Edit properties` and `Archive`; writable archived issues add `Restore`; guests receive no mutation command.
- Menu focus starts on the first item, supports ArrowUp, ArrowDown, Home, End, Escape, and Tab, and returns to the trigger or stable issue record when that target is still present.
- The menu measures its rendered height before viewport clamping, so owner, archived, and guest variants use their real geometry rather than a guessed item count.
- The quick editor uses native labeled selects for status, priority, and assignee. It submits a diff-only request with the visible issue revision and makes no request when values are unchanged.
- Archive and restore carry the visible issue revision. Successful mutations refresh issue, detail, activity, project, and milestone caches and announce the confirmed action.
- Every mutation retains its originating workspace ID. A workspace switch or capability loss closes stale UI, invalidates the correct workspace cache, suppresses stale announcements, and prevents focus recovery into unrelated records.

## Automated Verification

| Check | Result |
|---|---|
| Focused interaction, keyboard, semantics, and geometry tests | 6 files, 40 tests passed |
| Complete unit regression | 32 files, 196 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,927 modules; CSS 74,610 bytes; projects 37,225 bytes; issues 117,957 bytes; index 276,041 bytes; editor 402,713 bytes; runtime 589 bytes; HTML 663 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | Owner shell/session and guest session/membership returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. CT-50 changes no schema, service authorization contract, or RLS policy, but database-backed concurrency and authorization remain part of the pending canonical test matrix.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Active and archived issue records expose the appropriate open, property-edit, archive, and restore commands. |
| R-008 | List and board records share one contextual property-edit interaction without changing filtering or saved-view state. |
| R-010 | Action tracks remain fixed, the menu uses measured bounded geometry, and responsive list/board tracks retain command reachability. |
| R-011 | Quick edits announce confirmed values and row archive or restore announces the confirmed state. |
| R-012 | Archive and restore use revision-bearing requests and remain hidden without `issue:write`. |
| R-104 | Named menu semantics, native labels, keyboard navigation, one roving record tab stop, and stable focus recovery are enforced by tests. |
| R-105 | Menu placement clamps measured dimensions to the viewport and scroll, resize, outside-pointer, and workspace transitions dismiss stale state. |
| R-110 | Owner and guest fixture contracts are reachable. Rendered breakpoint and interaction verification remains pending. |

## Review Corrections

1. Menu placement now measures the actual owner, archived, or guest menu height before clamping, avoiding false vertical offsets for shorter variants.
2. Mutation variables retain the originating workspace ID, so a workspace switch cannot invalidate or announce against the replacement workspace.
3. Role loss closes the quick editor and action menu before another mutation can be submitted.
4. Focus recovery resolves a stable issue ID after virtualization and uses a record fallback when the overflow trigger is not mounted.
5. Diff-only request construction makes unchanged submissions a local no-op while preserving the visible optimistic-concurrency revision for real edits.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures in active list, active board, archived list, and archived board contexts. Exercise overflow click, right-click, `ContextMenu`, `Shift+F10`, menu arrows, Home, End, Escape, Tab, Open, quick edit, Archive, Restore, outside dismissal, scroll dismissal, resize dismissal, role loss, and workspace switch. Prove stable geometry, correct capability projection, confirmed announcements, no-op behavior, revision-conflict recovery, focus return, and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-50, complete CT-12, approve CT-13, pass rendered P-T09/P-T11/P-T13/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
