# CT-45 Implementation Session

- Issue: `CT-45`, stable ID `e440b2d5-3c55-4d10-81a8-516b2be93654`, implementation revision `2`.
- Implementation session: `codex-issue-hierarchy` / `CT45-IMPL-20260820T080745Z`.
- Scope: complete the accepted issue-detail hierarchy contract by separating parent and sub-issue workflows from peer and dependency relations.
- Boundary: pure direction partitioning, issue-detail relation presentation, existing relation mutation controls, focused contracts, and synthetic values only; no issue schema, endpoint, database, relation invariant, CSS, authentication, provider, release, license, identity, or outcome mutation.
- Defect loop: parent and sub-issue rows were mixed into generic relations, while the only hierarchy creation path appeared as an ambiguous `Parent of` option. Detail now presents hierarchy first and exposes an explicit add-existing-sub-issue command.
- Review loop: the complete regression exposed two legacy source-contract assumptions. A first compatibility adjustment restored them but pushed the issue chunk to 500,200 bytes. The final pass moved the count contract to the shared component's loading prop, retained final geometry, reduced the chunk to 499,991 bytes without a warning, and reran all gates; no failed result was discarded.
- Automated result: the focused hierarchy/navigation/conflict/route scope passes 34 tests, the CT-32 through CT-45 semantic slice passes 95 tests, all 166 complete tests pass, all eight workspaces typecheck, and the production build emits 1,926 modules without a chunk warning.
- Browser boundary: no CT-45 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-45 remains In Progress until desktop, tablet, and mobile browser verification exercises actual hierarchy order, direction labels, counts, creation, validation failures, removal, activity, archive guards, navigation, focus, responsive reachability, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
