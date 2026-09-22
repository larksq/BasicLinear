# CT-16 Workspace Event Feed Evidence

## Verdict

`OUTPUT_DONE_FOR_CT11`. The application now exposes an authenticated, workspace-scoped server-sent event endpoint backed by transactional outbox rows. It accepts a monotonic cursor from the query or `Last-Event-ID`, emits minimal revision hints, and lets the same-origin client invalidate workspace query state.

## Verification

- Event protocol unit coverage passes two cursor and serialization tests, including invalid cursor rejection and secret-bearing field exclusion.
- The CT-11 PostgreSQL suite proves cross-workspace event denial, authorized monotonic resume, no duplicate accepted cursor range, and payload allowlisting.
- The complete immutable image `basiclinear-test:ct11-final-r2` (`sha256:b073182b066e765bdda111ffa6f32a0befba85039e6cccd2794b781913cc325d`) passes 8 workspace type checks, 5 unit files / 20 tests, and 6 integration files / 16 tests.
- The matching live artifacts return readiness HTTP 200. A synthetic API mutation advanced `PRO-2`, the authenticated Chrome board refreshed through `EventSource` without a UI mutation or reload, and the restoring mutation returned the title to `Document restore and purge runbook` at revision 7.
- The post-restore authenticated DOM shows the restored title and two active issues. Browser warning/error logs are empty.
- Nginx disables proxy buffering and cache for `/api/` and retains a 65-second read timeout. Event payloads contain only cursor, workspace ID, entity type, entity ID, and revision.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-101 / P-T16 | Non-members receive no workspace event data; repository reads execute through the restricted workspace context and RLS. |
| R-106 / P-T16 | Cursor failures use structured application errors; event fields exclude descriptions, comments, tokens, credentials, and private evidence. |

## Verification Boundary

The immutable verifier used source-frozen image files and disposable PostgreSQL databases outside the code-mutating session. The live smoke used only synthetic credentials and content. This evidence closes the CT-16 implementation return loop; CT-11 owns independent acceptance and O-001/O-004 remain pending.
