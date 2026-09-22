# CT-73 Implementation Session

- Issue: `CT-73`, stable ID `0c4589b2-cb5a-4dea-836a-49be90e7f1b9`, starting revision `2`, intended checkpoint revision `3`.
- Session: `CT73-IMPL-20260821T005004Z`.
- Actor: `codex-workflow-status-inline-edit`.
- Mode: code-mutating implementation checkpoint.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Replace detached status editing with one compact baseline-bound team-row editor without changing the service contract, repository, schema, or capability model. Keep status creation available, calculate its position from the selected team, serialize create and edit operations, re-read authoritative status state after accepted and rejected writes, retain a rejected draft, expose explicit recovery, and restore focus to the initiating control.

## Execution

1. Added a pure workflow-status edit module that copies an isolated draft, validates exact workspace/team scope, and emits only normalized changed name, category, and color fields with the opening expected revision.
2. Rejected no-ops, blank or overlong names, malformed colors, invalid categories, cross-scope records, invalid revisions, and malformed team positions before submission.
3. Replaced the detached edit dialog with a one-at-a-time inline team-row editor while keeping status creation in its existing dialog.
4. Serialized status create and edit controls and retained the existing owner/admin `status:manage` capability boundary.
5. Re-read the authoritative collection after accepted and rejected writes. A rejected edit adopts a confirmed server baseline only after rejection while retaining the submitted draft.
6. Added explicit Retry draft and Use server values recovery, unavailable-record retention, stable feedback, and deterministic focus return to the editor, row action, or create control.
7. Extended the synthetic fixture with two-team reads, scoped create/idempotency, team-name uniqueness, sparse update, stale conflict, no-op, unsupported and invalid rejection, missing and cross-workspace failure, and final convergence behavior.

## Verification

- Focused tests: 2 files / 12 tests passed.
- Complete regression: 51 files / 348 tests passed.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Production build: 1,944 modules, 1,043,629 total bytes, no chunk warning.
- Release-audit regression: 1 file / 2 tests passed.
- Integration runner: 7 files / 17 tests discovered and skipped without a configured test PostgreSQL URL; no database-sensitive path changed and no new database pass is claimed.
- Stateful HTTP fixture: 54 of 54 named assertions passed at port 4199 after sandbox bind and sandbox-local Node connection results were rejected as environment evidence.
- Rendered browser captures and assertions: 0.

## Environment Retry Record

The normal fixture launch on port 4199 failed with sandbox `listen EPERM`; the managed production fixture then launched on the same port. The first complete Node host harness could not connect under sandbox policy and that result was rejected. The approved host-network rerun passed all 54 assertions without changing product or fixture code. The managed fixture remains available for review.

## Browser Boundary

The active security policy denies the approved browser surface. No alternate browser surface was used. Desktop, tablet, and mobile rendered status creation, inline editing, stale recovery, focus, keyboard, accessibility, pending geometry, containment, overflow, and console claims remain explicitly unaccepted.

## Handoff

CT-73 remains In Progress at intended revision `3`. CT-12 must ingest this checkpoint while retaining its browser blocker; CT-13 must refresh its deterministic release preflight against the reconciled candidate. No outcome or release claim is made.
