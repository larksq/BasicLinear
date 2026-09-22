# CT-84 Implementation Session

- Issue: `CT-84`, stable ID `1eefa911-b84a-487a-bcfc-cb76308feecf`, starting revision `1`, intended completion revision `2`.
- Session: `CT84-IMPLEMENT-20260821T074106Z`.
- Actor: `codex-platform-runtime`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser, or provider account was used for tracking.

## Discovery

A non-independent CT-82 rehearsal exercised a fresh built process through automatic owner bootstrap, status discovery, project, milestone, issue, private saved view, search, issue query, restart, canonical export/import, online backup, verification, restore, rejected import, rejected restore, and schema-1 upgrade. The functional and recovery checks passed.

The documented `npm start` Ctrl-C path nevertheless left `basiclinear.sqlite3-shm` in two stopped data directories and an uncheckpointed 181,312-byte `basiclinear.sqlite3-wal` in one. A second reproduction retained a 78,312-byte WAL and 32,768-byte SHM after the child process was confirmed absent.

## Investigation

1. Direct `BasicLinearDatabase.close()` and `await app.close()` removed sidecars.
2. A direct built Node process handled `SIGTERM`, exited zero, and left only the main database.
3. Removing the nested workspace npm launcher reduced process depth but did not make terminal process-group interruption wait for asynchronous cleanup.
4. A synchronous early database-close experiment was rejected because it could race in-flight Fastify work and still could not control an external npm parent.
5. CT-79 had deliberately deferred the final journal policy until interruption evidence. The accepted runtime has one process, one connection, one writer, and bounded personal data, so persistent WAL concurrency is unnecessary.

## Resolution

- The root start script launches `node apps/api/dist/index.js` directly instead of nesting another npm workspace command.
- Disk databases use SQLite `DELETE` rollback journaling with `FULL` synchronous durability.
- WAL/SHM files therefore do not persist while the process is idle or after process-group interruption. SQLite retains ownership of any transient `-journal` required during a transaction or crash recovery.
- Database and Fastify close assertions cover the normal close path; the foundation test locks the direct launcher and one-process topology.
- README, recovery, and architecture documentation record the selected journal policy and prohibit manual deletion of a transient recovery journal.

## Verification

- Focused: four files, 21 tests passed.
- Complete: 56 files, 386 tests passed.
- Typecheck: eight of eight workspaces passed.
- Build: 1,946 modules; 1,027,388 output bytes; no chunk warning.
- Release-audit regression: two of two tests passed.
- Final built npm process: owner/project/milestone/issue workflow passed on loopback; idle directory contained one SQLite file; Ctrl-C left zero WAL, SHM, or rollback-journal files.
- Restart retained the owner, workspace, project, milestone, and `OL-1` issue IDs.
- Canonical digest before and after restart: `fe4961acf50cf1240e5e83e1ae0d0100b83f95f2df240762343db56aa6f8ef83`.
- Backup SHA-256: `17b0f35d3c3a7daaf8d06b32bbf582aa07a4b1c7a2efcb35bd33e43111a2a700`; schema 2; integrity `ok`; zero foreign-key violations; 55 pages.

## Boundary

This closes a testing-discovered implementation defect. CT-82 still requires a distinct actor/session, clean supported account, last PostgreSQL fixture, multi-scope rejection fixture, network-denied observation, and complete independent acceptance. CT-12 still requires rendered workflow, accessibility, responsive, fidelity, and UAT evidence. No outcome or release claim is made.

Control Tower completion readback: `CT-84 Done@2`, `CT-82 Todo@2`, `CT-12 In Progress@60`; 6 active, 78 completed, 0 trash. S3 is 64 of 69 complete (`0.927536231884058`). The completion mutation backup SHA-256 is `23c365675ff331140c6066306413147b635aff5223461706d03fddd63e76d16d`.
