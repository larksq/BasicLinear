# CT-28 Implementation Session

- Issue: `CT-28`, stable ID `b668e4eb-2e44-44c3-8dd3-a31ecfa081b4`, implementation revision `2`.
- Implementation session: `codex-loading-states` / `CT28-IMPL-20260820T024944Z`.
- Scope: replace spinner-only core-surface loading fallbacks with named final-geometry skeletons, preserve compact mutation spinners, and add deterministic issue-list and direct-detail loading fixtures.
- Boundary: loading presentation, fixture behavior, source contracts, and focused semantics only; no API, schema, authentication, provider, release, license, identity, or outcome mutation.
- Review session: `codex-loading-states-reviewer` / `CT28-REVIEW-20260820T030030Z`.
- Review result: 12 focused tests and 57 complete tests pass; all eight workspaces typecheck; the production build emits 1,916 modules; four final-bundle browser captures show one named busy status, zero focusable skeleton nodes, zero positive horizontal overflow, zero outside controls, zero duplicate IDs, no incoherent overlap, and no console warning or error.
- Browser boundary: the review used the Codex in-app browser against the local synthetic fixture at `127.0.0.1:4180`; it did not use an authenticated Linear surface or claim a new Chrome run. Browser captures were normalized to real PNG containers without resizing.
- Outcome boundary: implementation output only. CT-12 remains In Progress behind CT-21/P-T21, and O-001 through O-005 remain pending.
