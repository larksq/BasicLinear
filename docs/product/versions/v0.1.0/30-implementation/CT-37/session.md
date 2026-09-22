# CT-37 Implementation Session

- Issue: `CT-37`, stable ID `73173adc-e98b-4051-8ba2-eb84ba0483b6`, implementation revision `2`.
- Implementation session: `codex-global-shortcut-safety` / `CT37-IMPL-20260820T051814Z`.
- Scope: prevent global issue-create and Search shortcut collisions, accidental dispatch, and modal stacking.
- Boundary: global keyboard-event eligibility and focused contracts only; no CSS, dimensions, visible copy, data, routing outcomes, pointer behavior, API, schema, authentication, provider, release, identity, or outcome mutation.
- Defect loop: unmodified and modified `C` paths shared the same issue-create branch, while Search could override editable content or stack over another modal. A pure resolver now accepts only exact eligible chords, distinguishes Search from other dialogs, and ignores prevented, repeat, composition, editable, and modal-conflicting paths.
- Test loop: the first focused run exposed a null-target context value that was not strictly boolean. The App binding was corrected, after which the focused contract passed 5 tests and the combined CT-32 through CT-37 slice passed 26 tests.
- Automated result: all 99 complete tests pass; all eight workspaces typecheck; the production build emits 1,919 modules.
- Browser boundary: no CT-37 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied browser outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-37 remains In Progress until desktop and mobile browser verification can exercise exact shortcut chords, editable/dialog isolation, Search toggle and focus return, responsive geometry, overflow, duplicate IDs, and console diagnostics.
- Outcome boundary: implementation output only. CT-12 remains In Progress, and O-001 through O-005 remain pending.
