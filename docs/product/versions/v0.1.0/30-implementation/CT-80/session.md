# CT-80 Implementation Session

- Issue: `CT-80`, stable ID `8fc8bdc7-06e4-4bab-8716-c26d25b445f5`, starting revision `2`, intended completion revision `3`.
- Session: `CT80-IMPL-20260821T051638Z`.
- Actor: `codex-embedded-sqlite`.
- Mode: code-mutating implementation, verification, and source review.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser, Docker, or external identity was used.

## Scope

Replace the supported application repository path with one compact Node 24 `node:sqlite` adapter while retaining the PostgreSQL repository only as a read-only canonical migration source until CT-81. Preserve the one-owner, one-implicit-workspace/team boundary accepted by CT-76 and CT-78.

## Execution

1. Added a version-1 strict SQLite schema with 17 tables, 13 uniqueness or direct-relationship indexes, foreign keys, defensive mode, a bounded busy timeout, `BEGIN IMMEDIATE` writes, and `PRAGMA user_version` migration control.
2. Ported owner bootstrap, transient sessions, statuses, projects/resources, milestones, issues/resources/labels, relations, comments, personal views, activity, revisions, archive/restore, idempotency, filters, search, and deterministic sorting behind the existing repository contracts.
3. Kept progress derived from issue/status records and kept search/filter/sort in TypeScript. Added no FTS, GIN, RLS, outbox, projection, container, database server, or tenant hierarchy.
4. Added canonical export/import with explicit workspace/team/owner selection, stable identity and record metadata, selected-scope activity retention, digest comparison inside the import transaction, and temporary-file promotion without source mutation.
5. Added online backup, integrity and foreign-key verification, durable temporary-file sync, atomic restore, regular-file and same-path guards, schema compatibility checks, and owner-only file modes.
6. Wired the API to `BASICLINEAR_DATABASE_PATH`, added an embedded API workflow test, and added built operator commands for local health, import, export, backup, verify, and restore.

## Review Corrections

The final source review corrected four migration and recovery defects before evidence freeze:

1. Position columns and uniqueness rules were initially stricter than valid canonical PostgreSQL data. They now preserve fractional and tied ordering, case-distinct workflow names, archived-label name reuse, and duplicate saved-view names.
2. Explicit team selection initially omitted activity attached to retained statuses, labels, saved views, users, and memberships. Those retained entity IDs are now part of the selected activity boundary.
3. A historical non-owner assignee retained for canonical fidelity blocked unrelated issue edits. Owner validation now runs only for an explicit reassignment.
4. Backup verification now reports corrupt SQLite input explicitly, rejected restore leaves the target untouched, live-database self-backup is rejected, and every promoted temporary file is synced first.

## Verification

- Focused SQLite/config/API suite: 3 files / 15 tests passed.
- Complete regression: 57 files / 386 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,946 modules; no chunk warning.
- Accepted personal workload: 10,000 issues, 1,000 projects, 2,000 milestones, and 50,000 activity entries passed the 5,000 ms scan/search/sort budget assertion.
- Built operator disk workflow: health, canonical export/import, backup verification, restore, and post-restore health passed with schema 1, integrity `ok`, zero foreign-key violations, one matching canonical digest, and four `0600` SQLite files.
- Compiled API scan: no `pg`, Kysely, `PostgresDialect`, or pool construction. One transitional `DATABASE_URL` fallback remains for CT-81 removal.
- Legacy PostgreSQL transition runner: 7 files / 17 tests discovered and skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Docker was not started and no pass is claimed.
- Release-audit regression: 2 of 2 tests passed. Public release readiness remains outside CT-80.

## Handoff

CT-80 implementation is complete. CT-81 owns removal of the transitional auth, PostgreSQL, Docker, and environment-backed runtime path and must provide the supported one-command loopback process. CT-82 and CT-12 independently own clean-install, PostgreSQL-fixture migration, restart, backup/restore, network-denied, rendered, and UAT acceptance. No Discovery outcome or release claim is made.

## Completion Readback

The project-local helper created a pre-update backup with SHA-256 `e867e76908a9885b108a5cbf6ee8b38341f621421274e6cfa692e47b87e26dcf` and advanced CT-80 from `In Progress@2` to `Done@3`. Stable ID, S3 milestone, healthy local authority, and disabled/`not_synced` provider projection were preserved. CT-81 read back as `Todo@1` with both blockers complete.
