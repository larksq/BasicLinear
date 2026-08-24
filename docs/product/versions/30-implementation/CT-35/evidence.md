# CT-35 Issue Board Accessibility Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Issue board cards now satisfy the source-level roving-focus, keyboard, nested-control, and nonvisual metadata contracts, but browser acceptance remains open.

## Correction

- Each populated board column exposes one card in the tab order instead of one tab stop per mounted card.
- Arrow Up, Arrow Down, `J`, and `K` clamp within a column, scroll the virtualizer to the target, and focus the mounted card.
- Enter still opens a focused card and Space still toggles its selection.
- Key events originating from nested controls no longer trigger card commands.
- Status and priority retain the same visible icon treatment while also exposing explicit screen-reader text.
- No CSS rule, card dimension, visible copy, grouping, query, pointer behavior, or responsive rule changed.

## Automated Verification

| Check | Result |
|---|---|
| Focused issue-board accessibility contract | 1 file, 4 tests passed |
| Combined CT-32/CT-33/CT-34/CT-35 semantic regression | 4 files, 16 tests passed |
| Complete unit regression | 16 files, 89 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,917 modules; CSS 63,366 bytes; projects 28,758 bytes; index 277,599 bytes; issues 492,048 bytes |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Board cards now implement the accepted row-navigation keys, bounded virtual focus, Enter open, Space selection, and nested-control exclusion. |
| R-104 | One roving tab stop per populated column and explicit status/priority text provide an observable keyboard and assistive-technology contract. |
| R-110 guard | No visual or responsive token changed; final desktop/mobile geometry inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. The required follow-up must verify at 1440x900 and 390x844 that each populated column has exactly one card tab stop; Arrow Up, Arrow Down, `J`, and `K` move focus through visible and initially unmounted cards; boundary keys clamp; Enter opens the focused card; Space selects it; checkbox keys do not open or double-toggle the card; status and priority are present in the accessibility tree; focus remains visible; horizontal scrolling preserves reachability; IDs are unique; and console diagnostics are clean.

## Privacy And Authority

The automated checks use repository source and synthetic fixtures only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-35, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
