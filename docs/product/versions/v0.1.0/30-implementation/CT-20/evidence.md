# CT-20 Mobile Navigation Accessibility Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. At the 390x844 breakpoint, the visually closed navigation rail is now hidden from sequential focus and the accessibility snapshot. The explicit menu control still opens the rail, every rail control is named and in view, and Escape plus keyboard or pointer scrim closure returns focus to the menu trigger.

## Root Cause And Correction

The mobile CSS translated the sidebar off canvas but did not change its visibility or interactivity. Ten controls remained `tabindex=0` between x=-240 and x=-9.

The correction adds mobile-only `visibility` and `pointer-events` state to the rail, leaving desktop rules unchanged. The menu trigger now owns a focus ref. Escape, scrim closure, workspace selection, and navigation from an open rail close the rail without leaving focus on hidden content.

## Verification

| Check | Result |
|---|---|
| Type check | All 8 workspaces passed |
| Complete unit | 6 files, 23 tests passed |
| Production build | All packages and Vite build passed; 1,911 modules transformed |
| Closed 390x844 rail | `visibility:hidden`, 0 off-viewport visible controls, 0 unnamed controls, 0 document overflow |
| Closed accessibility snapshot | Workspace navigation absent |
| Open 390x844 rail | `visibility:visible`, all 10 controls named, all 10 inside viewport, navigation landmark present |
| Escape | Rail hidden; focus returned to `Open navigation` |
| Keyboard scrim close | Rail hidden; focus returned to `Open navigation` |
| Pointer outside close | Rail hidden; focus returned to `Open navigation` |
| Desktop 1440x1000 | Rail visible and interactive at x=0..248; 0 document overflow |
| Browser diagnostics | Verification added 0 warning/error entries |

Screenshots:

- `evidence/mobile-navigation-closed-390x844.jpg`, SHA-256 `a32f2c96bb4fd0d272ba4bc38a35fcb89397204c82a7a358718954801863584a`.
- `evidence/mobile-navigation-open-390x844.jpg`, SHA-256 `c347f896a4462fc2ff84a2cc33edff190c578ede80d042bb1708a2d16e7d3927`.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Mobile navigation is keyboard reachable, Escape recoverable, and never leaves focus on hidden controls. |
| R-104 | Closed/open accessibility snapshots match the visible mobile state and every exposed control is named. |
| R-110 | No visible control lies outside the 390px viewport; the desktop rail and mobile content remain reachable without document overflow. |

## Verification Boundary

This remediation corrects mobile navigation exposure and focus recovery only. It does not claim CT-12 acceptance or any product outcome. CT-12 retains the independent integrated, visual, performance, and recovery decision.
