# CT-10 Implementation Session

## Scope

- Control Tower issue: `CT-10`, stable ID `fdb1ad84-8628-4ae8-8939-9b61f56a164d`, starting revision `1`, status `Todo`, milestone `S3 Implementation`.
- Completed dependencies: `CT-6` revision `3` and `CT-8` revision `3`, both status `Done`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-013`, `R-014`, `R-106`, `R-107`, `R-109`.
- Tests: `P-T14`, `P-T15`.
- Mode: code-mutating canonical data ownership and operator recovery slice.

## Allowed paths

- Root workspace controls and operator documentation when required for supported commands.
- Production code and tests under `apps/**`, `packages/**`, and `ops/**`.
- CT-10 evidence under `docs/product/versions/v0.1.0/30-implementation/CT-10/**`.
- Local Control Tower request artifacts under `.control-tower/**`.

Discovery, Planning, PMO, and completed implementation artifacts are read-only inputs. Private reference screenshots remain ignored and cannot enter exports, backups, fixtures, logs, or public evidence.

## Intended outputs

1. A versioned deterministic workspace export with canonical record and relation digests, schema/build metadata, and strict validation.
2. Import into an empty workspace boundary plus an explicitly confirmed replacement path, preserving IDs, ordering, relations, rich text, timestamps, revisions, and memberships.
3. Database backup, verification, and restore commands that prove compatibility and digest identity before acceptance and retain a last-known-good recovery point.
4. Explicit migration planning and application with verified pre-upgrade backup enforcement, compatibility checks, structured secret-safe errors, and operator health diagnostics.
5. A documented non-interactive CLI and exact-environment tests for round trips, interruption safety, restart persistence, and network-denied operation.

## Session record

Actor: Codex in the current user-authorized goal. No sub-agent or external coding agent is used. The project-local Control Tower v0.8 store is the sole issue and milestone authority; provider projection remains disabled and Linear API/MCP is not used.

## Boundary decision

CT-10 owns canonical export/import and operator recovery semantics. It does not claim independent security acceptance (CT-11), integrated recovery acceptance (CT-12), public release approval (CT-13), or mature O-004 outcome evidence (CT-14). Google and Linear credentials are absent from the supported runtime path.

## Safety decisions

- Export selects one authorized workspace and excludes sessions, password hashes, idempotency records, delivery state, and private evidence.
- Canonical serialization fixes record order and field order, normalizes JSON recursively, and hashes each collection plus the complete manifest.
- Import validates every identifier, reference, schema version, collection digest, and manifest digest before opening a transaction.
- Replacement requires an explicit confirmation flag and is atomic inside the target database; backup restore uses a new target database until verification succeeds.
- Errors expose stable codes and operational context without rich text, comments, credentials, tokens, or arbitrary database messages.

## Implemented outputs

- `basiclinear.workspace-export` version 1 serializes one authorized workspace with explicit field allowlists, deterministic collection order, per-collection SHA-256 digests, and a complete canonical digest.
- `basiclinear.database-backup` version 1 preserves local credential hashes and every workspace while excluding sessions, idempotency state, outbox delivery state, and derived projections.
- Import and restore validate structure, migration compatibility, identifiers, references, and every digest before mutation, then perform serializable writes and in-transaction digest readback before commit.
- The non-interactive operator provides `doctor`, `health`, `migrate plan`, `migrate apply`, `user recover`, `export`, `import`, `seed`, `backup`, `backup verify`, and `restore` with structured secret-safe output.
- Populated migration plans require a verified current backup; clean targets skip the unnecessary backup gate. Output files use atomic replacement and owner-only mode `0600`.
- Compose keeps the operator behind the `tools` profile, persists backups in a named volume, and retains database, migration, API, and operator traffic on the internal network.
- The recovery runbook documents backup, verification, upgrade, restore-to-new-target, credential recovery, rollback, and destructive-boundary expectations.

## Verification record

- Final local gates: 8 workspace typechecks; 4 unit files and 18 tests; production build with no JavaScript chunk above 500 kB.
- Exact rebuilt test-image filesystem: 5 PostgreSQL integration files and 8 tests passed, including 4 transfer/recovery tests.
- Exact Docker images: test `60f1427a77f1`, operator `297b9b534e13`, API `e740dd1f28fb`, and web `43e413340ad3`.
- The live API executable, contract/database runtime artifacts, and migration files are byte-identical to the final API image build outputs. Live ingress and readiness both returned HTTP 200 after the engine restart.
- A canonical workspace export contained 76 records in 16 collections with digest `ba0fa320605637842de5c0745aa6fd05bc6bad0419bc07011c2d88420000d839`.
- Pre-restart and post-restart database backups both produced canonical digest `da96eff026fbed8513a9289d9618b2f8c6cf518ce619589cb3baac1340ba5c41`; post-restart verification matched the current database.
- The final live fixture contains 1 workspace, 2 users, 2 memberships, 2 teams, 2 projects, 2 milestones, 2 issues, 1 comment, 1 saved view, 41 activity entries, 41 outbox events, and 2 live sessions. Backup files contain zero sessions.
- Chrome retained the authenticated owner session across the database/engine restart. Projects-to-Issues navigation reloaded 2 active issues and the saved board; browser logs remained empty.

## Retry and limitation record

1. A directly attached exact-image test run completed its database workload, but Docker Desktop left the client attached after removing the container, so that attempt supplied no admissible stdout or exit evidence.
2. The first extracted-image harness attempt failed before test collection because the root TypeScript configuration had not been copied. After adding the exact configuration, the suite passed.
3. The first full reconstructed-tree attempt failed before collection because preserved image files were owned by UID 503. Running under the preserved owner produced the final clean 5-file, 8-test pass.
4. Docker Desktop 4.15 / Engine 20.10.21 repeatedly deadlocked manual starts for newly created containers, including exact Compose starts, even after an engine restart. Configuration rendering, internal-network inspection, immutable builds, exact-filesystem integration, live restart recovery, and digest verification passed. A clean-host full-Compose rehearsal remains CT-12 acceptance scope.

Temporary test dependencies, operator files, and credential-bearing backup files were removed from the live API container after verification. Private Linear references and credentials were never copied into code, fixtures, exports, backups, logs, or evidence.
