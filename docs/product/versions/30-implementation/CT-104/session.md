# CT-104 Implementation Session

- Issue: `CT-104`, stable ID `12f9f96d-3b45-4c44-9566-53816f4a43b7`, created at revision `1` and completed at revision `2`.
- Session: `CT104-IMPLEMENT-20260822T071150Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, database server, external identity, Google account, or outbound runtime service was used.

## Finding

The inline native due-date control wrote on every `change`. During segmented keyboard entry, Chrome could serialize an incomplete value as empty and trigger a temporary clear before the user completed the date. React then replaced the control value, interrupting native editing. A focused draft also needed a stable authority baseline so SSE updates and rejected writes could not be overwritten or remain visually stale.

## Implementation

1. Converted the inline due-date control to an uncontrolled native date input with separate authoritative baseline and dirty state.
2. Marked every native input event dirty, including partial segments whose serialized value remains empty while `validity.badInput` is true.
3. Committed a complete valid date or deliberate clear only on blur or Enter; unchanged input performs no write.
4. Made Escape restore authority, stop propagation, blur the field, and leave issue detail open.
5. Restored the newest authority when the focus baseline is stale, preventing a draft from overwriting an SSE update.
6. Synchronized the DOM after every parent render unless the control is both focused and dirty, so confirmed and rejected mutations cannot leave stale display state.
7. Preserved issue creation, pointer date selection, optimistic revisions, owner scope, API, SQLite schema, canonical transfer, and stable internal scope metadata.

## Independent Review

Independent application review first identified stale-authority and rejected-write display races, then identified the empty-date partial-segment case. Each finding received a bounded fix and regression. The final review passed 2 focused files / 24 tests, web typecheck, production build, and diff inspection with no remaining finding. The reviewer made no source or task-store mutation.

## Verification

- Focused regression: 2 files / 24 tests passed.
- Complete regression: 69 files / 460 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,949 modules, 109 files / 1,912,735 bytes, without warnings.
- Release-audit regression: 10 / 10 tests passed.
- Current Chrome artifact: `http://127.0.0.1:4284/`, Chrome 151, synthetic owner-only data.
- Chrome covered complete-date commit, Escape, an SSE authority change during a focused complete draft, a forced rejected write, and an initially empty partial `09/dd/yyyy` draft retained across an SSE rerender.
- Independent CT-82 strict qualification passed all 21 checks against product revision `6d2f330e15cc714b2e131d0fd693bc1d4cdcff78`.

## Acceptance Boundary

CT-104 closes only the due-date defect. The four current-build screenshots bind the exercised issue-detail states, not the full product. CT-12 remains In Progress because the remaining P-T18 workflow, P-T19 accessibility/responsive, and P-T20 golden/performance matrices are incomplete. CT-3 qualified identity/legal review, CT-13 accountable release acceptance, cross-platform coverage, publication, and outcomes remain open.
