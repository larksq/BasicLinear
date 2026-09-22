# CT-36 Dynamic Issue Focus Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Virtualized issue list rows and board cards now resolve their single roving tab stop from stable issue identity, but rendered browser acceptance remains open.

## Correction

- A pure resolver retains the preferred focused issue while it remains visible, independent of its array position.
- If filtering, group collapse, refresh, or removal hides the preferred issue, the visible active issue becomes the roving target; otherwise the first visible issue is used.
- Empty collections expose no issue-record tab stop.
- List and board focus movement record the target issue ID before scrolling the virtualizer and focusing the mounted record.
- Reordering no longer silently transfers the tab stop to whichever issue inherits the old numeric index.
- Enter, Space, Arrow Up, Arrow Down, `J`, `K`, nested-control isolation, selection, grouping, dimensions, pointer behavior, and visible copy remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused dynamic-focus behavior and integration contract | 1 file, 5 tests passed |
| Combined CT-32 through CT-36 semantic regression | 5 files, 21 tests passed |
| Complete unit regression | 17 files, 94 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,918 modules; CSS 63,366 bytes; projects 28,758 bytes; index 277,599 bytes; issues 492,204 bytes |

The first combined run found one stale CT-35 source assertion that required an index-based tab stop. The implementation behavior was correct; the assertion was updated to require stable issue-ID focus, and the complete five-file semantic slice then passed 21 of 21 checks.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | List and board navigation now maintain one deterministic record target across dynamic collections while retaining every accepted keyboard command. |
| R-011 | Filtering, regrouping, collapse, reorder, and refresh no longer transfer the roving tab stop solely because a virtual index changed. |
| R-104 | Every non-empty issue collection exposes one predictable record tab stop and every empty collection exposes none. |
| R-110 guard | No CSS, grid, dimension, responsive rule, or visible copy changed; rendered geometry inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At 1440x900 and 390x844, the follow-up must focus a non-first list row and board card, reorder or refresh the collection, and confirm focus identity and the single tab stop remain on that issue. It must then filter or collapse the focused issue away and confirm deterministic active/first-visible fallback, restore the collection, exercise Arrow Up, Arrow Down, `J`, `K`, Enter, and Space through virtualized boundaries, verify nested checkbox isolation, visible focus, reachable horizontal content, unique IDs, and clean console diagnostics.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-36, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
