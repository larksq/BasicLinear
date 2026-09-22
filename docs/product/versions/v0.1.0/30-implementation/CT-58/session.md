# CT-58 Implementation Session

- Issue: `CT-58`, stable ID `b2289de0-eed2-401e-855f-0fbbd57e6ee9`, starting revision `2`.
- Implementation session: `codex-team-workspaces` / `CT58-IMPL-20260820T155803Z`.
- Scope: add first-class, URL-authoritative team workspaces for Projects and Issues without changing the production API, repository, schema, authorization, or RLS contracts.
- Route boundary: `teamIdFromSearch` accepts only team IDs returned by the selected workspace. `teamNavigationUrl` clears prior surface state, preserves unrelated fixture/OIDC markers, and establishes one team plus Projects/Issues destination.
- History boundary: team changes and the team surface switcher push clean entries; app-level `popstate` notices same-view team changes and remounts the stateful surface. Global Projects and Issues are explicit scope escapes.
- Invalid-route boundary: inaccessible, removed, or view-incompatible team parameters are replaced with a clean global surface after the workspace team query succeeds. A resolving route shows final-geometry loading content instead of briefly querying the global collection.
- Issue boundary: the fixed team condition is composed outside user filters, conflicting URL/saved-view team filters are removed, team projects/milestones/statuses are scoped, contextual creation locks the team, and a direct issue from another team is removed before detail content renders.
- Project boundary: project list queries carry the fixed team, contextual creation has one disabled team choice, and a direct project from another team is canonicalized to the scoped list before its detail body renders.
- Fixture boundary: `fixture=team-route` exposes Product Quality and Engineering Systems with separate statuses, projects, and issues. The issue query fixture reads the nested filter AST and returns only the requested team.
- Automated result: four focused files and 37 tests pass; all 38 files and 239 tests pass; all eight workspaces typecheck; fixture syntax passes; and the 1,932-module production build passes without a chunk warning.
- Runtime result: the first sandboxed server launch was denied (`EPERM`), the approved managed launch succeeded at port 4183, sandbox-local HTTP could not cross the namespace, and the host-network retry passed all six checks. The checks returned HTML 200, two teams, one project per team, two QA issues, and one ENG issue.
- Database boundary: CT-58 is a web-navigation and synthetic-fixture slice. No production database path changed and no new database execution is claimed.
- Browser boundary: no screenshot or rendered assertion is claimed because the approved browser surface remains denied by the active security policy. No alternate browser surface was used.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, MCP, or UI was used for tracking.
- Status boundary: CT-58 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-004 remain pending.
