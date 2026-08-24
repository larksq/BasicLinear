# CT-93 Implementation Session

- Issue: `CT-93`, stable ID `bc7e3113-d398-4c04-a67c-d0d2223db3f2`, created at revision `1`, scoped at revision `2`, intended completion revision `3`.
- Session: `CT93-IMPLEMENT-20260821T112846Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, remote service, external identity, or Google account was used.

## Finding

The accepted UX states contract requires an offline and reconnect state on every surface. Only Issues observed `navigator.onLine`, which describes external connectivity rather than the same-origin loopback service. Projects, Views, Workflow, command search, and bootstrap had no shared service state. An initial session transport failure could also fall through to owner provisioning, and TanStack Query's default network mode could pause localhost requests while the loopback process remained healthy.

## Implementation

1. Added one typed same-origin request boundary that normalizes fetch rejection to a stable local-service transport error.
2. Added a readiness probe limited to `/health/ready`, using same-origin credentials and no-store caching.
3. Configured all web queries and mutations with `networkMode: 'always'` so localhost behavior is independent of `navigator.onLine`.
4. Added a low-frequency healthy probe and faster failure probe, plus a native `Try now` action.
5. Kept the workspace mounted when cached session data exists, preserving lists, detail context, navigation, and drafts during service interruption.
6. Separated service and session failures from the exact `AUTHENTICATION_REQUIRED` state, preventing false owner provisioning.
7. Added one app-wide assertive disconnect alert and one time-bounded polite reconnect status.
8. Invalidated active non-health queries once after recovery so authoritative data refreshes without a reload.
9. Removed the misleading issue-only browser-network banner and listeners.
10. Added stable desktop/mobile banner geometry, long-message containment, and focused API/component/source coverage.

## Verification

- Focused local-service recovery regression: 1 file, 6 tests passed.
- Complete regression: 60 files, 410 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,947 modules, 109 output files, and 1,874,334 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Loopback readiness: `{"status":"ready"}` at port 4275; the served page references `index-B_cOWNaR.js` and `index-DpGYXKwV.css`.
- Rendered browser captures: 0.

## Acceptance Boundary

Source, unit, typecheck, build, and loopback evidence establish only the bounded implementation. Chrome extension transport remained unavailable on the seventh cumulative connection attempt, before any page opened. No disconnect/reconnect announcement, retry focus, retained-draft rendering, restored-data, responsive geometry, contrast, or visual-fidelity claim was produced. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, final-brand, license, and clean-room review; CT-13 owns accountable release acceptance.
