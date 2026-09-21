# CT-7 Implementation Session

## Scope

- Control Tower issue: `CT-7`, stable ID `e6494481-51bb-4c90-a148-41eb1d4a92cf`, starting revision `1`, status `Todo`, milestone `S3 Implementation`.
- Completed dependency: `CT-6`, stable ID `7d88459a-3877-4bc0-b628-0d6ed6031558`, revision `3`, status `Done`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-003`, `R-004`, `R-007`.
- Tests: `P-T06`, `P-T07`.
- Mode: code-mutating project and milestone vertical slice.

## Allowed paths

- Production code and tests under `apps/**` and `packages/**`.
- Operations wiring under `ops/**` only when required for the new migration or runtime verification.
- CT-7 evidence under `docs/product/versions/v0.1.0/30-implementation/CT-7/**`.
- Local Control Tower request artifacts under `.control-tower/**`.

Discovery, Planning, PMO, CT-4, and CT-6 artifacts are read-only inputs. Private reference screenshots remain ignored and must not enter product assets or public evidence.

## Intended outputs

1. Workspace-scoped project persistence for create, read, edit, archive, restore, search, filtering, and deterministic ordering.
2. Full project metadata, resources, overview content, and revision-safe activity semantics.
3. Ordered milestone CRUD with target dates and deterministic keyboard-accessible reorder operations.
4. A versioned issue-assignment and progress projection boundary that CT-8 can populate without making progress independently mutable.
5. Product surfaces for a dense project list and unframed project overview, plus schema, domain, integration, restart, and browser evidence.

## Session record

Actor: Codex in the current user-authorized goal. No sub-agent or external coding agent is used. The project-local Control Tower v0.8 store remains the only work authority; all provider projections remain disabled.

## Boundary decision

CT-7 owns project and milestone aggregates plus the read-only assignment/progress projection contract. CT-8 owns issue creation and mutation. CT-7 tests progress deterministically through schema fixtures and repository reads so the formula is fixed before CT-8 attaches the full issue model.

## Actual outputs

- Added migration `004_projects_milestones.sql` with workspace/team-safe project and milestone aggregates, ordered resources, an issue progress projection boundary, security-invoker progress views, composite constraints, and forced workspace RLS.
- Implemented revision-safe project and milestone repositories plus API contracts/routes for create, read, update, search, filter, order, archive, restore, activity, and exact-set reordering.
- Fixed progress policy `project-progress-v1`: completed divided by non-canceled eligible assignments, with zero eligible assignments producing zero and no writable progress field.
- Added a dense project list, document-like project overview, properties, resources, milestones, activity, keyboard row navigation, keyboard reorder commands, accessible dialogs, and reduced responsive columns.
- Ran the production images at `http://localhost:4175`, retained the authenticated Northstar workspace, and created only synthetic QA projects, milestones, and progress projections.

## Review and corrections

The first project PATCH was rejected because intersected TypeBox schemas retained incompatible inner `additionalProperties` rules; the contract was corrected and the regression passed. The first test harness query used the maintenance database after setup; it was switched to the migration database. Chrome then exposed two quality issues: JSONB key ordering and regenerated resource IDs produced false audit changes, and the 1024px milestone grid caused document-wide horizontal overflow. Semantic deep comparison/no-op rejection and an intermediate responsive breakpoint corrected both. The final status-only edit records only `status`, and the final 1024px captures have no horizontal scrollbar or clipped command.

## Validation record

- `npm run typecheck`: pass across 8 workspaces.
- `npm test`: pass, 11 tests across 3 files.
- `npm run build`: pass; web bundle 283.94 kB / 83.60 kB gzip without source maps.
- Dockerized real-PostgreSQL integration: pass, 2 test files and 2 end-to-end cases covering project/milestone CRUD, query/order/archive/restore, idempotency, stale and no-op conflicts, progress changes, workspace isolation, composite constraints, atomic activity/outbox writes, and restart persistence.
- Exact final operator migration plan: 4/4 applied with matching digests.
- Live readiness: HTTP 200; running API/web/database logs contain no flagged warning, error, fatal, or 5xx entry.
- Chrome: pass at 390x844, 768x800, 1024x768, and 1440x900; 0 duplicate IDs, 0 unnamed buttons, keyboard J/Enter navigation passes, dialog Escape focus return passes, archive/restore and manual reorder pass.

## Failure and exception history

The initial web-container replacement made the internal-only network primary, so host ingress was unavailable even though Nginx was healthy. Recreating the stopped container with the edge network primary and attaching the internal network before startup restored localhost ingress. An in-sandbox curl then produced a false negative; the approved host-network probe returned 200. The existing Docker Desktop mount limitation from CT-6 remains unchanged, so the live verification database still uses its container writable layer while the production Compose definition retains the required named volume. Clean-host named-volume qualification remains owned by CT-10 and CT-12.

## Handoff boundary

CT-7 implementation output is complete. CT-8 may populate the versioned issue progress projection while implementing issue CRUD, relations, list/board views, and bulk operations. CT-9 remains blocked on CT-8, and independent security/integrated acceptance remain owned by CT-11 and CT-12. No outcome metric is claimed by this implementation issue.
