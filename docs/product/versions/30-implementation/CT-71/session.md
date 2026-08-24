# CT-71 Implementation Session

- Issue: `CT-71`, stable ID `e01750b3-1683-49f5-b694-d176723d1518`, starting revision `2`, intended checkpoint revision `3`.
- Session: `CT71-IMPL-20260821T000125Z`.
- Actor: `codex-issue-relation-directions`.
- Mode: code-mutating implementation checkpoint.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Complete the existing directed issue-relation workflow without changing its API or graph model. Let a user express every server-supported direction relative to the current issue, select active candidates across the workspace, serialize relation mutations, recover authoritative state after rejected writes, retain the rejected create selection, and restore focus to the initiating control.

## Execution

1. Added a pure relation-command module that exposes explicit current-issue-relative hierarchy and peer directions and maps inverse choices to canonical API source, type, and target values.
2. Added fail-closed candidate validation for self, missing, archived, cross-workspace, and duplicate issue identities while retaining valid cross-team issues.
3. Replaced limited relation creation controls with independent hierarchy and peer composers for Parent issue, Sub-issue, Related to, Blocks, Blocked by, Duplicate of, and Duplicates.
4. Kept each composer controlled and independently reset so a successful mutation in one section cannot erase an unsubmitted selection in the other.
5. Serialized creation and removal, blocked issue archive while relation writes are pending, and disabled relation controls while an issue revision write is pending.
6. Re-read authoritative current-issue relations after accepted and rejected mutations. Rejected create selections remain intact without automatic retry; pending, success, and error feedback use stable geometry.
7. Restored focus to the initiating composer or relation removal control and invalidated both endpoint relation/activity projections after accepted creation.
8. Extended the deterministic synthetic fixture with cross-team candidates, canonical/inverse readback, idempotency, cycle and duplicate rejection, exact-revision removal, and final convergence checks.

## Verification

- Focused tests: 3 files / 18 tests passed.
- Complete regression: 49 files / 335 tests passed.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Production build: 1,942 modules, 1,025,669 total bytes, no chunk warning.
- Release-audit regression: 1 file / 2 tests passed.
- Integration runner: 7 files / 17 tests discovered and skipped without a configured test PostgreSQL URL; no database-sensitive path changed and no new database pass is claimed.
- Stateful HTTP fixture: 39 of 39 named assertions passed at port 4197 after sandbox bind/connect and a host-harness response-parser result were rejected as environment/harness evidence.
- Rendered browser captures and assertions: 0.

## Environment Retry Record

The normal fixture launch on port 4197 failed with sandbox `listen EPERM`; the managed production fixture then launched on the same port. A sandbox-local request could not connect. The first host-network harness run reached the fixture but treated HTML as JSON, so that harness result was rejected and the parser was corrected without changing product or fixture code. The corrected host-network matrix passed all 39 assertions. A clean final fixture was then restarted for review.

## Browser Boundary

The active security policy denies the approved browser surface. No alternate browser surface was used. Desktop, tablet, and mobile rendered direction selection, focus, keyboard, accessibility, pending geometry, containment, overflow, and console claims remain explicitly unaccepted.

## Handoff

CT-71 remains In Progress at intended revision `3`. CT-12 must ingest this checkpoint while retaining its browser blocker; CT-13 must refresh its deterministic release preflight against the reconciled candidate. No outcome or release claim is made.
