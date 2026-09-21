# CT-84 Sidecar-Free Local Runtime Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. The one-writer runtime now uses SQLite rollback journaling with full synchronous durability and leaves no persistent SQLite sidecar while idle or after the documented npm Ctrl-C path.

## Defect Reproduction

| Check | Result |
| --- | --- |
| Fresh owner workflow | Passed |
| Loopback listener | `127.0.0.1` only |
| Child process after Ctrl-C | Absent |
| Retained WAL | 181,312 bytes in first rehearsal; 78,312 bytes in focused reproduction |
| Retained SHM | 32,768 bytes |
| Database integrity | `ok`; zero foreign-key violations |

The residue was caused by process-group interruption not waiting for WAL cleanup. Direct database, Fastify, and Node signal closes were sidecar-free, so deleting files manually or closing the database ahead of active request draining was rejected.

## Selected Policy

`DELETE` rollback journaling matches the accepted personal runtime: one process, one connection, one writer, short `BEGIN IMMEDIATE` transactions, and bounded data. `FULL` synchronous durability remains enabled. A temporary rollback journal may appear only while SQLite owns a transaction or recovery; it is never an application cleanup target.

## Final Built-Process Readback

| Check | Result |
| --- | --- |
| Documented root launcher | `node apps/api/dist/index.js` |
| Listener | `127.0.0.1:4296` |
| Journal mode | `delete` |
| Synchronous mode | `2` (`FULL`) |
| Idle sidecars | 0 |
| Post-Ctrl-C WAL/SHM/journal | 0 |
| Main database mode | `0600` |
| Owner/project/milestone/issue restart IDs | Preserved |
| Canonical digest before/after restart | `fe4961acf50cf1240e5e83e1ae0d0100b83f95f2df240762343db56aa6f8ef83` |
| Backup | schema 2, 55 pages, integrity `ok`, 0 FK violations |
| Backup SHA-256 | `17b0f35d3c3a7daaf8d06b32bbf582aa07a4b1c7a2efcb35bd33e43111a2a700` |

## Automated Evidence

- Focused regression: 4 files / 21 tests passed.
- Complete regression: 56 files / 386 tests passed.
- Workspace typecheck: 8 / 8 passed.
- Production build: 1,946 modules / 1,027,388 bytes; no chunk warning.
- Release audit regression: 2 / 2 passed.

Structured evidence is in `evidence/runtime-rehearsal.json`. The CT-82 rehearsal remains non-independent and cannot pass P-T21.

Control Tower readback is healthy: `CT-84 Done@2`, `CT-82 Todo@2`, and `CT-12 In Progress@60`. Project totals are 6 active, 78 completed, and 0 trashed issues; provider projection remains disabled and `not_synced`.
