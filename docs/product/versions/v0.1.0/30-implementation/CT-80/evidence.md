# CT-80 Embedded SQLite Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. The application and built operator now have a compact embedded SQLite persistence path with canonical one-scope transfer and recovery tooling. Source, unit, type, build, synthetic workload, and local disk checks pass. Independent clean-runtime and last-PostgreSQL-fixture acceptance remain pending under CT-81, CT-82, and CT-12.

## Implemented Contract

- One Node 24 process can own one `DatabaseSync` connection and one application file.
- Schema version 1 contains only the owner profile, implicit scope metadata, transfer metadata, workflow statuses, projects/resources, milestones, issue sequence, labels, issues/resources/labels, relations, comments, saved views, activity, and bounded idempotency.
- Foreign keys are enabled, extensions and double-quoted string literals are disabled, defensive mode is enabled after migration, the busy timeout is 2 seconds, and writes use short `BEGIN IMMEDIATE` transactions.
- Disk databases use WAL and `synchronous=FULL`; database, import, backup, and restored files are mode `0600`.
- Progress is derived. Search, filter evaluation, ranking, and sorting scan the accepted personal dataset in TypeScript. There is no FTS, GIN, persisted progress, outbox, RLS, or generalized tenancy.
- Runtime collaboration writes fail closed. Saved views created or updated through the runtime are private. Historical identity and sharing metadata may survive only in canonical transfer metadata.

## Migration And Recovery

- Canonical workspace exports retain source migration/build identity, stable IDs, timestamps, order values, relations, archive state, rich text, and activity.
- Multi-workspace backups require `--workspace`; multi-team workspaces require `--team`; ambiguous owners require `--owner`.
- Explicit team selection retains workspace records and activity for every retained identity, status, label, saved view, project, milestone, issue, relation, and comment.
- Import validation and canonical readback digest comparison occur before transaction commit. File imports use a new temporary database and promote only after integrity, foreign-key, and schema checks.
- The source export or PostgreSQL database is never modified. Rejected, corrupt, tampered, future-schema, ambiguous-scope, and unsafe-path inputs fail without target promotion.
- Online backup and restore verify `integrity_check`, `foreign_key_check`, schema version, file type, and permissions. A backup cannot overwrite its live source database.

## Verification Matrix

| Check | Result |
|---|---|
| Focused SQLite/config/API suite | 3 files, 15 tests passed |
| SQLite repository and transfer suite | 9 tests passed |
| Complete unit regression | 57 files, 386 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,946 modules; no chunk warning |
| Accepted personal workload | 10k issues, 1k projects, 2k milestones, 50k activity; under 5,000 ms assertion |
| Built operator disk flow | Health/export/import/backup/verify/restore/health passed |
| Canonical disk round trip | 17 records; digest preserved |
| SQLite file health | Schema 1; integrity `ok`; 0 foreign-key violations |
| SQLite file permissions | Source/import/backup/restore all `0600` |
| Compiled API legacy adapter scan | 0 `pg`, Kysely, dialect, or pool matches |
| Legacy transition runner | 7 files / 17 tests skipped unconfigured; not counted as passed |
| Docker or external service | Not started or used |
| Release-audit regression | 2 tests passed |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 / R-003 / R-004 / R-005 / R-006 / R-007 / R-008 | Repository behavior, revisions, archive/restore, relations, comments, private views, derived progress, and API workflow tests. |
| R-009 | Deterministic bounded TypeScript search, filter, rank, and sort at the accepted workload ceiling. |
| R-012 / R-013 / R-014 | Canonical export/import, explicit one-scope selection, online backup, verification, atomic promotion, restore, restart, and file permissions. |
| R-102 / R-106 / R-107 / R-109 | No source mutation, fail-closed ambiguity/corruption/schema/path handling, transaction rollback, and owner-scope enforcement. |
| P-T04 through P-T11 / P-T14 / P-T15 / P-T17 / P-T21 | Implementation evidence only; CT-82 and CT-12 remain independent acceptance owners. |

## Review Boundary

This was a source review by the implementation actor, not independent acceptance. It found and corrected migration-parity, selected-activity, historical-assignee, and recovery-safety defects. No blocking source finding remains. The unconfigured PostgreSQL transition runner does not compare a live last-PostgreSQL fixture, and no clean-host, outbound-denied, multi-platform, rendered browser, accessibility, or UAT claim is made.

## Authority And Privacy

All task state is in `.control-tower/tasks-v0.8.sqlite3`; provider projection is disabled and `not_synced`. Evidence uses deterministic synthetic data and redacted temporary paths. No Linear API/MCP/UI, browser authorization, Google account, external credential, private workspace, Docker process, database server, or outbound runtime request was used.

## Control Tower Completion

The authoritative local store read back CT-80 as `Done@3`, stable ID `8fc8bdc7-06e4-4bab-8716-c26d25b445f5`, with store health `ready` and provider projection disabled/`not_synced`. The optimistic update backup SHA-256 is `e867e76908a9885b108a5cbf6ee8b38341f621421274e6cfa692e47b87e26dcf`. CT-81 remains `Todo@1` until its separate implementation session begins.
