# CT-41 Project Row Interaction Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The Projects list now implements the accepted single-row tab stop, visible selection, bulk archive/restore, and keyboard/pointer overflow-menu contract. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- The interactive Projects surface is now a named multi-select grid with exactly one visible data row in the page Tab order.
- Roving focus follows stable project identity across reorder and refresh, falls back to the first visible project when a filter removes the preferred row, and moves with Arrow Up, Arrow Down, J, and K.
- Enter retains project opening. Space and a pointer checkbox now toggle a visible and nonvisual selected state without entering nested controls.
- Selection exposes a stable `42px` bulk toolbar with selected count, archive or restore, partial-result reporting, retryable failed records, and clear selection.
- Per-row reorder and archive controls are consolidated behind one familiar overflow trigger. The menu opens by pointer, right click, Context Menu, or Shift+F10 and supports enabled-item arrows, Home/End, exact disabled states, and Escape focus restoration.
- The last two menus open upward so the absolute menu layer stays reachable without changing the accepted `32px`, `36px`, or `44px` row geometry.
- Filters, ordering rules, archive/restore APIs, project properties, progress, density persistence, responsive column pruning, row pointer opening, and project detail behavior remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused project-row, keyboard, density, and grid contract | 4 files, 23 tests passed |
| Combined CT-32 through CT-41 semantic regression | 11 files, 60 tests passed |
| Complete unit regression | 22 files, 128 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,922 modules; CSS 68,414 bytes; projects 33,884 bytes; index 279,244 bytes; issues 493,929 bytes |

The first focused run found one historical assertion that still required passive table-cell roles. It was corrected to require an interactive multi-select grid with grid cells, after which all focused checks passed. Final source review added upward-opening bottom-row menus and moved menu arrow/Home/End indexing into a pure tested resolver. Clean focused, combined, complete, typecheck, and build reruns include both corrections.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Project rows now expose selection plus menu-based open, reorder, archive, and restore paths while preserving current filters, ordering eligibility, revisions, and API semantics. |
| R-010 | One roving row tab stop supports Enter, Space, J/K, arrows, Context Menu, Shift+F10, menu arrows, Home/End, and Escape recovery while exact modifier, repeat, composition, prevented, and nested-control exclusions remain enforced. |
| R-104 | The project list is a named multi-select grid; rows expose `aria-selected`, shortcuts, named checkbox and menu controls, enabled menu-item navigation, visible focus, and a live selected-count/result state. Rendered assistive-technology verification remains required. |
| R-105 | Selection layers and absolute menus do not alter the exact density row heights in source and CSS contracts; pinned screenshots remain required. |
| R-110 | Existing tablet/mobile column pruning is unchanged, bottom menus flip upward, and menu/selection layers use bounded geometry; rendered reachability, text fit, and overflow inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must verify exactly one visible project row is tabbable; Arrow/J/K focus movement and stable identity across reorder, filter, refresh, and detail return; Enter and pointer opening; Space and pointer checkbox selection; visible selected styling and announcements; stable bulk-toolbar height; synthetic archive/restore success, partial failure, retry, and clear behavior; pointer, right-click, Context Menu, and Shift+F10 menu opening; enabled-item arrows and Home/End; exact disabled reorder items; Escape restoration; upward bottom-row menus; all three row densities; responsive property reachability; zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-41, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
