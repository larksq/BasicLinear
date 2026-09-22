# CT-99 Document and Typography Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. BasicLinear now expresses the accepted document-width and title-scale values through shared tokens, applies the document cap only to the project Overview state, and has no CSS backdrop blur.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Document maximum | `--ol-document-content-width` is `920px`; `project-detail-overview` is centered and capped by that token. |
| Fluid work views | The existing `content-projects` surface remains `min(1280px, 100%)`; no width rule exists for project Issues or Activity states. |
| Page title | `--ol-page-title-size` is `20px` and drives section headings without a responsive size override. |
| Project title | `--ol-project-title-size` is `24px` and drives both the displayed heading and project-name editor without a responsive size override. |
| Dialog backdrop | Existing `rgb(15 16 18 / 42%)` dimming remains; `backdrop-filter` is absent from application CSS. |
| Scope boundary | Project/issue behavior, tables, dialog structure, navigation, API, SQLite, schema, canonical transfer, fixtures, authentication, identity, and external services are unchanged. |

## Verification

| Check | Result |
| --- | --- |
| Focused visual/navigation/overview regression | 3 files / 14 tests passed |
| Complete regression | 66 files / 440 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 105 files / 1,890,845 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback readiness | `ready` and `live` on port 4279 using a temporary local data directory |
| Served candidate | HTML references `index-CLxXYmWN.js` and `index-BWNB4Ft7.css` |
| Served CSS contract | Accepted tokens, overview cap, and fluid work-surface rule present; no backdrop filter or old heading rules |
| Source JSON parse | 315 source JSON files parsed |
| Rendered Chrome evidence | 0 captures; required Chrome transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/ui/src/tokens.css` | `19424bb43534757ba75bb845f37cbf3455936d98610b9c4a2832beae4cc78b63` |
| `apps/web/src/projects.tsx` | `2e50cf51c5e48ca1921fea917d84550fddc21ff912e23ec4a3c2d73f584b4c49` |
| `apps/web/src/styles.css` | `7c8214f5130fc2c1c2a0fda255763ed2f4347c79cb7b8b95030129f37f94d619` |
| `apps/web/tests/content-visual-contract.test.ts` | `4fdd90af9b1861c5996ba2418d5af14fe6f6e1714dd3a52250567cdf4057a2a7` |

## Protected Gates

Source inspection and served CSS do not establish computed geometry, typography, paint, contrast, focus, wrapping, overlap, or responsive behavior. CT-12 must execute the current Chrome matrix at `1440x900`, `1024x768`, `390x844`, and `2154x1340`, including live breakpoint checks. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
