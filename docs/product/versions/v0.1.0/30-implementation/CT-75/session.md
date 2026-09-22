# CT-75 Implementation Session

- Issue: `CT-75`, stable ID `87555ca5-f32d-41ec-86da-72b6450d4898`, starting revision `4`, intended completion revision `5`.
- Session: `CT75-IMPL-20260821T035500Z`.
- Actor: `codex-workflow-status-retirement`.
- Mode: code-mutating implementation and verification.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Complete the storage-neutral workflow-status retirement behavior before the SQLite migration: a distinct same-team replacement, source and replacement revision checks, final-status protection, atomic active and archived issue reassignment, issue revision and progress updates, mutation evidence, authoritative remaining order, destructive confirmation, serialized workflow controls, readback, feedback, and focus recovery.

## Architecture Boundary

CT-79 supersedes the supported PostgreSQL and Docker runtime. Migration `011`, RLS, advisory locking, projections, and the current PostgreSQL repository are retained only as a temporary source adapter until CT-80 completes the canonical one-scope export and SQLite import. CT-75 adds no container, service, server, index, stored function, or distributed-delivery design. The accepted behavior and request/response contracts are the migration input; PostgreSQL-specific mechanics are not the target architecture.

## Execution

1. Reviewed the existing contract, repository transaction, API route, client request helper, destructive dialog, and focus/readback paths.
2. Moved final-status validation ahead of replacement lookup so the rejected state has an explicit and stable reason.
3. Strengthened the client request builder to reject every duplicate, invalid-revision, source-duplicating, cross-workspace, or cross-team candidate in a retained draft.
4. Serialized status move and edit controls while the retirement dialog is open and repaired the stale capability contract.
5. Added focused retirement tests spanning pure draft/request behavior, service/source bindings, destructive-dialog behavior, styling, and fixture coverage.
6. Added a stateful local fixture that reassigns active and archived issues, increments revisions, isolates the other team, deletes only the source, returns authoritative order/count, and rejects malformed, stale, cross-scope, repeat, and final-status requests.
7. Added an environment-gated database scenario for active and archived issue rows, progress rows, mutation evidence, authorization, stale writes, source deletion, and final-status preservation. The runner discovered it but did not execute because the two database variables are absent.

## Verification

- Focused workflow suite: 4 files / 40 tests passed.
- Complete regression: 53 files / 376 tests passed.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Stateful local HTTP fixture: 40 of 40 checks passed on `127.0.0.1:4201` after the sandbox bind/connect results were rejected as evidence and the approved local loopback run completed.
- Production build: 1,946 modules and 1,058,171 total bytes, without a chunk warning.
- Release-audit regression: 2 of 2 tests passed.
- PostgreSQL transition runner: 7 files / 17 tests discovered and skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Docker was not started.
- Rendered browser captures and assertions: 0.

## Review Record

A separate source review pass found and corrected four incomplete edges before evidence freeze: stale capability assertions, partial candidate validation, workflow controls that remained visibly enabled behind the retirement dialog, and the final-status error being masked by replacement validation. It also removed one assertion accidentally placed in CT-74's test path. No blocking source finding remains. This is not an independent testing actor and does not replace CT-12 browser, database, or UAT acceptance.

## Handoff

CT-75 implementation is complete and can unblock CT-78 and CT-80. CT-12 retains the rendered Workflow retirement matrix and the database-sensitive transition scenario as pending; CT-80 must port the behavior to the embedded SQLite transaction and eliminate the projection/RLS/advisory-lock mechanics. No outcome or release claim is made.
