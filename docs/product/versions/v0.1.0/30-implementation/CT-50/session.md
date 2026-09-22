# CT-50 Implementation Session

- Issue: `CT-50`, stable ID `c11ef27e-6b2c-4804-acff-a18de085d20e`, implementation revision `3`.
- Implementation session: `codex-issue-row-actions` / `CT50-IMPL-20260820T112036Z`.
- Scope: add one shared contextual action surface for virtualized issue-list rows and board cards, including a revision-safe quick property editor.
- Interaction boundary: each record keeps one roving tab stop. The trailing overflow trigger is available to pointer users but remains outside sequential tab order; right-click, `ContextMenu`, and `Shift+F10` open the same menu.
- Menu boundary: `Open issue` is available for every readable issue. `Edit properties` and `Archive` or `Restore` require `issue:write`; archived issues omit editing. Arrow keys, Home, End, Escape, and Tab follow named menu semantics and restore focus by stable issue ID.
- Mutation boundary: quick editing submits only changed status, priority, or assignee values with the visible issue revision. Archive and restore also carry the visible revision. No-op editing does not call the API.
- Workspace boundary: mutation variables retain the originating workspace ID. Workspace or role changes close stale action state, suppress stale completion announcements, invalidate the correct cache, and prevent focus recovery into the replacement workspace.
- Geometry boundary: the list reserves a 28-pixel action track, board-card actions have fixed header geometry, and the fixed menu measures its actual capability-dependent height before clamping to the viewport.
- Accessibility boundary: menu and menu-item roles, native labeled select controls, live mutation announcements, visible focus, and screen-reader-only table-header semantics are covered by source contracts.
- Automated result: six focused files and 40 tests pass, all 32 files and 196 complete tests pass, all eight workspaces typecheck, and the 1,927-module production build passes without a chunk warning.
- Database boundary: the PostgreSQL integration runner collected seven files and 17 tests but skipped all because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. This skip is recorded and is not a pass.
- Fixture boundary: the deterministic fixture serves owner and `?fixture=guest-readonly` contracts at `http://127.0.0.1:4181/`; four host HTTP/API checks pass.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-50 remains In Progress. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
