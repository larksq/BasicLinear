# CT-31 Implementation Session

- Issue: `CT-31`, stable ID `dc56327b-4ceb-45a5-889f-dabb0de58988`, implementation revision `2`.
- Implementation session: `codex-dialog-accessibility` / `CT31-IMPL-20260820T040139Z`.
- Scope: give every shared modal dialog the accessible name already rendered as its visible title.
- Boundary: the shared dialog title association and its source contract only; no dialog layout, focus algorithm, API, schema, authentication, provider, release, license, identity, or outcome mutation.
- Review session: `codex-dialog-accessibility-reviewer` / `CT31-REVIEW-20260820T040657Z`.
- Defect loop: CT-30 browser review found visible `New issue for Interaction acceptance` text but zero matching named-dialog roles. The shared component now uses one React-generated ID for both `aria-labelledby` and the visible `h2`.
- Review result: the focused layout contract passes 7 tests; the combined CT-30/CT-31 focus run passes 16 tests; all 73 complete tests pass; all eight workspaces typecheck; the production build emits 1,916 modules.
- Browser assertions: named-dialog role lookup changed from 0 to 1 at both 1440x900 and 390x844; the label reference resolves to the visible heading; initial focus remains on the title input; the close control leaves zero open dialogs and restores focus to `New issue`; captures have zero positive horizontal overflow and zero duplicate IDs, with zero console warnings or errors.
- Browser boundary: review used the Codex in-app browser against the local synthetic fixture at `127.0.0.1:4180`; it did not use authenticated Linear data or claim a new Chrome run.
- Outcome boundary: implementation output only. CT-12 remains In Progress behind CT-21/P-T21, and O-001 through O-005 remain pending.
