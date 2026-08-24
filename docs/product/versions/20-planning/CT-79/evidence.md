# CT-79 Review Evidence

## Repository inventory

- `ops/compose/docker-compose.yml`: five defined services, four in the default start path and one operator profile.
- `ops/compose/`: two Dockerfiles, Nginx, PostgreSQL role initialization, volumes, networks, health checks, and secret-bearing configuration.
- `packages/db/migrations/`: 11 migrations and 1,313 lines of PostgreSQL SQL.
- `packages/db/src/`: 6,858 lines of database TypeScript.
- Schema history: 23 table declarations, 36 explicit index declarations, 47 policy declarations, and 20 stored-function declarations.
- `apps/api/tests/*.integration.test.ts`: 4,012 lines of PostgreSQL integration coverage.
- PostgreSQL-specific runtime behavior includes RLS context, JSONB, full-text vectors/queries, advisory locks, stored procedures, roles, and separate migration/application credentials.

Counts describe the reviewed source tree on 2026-08-21. Policy occurrences include replacement history and are a complexity indicator, not a claim that 47 distinct policies are simultaneously active.

## Local feasibility probe

The disposable `/tmp/ct21-sqlite-probe.mjs` ran under the repository's installed Node `v24.18.0`. It used `node:sqlite`, foreign keys, defensive mode, a 2-second busy timeout, strict tables, one transaction, and the online backup API.

Observed local result:

```json
{
  "rows": 10000,
  "manualSearchOrSortIndexes": 0,
  "seedMs": 47.18,
  "searchMs": 4.12,
  "searchRows": 50,
  "backupMs": 3.39,
  "backupPages": 372,
  "restoredCount": 10000,
  "restoredRelations": 1,
  "integrity": "ok"
}
```

Primary-key and unique constraints still create their normal supporting indexes. The probe timing is machine-specific feasibility evidence, not a product performance pass, accepted query plan, final journaling decision, or recovery result.

## Primary references

- Node 24.18 documents file-backed `DatabaseSync`, foreign-key enforcement, defensive mode, busy timeout, prepared statements, and the online backup wrapper: [Node.js `node:sqlite`](https://nodejs.org/download/release/v24.18.0/docs/api/sqlite.html).
- SQLite describes local application storage, application-file use, a server-side app with serialized requests, and single-writer workloads as appropriate uses: [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html).
- SQLite documents snapshot-safe online backup and its locking/error behavior: [SQLite Backup API](https://www.sqlite.org/backup.html).

These sources support technical feasibility. They do not prove OpenLinear implementation quality, setup success, recovery, or outcomes.

## Control Tower readback

- `CT-21`: revision 3, Canceled; superseded by CT-82.
- `CT-76`: revision 2, Done; single-owner contract reconciled.
- `CT-78`: revision 2, Todo; blocked by CT-75 and completed CT-76.
- `CT-79`: `4c50132e-8cbc-477a-939b-7e9946aca7d1`, revision 2, Done.
- `CT-80`: `8fc8bdc7-06e4-4bab-8716-c26d25b445f5`, revision 1, Todo; blocked by CT-75 plus completed CT-76/79.
- `CT-81`: `3f54fea5-3822-451b-8300-0baaa8f9d170`, revision 1, Todo; blocked by CT-78 and CT-80.
- `CT-82`: `0103a501-2a94-41d2-8db6-751827501b27`, revision 1, Todo; blocked by CT-81.
- `CT-12`: revision 56, In Progress; CT-82 replaced CT-21 as its direct runtime gate.
- `CT-13`: revision 57, Todo; the pre-amendment release preflight is stale.
- Store health is `ready` with 53 active, 29 completed, and 0 trashed issues. Provider projection is disabled and `not_synced` for every task.

## Contract validation

- Discovery validator: valid, 0 errors, 1 retained `market-research.switching-cost` warning.
- Planning validator: valid, 0 errors, 3 retained implementation-only O-002 baseline warnings for CT-7/8/9.
- Discovery outcomes deep-equal both Planning outcome arrays.
- Discovery package SHA-256: `61dc2f6dc797ccf25fd9d102c6a8a9791ad3197f3bd25f600292be643394a723`.
- Planning package SHA-256: `d078ff629b943dcb66563a8b02f9ef9f3671948d0fceb9e84219c922b4e8fbdc`.

The helper preserved a private versioned backup before every mutation. The CT-79 completion backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-21T03-51-09-024Z-069efeb9-a2bd-4a11-9038-617689b3e3c7.json` with SHA-256 `c1570cbaeaffa5b99fab7e3470cf50a4686e46215340a93cd47bbbf4529f4cf9`.
