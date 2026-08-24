# Technical Investigation

## Recommendation

Use a TypeScript monorepo with a React web client, one Node 24 service process, and one embedded SQLite application file. The process serves the built web application and API on loopback. Keep Docker, PostgreSQL, reverse proxies, external identity, queues, object storage, Redis, search services, native shells, remote access, and multi-instance topology outside v0.1.

This replaces the original PostgreSQL/Docker hypothesis under sponsor direction and CT-79. The current PostgreSQL build remains only long enough to produce a canonical, read-only transfer fixture for the SQLite migration.

## Domain boundary

The supported model contains one owner profile, internal workspace/team identifiers, workflow statuses, projects, ordered milestones, issues, labels, comments, relations, personal saved views, resources, and activity entries. v0.1 exposes no account, workspace, team, membership, invitation, role, sharing, remote-access, or OIDC administration.

Project and milestone progress is derived from issue states. Archived records remain addressable to restore and audit paths. Relations are transactional and validate self-reference and direction invariants. Rich text has a versioned storage contract and sanitized rendering. Optimistic revisions prevent stale overwrite.

## Authority and synchronization

One SQLite file is the sole application authority. Browser cache is disposable and reconciles with server revisions. A mutation and activity entry commit in one short transaction. Multiple tabs may receive an in-process change hint and refetch; v0.1 does not promise durable event replay.

There is no Linear synchronization. Control Tower remains the project-work authority in `.control-tower/tasks-v0.8.sqlite3`; product data uses a separate application SQLite file. The two stores have distinct purposes and no provider projection.

## Local security

The v0.1 threat model protects a local HTTP and file boundary rather than multiple tenants. The service binds only to loopback, rejects unexpected Host/Origin and missing CSRF, accepts state changes as same-origin JSON, uses an ephemeral process session, validates local data/backup paths, applies restrictive permissions where supported, and rejects corrupt or implicit multi-scope imports.

The release does not claim protection from a compromised OS account or direct file access. Remote access, shared database files, multi-user collaboration, and concurrent processes require new Discovery.

## Operations feasibility

A headless operator command remains appropriate for `doctor`, canonical export/import, online backup, backup verification, restore, and migration. One start command creates a platform-standard data directory, bootstraps the schema and defaults, serves the application, and reports health. No environment file, database URL, database credential, setup token, OIDC provider, container runtime, or external service is required.

SQLite uses a single connection with foreign keys, defensive mode, bounded busy timeout, short immediate write transactions, and `PRAGMA user_version` migrations. Backup writes and verifies a new snapshot. Import/restore builds a temporary file and promotes it only after integrity and canonical digest checks.

## Search and performance

The accepted personal workload contains at most 10,000 issues, 1,000 projects, 2,000 milestones, and 50,000 auxiliary comment/relation/activity records. Search scans bounded issue/project text and applies deterministic ranking. Filtering and sorting may scan the supported dataset. Initial indexes are limited to primary keys, uniqueness, and relationship lookup; an added performance index requires a named failing query and measurement.

Node's `DatabaseSync` API is synchronous, so CT-80 must measure event-loop blocking as well as query latency. Larger data and concurrent writers are not claimed.

## Migration feasibility

The current PostgreSQL store is never converted in place. Its operator emits a deterministic canonical JSON export. CT-80 imports one explicit workspace/team into a temporary SQLite file, verifies stable IDs, timestamps, order, relations, rich text, counts, foreign keys, `integrity_check`, and canonical digest, then atomically promotes the file. Multi-scope input without selection fails closed; the source database and export remain unchanged.

## Visual, responsive, and accessibility validation

Playwright screenshot comparisons run with pinned browser, fonts, viewport, seed, locale, time, and motion. Baselines use synthetic fixtures and independent design. Visual tests remain separate from keyboard, focus, announcement, axe, responsive, persistence, and recovery tests.

## Breaking assumptions

- `C-009`: one technically capable owner is the supported v0.1 decision unit. Sponsor direction and CT-77 establish the boundary and workflow rank.
- `C-010`: reference interaction cost is unknown. CT-2's historical diagnostic is not an accepted baseline.
- `C-011`: the sponsor selected and applied `AGPL-3.0-only`; the requested OpenLinear product brand, qualified license review, and clean-room publication boundary remain unresolved under CT-3.
- `C-012`: the original TypeScript/PostgreSQL/Docker topology is rejected for v0.1 as disproportionate.
- `C-013`: one loopback Node 24 process and SQLite file can preserve the accepted behavior at the personal workload. CT-80/81 implement it and CT-82 independently tests it.
- `C-014`: Node 24 `node:sqlite` is release-candidate stability. The runtime is pinned and all driver usage stays behind a replaceable adapter.

## Prototype evidence

CT-79's disposable Node 24.18 probe stored 10,000 synthetic issues, committed a relation transaction, scanned text without manual search/sort indexes, created an online backup, restored 10,000 rows, and returned `integrity_check = ok`. Its 4.12 ms scan and 3.39 ms backup observations are feasibility-only machine results, not acceptance.

Official Node and SQLite sources support file-backed storage, foreign keys, defensive mode, single-writer local workloads, and online backup. They do not prove product migration, recovery, performance, or usability.

## Downstream boundary

Planning may choose exact prepared-statement helpers, journaling/synchronous settings after interruption tests, platform path conventions, and static-file serving library. It may not add Docker, PostgreSQL, OIDC, remote access, a second storage engine, dual writes, FTS, or speculative scale indexes without a governed change. Multi-user or remote operation returns to Discovery.
