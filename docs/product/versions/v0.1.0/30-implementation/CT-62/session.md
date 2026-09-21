# CT-62 Implementation Session

- Issue: `CT-62`, stable ID `6388f0c5-8c5a-4f7b-9b0c-6414b9e33e81`, starting revision `2`, intended checkpoint revision `3`.
- Implementation session: `codex-milestone-drag-reorder` / `CT62-IMPL-20260820T181134Z`.
- Scope: add deterministic pointer drag reordering to active project milestones while retaining the accepted keyboard Move Up and Move Down controls and the existing revision-checked reorder API.
- State boundary: the pure reorder helper operates on stable unique IDs, does not mutate its input, and rejects missing, duplicate, self, adjacent no-op, and invalid-edge drops.
- Pointer boundary: mouse uses the primary button; mouse, touch, and pen require a six-pixel movement threshold before pickup; one captured pointer owns the gesture; row geometry selects before or after; pointer cancel, capture loss, missing targets, and unchanged orders cancel without mutation.
- Mutation boundary: a valid drop submits the complete ordered milestone set with each current `expectedRevision`. The existing query invalidation, conflict handling, live announcements, and focus restoration remain shared with keyboard reordering.
- Accessibility boundary: the pointer handle is excluded from the accessibility tree because the named Move Up and Move Down buttons remain the complete keyboard alternative. Pickup, target, cancellation, committed position, and failure use the existing polite atomic status.
- Fixture boundary: `fixture=milestone-drag` exposes three active milestones and a stateful reorder route. The host matrix proved initial order, normalized positions, persisted readback, revision increments, and stale-request rejection.
- Automated result: two focused files and 28 tests pass; all 40 files and 265 tests pass; all eight workspaces typecheck; fixture syntax passes; and the 1,934-module production build passes without a chunk warning.
- Runtime result: the sandboxed fixture launch was denied with `EPERM`; the managed fixture started on port 4187 as session 6084. All eight host checks passed.
- Database boundary: CT-62 changes only web interaction state, tests, styling, and synthetic fixture behavior. No production API, repository, schema, authorization, RLS, migration, or recovery path changed, and no database execution is claimed.
- Browser boundary: no screenshot or rendered assertion is claimed because the approved browser surface remains denied by the active security policy. No alternate browser surface was used.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. Provider projection is disabled and no Linear API, MCP, or UI was used for tracking.
- Status boundary: CT-62 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-003 remain pending.
