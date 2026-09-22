# CT-44 Issue Navigation Context Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Route-style issue detail now retains the exact matching virtual list or board scroll context, and related-issue navigation keeps the first initiating record as the focus return target. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- A pure navigation-context policy owns bounded list scroll, board horizontal scroll, and stable group-column vertical scroll values under one exact workspace and serialized query-state key.
- Negative and non-finite offsets fail closed to zero, extreme offsets are bounded, and a different workspace, layout, filter, grouping, order, saved state, project, or milestone context receives a fresh zeroed snapshot.
- The virtual list and each virtual board column restore at their actual scroll owners in a layout effect, while scroll events update a parent ref without adding render pressure.
- Board horizontal scroll is retained separately from per-column vertical offsets, so route presentation can unmount and remount the board without conflating axes or groups.
- Opening the first contextual issue records its row or card identity. Following related issues no longer overwrites that origin, and focus recovery retries across bounded animation frames so the restored virtual item can render first.
- Direct detail URLs retain no synthetic list origin. Source review found that a later direct `popstate` entry could otherwise inherit an older contextual origin, so direct history entries now clear it explicitly without clearing the contextual back path.
- URL serialization, filters, grouping, collapsed groups, selection, virtualization thresholds, queries, detail presentation, panel resizing, and existing keyboard and pointer commands remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused navigation, route, and roving-focus contract | 3 files, 20 tests passed |
| Combined CT-32 through CT-44 semantic regression | 14 files, 87 tests passed |
| Complete unit regression | 25 files, 158 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,925 modules; CSS 70,935 bytes; projects 37,297 bytes; index 279,252 bytes; issues 498,846 bytes |

The initial implementation passed focused tests and all workspace typechecks. Source review then found that a later direct history entry could retain an origin from a completed contextual path. The final pass clears only direct-entry origin state and reran the focused suite before the complete regression, final typecheck, and production build. No failed result was discarded.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-008 | The exact serialized layout, grouping, order, properties, filter, archive, search, and contextual scope state keys the scroll snapshot; a different context cannot inherit it. |
| R-010 | Detail chains retain one recoverable initiating control, direct routes invent none, and bounded delayed focus waits for virtual content to remount. |
| R-011 | List scroll, board horizontal and column scroll, selection, collapsed groups, URL state, and original trigger identity remain owned outside route-detail presentation. |
| R-103 | Scroll recording uses mutable refs rather than React state, avoiding a rerender for each scroll event while retaining the established virtualizers. |
| R-104 | Focus returns to the original row or card instead of an intermediate relation target; rendered keyboard and focus-ring verification remains required. |
| R-110 | No layout or CSS contract changed; the same bounded panel, tablet overlay, and mobile route receive restored context. Rendered overflow and reachability inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must exercise long virtual lists and multi-column boards; list and board route open/close; horizontal and independent column scrolling; filter and grouping context changes; selected and collapsed state; two-step relation navigation; direct history entries; browser back/forward; focus-ring recovery; responsive reachability; and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-44, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
