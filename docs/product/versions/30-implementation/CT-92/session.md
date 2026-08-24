# CT-92 Implementation Session

- Issue: `CT-92`, stable ID `a20d5002-2055-4507-8e12-78527a6b5e44`, created and scoped at revision `1`, intended completion revision `2`.
- Session: `CT92-IMPLEMENT-20260821T110000Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, external identity, or Google account was used.

## Finding

The accepted UX states contract requires recoverable errors on every core surface. Initial query failures in Projects, Issues, and saved views could render a generic error and then fall through to a false empty collection. Project and issue detail subsections exposed dead-end errors without a local retry. Owner context and command search also lacked explicit recovery, and some read errors shared feedback with mutations.

## Implementation

1. Added one shared query-error state with a named alert, error message, optional API correlation identifier, and native retry button.
2. Split initial blocking failures from stale-data failures by checking whether query data exists.
3. Made owner context, command search, Projects, saved views, and Issues retry the exact failed read set.
4. Added local recovery for project detail, milestones, and activity plus issue detail, milestones, relationships, comments, and activity.
5. Prevented failed collection reads from exposing false empty results or their contextual empty-state actions.
6. Preserved stale data during background failures and kept mutation feedback in its existing action context.
7. Kept Back, close, Escape, view configuration, and permission contracts intact.
8. Added stable desktop and mobile geometry, long-message containment, and focused component/source coverage.

## Verification

- Focused query-error regression: 1 file, 5 tests passed.
- Complete regression: 59 files, 404 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,947 modules, 109 output files, and 1,870,112 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Loopback readiness: `{"status":"ready"}` at port 4275; the served page references `index-C5DDgwqD.js` and `index-BD3_gNaP.css`.
- Rendered browser captures: 0.

The first complete regression exposed two established capability-source bindings. Comment creation now remains permission-bound and is hidden only during its blocking comments read; new-view creation remains available because it does not depend on the saved-view collection read. The final complete regression passed without changing existing contract tests.

## Acceptance Boundary

Source, unit, typecheck, build, and loopback evidence establish the bounded recovery implementation only. Chrome extension transport remained unavailable on the sixth cumulative connection attempt, and execution-time authorization is required to open the selected authenticated profile. No retry focus, live announcement, stale-data rendering, responsive error geometry, contrast, or visual-fidelity claim was produced. CT-12 owns rendered acceptance; CT-82 owns independent clean-revision runtime acceptance; CT-3 owns public identity, license, brand, and clean-room review; CT-13 owns accountable release acceptance.
