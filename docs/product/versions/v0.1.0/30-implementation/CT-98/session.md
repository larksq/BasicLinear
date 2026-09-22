# CT-98 Implementation Session

- Issue: `CT-98`, stable ID `c9816cda-d98d-447b-8a36-d6ea37997c94`, created at revision `1`, implementation started at revision `2`, and expected to complete at revision `3`.
- Session: `CT98-IMPLEMENT-20260822T030630Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, database server, external identity, Google account, or outbound runtime service was used.

## Finding

The accepted UX spatial system fixes the top view header at exactly `44px` and rejects blurred backgrounds. The application instead hard-coded `49px` into the topbar, recovery-banner offset, and tablet detail overlay. Desktop detail and resizer offsets retained arithmetic derived from that same old height, while the topbar used a translucent background with `backdrop-filter: blur(12px)`. No later accepted implementation artifact authorized either deviation.

## Implementation

1. Added one shared `--ol-topbar-height: 44px` UI token.
2. Bound the topbar height and recovery-banner sticky offset directly to that token.
3. Expressed desktop contextual detail and resizer offsets and available height as calculations from the same token.
4. Bound the tablet overlay inset to the token without changing its width, presentation mode, or navigation behavior.
5. Replaced only the translucent blurred topbar paint with the existing opaque semantic page background.
6. Added a focused contract that binds the accepted UX text, shared token, topbar paint, absence of raw `49px` shell geometry, and every dependent offset.
7. Updated the existing local-service recovery contract to require the shared header token.

## Verification

- Focused shell and recovery regression: 2 files / 9 tests passed.
- Complete regression: 65 files / 436 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 109 output files, and 1,909,362 output bytes, without warnings.
- Isolated rebuilt process: `ready` at `http://127.0.0.1:4278/` from `/tmp/basiclinear-ct98-20260822-1109`.
- Served HTML references `index-Dv9YgZKT.js` and `index-DxwJSw8s.css`; the served CSS contains the 44px token and contains neither raw `49px` nor `blur(12px)`.
- Rendered Chrome captures: 0.

## Acceptance Boundary

Source, test, build, and served-asset evidence establish only the bounded implementation. Chrome extension transport remains unavailable after ten cumulative attempts, and no current page was opened. CT-12 must still measure the computed header at exactly `44px` at every accepted viewport and breakpoint, verify banner and detail containment, opaque Light/Dark paint, focus visibility, zero overlap, and zero unintended document overflow. CT-82 remains responsible for independent clean-revision runtime acceptance; CT-3 remains responsible for public identity and qualified clean-room review; CT-13 remains responsible for accountable release acceptance.
