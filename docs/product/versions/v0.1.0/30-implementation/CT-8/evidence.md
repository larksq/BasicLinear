# CT-8 Issues, Relations, Activity, and Recovery Evidence

## Verdict

`OUTPUT_DONE_FOR_CT9_CT10` on 2026-08-20. CT-8 delivers the persisted issue aggregate, stable team identifiers, rich text, core properties, labels, typed relations, comments, transactional activity, archive/restore, confirmed owner purge, project progress integration, and responsive issue workflows. This is implementation evidence. It does not claim CT-9 saved views, board/grouping, bulk operations, global search, command-palette or side-panel acceptance; CT-10 export/backup/restore; downstream independent acceptance; or a Discovery outcome.

The repository is unborn and has no Git `HEAD`. Evidence is bound to Control Tower issue `CT-8` implementation revision `2`, expected completion revision `3`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, exact paths in `changed-files.txt`, changed-files manifest SHA-256 `ce551a577e72b0e0c15df4744b27caf57f8efb0aba24bc7a49706ea46539a5f7`, production-source tree SHA-256 `a9ca80d435ee1a66a889a4e5ffa87aabc11d71e07502447c31069be9cd9a7bc9`, and package-lock SHA-256 `46ce53b843c0a6b6d449198eb5a70a888f05cccd56f1f05b2e6c4df88131942d`.

## Delivered Boundary

- Issues allocate stable per-team identifiers transactionally and persist title, allowlisted ProseMirror JSON, workflow status, priority, type, assignee, due date, labels, project, milestone, revision, archive state, and timestamps.
- Labels support workspace-scoped create/read and assignment. Project and milestone assignments enforce workspace and project consistency.
- Blocking, related, duplicate, and parent/sub-issue relationships use canonical edges with derived inverse presentation. Self-relations, invalid scope, duplicate edges, blocking cycles, and parent cycles fail atomically.
- Comments use the same normalized rich-text contract and support revision-safe create/edit/archive/restore.
- Accepted issue, relation, and comment writes record actor, timestamp, revision, action, field, and before/after semantics with the outbox write in one transaction. Stale, invalid, and semantic no-op writes append nothing.
- Archive is recoverable. Purge requires the owner capability, an archived issue, the current revision, and exact identifier confirmation.
- Issue writes update the CT-7 `project-progress-v1` projection monotonically. Live QA changed one project and its assigned milestone to 100% after the eligible issue reached Done.
- The frontend provides a dense issue list, global and project-contextual creation, a full-page detail surface, rich descriptions and comments, properties, relations, activity, recovery actions, keyboard traversal, responsive reduced layouts, and safe human-readable activity summaries.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass across 8 workspaces |
| `npm test` | Pass, 3 files and 12 tests |
| `npm run build` | Pass; web bundle 717.56 kB, gzip 215.34 kB, no source maps |
| Dependency installation audit | Pass, 0 vulnerabilities |
| Real PostgreSQL integration | Pass, 3 files and 3 tests against final test image |
| Exact final migration state | Pass; 5/5 applied with matching digests |
| Live readiness | HTTP 200 through localhost Nginx ingress |
| Running containers | API, web, and database running with 0 restarts on recorded immutable images |
| Runtime logs | No error-level entry or 5xx response; two expected 400 validation rejections contain no submitted values |
| Browser interaction | Create/edit/filter/relation/comment/archive/restore/confirmed-purge/project-context and keyboard workflows pass |
| Responsive review | Pass at 390x844, 768x800, 1024x768, and 1440x900 |
| Layout review | Document width equals client width and 0 visible controls are offscreen at each reviewed viewport |
| Mobile composer | 356px dialog within a 390px document; 0 offscreen controls |

The Chrome connector available in this run did not expose a console-message stream, so no browser-console count is claimed. Final server/proxy logs, DOM geometry, screenshots, API responses, persisted database state, and interaction results were inspected instead. Vite reports one bundle-size advisory above 500 kB; code splitting and seeded-scale performance remain CT-9 and CT-12 concerns.

## Integration Coverage

The PostgreSQL suite applies all five migrations to fresh databases. CT-8 coverage includes transactional team sequence allocation, idempotent create replay, full property and label persistence, strict rich-text normalization, stale and semantic no-op rejection, project/milestone consistency, workspace isolation, direct constraint failures, all relation kinds and inverse semantics, self-edge/duplicate/cycle rejection, comment edit/archive/restore, paired activity/outbox counts, archive/restore, incorrect purge confirmation, member purge denial, owner purge, and process readback. The CT-7 progress suite now uses the real issue aggregate and verifies status-driven project and milestone progress.

The live fixture contains two active synthetic issues, two labels, three label assignments, one canonical blocking relation, one active edited comment, one active project projection, 35 activity entries, and 35 paired outbox events. A temporary third issue was created, archived, and owner-purged after exact confirmation; its absence is part of the recovery-boundary evidence.

## Requirement Trace

| Requirement | CT-8 evidence |
|---|---|
| R-005 | Global and project-contextual create plus detail edit persist stable team ID, title, rich text, status, priority, type, assignee, due date, labels, project, and milestone through pointer and keyboard paths. |
| R-006 | Blocking, related, duplicate, and parent/sub-issue contracts persist canonical inverse semantics; self, invalid-scope, duplicate, blocking-cycle, and parent-cycle mutations fail atomically. |
| R-007 | Accepted issue/relation/comment mutations pair field-level activity and outbox records in the transaction; failed, stale, and no-op mutations append nothing. |
| R-012 | Issue and comment archive/restore are recoverable; owner purge requires archived state, current revision, capability, and exact identifier confirmation. |

| Planned test | CT-8 evidence |
|---|---|
| P-T08 | Migration 005, five-migration fresh PostgreSQL application, forced RLS, composite constraints, repository/API schema contract, real issue progress projection, and workspace isolation pass. |
| P-T09 | Domain and integration tests cover strict rich text, relation graph integrity, revision/no-op behavior, transactional activity, archive/restore, and elevated confirmed purge. |

## Browser Review

Chrome exercised the production images at four breakpoints. The run created `PRO-1` with complete metadata, a project, a milestone, bold description text, and two labels; created `PRO-2` without a project or milestone using a bullet-list description; added the `PRO-2 blocks PRO-1` relation; created, edited, archived, and restored a rich comment; updated issue status, title, and priority; archived and restored an issue; rejected an incorrect purge confirmation; and exactly confirmed owner purge of temporary `PRO-3`.

Project context locked the correct team/project and offered only project milestones. `C` opened creation globally, including while detail was open. `J` then Enter moved between list rows and detail, Escape returned to the list, and search for `restore` filtered to `PRO-2`. Activity presents user-facing action and field names, rich-text summaries rather than content, resolved issue identifiers, and resolved milestone names.

| Artifact | SHA-256 |
|---|---|
| `evidence/issue-create-390x844.jpg` | `978fb175c6f4d4b62d181046ac89faeea216f24b234d1d8243807bbba0b22005` |
| `evidence/issue-detail-1024x768.jpg` | `8336708a80b874d02cd523b5638df9d7f93c045420f1da149b6342f8a89a0c1a` |
| `evidence/issue-detail-1440x900.jpg` | `dfee23d3f3db9585c99a69c72e389ec5c1a54f2ea9e99445587631cc4e3b878f` |
| `evidence/issue-detail-390-full.jpg` | `56513ce76c36c24a8a834b2cd3c00ae3790718d7f98f28e8622a5c2c27e83dfd` |
| `evidence/issue-detail-390x844.jpg` | `11811d5b20f3d0b8ee2118699bfc6f5c487602febe2d79988ed785046d7a312d` |
| `evidence/issue-detail-768x800.jpg` | `8cb02ea9721ca50a2e790db3ae8ce7ea5877fff9b8d30a1fde2f6a6a5d28dc2d` |
| `evidence/issues-list-1440x900.jpg` | `437869f5663e349d628872b215af45cbb5b983ae6572caea295d4fa81a4d398c` |
| `evidence/issues-list-390x844.jpg` | `ff112af923c1e0a7750e0bfc9a8c497d2575844cd55d7d9618bfca5b79d93454` |
| `evidence/issues-list-filtered-1440x900.jpg` | `82dfd32cad56185c598da7670c4545bd40d971ab4046210b95ef2d97cdc00042` |

The connector encoded these captures as JPEG bytes while retaining the requested `.png` filenames; the hashes bind the exact reviewed artifacts. Private Linear reference screenshots under `.control-tower/evidence/` remain ignored and were not copied into the application or public implementation evidence.

## Images and Migrations

Final local images are API `573d018a3ec9` (321,375,346 bytes), web `599fa6bf4091` (61,985,930 bytes), test `adf829708565` (441,708,129 bytes), and PostgreSQL `06928dd03c45` (449,935,983 bytes). Running API, web, and database containers resolve to those recorded image digests and report zero restarts.

Migration SHA-256 values are `dd1fac4916d38f072f9fd49f31d0a89ff000b9b0d5cce0d588dea1754b0e7a3b`, `79c55276d5be91b4b36cd6fc66135bbb9a2879e529622159f7ba3c135f911f92`, `15e41c9eff8401f6092d43b2c604633c7ac9f6cc2ba515b523648d3bd4fe256b`, `9539e28e2ae66a1c891e68bb805e24fee2179be92d2203b823c09bd1ad623612`, and `0df907aa7da512925c410736dca969200568f3cd38d5ad6bc8c5b5f950019d2a`.

## Host Qualification

The CT-6 Docker Desktop 4.15.0 / Engine 20.10.21 mount deadlock remains present on this host. The production Compose definition retains the named PostgreSQL volume and remains the supported topology; live verification used exact images and equivalent internal/edge networks with database state in the container writable layer. Fresh-database migration and process readback pass in integration. Full clean-host named-volume export/restore rehearsal remains assigned to CT-10/P-T15 and CT-12/P-T21.

## Handoff

CT-9 may build the versioned filter/view/search/board/bulk/detail-context/command surfaces on the issue repository and API. CT-10 may serialize and recover the persisted issue, relation, comment, activity, and projection model. CT-11 and CT-12 retain independent security, concurrency, accessibility, visual, performance, and recovery acceptance. No Discovery outcome is claimed here.
