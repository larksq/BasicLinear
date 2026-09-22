# CT-46 Implementation Session

- Issue: `CT-46`, stable ID `6b7ae26d-563d-4b3a-9d3c-c576abdf1c12`, implementation revision `3`.
- Implementation session: `codex-issue-resources` / `CT46-IMPL-20260820T084337Z`.
- Scope: close the accepted issue-resource gap across the typed issue aggregate, migration, repository, API evidence, canonical transfer and recovery, issue create/detail UI, activity, deterministic fixture, and production chunk budget.
- Boundary: repository source and synthetic values only; no authenticated Linear observation, provider mutation, external identity, public-name, license, legal, browser-policy, clean-host, or outcome decision.
- Review loop: the first production build passed but emitted a 503.68 kB issues chunk and Vite warning. The implementation split rich-text editor dependencies without raising the warning threshold, producing a 112,005-byte issues chunk and a 402,713-byte editor chunk with no warning.
- Upgrade loop: source review found that a pre-007 backup verified during populated migration would query `app.issue_resources` before the table existed. Snapshot reads are now migration-aware, and the integration scenario constructs a valid 006 backup, verifies it against a populated 006 state, applies 007, and checks that existing issues remain.
- Automated result: the focused canonical/resource scope passes 10 tests, all 172 complete tests pass, all eight workspaces typecheck, and the 1,926-module production build passes without a chunk warning.
- Database boundary: the PostgreSQL integration runner started successfully but skipped all 6 files and 16 tests because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Migration, RLS, API persistence, restart, transfer, backup/restore, and upgrade scenarios are therefore not claimed as executed.
- Browser boundary: no CT-46 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-46 remains In Progress until isolated PostgreSQL execution and desktop, tablet, and mobile browser verification pass.
- Outcome boundary: implementation output only. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
