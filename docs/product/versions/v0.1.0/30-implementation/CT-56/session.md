# CT-56 Implementation Session

- Issue: `CT-56`, stable ID `e57793e7-5a84-4b7b-97e2-95e377992526`, implementation revision `1`.
- Implementation session: `codex-project-navigation` / `CT56-IMPL-20260820T145559Z`.
- Scope: make the accepted project list, detail, tab, and milestone issue-drill-down context URL-authoritative without changing schema, service routes, authorization, or persistence.
- Route boundary: one allowlisted parser and serializer owns project query, status, priority, archive mode, ordering, direction, density, selected project, active tab, and milestone issue scope. Malformed enumerations and IDs fall back to bounded list state rather than creating an untrusted detail scope.
- History boundary: project-row and created-project opens push one marked detail entry; tab, milestone, filter, ordering, and density changes replace that entry; Back returns through the originating canonical list; a direct detail URL uses an explicit Projects control that replaces the current entry with the list rather than navigating outside the app.
- Shell boundary: project command results open the requested project through the shared project route, and explicit Projects rail or command navigation resets stale project-local state even when the Projects surface is already mounted.
- Focus boundary: Back and explicit close attempt to restore the originating project row by stable ID and fall back to the project search field when the row is unavailable. Workspace changes clear detail, selection, menus, transient milestone state, and focus origins.
- Milestone boundary: the selected Issues tab and milestone ID are serialized together. Milestone scope is accepted only for a valid project route on the Issues tab and is cleared when the user selects a plain project tab.
- Automated result: three focused files and 22 tests pass, all 37 files and 228 complete tests pass, all eight workspaces typecheck, fixture syntax passes, and the 1,932-module production build passes without a chunk warning.
- Database boundary: CT-56 changes only web source and tests. Existing project, milestone, issue-query, RLS, recovery, and authorization paths are unchanged; no new database pass is claimed for this web-only slice.
- Fixture boundary: the canonical project list, overview, milestone-scoped Issues tab, Activity tab, project API, and milestone API at `http://127.0.0.1:4181/` return HTTP 200 after the exact production build.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-56 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
