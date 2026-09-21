# CT-40 Issue Loading Geometry Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The issue loading surface now follows the selected list or board layout, density, and list-property tracks. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- List loading rows now follow the selected compact, default, or comfortable density at exact `32px`, `36px`, or `44px` data-row heights while retaining the `34px` header.
- List placeholder count and grid tracks now derive from the same visible-property state as loaded issue rows.
- Board selection now renders a dedicated named board skeleton rather than a table.
- The board skeleton reserves three fluid board columns, the loaded `350px` minimum region, the `300px` card region, and exact `76px`, `92px`, or `108px` card heights.
- The board loading region owns explicit horizontal scrolling at reduced widths, matching the loaded board contract.
- Invalid-filter precedence, query behavior, saved view state, loaded list and board virtualization, record actions, and visible copy remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused issue-loading contract | 1 file, 8 tests passed |
| Loading and layout integration | 3 files, 34 tests passed |
| Combined CT-32 through CT-40 semantic regression | 9 files, 47 tests passed |
| Complete unit regression | 21 files, 122 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,921 modules; CSS 66,751 bytes; projects 29,783 bytes; index 279,244 bytes; issues 493,530 bytes |

Review found two adjacent state edges before evidence packaging. The first pass still hard-coded list placeholder count and grid tracks despite configurable visible properties; the final implementation derives both from the selected property set. The board skeleton also initially placed horizontal overflow on an oversized child; final CSS places explicit scrolling on the bounded named loading region. Clean focused, combined, complete, typecheck, and build reruns include both corrections.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-008 | Saved layout, density, and visible-property state now select the matching loading structure before loaded issue data appears. |
| R-103 | Loading no longer substitutes the comfortable table geometry or a table for the selected board; rendered transition timing and shift inspection remains required. |
| R-104 | Each list or board loading surface exposes one named, busy, noninteractive status with no focusable descendants. |
| R-105 | Exact accepted list rows and implemented board card dimensions are encoded in focused source, markup, and CSS contracts; pinned screenshots remain required. |
| R-110 | Responsive pruning remains CSS-owned, and the board loading region owns explicit horizontal scrolling; rendered text fit, reachability, and overflow inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must delay issue reads and verify list loading at all three densities; verify selected property combinations produce the same placeholder tracks as loaded rows; verify board loading at all three card densities; transition from each loading state into its final surface without incoherent resize; restore saved list and board views; verify the named busy region and absence of focusable skeleton descendants; exercise explicit board horizontal scrolling; and inspect overlap, outside controls, duplicate IDs, focus behavior, console warnings, and console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-40, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
