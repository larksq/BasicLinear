# CT-98 Application-Shell Geometry Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. The application shell now has one accepted `44px` header token, and every banner or issue-detail offset previously coupled to the hard-coded `49px` value derives from that token. The topbar now paints an opaque semantic background without blur.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Accepted height | `packages/ui/src/tokens.css` defines `--ol-topbar-height: 44px`, matching the accepted UX spatial system. |
| Topbar | Height uses the shared token; paint uses `var(--ol-bg)` with no transparency or backdrop filter. |
| Recovery banner | Sticky top uses the shared header token, preserving its existing responsive content geometry. |
| Desktop context panel | Sticky top is `header + 13px`; panel and resizer height are `viewport - header - 25px`; existing negative margin and 480/560/640px width contract remain unchanged. |
| Tablet overlay | Fixed inset begins at the shared header height; the near-full overlay width and panel behavior are unchanged. |
| Scope boundary | Navigation, content layout, panel widths, dialog backdrop, API, SQLite, schema, canonical transfer, fixtures, authentication, and external services are unchanged. |

## Verification

| Check | Result |
| --- | --- |
| Focused shell/recovery regression | 2 files / 9 tests passed |
| Complete regression | 65 files / 436 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 109 files / 1,909,362 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback readiness | `ready` on port 4278 using a temporary local data directory |
| Served candidate | HTML references `index-Dv9YgZKT.js` and `index-DxwJSw8s.css`; served CSS contains `--ol-topbar-height:44px` |
| Stale geometry scan | Served CSS contains no raw `49px` and no `blur(12px)` |
| Rendered Chrome evidence | 0 captures; required Chrome transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/ui/src/tokens.css` | `f0c76ca99addc1697b51f6d12630af43a6e728c667edc2040968a0619c9acad8` |
| `apps/web/src/styles.css` | `3cde2e3a0e14656f6e72cf5ccb900a5dda95ca923649dd72873971217edf1524` |
| `apps/web/tests/shell-geometry.test.ts` | `3a669a8b7c59b56da852eaa0558958661865e1d74e417e5c753ed77faf7f6f47` |
| `apps/web/tests/local-service-recovery.test.ts` | `60f7cd2d1d3b00686b0d61002bdb5170081cf33fb398461374194fdce0776262` |

## Protected Gates

Source inspection and served CSS do not establish computed geometry, paint, contrast, focus, overlap, or responsive behavior. CT-12 must execute the current Chrome matrix at `1440x900`, `1024x768`, `390x844`, and `2154x1340`, including live `767/768` and `1199/1200` boundary checks. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
