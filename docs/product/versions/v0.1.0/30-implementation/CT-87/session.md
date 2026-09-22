# CT-87 Implementation Session

- Issue: `CT-87`, stable ID `dce3e8e1-c1db-4eb3-a5e4-bdff720c8d35`, created at revision `1`, implementation scope revision `3`, intended completion revision `4`.
- Session: `CT87-IMPLEMENT-20260821T083941Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, external identity, or Google account was used.

## Finding

CT-78 fixed creation and primary navigation, but four reachable owner-mode paths still exposed assignment mutation: issue detail, row quick edit, bulk edit, and assignee-grouped board drag. A legacy URL or private saved view could restore the board grouping even after its menu option was removed.

## Implementation

1. Owner mode renders the current local owner as fixed identity metadata in issue detail and quick edit.
2. Quick-edit submissions preserve the issue's stored assignee value in owner mode, including a handler-level guard.
3. Owner mode omits bulk assignment controls and strips any stale bulk assignment draft before request construction.
4. Owner mode omits assignee grouping, canonicalizes legacy URL and saved-view assignee grouping to `none`, and rejects any stale assignee-board move callback.
5. Read-only assignee columns and filters remain available for imported historical records.
6. Contracts, SQLite schema, API semantics, canonical transfer shapes, stable IDs, and stored historical assignee values are unchanged.

## Verification

- Focused owner-boundary regression: 3 files, 20 tests passed.
- Complete regression: 56 files, 389 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,946 modules and 1,028,892 output bytes, without warnings.
- Served runtime: existing loopback process returned `{"status":"ready"}` after the build.
- Release-audit regression: 3 of 3 tests passed.
- `git diff --check`: clean. Source revision remains unavailable because the repository has no commit.

## Acceptance Boundary

Chrome control still reports the browser unavailable because the selected Chrome profile does not have the required browser-control extension enabled. No screenshot, responsive measurement, accessibility-tree inspection, or rendered UAT claim was produced. CT-12 remains responsible for those checks, CT-82 remains responsible for independent clean-runtime acceptance, and CT-3 remains responsible for public identity, license, and clean-room decisions.
