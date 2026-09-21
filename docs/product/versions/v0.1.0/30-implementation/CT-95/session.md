# CT-95 Implementation Session

- Issue: `CT-95`, stable ID `6958c749-9489-4287-9135-212a0cd062d2`, created at revision `1`, scoped at revision `2`, intended completion revision `3`.
- Session: `CT95-IMPLEMENT-20260821T122314Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, remote service, external identity, or Google account was used.

## Finding

The accepted project UX requires recoverable archive to be visibly separated from irreversible purge. The current implementation ended at archive/restore: it had no destructive project capability, request/receipt contract, transactional repository operation, API route, client call, confirmation UI, or project-purge regression. An archived project could only be restored.

## Implementation

1. Added `project:purge` to the retained capability model and excluded it from admin, member, and guest roles.
2. Added strict purge request and counted timestamped receipt contracts.
3. Required owner scope, archived state, current revision, and an exact project-name confirmation.
4. Selected every referenced active or archived issue inside the serialized SQLite write, cleared project and milestone references, incremented each issue revision, and recorded paired before/after activity.
5. Recorded project purge activity, removed project and milestone idempotency tombstones, then deleted the project so existing milestone/resource foreign-key cascades run only after issue detachment.
6. Preserved issue identity, title, labels, relations, comments, archive state, and all unrelated fields.
7. Added the authenticated same-origin API route and web client request.
8. Added a distinct archived-only danger action and exact-name dialog that names permanent removal and issue preservation.
9. Closed the invalid project detail route after success, restored list-search focus, refreshed dependent project/issue/milestone/activity reads, and exposed a persistent counted completion status.
10. Added domain, contract-validation, repository, API integration, capability projection, UI-source, and geometry coverage.

## Verification

- Focused domain, repository, API, validation, capability, and UI regression: 6 files, 31 tests passed.
- Complete regression: 62 files, 422 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 109 output files, and 1,890,839 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Loopback readiness after API-process restart: `{"status":"ready"}` at port 4275; the served page references `index-D8DnNmXI.js` and `index-_71zhCk-.css`.
- Rendered browser captures: 0.

## Acceptance Boundary

Repository, API, source, unit, typecheck, build, and loopback evidence establish only the bounded implementation. Chrome extension transport remains unavailable after eight cumulative connection attempts, before any page opened. No archived-only reachability, dialog focus, exact-confirmation feedback, preserved-issue rendered readback, responsive geometry, contrast, or visual-fidelity claim was produced. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, final-brand, license, and clean-room review; CT-13 owns accountable release acceptance.
