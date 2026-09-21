# CT-49 Implementation Session

- Issue: `CT-49`, stable ID `4ff15472-ea6e-4ef8-acc8-9eda80e9c0b2`, implementation revision `5`.
- Implementation session: `codex-workspace-capabilities` / `CT49-IMPL-20260820T104422Z`.
- Scope: mirror the server's workspace-role capability matrix in project, milestone, issue, saved-view, bulk, and workspace-administration mutation controls without weakening API authorization.
- Capability boundary: the domain package exports one non-throwing `hasCapability` predicate beside `assertCapability`. Owner, admin, member, and guest affordances now derive from that same role-to-capability table instead of repeating role-name comparisons in the web client.
- Workspace boundary: team, membership, and status management require their respective manager capabilities. Issue creation requires `issue:write`, including the global `C` shortcut and command palette.
- Project boundary: project and milestone create, edit, archive, reorder, selection, context-menu, and bulk controls require `project:write`. A workspace-role change closes stale project mutation state before another command can be submitted.
- Issue boundary: title, rich description, properties, comments, relations, resources, labels, saved views, archive, and bulk actions require `issue:write`; purge requires `issue:purge`. Guest issue content remains readable and selectable.
- Signal boundary: an authorized global issue-create signal is consumed once. A signal received by a read-only workspace is discarded rather than replayed after a later workspace or role change.
- Review loop: command-palette keyboard navigation skips the disabled guest create command; stale dialogs and drafts close when capabilities are revoked; guest issue titles use read-only rather than disabled semantics; and static rich text remains available to assistive technology.
- Automated result: six focused files and 33 tests pass, all 31 files and 187 complete tests pass, all eight workspaces typecheck, and the 1,926-module production build passes without a chunk warning.
- Database boundary: the PostgreSQL integration runner collected seven files and 17 tests but skipped all because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. CT-49 changes no schema or server authorization path, so this skip is recorded without treating database execution as a CT-49 pass.
- Fixture boundary: the refreshed deterministic fixture serves owner and `?fixture=guest-readonly` session contracts at `http://127.0.0.1:4181/`; four host HTTP/API checks pass.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-49 remains In Progress. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
