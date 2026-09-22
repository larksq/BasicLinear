# CT-75 Workflow Status Retirement Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. The service and client now define one bounded workflow-status retirement contract, and all available local automated and stateful host checks pass. The database-backed transition scenario is present but skipped without its two environment variables; rendered browser and UAT acceptance remain unavailable. CT-75 can close as an implementation issue while CT-12 keeps those acceptance rows open.

## Implemented Contract

- `POST /api/v1/workspaces/:workspaceId/statuses/:statusId/retire` requires positive opening revisions for a source and a distinct replacement.
- The repository authorizes status management, locks the source team, rejects the final status before replacement validation, verifies both revisions, and fails closed for missing or cross-team records.
- Active and archived issues using the source are reassigned in the same transaction and each issue revision advances once.
- Project/milestone progress rows are refreshed for the transition repository; issue and retired-status activity/outbox records are written before the source is removed.
- The response contains the retired ID, replacement ID, exact affected count, and authoritative remaining team order.
- The client validates the full retained candidate set, serializes create/edit/reorder/retire controls, keeps a destructive confirmation and explicit replacement selector, re-reads after accepted and rejected writes, announces stable feedback, and restores focus.
- The final status cannot be retired, and malformed, same-status, stale, cross-team, cross-workspace, unauthorized, repeated, and missing requests do not partially mutate state.

## Verification

| Check | Result |
|---|---|
| Focused retirement/capability/edit/reorder suite | 4 files, 40 tests passed |
| Complete unit regression | 53 files, 376 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Fixture syntax | Passed |
| Stateful loopback HTTP fixture | 40 of 40 checks passed; 2 issues reassigned, including 1 archived issue; rejected writes preserved state; final status retained |
| Production build | 1,946 modules; 1,058,171 bytes; no chunk warning |
| Release-audit regression | 2 tests passed |
| PostgreSQL transition integration | 7 files / 17 tests discovered and skipped because the required URL/password are absent; not counted as a pass |
| Rendered browser acceptance | 0 captures and 0 assertions; pending CT-12 |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-002 | Workflow status configuration has a safe retirement path and preserves one remaining status. |
| R-005 | Active and archived issues keep valid status assignments and revisions. |
| R-007 / R-010 | Named keyboard-reachable destructive controls, native selection, announcements, serialization, and deterministic focus return are implemented. |
| R-102 | Both opening revisions are checked and stale requests receive an authoritative recovery path without automatic replay. |
| R-106 / R-107 | Atomic mutation, authoritative readback, and exact mutation evidence are specified and covered by host/source checks; database execution remains pending. |
| R-110 | Invalid candidates, malformed input, missing scope, authorization failure, repeats, and final-status attempts fail closed. |

## Review Corrections

1. Treating the selected replacement alone as sufficient client validation was rejected; every retained candidate must remain unique, revisioned, and in scope.
2. Letting workflow move/edit controls remain visibly enabled while the destructive dialog was open was rejected; the whole mutation family is now visibly serialized.
3. Looking up a replacement before checking whether only one status remained masked the final-status invariant; validation order now reports the actual invariant.
4. Source-string tests without a stateful retirement endpoint were insufficient; the fixture now proves rejected-state preservation, active/archived reassignment, count/order receipts, deletion, and final-status retention.
5. The local integration runner's skip is not a database pass. Docker was not started to manufacture one after CT-79 removed it from the supported solution.
6. HTTP checks are not rendered acceptance. No pixel, focus-ring, accessibility-tree, responsive containment, or console assertion is claimed.

## Local Runtime Boundary

The current PostgreSQL delete policy and repository transaction are transitional compatibility code only. CT-80 owns the embedded SQLite implementation and must preserve these domain effects while removing RLS, advisory locks, persisted progress projections, and outbox delivery. CT-81 owns the one-process runtime. CT-82 owns independent local migration, backup, restore, rollback, and offline acceptance.

## Privacy And Authority

All evidence uses repository source and deterministic synthetic local data. No database credential was available or persisted. No Docker process, authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was used. Project-local Control Tower v0.8 is the sole issue and milestone authority.

## Acceptance Boundary

This evidence closes implementation only. It does not pass P-T18/P-T19, execute the database-sensitive transition scenario, accept the SQLite port, complete CT-12, approve CT-13, validate O-001 through O-004, or authorize release.
