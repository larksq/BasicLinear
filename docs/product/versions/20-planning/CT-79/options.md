# CT-79 Storage and Runtime Options

## Decision matrix

| Option | Install burden | Atomic relations and revisions | Backup/restore | Migration and inspection | Fit |
|---|---|---|---|---|---|
| Built-in SQLite in one Node process | Node 24 only; no native package or server | Strong transactions and foreign keys; one writer matches scope | Online backup plus a stable single-file format | SQL and common tooling; canonical JSON remains portable | **Selected** |
| One JSON file | Lowest apparent dependency count | Requires custom locking, journaling, validation, and whole-file rewrite | File copy is simple only when stopped and consistent | Human-readable but fragile for relations and partial writes | Rejected: simplicity moves into unsafe application code |
| Browser IndexedDB | No local service install | Browser transactions, but data is coupled to a browser profile and origin | Export/restore and clean upgrade are harder to operate and verify | Poor operator visibility; browser reset can remove data | Rejected: weak ownership and recovery ergonomics |
| Native PostgreSQL without Docker | Removes containers only | Preserves current guarantees | Mature, but still requires server install, roles, ports, credentials, and upgrades | Reuses code but retains the heavy operating model | Rejected: does not solve the user's core burden |
| Embedded PostgreSQL/Wasm compatibility layer | Removes a separate database service | May reuse some SQL semantics | Adds another engine/runtime and compatibility boundary | Preserves complexity that v0.1 no longer needs | Rejected: migration convenience is not end-state simplicity |
| In-memory state plus periodic JSON snapshots | Low startup burden | Crash windows and recovery semantics require a custom journal | Snapshots are easy to copy but hard to trust during interruption | Simple until relations, revisions, and upgrades are included | Rejected: data-integrity risk is too high |

## Why SQLite instead of JSON

The application already requires transactional status retirement, issue relation invariants, optimistic revisions, archive/restore, ordered records, and verified backup. Reimplementing those properties over JSON would create a database layer without the benefit of a mature database engine. SQLite keeps the operational surface at one file while retaining the required integrity primitives.

## Why no ORM or dual dialect

The current PostgreSQL repository contains substantial engine-specific SQL. Pretending it is portable through an ORM would leave RLS, stored functions, advisory locks, JSONB, full-text search, and outbox semantics unresolved. CT-80 keeps storage-neutral repository contracts, implements focused prepared statements for SQLite, and uses canonical export for the one-time transition.

## Small-data policy

The first implementation starts with no manual search/sort index. Primary keys, uniqueness, and direct relationship lookup remain. CT-80 measures the accepted fixture and records query plans. A new index is permitted only when one named workflow misses its accepted budget and the index demonstrably fixes that query without complicating writes or recovery.
