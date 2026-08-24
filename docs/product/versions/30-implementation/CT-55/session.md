# CT-55 Implementation Session

- Issue: `CT-55`, stable ID `e0848371-57f5-4406-a674-2d296c00dd74`, implementation revision `1`.
- Implementation session: `codex-my-work-navigation` / `CT55-IMPL-20260820T142533Z`.
- Scope: add the accepted `My work` primary destination as a locked current-user issue scope and make workspace-view URLs authoritative without changing schema, service routes, authorization, or persistence.
- Query boundary: `My work` composes the authenticated user ID into the existing server-side issue-filter AST. Conflicting assignee clauses are removed from URL/user state before the locked condition is added, so local rendering never broadens or replaces authoritative query results.
- Navigation boundary: one allowlisted parser owns direct workspace-view restoration. Switching between Issues and My work clears detail, layout, search, saved-view, and filter parameters; same-surface navigation preserves them. App-level `popstate` handling restores every primary or settings destination.
- State boundary: Issues and My work use keyed issue surfaces, route-aware issue-detail URLs, isolated transient state, and the same list/board/search/group/order/archive controls. Saved-view mutation controls remain on the general Issues surface rather than silently capturing a hidden system constraint.
- Creation boundary: New issue inside My work defaults its assignee to the signed-in user so a successful create remains in the active result set. Global creation retains the existing general Issues behavior.
- Accessibility boundary: My work exposes one named navigation item with `aria-current`, one page heading, one applied Assignee context, and one command-palette option. Fixed command indices and dynamic-result offsets remain aligned.
- Automated result: four focused files and 33 tests pass, all 36 files and 220 complete tests pass, all eight workspaces typecheck, and the 1,931-module production build passes without a chunk warning.
- Database boundary: CT-55 changes only web source and tests. The existing query endpoint, repository filter compiler, RLS, and CT-54 PostgreSQL 16.10 matrix are unchanged; no new database pass is claimed for this web-only slice.
- Fixture boundary: owner and guest My work shells, owner and guest sessions, and the current-user assignee query at `http://127.0.0.1:4181/` return HTTP 200 after the exact production build.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-55 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
