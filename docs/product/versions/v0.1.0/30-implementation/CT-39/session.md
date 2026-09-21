# CT-39 Implementation Session

- Issue: `CT-39`, stable ID `6544ff13-9f17-4b7b-b41f-3c9be0fe7f81`, implementation revision `2`.
- Implementation session: `codex-project-density` / `CT39-IMPL-20260820T055204Z`.
- Scope: align project-list loaded and loading rows with the accepted compact, default, and comfortable density contract.
- Boundary: project density state, control, loaded rows, loading skeleton, focused contracts, and responsive containment only; no project data, mutation, routing, API, schema, authentication, provider, release, identity, or outcome mutation.
- Defect loop: accepted UX design specifies `32px`, `36px`, and `44px` project-list rows, but the shipped project list and skeleton fixed data rows at `58px` and exposed no density preference. One stored preference now drives exact loaded and loading geometry.
- Review loop: the first combined integration run exposed one stale layout-source assertion that expected the old skeleton call. The assertion now requires the shared density binding, and all verification was rerun cleanly.
- Automated result: the focused contract passes 7 tests, density and layout integration passes 41 tests, the CT-32 through CT-39 semantic slice passes 39 tests, all 112 complete tests pass, all eight workspaces typecheck, and the production build emits 1,921 modules.
- Browser boundary: no CT-39 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-39 remains In Progress until desktop, tablet, and mobile browser verification measures all three loaded and loading densities and exercises persistence, containment, reachability, focus, responsive columns, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
