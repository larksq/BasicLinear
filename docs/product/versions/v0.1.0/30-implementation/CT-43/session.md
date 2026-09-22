# CT-43 Implementation Session

- Issue: `CT-43`, stable ID `3e7c53ff-847c-4674-a753-d9b9a6fc6120`, implementation revision `2`.
- Implementation session: `codex-issue-conflict-recovery` / `CT43-IMPL-20260820T072535Z`.
- Scope: complete the accepted stale issue edit recovery, confirmed server-state restoration, retained-draft, explicit reapply/discard, and focus contract.
- Boundary: issue-detail client state, pure conflict policy, existing issue edit form defaults, responsive notice geometry, focused contracts, and synthetic API orchestration only; no issue schema, mutation endpoint, database, relation, comment, activity, saved view, authentication, provider, release, license, identity, or outcome mutation.
- Defect loop: the API already rejected stale revisions, but the form left rejected values visible and exposed only a generic error. Recovery now requires a fresh authorized readback, shows confirmed server values, retains the attempted draft, and requires an explicit non-submitting Reapply or Discard choice.
- Review loop: source review found an event-refetch race and an archived-control focus edge. The final pass advances only open conflict state to the latest confirmed revision, pins explicitly reapplied drafts against silent remounts, and falls back to the Archive/Restore action when the title is disabled. All focused and broad verification was rerun after the final correction; no failed result was discarded.
- Automated result: the focused conflict/route/state scope passes 19 tests, the CT-32 through CT-43 semantic slice passes 91 tests, all 147 complete tests pass, all eight workspaces typecheck, and the production build emits 1,924 modules.
- Browser boundary: no CT-43 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-43 remains In Progress until desktop, tablet, and mobile browser verification exercises actual stale writes, confirmed fields, announcements, draft actions, second-save behavior, event races, focus, generic errors, responsive reachability, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
