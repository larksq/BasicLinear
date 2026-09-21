# CT-99 Implementation Session

- Issue: `CT-99`, stable ID `fb12f4b7-7cf6-4390-93c4-60cd96a90fa9`, created at revision `1`, implementation started at revision `2`, and expected to complete at revision `3`.
- Session: `CT99-IMPLEMENT-20260822T032448Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, database server, external identity, Google account, or outbound runtime service was used.

## Finding

The accepted UX system caps document-like overview content at `920px`, keeps tables and work views fluid, fixes page titles at `20px` and project titles at `24px`, and rejects blurred backgrounds. The project detail wrapper instead stayed inside the `1280px` work surface for every tab, page titles rendered at `24px` and then `21px` below 900px, project titles and their editor rendered at `25px` and then `21px`, and the dialog backdrop retained `blur(2px)`. No later accepted artifact authorized these deviations.

## Implementation

1. Added shared `--ol-document-content-width`, `--ol-page-title-size`, and `--ol-project-title-size` tokens at the accepted values.
2. Added a tab-specific project-detail class and capped only `project-detail-overview` at the document token, centered within the existing fluid work surface.
3. Left Projects, Issues, project Issues, and project Activity work surfaces at their existing fluid geometry.
4. Bound view headings, project headings, and the project-name editor to the shared title tokens at every viewport.
5. Removed the final application `backdrop-filter` while preserving the existing dialog dimming color and opacity.
6. Added a focused source contract that binds planning text, tokens, tab-specific width behavior, stable responsive title sizes, fluid work surfaces, and the no-blur rule.

## Verification

- Focused visual, navigation, and rich-overview regression: 3 files / 14 tests passed.
- Complete regression: 66 files / 440 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 105 output files, and 1,890,845 output bytes, without warnings.
- Release-audit regression: 6 / 6 tests passed.
- Isolated rebuilt process: `ready` and `live` at `http://127.0.0.1:4279/` from `/tmp/openlinear-ct99-20260822-1127`.
- Served HTML references `index-CLxXYmWN.js` and `index-BWNB4Ft7.css`; served CSS contains the accepted tokens and overview cap, retains the fluid `1280px` work surface, and contains no `backdrop-filter`, `blur(2px)`, old 24px page-heading rule, or old 25px project-heading rule.
- Rendered Chrome captures: 0.

## Acceptance Boundary

Source, test, build, and served-asset evidence establish only the bounded implementation. Chrome extension transport remains unavailable after ten cumulative attempts, and no current page was opened. CT-12 must still measure the computed `920px`, `20px`, and `24px` contracts, prove that non-overview work views remain fluid, inspect dialog paint and pinned Light/Dark contrast, and verify focus, overlap, wrapping, overflow, and responsive behavior. The accepted cyan selection/focus direction is intentionally unchanged until current Chrome color and contrast evidence exists. CT-82 remains responsible for independent clean-revision runtime acceptance; CT-3 remains responsible for public identity and qualified clean-room review; CT-13 remains responsible for accountable release acceptance.
