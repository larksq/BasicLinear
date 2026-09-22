# CT-35 Implementation Session

- Issue: `CT-35`, stable ID `d266f22e-39ef-43a8-8c69-753eb860c76a`, implementation revision `2`.
- Implementation session: `codex-board-accessibility` / `CT35-IMPL-20260820T045355Z`.
- Scope: complete the issue board card focus, keyboard, nested-control, and status/priority semantics.
- Boundary: issue board semantics and its focused source contract only; no CSS, dimensions, visible copy, data, ordering, grouping, pointer behavior, API, schema, authentication, provider, release, identity, or outcome mutation.
- Defect loop: every mounted card previously had `tabIndex=0`; navigation keys were absent; nested key events could reach card commands; and status/priority lacked explicit text. The board now uses one roving tab stop per populated column, virtualizer-backed focus movement, guarded card commands, and screen-reader metadata.
- Automated result: the focused board contract passes 4 tests; the combined CT-32/CT-33/CT-34/CT-35 semantic run passes 16 tests; all 89 complete tests pass; all eight workspaces typecheck; the production build emits 1,917 modules.
- Browser boundary: no CT-35 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-35 remains In Progress until final desktop and mobile browser verification can inspect the accessibility tree, roving focus through virtualization, nested-control isolation, responsive geometry, horizontal reachability, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
