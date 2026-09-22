# CT-96 Implementation Session

- Issue: `CT-96`, stable ID `64b51645-3eb0-49e9-a81e-ad6fa9a8d8bf`, created at revision `1`, scoped at revision `2`, intended completion revision `3`.
- Session: `CT96-IMPLEMENT-20260821T125558Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, remote service, external identity, or Google account was used.

## Finding

The accepted milestone journey requires linked issues to remain visible with an auditable change when a milestone is removed. The current implementation ended at archive/restore and exposed no individual milestone purge. Removing the entire parent project was the only destructive path.

## Implementation

1. Added owner-only `milestone:purge` capability and strict request and receipt contracts.
2. Required archived state, current revision, and exact milestone-name confirmation.
3. Selected every linked active or archived issue inside one serialized SQLite write, cleared only `milestoneId`, incremented each revision, and recorded before/after activity.
4. Preserved project membership, identity, content, labels, relations, comments, resources, archive state, and unrelated issue fields.
5. Recorded counted `milestone.purged` activity on the parent project so the event survives milestone deletion.
6. Removed milestone idempotency tombstones and deleted the milestone in the same transaction.
7. Added the authenticated same-origin route and client request.
8. Added the archived-only owner action and exact-name dialog naming permanent removal and issue preservation.
9. Cleared matching milestone route context, refreshed dependent reads, restored adjacent-row or archived-toggle focus, and exposed visible counted completion feedback.
10. Added domain, repository, API, validation, capability-projection, UI-source, focus/query, and geometry coverage.

## Verification

- Focused domain, repository, API, validation, capability, and UI regression: 6 files, 32 tests passed.
- Complete regression: 63 files, 428 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,948 modules, 109 output files, and 1,902,251 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Isolated production process: `ready` at port 4276, serving `index-GpJbqAul.js` and `index-vO8y3zKJ.css` from a temporary local data directory while the existing port-4275 process remained untouched.
- Live API workflow: active purge rejected with HTTP 400; archived exact-name purge returned a one-issue receipt; issue readback retained the project at revision 2 with no milestone; milestone readback was empty; project activity retained the counted purge event.
- Rendered browser captures: 0.

## Acceptance Boundary

Repository, API, source, unit, typecheck, build, and loopback evidence establish only the bounded implementation. Chrome extension transport remains unavailable after eight cumulative connection attempts, before any page opened. No archived-only rendered reachability, dialog focus, exact-confirmation feedback, preserved-issue rendered readback, URL-context recovery, responsive geometry, contrast, or visual-fidelity claim was produced. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, final-brand, license, and clean-room review; CT-13 owns accountable release acceptance.
