# CT-79 Local Runtime Architecture Decision

Status: accepted planning decision. Implementation and independent acceptance remain open under `CT-80`, `CT-81`, and `CT-82`.

## Decision

Replace the supported Docker Compose and PostgreSQL topology with one Node 24 process bound to loopback and one embedded SQLite application file. The process serves the built web application and its API. The first release has one owner, one implicit workspace, one implicit team, one active writer, and no remote-access mode.

Use Node's built-in `node:sqlite` behind a project-owned storage adapter. Pin the supported Node 24 patch line until that adapter passes the complete contract suite. Do not add a native database dependency, ORM abstraction for multiple engines, embedded PostgreSQL/Wasm engine, search service, FTS index, or dual-write path.

## Why the previous plan is disproportionate

The current repository defines five Compose services: four default startup services (`db`, `migrate`, `api`, and `web`) plus an operator profile. It also carries two Dockerfiles, Nginx, PostgreSQL role initialization, required database and setup secrets, and a named-volume recovery path.

Persistence currently spans:

- 23 PostgreSQL tables;
- 36 explicit indexes;
- 47 `CREATE POLICY` occurrences across the migration history;
- 20 stored functions;
- 1,313 lines of SQL migrations;
- 6,858 lines of database TypeScript; and
- 4,012 lines of PostgreSQL integration tests.

Much of that work exists for concurrent tenants, remote deployment, database-enforced roles, durable outbox delivery, indexed full-text search, and operator-managed database upgrades. Those are valid capabilities for a hosted team system, but they are not required by the accepted personal v0.1 boundary.

## Supported boundary

The accepted v0.1 workload is one local owner with at most 10,000 issues, 1,000 projects, 2,000 milestones, and 50,000 combined comments, relations, and activity entries. These are acceptance-fixture ceilings, not enforced product quotas. A larger dataset is allowed to open, but performance above the ceiling is unsupported until measurement justifies a new limit or index.

The supported process:

- binds only `127.0.0.1` and `::1`;
- rejects remote bind configuration;
- uses a platform-standard user data directory or an explicit test/operator override;
- owns one open SQLite connection and serializes writes;
- serves static assets and `/api` from the same origin;
- performs no outbound runtime request; and
- needs no account password, OIDC provider, database server, setup token, proxy, or container runtime.

Remote access, shared network drives, simultaneous database access from another process, multi-user collaboration, and multiple hosted instances require new Discovery and architecture review.

## Data model

Use a compact schema for application metadata, the owner profile, workflow statuses, projects and resources, milestones, issues and resources, labels and links, relations, comments, personal saved views, activity entries, and bounded idempotency records. Workspace and team identifiers remain internal constants in metadata and canonical transfer records; membership and role tables are not part of the supported local runtime.

Retain:

- foreign keys, check constraints, stable IDs, timestamps, and explicit schema versions;
- `revision` checks and atomic aggregate mutations;
- archive/restore semantics and explicit purge boundaries;
- derived project and milestone progress;
- rich-text JSON validation;
- deterministic canonical JSON export/import and hashes;
- activity records; and
- backup, verification, restore, migration, and rollback commands.

Remove from the supported runtime:

- PostgreSQL roles, RLS policies, extensions, stored functions, advisory locks, and JSONB-specific SQL;
- durable outbox rows and distributed event replay;
- users, memberships, persistent sessions, OIDC identities, and authorization-role matrices;
- persisted progress projections;
- GIN/FTS search vectors and scale-oriented composite indexes; and
- Docker, Compose, Nginx, database URLs, database credentials, and container health orchestration.

Initial indexes are limited to primary keys, uniqueness constraints, and direct relationship lookup. Search performs a bounded case-insensitive scan of issue identifiers/titles/descriptions/labels and project names/summaries, then applies deterministic TypeScript ranking. Filtering and sorting may scan the supported dataset. A new performance index requires a measured failing query and a focused decision; it is not added speculatively.

## Local security

Removing multi-tenant RLS does not remove the local web boundary. The runtime must:

- fail closed for non-loopback listeners and unexpected `Host` headers;
- allow only its exact same-origin browser origin;
- require JSON for state-changing requests;
- use a process-local, `HttpOnly`, `SameSite=Strict` session and CSRF token without a session table;
- set restrictive file and backup permissions where the OS supports them;
- reject symlinked or unsafe data paths; and
- keep private content and paths out of logs.

The threat model excludes a compromised local OS account or an attacker who can directly read the owner's files. It includes hostile web origins attempting to reach loopback, accidental remote binding, corrupt or tampered imports, interrupted writes, stale browser writes, and unsafe restore paths.

## Storage behavior

Open SQLite with foreign keys enabled, defensive mode enabled, a bounded busy timeout, and one connection. Use short `BEGIN IMMEDIATE` write transactions. Use `PRAGMA user_version` for ordered migrations. The implementation must select and document a journal/synchronous policy after interruption tests; the planning decision does not assume the probe's WAL setting is final.

The synchronous `DatabaseSync` API is acceptable only under the supported small-data ceiling. Repository methods must bound result size and avoid long work inside a write transaction. CT-80 measures event-loop blocking and query latency before acceptance.

## Events

Mutation responses remain authoritative. Multiple tabs may receive in-process change hints and refetch current state, but v0.1 does not promise durable event replay. A process restart invalidates the transient cursor and forces a bounded refetch. This replaces the transactional outbox because there is one process and one owner.

## Operations

The release exposes one start command and operator commands for `doctor`, `export`, `import`, `backup`, `backup verify`, `restore`, and `migrate`. First start creates the directory, database, owner profile, internal scope IDs, and default workflow in one transaction.

Backup uses SQLite's online backup API into a new timestamped file, followed by `integrity_check`, canonical digest comparison, and a manifest hash. Restore verifies a temporary database and atomically promotes it; it never overwrites the last known-good file before all checks pass.

## Migration from the current build

The PostgreSQL implementation is an export source, not a second supported runtime:

1. Freeze the last accepted canonical transfer schema.
2. Produce a read-only canonical JSON export from PostgreSQL.
3. Require exactly one workspace/team or an explicit scope selection.
4. Import into a new temporary SQLite file.
5. Verify foreign keys, `integrity_check`, counts, stable IDs, timestamps, order, relations, rich text, and canonical digest.
6. Atomically promote the verified file and retain the export, source database, and pre-upgrade backup.
7. Remove PostgreSQL/runtime packaging only after the parity fixture passes.

A multi-scope input without an explicit selection fails before creating or promoting output. Unselected records remain in the source export. There is no direct PostgreSQL-backup-to-SQLite conversion and no live dual write.

## Consequences

Setup and recovery become much simpler, and the storage format is directly inspectable and portable. The tradeoff is an explicit loss of remote collaboration, database-level tenant isolation, concurrent writers, durable distributed events, and indexed large-data search. That loss matches the maintainer's personal-use boundary rather than being hidden as an implementation shortcut.

Node 24.18 documents `node:sqlite` as release-candidate stability, so the adapter and pinned runtime are mandatory risk controls. SQLite documents local application storage, single-writer workloads, and application-file use as appropriate fits. These sources establish capability, not product acceptance:

- [Node.js 24.18 `node:sqlite`](https://nodejs.org/download/release/v24.18.0/docs/api/sqlite.html)
- [SQLite appropriate uses](https://www.sqlite.org/whentouse.html)
- [SQLite online backup API](https://www.sqlite.org/backup.html)

## Task topology

- `CT-21` is canceled because its clean Docker-host goal is no longer a release requirement.
- `CT-80` migrates persistence and canonical transfer to SQLite.
- `CT-81` collapses packaging and runtime to one loopback process.
- `CT-82` independently verifies clean local start, upgrade, backup, restore, rollback, and offline operation.
- `CT-12` remains blocked until `CT-82` and its other browser/UAT gates pass.
