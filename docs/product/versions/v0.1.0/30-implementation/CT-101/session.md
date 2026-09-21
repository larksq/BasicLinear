# CT-101 Implementation Session

- Issue: `CT-101`, stable ID `ecacb4c2-958e-4d32-a6cd-6291938dbf77`, created at revision `1`, implementation started at revision `2`, scope wording corrected at revision `3`, and expected to complete at revision `4`.
- Session: `CT101-IMPLEMENT-20260822T040137Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, database server, external identity, Google account, or outbound runtime service was used.

## Finding

The shipped CSS consumed `var(--ol-text-subtle)` for connection correlation IDs, query-error correlation IDs, and the workflow-status drag handle, but the shared token source defined no such property. Each declaration was therefore invalid at computed-value time and inherited context-dependent paint. The milestone drag handle was inspected during scoping and correctly uses `var(--ol-text-muted)`; revision `3` corrected the issue title and evidence boundary before completion.

## Implementation

1. Added Light `--ol-text-subtle: #6d6e74`.
2. Added explicit and System-Dark `--ol-text-subtle: #8b8b94`.
3. Preserved every existing consumer and all primary, accent, focus, status, surface, project, label, and user-configured colors.
4. Added deterministic sRGB relative-luminance and contrast calculations against every accepted theme background and surface.
5. Proved subtle text stays lower-emphasis than muted text without dropping below `4.5:1`.
6. Added a complete source contract that rejects any `var(--ol-*)` consumer without a shared token definition.
7. Kept current Chrome inspection, computed paint, hover/focus behavior, and non-color affordance acceptance in CT-12.

## Verification

- Focused semantic-token, appearance, recovery, and workflow regression: 5 files / 35 tests passed.
- Complete regression: 68 files / 448 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 105 output files, and 1,890,920 output bytes, without warnings.
- Release-audit regression: 6 / 6 tests passed.
- Isolated rebuilt process: `ready` and `live` at `http://127.0.0.1:4281/` from `/tmp/openlinear-ct101-20260822-1206`.
- Served HTML references `index-DvgrHPGW.js` and `index-BVLPlYtU.css`; the CSS hash matches the local build, contains one Light and two Dark/System-Dark subtle values, three definitions and three consumers, no undefined `--ol-*` consumer, and the expected connection, query-error, and workflow-status rules.
- Rendered Chrome captures: 0.

## Acceptance Boundary

The source calculations and served CSS prove token definition, wiring, and token-to-surface contrast only. Chrome extension transport remains unavailable after ten cumulative attempts, and no current page was opened. CT-12 must still inspect long recovery identifiers and the workflow-status drag handle in pinned Light, pinned Dark, and live System mode; verify computed color and contrast, hover/focus paint, pointer and keyboard affordance, visible focus, non-color meaning, wrapping, overlap, and responsive behavior. CT-82 remains responsible for independent clean-revision runtime acceptance; CT-3 remains responsible for public identity and qualified clean-room review; CT-13 remains responsible for accountable release acceptance.
