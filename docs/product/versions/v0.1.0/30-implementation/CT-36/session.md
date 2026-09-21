# CT-36 Implementation Session

- Issue: `CT-36`, stable ID `fa21d313-bddc-4c33-baf5-c783c85a643d`, implementation revision `2`.
- Implementation session: `codex-dynamic-issue-focus` / `CT36-IMPL-20260820T050611Z`.
- Scope: preserve the single roving tab stop by stable issue identity across dynamic list and board collections.
- Boundary: issue record focus resolution and focused contracts only; no CSS, dimensions, visible copy, data, ordering, grouping, selection, pointer behavior, API, schema, authentication, provider, release, identity, or outcome mutation.
- Defect loop: list and board focus state previously tracked virtual array positions. Collection changes could assign the tab stop to a different issue or leave no issue record tabbable. Both layouts now resolve a preferred stable issue ID with active/first-visible fallback and record navigation targets before virtualizer focus.
- Test loop: the focused contract passed 5 tests. The first combined semantic run exposed one stale CT-35 source assertion that required index-based state; the assertion was updated to the stronger stable-ID contract, after which the combined slice passed 21 tests.
- Automated result: all 94 complete tests pass; all eight workspaces typecheck; the production build emits 1,918 modules.
- Browser boundary: no CT-36 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-36 remains In Progress until desktop and mobile browser verification can inspect focus identity through reorder, filter, collapse, refresh, and virtualization plus accessibility tree, responsive geometry, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
