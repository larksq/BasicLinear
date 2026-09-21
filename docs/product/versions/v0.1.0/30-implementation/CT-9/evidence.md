# CT-9 Dense Views, Search, Context, and Keyboard Evidence

## Verdict

`OUTPUT_DONE_FOR_CT11_CT12` on 2026-08-20. CT-9 delivers the versioned issue-view model, allowlisted filter compiler, saved views, workspace-scoped ranked search, explicit-result bulk mutations, virtualized list and board layouts, URL-backed split detail context, command search, accepted keyboard workflows, responsive geometry, code splitting, and seeded-scale performance controls.

This is implementation evidence. It does not claim CT-10 export/backup/restore, CT-11 independent security and concurrency acceptance, CT-12 integrated accessibility/fidelity/performance/recovery acceptance, or any Discovery outcome. O-002 remains baseline-needed under CT-2.

The repository is unborn and has no Git `HEAD`. Evidence is bound to Control Tower issue `CT-9` implementation revision `2`, expected completion revision `3`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, changed-files manifest SHA-256 `32ce36e3767b054c55ec04e9d4f1ba009d1a898b41503e22d9344eb45489607d`, production-file aggregate SHA-256 `3f2db4908b512b2adc7c8dab494d8a08ba0b2238820bc3e72e3e6a6f3d822c0d`, and package-lock SHA-256 `b45d7131ab518b5d6c00bc0c42c86115e59d943462b650beab831b5cfa66eaea`.

## Delivered Boundary

- Issue view state is a normalized versioned contract covering filter AST, search query, layout, grouping, ordering, density, visible properties, archive scope, and collapsed groups.
- Filter clauses are allowlisted and compiled to parameterized, workspace-scoped SQL. Invalid nodes reject visibly instead of broadening the query.
- Saved views are private or workspace-visible, owner-controlled, revision-safe, archiveable, restorable, and URL-addressable.
- Workspace search ranks authorized issue and project summaries. Search does not log queries, rich text, comments, or submitted values.
- Bulk mutations require an explicit issue set plus expected revision per item and return `updated`, `conflict`, or `failed` results independently.
- List and board modes preserve fixed row/card geometry, grouping, collapse, density, ordering, properties, selection, and archive state. Teams containing visible work lead workspace-wide boards while empty workflow columns remain present.
- The list and each board column use `@tanstack/react-virtual`; a 2,002-issue fixture mounted at most 37 issue rows during the recorded run.
- Detail context is encoded in the URL. The first list-to-detail transition pushes history, adjacent issue changes replace that detail entry, and close returns directly to the preserved list state with trigger focus restored.
- Global command search, `/`, `F`, `B`, `J/K`, arrows, Space, Enter, and Escape respect editable targets and deepest-layer recovery.
- Route-level lazy loading separates the application shell, projects, and issues bundles. No emitted JavaScript chunk exceeds 500 kB.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass across 8 workspaces |
| `npm test` | Pass, 3 files and 14 tests |
| Exact final PostgreSQL integration image | Pass, 4 files and 4 tests |
| `npm run build` | Pass; shell 264.80 kB, projects 27.90 kB, issues 481.43 kB, CSS 46.24 kB |
| Dependency installation audit | Pass, 0 vulnerabilities |
| Exact migration state | Pass, 6/6 applied with matching digests |
| Live readiness | HTTP 200 through `http://localhost:4175` |
| Running containers | API, web, and database running with 0 restarts on recorded images |
| Runtime/browser logs | No error-level API entry, no HTTP 5xx, and no browser warning or error |
| Saved-view lifecycle | Create/select/persist/reload/archive/restore pass |
| Bulk mutation | `1 updated, 0 conflicts, 0 failed`; priority restored to original value |
| Search/command | Scoped `PRO-1` result and project navigation pass |
| History/focus | Adjacent detail replacement, direct close, list return, and trigger-focus restoration pass |
| Keyboard matrix | `/`, `F`, `B`, `J`, Space, Enter, and Escape pass |
| Responsive review | Pass at 390x844, 768x1024, and 1440x1000 |
| Overflow review | Document/main/table/list overflow all 0 at their applicable viewports |
| Accessibility semantics | 71 visible controls, 0 unlabeled, 0 duplicate IDs, 0 heading skips, one main and one nav |
| Dark-theme contrast | Primary 4.71:1, hover 5.66:1, muted text 6.49:1, primary text 15.18:1 |

## Performance Gate

A temporary deterministic fixture added 2,000 issues to the two persisted QA issues. It was measured in the production container at 1440x1000, then deleted and verified absent.

| Metric | Result | Gate |
|---|---:|---:|
| Fixture size | 2,002 issues | 2,000+ |
| Initially mounted issue rows | 28 | <= 70 |
| Maximum mounted issue rows during sampling | 37 | <= 70 |
| Adjacent detail-ready samples | 20 | recorded |
| p50 | 61.9 ms | informational |
| p75 | 79.5 ms | <= 100 ms |
| p95 | 141.5 ms | informational |
| Maximum | 380.0 ms | informational |
| Temporary fixture rows after cleanup | 0 | 0 |

Timing comes from the application's `PerformanceMeasure` between issue selection and detail data readiness, exposed as a nonvisual document data attribute for driver-independent QA. The 20 sorted durations were `55.5, 57.3, 57.8, 58.5, 58.7, 59.2, 59.3, 60.2, 60.8, 61.9, 65.2, 65.7, 74.4, 75.6, 79.5, 85.0, 85.9, 135.3, 141.5, 380.0` ms.

## Requirement Trace

| Requirement | CT-9 evidence |
|---|---|
| R-008 | Versioned filter AST, deterministic query ordering, team-qualified values, grouping/collapse, density, visible properties, archive scope, list, and board pass. |
| R-009 | Saved-view create/select/update/archive/restore persistence and revision conflicts pass in the real PostgreSQL suite and browser lifecycle. |
| R-010 | Workspace-scoped ranked issue/project search and the global command surface return authorized summaries only. |
| R-011 | Explicit selection plus per-item revision-safe bulk results pass, including partial-conflict integration coverage. |
| R-103 | URL state preserves durable view and selected issue context; adjacent selection replaces one detail entry and close returns to the list. |
| R-104 | List, board, split panel, toolbar, and card geometry are responsive and stable across recorded viewports. |
| R-105 | Visible focus and keyboard workflows pass while editable controls are protected from global shortcuts. |
| R-110 | Virtualization, code splitting, 2,002-record mounted-node control, and p75 detail readiness pass the implementation gates. |

| Planned test | CT-9 evidence |
|---|---|
| P-T10 | Filter AST normalization, parameterized SQL, deterministic ordering, workspace isolation, invalid-input rejection, and URL round trip pass. |
| P-T11 | Saved-view ownership, scope, revision conflict, archive, restore, persistence, and reload pass. |
| P-T12 | Ranked search authorization, explicit bulk results, conflict behavior, and no query-value logging pass. |
| P-T13 | Virtual list/board, split history/focus, command surface, keyboard matrix, responsive geometry, semantics, contrast, and seeded performance pass. |

## Screenshots

| Artifact | SHA-256 |
|---|---|
| `evidence/issues-board-desktop-1440x1000.jpg` | `4dd600f4ffb2208e9704485707d07a614d3fc9578a4200079e397cfc681501b2` |
| `evidence/issues-split-desktop-1440x1000.jpg` | `ffde53eb19b49a03d8fa69e91b2153dc9cfd1355c961011f2da79b7db5d12ccd` |
| `evidence/issues-tablet-768x1024.jpg` | `1539fa2bc20f6c97906e095218b34f0ffd345b8f7b24d9658943aeb151ba08d9` |
| `evidence/issues-mobile-390x844.jpg` | `ef6b75e539f8840f642233ec82d3b8f78a3753341a5b6b1ea6e04338a586d96e` |
| `evidence/virtualization-2002-issues-1440x1000.jpg` | `aef875c8b472995e22022e61cdc0ba7cb3bf2699e8b605ca13d143fefc753f66` |

These are synthetic clean-room application captures. Private Linear reference screenshots remain under ignored `.control-tower/evidence/` paths and were not copied into product assets, fixtures, or public evidence.

## Images and Migrations

Final images are API `6f75afa2c583` (322,037,789 bytes), web `43e413340ad3` (62,053,295 bytes), test `932925f2824b` (442,618,171 bytes), and PostgreSQL `06928dd03c45` (449,935,983 bytes). The running API and web resolve to the recorded final image digests and report zero restarts.

Migration SHA-256 values are `dd1fac4916d38f072f9fd49f31d0a89ff000b9b0d5cce0d588dea1754b0e7a3b`, `79c55276d5be91b4b36cd6fc66135bbb9a2879e529622159f7ba3c135f911f92`, `15e41c9eff8401f6092d43b2c604633c7ac9f6cc2ba515b523648d3bd4fe256b`, `9539e28e2ae66a1c891e68bb805e24fee2179be92d2203b823c09bd1ad623612`, `0df907aa7da512925c410736dca969200568f3cd38d5ad6bc8c5b5f950019d2a`, and `8b7944c5bf5e768c824cd9a4c6e5a2b632ac6f1fcef0d48f299f357dd2221467`.

The final synthetic fixture has two active issues, one active saved view, 41 activity entries, 41 paired outbox events, and zero performance-fixture rows.

## Handoff

CT-10 can implement canonical export/import and operator recovery on the six-migration model. CT-11 can independently exercise isolation, direct-ID/search/activity access, stale writers, filter compiler boundaries, and secret-safe failure paths now that CT-9 is complete. CT-12 retains integrated assistive-technology, fidelity, performance, and recovery acceptance. No outcome is claimed.
