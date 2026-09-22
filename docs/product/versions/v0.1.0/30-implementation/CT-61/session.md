# CT-61 Implementation Session

- Issue: `CT-61`, stable ID `0f03763c-eddd-450d-ba31-3363b8c626a0`, starting revision `2`; scope amendments were recorded at revisions `3` and `4` before their test-file mutations.
- Implementation session: `codex-issue-view-configuration` / `CT61-IMPL-20260820T173919Z`.
- Scope: make issue list and board configuration canonical across URL, history, saved state, loading geometry, and virtualized table semantics without changing issue queries, persistence, authorization, or API behavior.
- Property boundary: `priority`, `assignee`, `project`, `milestone`, `labels`, and `dueDate` use one canonical order. The explicit `none` sentinel preserves an intentionally empty property set, while malformed or duplicate payloads fail closed to the accepted default.
- Collapse boundary: URL collapse keys are qualified by the active grouping, bounded to 32, duplicate-free, and validated against stable UUID or accepted empty-state keys. Cross-group or malformed state restores no collapsed groups.
- Grouping boundary: an ungrouped list mounts issue rows directly and omits the synthetic `All issues` header. Grouped virtual lists expose one table `rowgroup`, semantic group `row` and `rowheader` records, expanded state, and aligned column span.
- Geometry boundary: header, issue rows, and loading skeletons use the same canonical grid helper for every visible-property set.
- Fixture boundary: `fixture=issue-view` exposes three issues across two teams and three statuses. Existing team-route and project-view record counts remain unchanged.
- Automated result: five focused files and 38 tests pass; all 40 files and 259 tests pass; all eight workspaces typecheck; fixture syntax passes; and the 1,934-module production build passes without a chunk warning.
- Runtime result: the sandboxed fixture launch was denied with `EPERM`; the managed fixture started on port 4186 as session 68382. The bounded host-network matrix passed all six checks: HTML, session, two-team catalogue, three-issue catalogue, two Product Quality issues, and one Engineering Systems issue.
- Database boundary: CT-61 changes only web presentation state, route serialization, tests, and synthetic fixture data. No production schema, repository, service route, authorization, RLS, migration, or recovery path changed, and no new database execution is claimed.
- Browser boundary: no screenshot or rendered assertion is claimed because the approved browser surface remains denied by the active security policy. No alternate browser surface was used.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. Provider projection is disabled, and no Linear API, MCP, or UI was used for tracking.
- Status boundary: CT-61 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-003 remain pending.
