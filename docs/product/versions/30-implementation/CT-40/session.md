# CT-40 Implementation Session

- Issue: `CT-40`, stable ID `47084bfe-cb67-4c91-8e9a-05636f7b8c34`, implementation revision `2`.
- Implementation session: `codex-issue-loading-geometry` / `CT40-IMPL-20260820T060944Z`.
- Scope: make issue loading states reserve the selected list or board geometry, density, and list-property tracks.
- Boundary: loading markup, loading geometry, selected view-state binding, focused contracts, and responsive data-region overflow only; no issue data, queries, saved-view mutation, loaded virtualization, record actions, routing, API, schema, authentication, provider, release, identity, or outcome mutation.
- Defect loop: loaded issue-list rows implement the accepted `32px`, `36px`, and `44px` densities, but loading fixed all rows at `44px`; selected Board still rendered a table skeleton. One selected view state now chooses exact list rows or board cards and the correct surface structure.
- Review loop: source review found hard-coded list placeholder count/tracks despite configurable properties and ineffective child-owned board overflow. The final pass derives count/tracks from visible properties and places explicit scrolling on the bounded named board-loading region.
- Automated result: the focused contract passes 8 tests, loading and layout integration passes 34 tests, the CT-32 through CT-40 semantic slice passes 47 tests, all 122 complete tests pass, all eight workspaces typecheck, and the production build emits 1,921 modules.
- Browser boundary: no CT-40 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-40 remains In Progress until desktop, tablet, and mobile browser verification measures list and board loading geometry and exercises saved state, property tracks, transitions, semantics, scrolling, focus, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
