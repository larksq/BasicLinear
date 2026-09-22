# CT-74 Implementation Session

- Issue: `CT-74`, stable ID `37d5cc1f-0da7-4c76-b8c3-aadafb38401b`, starting revision `2`, intended checkpoint revision `3`.
- Session: `CT74-IMPL-20260821T012557Z`.
- Actor: `codex-workflow-status-reorder`.
- Mode: code-mutating implementation checkpoint.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Add atomic team-scoped workflow status ordering to the existing service and expose it through compact pointer controls and named keyboard alternatives. Keep the last confirmed order visible during submission, bind every request to the complete opening set and revisions, serialize create/edit/reorder work, re-read authoritative state after accepted and rejected writes, and restore focus to the moved row or recovery control.

## Execution

1. Added a repository transaction that authorizes `status:manage`, validates exact workspace/team scope, locks the team order domain, requires every current status exactly once, verifies every revision before mutation, rejects no-ops, normalizes positions to 100-point increments, and increments only changed rows.
2. Added the team-scoped reorder API route using the existing strict reorder request schema and production response envelope.
3. Recorded one revision-bearing activity and outbox event per changed status inside the same transaction and returned the authoritative sorted team order.
4. Added pure move/drop helpers with exact-scope and revision validation, a six-pixel pointer pickup threshold, before/after targets, one-based announcements, and boundary-safe keyboard movement.
5. Added pointer-only drag handles plus named Move up and Move down controls. Owner/admin controls remain capability-gated while member/guest projections remain read-only.
6. Kept committed order visible until acceptance, retained the complete opening baseline across background refetches, re-read after success and failure, exposed stable recovery feedback, and restored focus deterministically.
7. Extended the synthetic fixture with a production-shaped atomic reorder endpoint, exact scope/full-set/revision validation, normalized positions, secondary-team isolation, concurrent edit conflicts, and a clean unique-ID seed.

## Verification

- Focused tests: 2 files / 20 tests passed.
- Complete regression: 52 files / 363 tests passed.
- Typecheck: all 8 workspaces passed.
- Fixture syntax: passed.
- Production build: 1,945 modules, 1,051,564 total bytes, no chunk warning.
- Release-audit regression: 1 file / 2 tests passed.
- Current-source PostgreSQL integration: 7 files / 17 tests passed in an isolated harness on the existing governed verification stack; credentials remained in process memory and redacted output only.
- Stateful HTTP fixture: a clean final run passed 45 of 45 named assertions on port 4200.
- Rendered browser captures and assertions: 0.

## Retry And Correction Record

The sandbox fixture launch failed with `listen EPERM`, so the managed host fixture was used. The first host harness assumed a bare response body instead of the production `{data: ...}` envelope and was rejected as harness evidence. An initial 43-assertion run did not include an ID-uniqueness check; source review then found and corrected a synthetic cross-team UUID collision. The expanded clean matrix passed 45 of 45. A later recapture against the already-mutated long-lived fixture correctly rejected a semantic no-op; that non-clean result was rejected, the fixture was restarted, and the clean 45-of-45 matrix passed again.

The first database attempt stopped before test discovery because a reused Vite cache was not writable. The second stopped before test discovery because the intentionally source-only harness lacked compiled workspace exports. After correcting only the isolated harness cache and building the copied current source, all 17 integration tests passed without a product change.

## Browser Boundary

The active security policy denies the approved browser surface. No alternate browser surface was used. Desktop, tablet, and mobile rendered ordering, mouse/touch/pen thresholds, focus, keyboard parity, accessibility announcements, responsive containment, overflow, and console claims remain explicitly unaccepted.

## Handoff

CT-74 remains In Progress at intended revision `3`. CT-12 must ingest the current automated, database, and host evidence while retaining its browser blocker; CT-13 must refresh deterministic release preflight against the reconciled candidate. No outcome or release claim is made.
