# CT-47 Implementation Session

- Issue: `CT-47`, stable ID `aa72195b-c2d5-45b2-956e-3421aacc8dc0`, implementation revision `2`.
- Implementation session: `codex-project-rich-overview` / `CT47-IMPL-20260820T092354Z`.
- Scope: close the accepted rich-project-overview gap across the public document contract, repository validation and activity, migration, populated upgrade, canonical recovery, project create/edit/detail UI, and deterministic fixture.
- Boundary: repository source and synthetic values only; no authenticated Linear observation, provider mutation, external identity, public-name, license, legal, browser-policy, clean-host, or outcome decision.
- Contract loop: executable schema coverage found that the first recursive representation allowed `text` on a paragraph. The final discriminated node schema rejects legacy and structurally invalid nodes at the public boundary.
- Activity loop: source review found that redacted summaries cannot safely determine semantic equality. The final repository deep-compares normalized documents and redacts only the activity payload, preserving same-shape and same-length edits.
- Upgrade loop: migration 008 converts legacy paragraph strings to semantic paragraph/text nodes. The integration scenario builds a matching verified pre-008 backup, requires it for the populated migration, and checks exact conversion without revision, order, or timestamp drift.
- Automated result: 3 focused files and 15 tests pass, all 29 files and 179 complete tests pass, all eight workspaces typecheck, and the 1,926-module production build passes without a chunk warning.
- Database boundary: the PostgreSQL integration runner started successfully but skipped all 6 files and 16 tests because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Migration, persistence, activity, restart, transfer, backup/restore, and populated upgrade scenarios are therefore not claimed as executed.
- Browser boundary: no CT-47 browser assertion or screenshot is claimed. Access to the local browser surface remains denied by the active security policy, and the denied outcome was not retried through another browser surface.
- Status boundary: implementation is complete but CT-47 remains In Progress until isolated PostgreSQL execution and desktop, tablet, and mobile browser verification pass.
- Outcome boundary: implementation output only. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
