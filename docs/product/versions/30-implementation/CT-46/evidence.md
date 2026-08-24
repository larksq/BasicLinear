# CT-46 Issue Resource Evidence

## Verdict

`IMPLEMENTED_AWAITING_DATABASE_AND_BROWSER_VERIFICATION`. Ordered issue resources now cross the public contract, transactional repository, workspace-isolated schema, canonical recovery format, API evidence, create workflow, issue detail, activity history, and deterministic fixture. PostgreSQL-backed execution and rendered desktop, tablet, and mobile acceptance remain open.

## Correction

- Issue create and update accept at most 50 labeled HTTP(S) resources. The repository trims labels, rejects empty labels, normalizes URLs, and rejects credentials or non-HTTP(S) schemes before mutation.
- `app.issue_resources` keeps stable IDs and explicit positions, cascades with its issue, forces workspace-member row-level security, and grants only the established application role operations.
- Issue list and detail reads return ordered resources. Create and revision-bound update replace resources in the same transaction as the issue mutation and record normalized before/after values in activity.
- Canonical workspace export, import, database backup, restore, sorting, digesting, shape validation, duplicate-ID rejection, and reference validation include issue resources.
- A review-found upgrade defect is fixed: a verified pre-007 backup no longer queries a table that does not exist in the source schema. Pre-007 snapshots emit an empty resource collection, while current snapshots require and read migration 007.
- Issue creation supports resources. Issue detail places Resources after hierarchy and peer relations and before comments, exposes named add/edit/remove controls, preserves resource drafts through the existing optimistic-conflict recovery, and removes mutation controls from archived issues.
- The first production build pushed the issues chunk to 503.68 kB and triggered Vite's 500 kB warning. Editor dependencies are now isolated in a 402,713-byte chunk; the issues chunk is 112,005 bytes and the warning is absent without raising `chunkSizeWarningLimit`.

## Automated Verification

| Check | Result |
|---|---|
| Focused canonical and issue-resource contract | 2 files, 10 tests passed |
| Complete unit regression | 27 files, 172 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,926 modules; CSS 71,615 bytes; projects 37,200 bytes; index 267,483 bytes; issues 112,005 bytes; editor 402,713 bytes; no chunk warning |
| PostgreSQL integration runner | 6 files and 16 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |

The skipped integration result is not a pass. The unexecuted database cases cover migration 007, workspace RLS, create/update/readback, invalid-URL atomicity, activity, restart persistence, canonical round trip, backup/restore, and verified pre-007 backup followed by upgrade. No database-backed result is inferred from source, unit, typecheck, or build output.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Issue create, list, detail, revision-bound update, archive state, and activity now carry ordered resources in the existing issue aggregate. |
| R-007 | Resource changes appear in issue activity with normalized before and after values and no credential-bearing URL acceptance through the repository. |
| R-013 | Migration 007, canonical transfer, backup, restore, migration compatibility, and the pre-007 backup branch preserve the self-hosted ownership and recovery contract. |
| R-107 | Resource rows are workspace-scoped, force RLS, cascade through the composite issue reference, and are included in the security table inventory. |
| R-110 | Resources occupy the accepted issue-detail order and reuse the existing unframed secondary-section geometry; the editor split restores the accepted build budget. Rendered geometry remains required. |

## Pending Database Matrix

Run the existing integration suite against an isolated PostgreSQL admin URL and application password. It must prove a clean migration, a populated 006 database with a matching verified backup followed by migration 007, resource RLS and cross-workspace denial, normalized ordered create/update/readback, invalid URL rollback without revision drift, activity evidence, restart persistence, export/import digest equality, and backup/restore digest equality.

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must exercise no resources, one resource, 50 resources, add, edit, remove-all, invalid label, invalid URL, stale revision recovery, archive read-only state, external-link activation, create-dialog resources, activity rendering, route and panel contexts, keyboard focus, and zero overlap, uncontained overflow, duplicate IDs, hidden focus, console warnings, or console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-46, complete CT-12, pass the database-backed P-T08/P-T09/P-T14 paths, pass rendered P-T19, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
