# CT-10 Canonical Transfer and Operator Recovery Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12` on 2026-08-20. CT-10 delivers deterministic workspace export/import, credential-bearing database backup/verification, restore into an empty migrated target, an explicit pre-upgrade backup gate, operator health and recovery commands, named backup persistence, and a recovery runbook.

This is implementation evidence. It does not claim CT-11 security/concurrency acceptance, CT-12 integrated recovery or clean-host acceptance, public release approval, or an observed O-001/O-004 outcome. The repository is unborn and has no Git `HEAD`.

Evidence is bound to Control Tower issue `CT-10` implementation revision `2`, expected completion revision `3`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, changed-files manifest SHA-256 `933b06723668cd6ac6b9aac1d834dcb773821f42601ffca599ac899c25a60bdb`, production-file aggregate SHA-256 `8161b7e1413d05da12723c81781a1561116e1d96988ea34f673872a70967c91c`, and package-lock SHA-256 `60e4998a0fdc1bc4241e3a6354fb7598e2e0f7c91ef3c3e412be61a2bb4e42ed`.

## Delivered Boundary

- Workspace export requires an owner or administrator actor, selects exactly one workspace, and includes referenced public users, memberships, teams, workflows, projects, resources, milestones, sequences, labels, issues, label links, relations, comments, saved views, and activity.
- Export omits password hashes, sessions, idempotency records, outbox delivery state, projections, and private evidence. New imported users receive an unrecoverable generated hash until explicit `user recover`.
- Database backup includes credential hashes and every canonical workspace. Sessions and transient retry/delivery state are deliberately excluded.
- Explicit allowlists reject unknown fields. UUIDs, timestamps, enums, ordering, relationship closure, migrations, collection digests, and full digests are validated before a transaction begins.
- Import and restore preserve IDs, revisions, ordering values, rich-text JSON, relations, memberships, and timestamps. Derived progress and issue sequences are rebuilt, and canonical readback must match before commit.
- Restore accepts only an empty, already-migrated target on the same PostgreSQL major version. Replacement and overwrite paths require explicit confirmation.
- Migration planning detects digest drift. A populated pending upgrade fails with `BACKUP_REQUIRED` unless the supplied backup matches the current canonical database and migration manifest.
- Output is structured and secret-safe. Files are atomically replaced only when authorized and are created with mode `0600`.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass across 8 workspaces |
| `npm test` | Pass, 4 files and 18 tests |
| Exact rebuilt-image PostgreSQL suite | Pass, 5 files and 8 tests |
| CT-10 transfer/recovery integration | Pass, 4 tests |
| `npm run build` | Pass; largest JavaScript chunk 481.43 kB |
| Dependency installation audit | Pass, 0 vulnerabilities for the recorded lockfile |
| Compose default/tools rendering | Pass for both profiles |
| Verification network | `internal=true`, bridge, 3 attached runtime containers |
| Migration state | Pass, 6/6 applied with matching digests |
| Live restart recovery | Pass; database, API, and web recovered; ingress/readiness HTTP 200 |
| Runtime artifact comparison | Pass; API, contracts, database, and migration artifacts byte-identical to final build outputs |
| Browser recovery | Pass; authenticated owner, 2 active issues, saved board, no browser log entries |
| Runtime logs | No post-restart API error or HTTP 5xx entry |
| Backup permissions | Pass, mode `0600` |
| Backup/current verification | Pass; canonical digest equal after restart |

## Canonical Evidence

| Artifact | Result |
|---|---|
| Workspace export | 76 records, 16 collections |
| Workspace export digest | `ba0fa320605637842de5c0745aa6fd05bc6bad0419bc07011c2d88420000d839` |
| Initial database backup | 37,927 bytes; 1 workspace; 2 users; 0 sessions |
| Initial file SHA-256 | `48aeb32841ff0317aa92643c8cd71c17450ef65e49ad585c00a322eeb64f6c34` |
| Post-restart database backup | 37,927 bytes; 1 workspace; 2 users; 0 sessions |
| Post-restart file SHA-256 | `5c2d5e0eca9f73e195a4b9f9e28a4038daae267ecacef8ea8264d7e78c30dce3` |
| Canonical database digest, both runs | `da96eff026fbed8513a9289d9618b2f8c6cf518ce619589cb3baac1340ba5c41` |
| Matches current database after restart | `true` |

The file hashes differ because generation time is provenance metadata. The canonical digest deliberately excludes that field and remained stable across the restart.

## Requirement Trace

| Requirement | CT-10 evidence |
|---|---|
| R-013 | Versioned canonical export/import preserves all accepted canonical records, relationships, rich text, timestamps, ordering, revisions, and memberships. |
| R-014 | Backup verification, restore-to-empty-target, explicit overwrite/replace boundaries, post-write digest equality, and the runbook provide executable recovery. |
| R-106 | Canonical schema/build/migration metadata, deterministic ordering, strict parsing, and digest checks fail closed on incompatible or tampered artifacts. |
| R-107 | Migrations are explicit and digest-bound; populated upgrades require a current verified backup; startup/restart and clean migration behavior are exercised. |
| R-109 | The non-interactive operator CLI, health checks, secret-safe structured failures, internal network, and named backup volume support self-hosted operation. |

| Planned test | CT-10 evidence |
|---|---|
| P-T14 | Authorized export, unauthorized rejection, mode `0600`, canonical import round trip, backup verification, restore, credential preservation, session exclusion, and tamper rejection pass in real PostgreSQL. |
| P-T15 | Clean migration planning/application, populated-upgrade backup enforcement, Compose rendering, internal-network inspection, engine restart recovery, browser recovery, and post-restart canonical equality pass. |

## Images and Runtime

Final images are test `60f1427a77f1` (442,871,777 bytes), operator `297b9b534e13` (322,087,169 bytes), API `e740dd1f28fb` (322,264,672 bytes), and web `43e413340ad3` (62,053,295 bytes). PostgreSQL is `06928dd03c45`.

The live API remains on CT-10 image `84fa56676067` because this host stopped accepting newly created container starts. Its executable API, contracts/database runtime, and migration trees compare byte-for-byte with final image outputs. The running web is the final web image. Database, API, and web report zero container restarts; the engine restart itself is recorded separately.

Migration SHA-256 values are `dd1fac4916d38f072f9fd49f31d0a89ff000b9b0d5cce0d588dea1754b0e7a3b`, `79c55276d5be91b4b36cd6fc66135bbb9a2879e529622159f7ba3c135f911f92`, `15e41c9eff8401f6092d43b2c604633c7ac9f6cc2ba515b523648d3bd4fe256b`, `9539e28e2ae66a1c891e68bb805e24fee2179be92d2203b823c09bd1ad623612`, `0df907aa7da512925c410736dca969200568f3cd38d5ad6bc8c5b5f950019d2a`, and `8b7944c5bf5e768c824cd9a4c6e5a2b632ac6f1fcef0d48f299f357dd2221467`.

## Host Limitation

Docker Desktop 4.15 / Engine 20.10.21 repeatedly deadlocked manual starts for new containers and exact Compose services. The exact final image filesystem was therefore reconstructed under an isolated path inside the already-running internal-network API container and executed with its preserved image UID; it passed all 8 integration tests and was removed afterward. Compose renders both profiles, the verification network is outbound-isolated, final images build, runtime artifacts match, and restart/digest recovery passes. CT-12 retains the independent clean-host full-Compose rehearsal rather than treating this host workaround as acceptance.

## Handoff

CT-11 can independently exercise tenancy isolation, direct-ID/search/activity access, stale writers, filter boundaries, CLI failure redaction, and concurrency. CT-12 can consume the canonical digests and operator commands for clean-host restore, assistive-technology, fidelity, performance, and integrated recovery acceptance. O-001 and O-004 remain pending.
