# CT-17 Concurrency Readback Evidence

## Verdict

`OUTPUT_DONE_FOR_CT11`. Revisioned mutations now acquire a workspace-scoped PostgreSQL row lock before evaluating the client's expected revision. A loser therefore observes and returns the committed revision rather than a stale pre-lock value.

## Verification

- The real-PostgreSQL CT-11 matrix runs two simultaneous revision-1 writes for issue, project, milestone, label, saved view, workflow status, and comment entities.
- Every case produces exactly one HTTP 200 and one HTTP 409. Each loser reports `currentRevision: 2`; persisted state is revision 2.
- Per-case database assertions prove exactly one matching activity entry and one matching outbox effect. Sequential stale-write and idempotent-create behavior remains covered.
- The immutable image `basiclinear-test:ct11-final-r2` (`sha256:b073182b066e765bdda111ffa6f32a0befba85039e6cccd2794b781913cc325d`) passes typecheck, all 20 unit tests, and all 16 integration tests.
- The integration teardown uses bounded database-drop retries, avoiding forced backend termination and unhandled pool errors while preserving isolation.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-102 / P-T17 | Exactly one concurrent writer commits; every loser receives the committed revision; retry effects remain singular. |
| R-106 / P-T17 | Conflict responses stay structured and expose no record content beyond the revision refresh hint. |

## Verification Boundary

The immutable verifier used source-frozen artifacts and fresh disposable databases outside the mutation session. This closes the CT-17 implementation return loop; independent Testing remains CT-11 authority.
