# CT-107 Implementation Session

- Issue: `CT-107`, stable ID `082d82a7-a757-42ef-9b10-517b7abc8e57`, created at revision `1` and completed at revision `2`.
- Session: `CT107-IMPLEMENT-20260822T092423Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, external account, or outbound runtime service was used.

## Finding

Every closed project action trigger published `aria-controls=project-menu-<id>` while its conditionally rendered menu was absent. Current Chrome therefore reported a dangling ARIA ID reference even though `aria-expanded` correctly represented the closed state.

## Implementation

1. Published `aria-controls` only when `openProjectMenuId` matches the row.
2. Kept the controlled ID identical to the mounted menu ID.
3. Changed no menu render, action, focus, context-menu, roving-row, pointer, or keyboard behavior.
4. Bound the conditional relationship in the project-row interaction regression.

## Independent Review

An independent reviewer found no issue. The reviewer confirmed closed/open synchronization with `aria-expanded`, exact ID matching, first-item focus, Escape row-focus recovery, Tab behavior, enabled-item navigation, blur dismissal, and unchanged menu actions. Focused regression passed 1 file / 4 tests, web typecheck passed, and the scoped diff passed `git diff --check`. The reviewer made no file or task-store mutation.

## Verification

- Focused regression: 1 file / 4 tests passed.
- Complete regression: 70 files / 461 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,949 modules, 105 files / 1,894,235 bytes, without warnings.
- Release-audit regression: 10 / 10 tests passed.
- Current Chrome: Light, 1440x900. Closed state had no `aria-controls`, `aria-expanded=false`, and no menu. Keyboard open created one exact matching menu, set expanded true, and focused `Open project`. Escape removed menu and reference and restored a visible 2px row focus indicator.

## Acceptance Boundary

CT-107 closes only the project-menu reference defect. Product revision `cf99bb834f544633ad820328817dcc2320d09744` requires fresh independent P-T21 qualification. CT-12 retains complete P-T18, P-T19, and P-T20 acceptance; identity/legal, accountable release, publication, cross-platform, and outcome gates remain open.
