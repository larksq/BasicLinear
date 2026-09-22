# CT-44 Implementation Session

- Issue: `CT-44`, stable ID `c91d1bc0-698b-4e7f-8d4c-8e4191fcac23`, implementation revision `2`.
- Implementation session: `codex-issue-navigation-context` / `CT44-IMPL-20260820T075042Z`.
- Scope: complete the accepted issue list/detail context-preservation contract for virtual scroll and first-trigger focus recovery.
- Boundary: issue-view client refs, pure scroll policy, existing list and board virtual scroll owners, route history focus state, focused contracts, and synthetic values only; no issue schema, mutation endpoint, database, relation semantics, saved-view contract, authentication, provider, release, license, identity, or outcome mutation.
- Defect loop: route detail unmounted the list or board and discarded their internal scroll offsets, while detail-to-detail relation navigation replaced the initiating row identity. The parent now retains context-keyed offsets and the first origin outside route presentation.
- Review loop: source review found that a later direct history entry could inherit a completed contextual origin. The final pass clears origin only for direct `popstate` entries, preserves the contextual back path, and reran focused verification before the final broad gates; no failed result was discarded.
- Automated result: the focused navigation/route/roving scope passes 20 tests, the CT-32 through CT-44 semantic slice passes 87 tests, all 158 complete tests pass, all eight workspaces typecheck, and the production build emits 1,925 modules.
- Browser boundary: no CT-44 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-44 remains In Progress until desktop, tablet, and mobile browser verification exercises actual virtual scroll restoration, context invalidation, related-detail chains, history, focus, responsive reachability, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
