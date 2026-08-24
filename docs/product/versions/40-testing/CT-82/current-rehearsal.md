# CT-82 Current-Revision Rehearsal

## Verdict

`PASSED_IMPLEMENTATION_REHEARSAL` for exact product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa` and tree `d106d3bb40a84184e7ee26c919134b01e4748679`. This is a non-independent rehearsal: P-T21 remains open for this product revision, and the accepted `f7c3625` qualification remains historical evidence for that revision only.

## Revision Lock

- Environment: macOS 25.5 arm64, Node `v24.19.0`, npm `11.8.0`; no Docker, PostgreSQL server, external identity, or paid service.
- Source: clean isolated checkout, zero status entries, 1,241 files, SHA-256 `456fc149dffc711e87f372f2f71af937e6a3ba4db984201af84000e2cb659c2a`.
- Artifact: 111 files / 2,053,719 bytes, SHA-256 `858750ef2bce49e39a028419a23646200207f58fd5394a20f812c207889c1e7c`.
- Runner / guard: SHA-256 `d447f179db835fd09d5f420cc9d1c3f412470e099c3a711ca4f708bf37fa412c` / `f11d5f39866508001fa7eebe2a2242efb52a4c6bf3d0a61c72fd45b2d58d5062`.
- Runner contract: 4 / 4 tests passed under supported Node 24.

## Qualification Matrix

All 21 structured checks passed. Six guarded phases emitted 11 audit records with zero outbound-network or subprocess attempts. Recovery passed for `SIGKILL`, `SIGTERM`, and `SIGINT`; the work directory and SQLite sidecars were cleaned. Export/import, online backup, integrity, restore, corrupt-restore rejection, schema 1 to 2 upgrade, future-schema rejection, malformed-migration rollback, owner-only permissions, and legacy transfer compatibility passed. The canonical restore/upgrade digest is `82a029c6c16d3f7504e8a1c8c48cca63cc20025202032e525cf2253f733c8584`. Accepted personal scale covered 1,001 projects, 2,001 milestones, 10,001 issues, and 50,006 activity entries in 157 ms.

The initial sandbox execution failed closed on `listen EPERM 127.0.0.1`. The exact guarded command was rerun with only temporary loopback-listener and audited local-subprocess permission; no network-denial policy was relaxed.

## Evidence And Boundary

Private raw evidence is owner-only at `.control-tower/evidence/CT-82/rehearsal-5a33d28.json`, 3,898 bytes, SHA-256 `62a1e1d65c1058163fabec4dfbde424881c1477d273d2b7bac4fd1d3d80455c0`. The tracked summary is `evidence/rehearsal-5a33d28.json`.

One optimistic project-local update reopened `CT-82@17` as `Todo@18` in `S4 — Testing`. Fresh readback returned store health `ready`, 14 active issues, 110 completed issues, empty Trash, and provider projection disabled / `not_synced`. The owner-only pre-update backup is `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-23T03-14-43-717Z-a95d4cb2-db32-4ec1-97a4-287e104c62a0.json`, 488,076 bytes, canonical package SHA-256 `810302dde688be64b45809546b1109a4cefe817ac4799509b280a9fa28316006`, serialized file SHA-256 `98122378e8ecd899d35a0ba0adb476601881ce0dc03aa2ee9c85bc04fe81272b`.

This rehearsal does not accept P-T21, complete CT-82 for `5a33d28`, accept CT-117 through CT-124, certify CT-12, authorize release, resolve CT-3 identity/legal review, resolve CT-13 accountable review, or validate outcomes. A distinct actor/session must rerun the strict harness against the exact clean product revision before current-revision acceptance.
