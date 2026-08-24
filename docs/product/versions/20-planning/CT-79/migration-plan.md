# CT-79 Migration and Rollback Plan

## Phase 1: freeze the transfer contract

Keep the current PostgreSQL code runnable only long enough to emit the canonical versioned export. Freeze field order, collection order, scope identifiers, stable IDs, timestamps, rich text, relations, activity, archive state, and digests. Add a deterministic last-PostgreSQL fixture.

Exit: two repeated exports of the same fixture are byte-identical and verify successfully.

## Phase 2: implement SQLite behind repository contracts

Create the compact schema and prepared-statement adapter. Port one aggregate at a time: bootstrap/statuses, projects/milestones, issues/labels/relations/comments, views/search, activity, transfer/recovery. Keep the web request and response contracts stable unless a removed collaboration/OIDC field is explicitly revised by CT-76/CT-78/CT-81.

Exit: storage-neutral contract suites pass against SQLite in memory and on disk.

## Phase 3: import without mutating the source

Read canonical JSON, validate schema and scope selection, write a new temporary database, run migrations and import in one controlled sequence, and verify before promotion. The source PostgreSQL database and canonical export remain unchanged.

Exit: PostgreSQL export and SQLite re-export have the same canonical digest, record counts, IDs, ordering, relations, timestamps, and rich-text documents.

## Phase 4: collapse the runtime

Serve the web build and API from one loopback process. Replace persistent login/OIDC with the local same-origin process session. Add the local data directory, one start command, health, shutdown, backup, restore, and migration commands. Retire the supported Docker/PostgreSQL path only after the parity gate.

Exit: `CT-81` implementation checks pass and no supported runtime command references Docker, PostgreSQL, a database URL, a setup token, OIDC, or an external service.

## Phase 5: independent acceptance

`CT-82` uses a clean user account and empty data directory. It runs first start, workflow, accepted-scale search/sort, restart, backup, restore, interrupted upgrade, rollback, source import, and outbound-denied checks independently.

Exit: P-T21's local-runtime row passes with exact evidence. Browser/UAT and outcome gates remain separate.

## Rollback rules

- Never migrate the only copy of a database.
- Create and verify a pre-upgrade backup before changing `user_version`.
- Apply migrations to a temporary or recoverable target and promote only after verification.
- Keep the previous executable with its matching database backup.
- Do not open a newer schema with an older release except through explicit verified restore.
- On any import, migration, integrity, digest, permission, or promotion error, leave the last known-good file selected and return an actionable error.
- Never silently drop unselected workspaces, teams, users, or records from a multi-scope export.
