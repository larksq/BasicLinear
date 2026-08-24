# CT-9 Implementation Session

## Scope

- Control Tower issue: `CT-9`, stable ID `5c6dbd22-82bf-46d4-8e0a-098146b45282`, starting revision `1`, status `Todo`, milestone `S3 Implementation`.
- Completed dependencies: `CT-7` revision `3` and `CT-8` revision `3`, both status `Done`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-008`, `R-009`, `R-010`, `R-011`, `R-103`, `R-104`, `R-105`, `R-110`.
- Tests: `P-T10`, `P-T11`, `P-T12`, `P-T13`.
- Mode: code-mutating daily-work view, search, context, bulk, saved-view, command, keyboard, accessibility, responsive, and performance slice.

## Allowed paths

- Production code and tests under `apps/**` and `packages/**`.
- Operations wiring under `ops/**` only when required for migration or runtime verification.
- CT-9 evidence under `docs/product/versions/v0.1.0/30-implementation/CT-9/**`.
- Local Control Tower request artifacts under `.control-tower/**`.

Discovery, Planning, PMO, and completed implementation artifacts are read-only inputs. Private reference screenshots remain ignored and must not enter product assets, fixtures, or public evidence.

## Intended outputs

1. A versioned filter AST, deterministic workspace-scoped search, and saved view persistence covering layout, grouping, ordering, visible properties, density, and query state.
2. Dense list and board composition with stable geometry, grouping/collapse, configurable properties, bulk selection/actions, and seeded-scale behavior.
3. URL-backed contextual issue detail that preserves list query, grouping, collapse, scroll, selection, and trigger focus across edit, close, and browser history.
4. A global command/search dialog plus the accepted keyboard matrix with deepest-layer Escape recovery, visible focus, and non-editable-key safeguards.
5. Responsive desktop, tablet, and mobile layouts with deterministic clean-room screenshots and accessibility/performance evidence.

## Session record

Actor: Codex in the current user-authorized goal. No sub-agent or external coding agent is used. The project-local Control Tower v0.8 store is the sole issue and milestone authority; provider projection remains disabled and Linear API/MCP is not used.

## Boundary decision

CT-9 composes daily-work surfaces on the persisted CT-7/CT-8 contracts. It may add saved-view/search persistence and narrowly required query/bulk APIs. It does not own canonical export/backup/restore (CT-10), independent security/concurrency acceptance (CT-11), or integrated assistive-technology/performance/recovery acceptance (CT-12). O-002 remains baseline-needed under CT-2 and no outcome is claimed.

## Safety decisions

- Filter input is parsed as a versioned allowlisted AST and compiled to parameterized workspace-scoped SQL; invalid nodes fail visibly and never broaden a query.
- Saved views are workspace-scoped mutable aggregates with revisions and deterministic serialization.
- Bulk mutations require an explicit issue-ID set and expected revision per issue; partial or stale writes return explicit per-item results rather than hiding conflicts.
- URL state owns durable navigation; transient selection, collapse, panel width, scroll restoration, and trigger focus stay client-side.
- Search results contain authorized summaries only. Rich text, comments, tokens, and private evidence never enter logs.

## Output record

- Implemented the accepted filter, saved-view, search, bulk, virtual list/board, URL context, command, keyboard, responsive, accessibility, and performance slice across the 18 production files listed in `changed-files.txt`.
- Preserved every workflow column while ordering teams with visible work first; qualified duplicate status names with their team across groups, filters, and bulk controls.
- Corrected mobile document overflow, desktop split-view scrollbar-gutter overflow, stale external open requests, project URL residue, and adjacent-detail history accumulation found during browser verification.
- Verified the exact final source with 8-workspace typechecking, 14 unit tests, 4 real-PostgreSQL integration tests, six matching migrations, production builds, immutable final images, live readiness, browser interaction, semantics, contrast, responsive screenshots, and a cleaned 2,002-issue performance fixture.
- The p75 application-measured issue-detail readiness result is 79.5 ms with at most 37 mounted issue rows against gates of 100 ms and 70 rows.
- Implementation result is `output_done`; CT-11 and CT-12 retain independent acceptance, CT-10 retains export/recovery, and no outcome is claimed.
