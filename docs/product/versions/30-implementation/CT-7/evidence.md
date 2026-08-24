# CT-7 Projects and Milestones Evidence

## Verdict

`OUTPUT_DONE_FOR_CT8` on 2026-08-20. CT-7 delivers workspace-scoped project and milestone management, deterministic derived progress, revision-safe mutations, transactional activity, and responsive project surfaces. This is implementation evidence. It does not claim CT-8 issue management, downstream outcome validation, public-release readiness, or the independent CT-11/CT-12 verdicts.

The repository is unborn and has no Git `HEAD`. Evidence is bound to Control Tower issue `CT-7` implementation revision `2`, expected completion revision `3`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, exact paths in `changed-files.txt`, production-source manifest SHA-256 `6334ff4f8b2d5a529cb893b04e9bcf5c4ffa3bee5bbeffc1b28472b909588d3e`, and package-lock SHA-256 `12013ae5bc30fba8a5fc2e54e629ca2ed3586c94e24168aed832e5be585217bb`.

## Delivered Boundary

- Projects support create, read, edit, search, status/priority filtering, deterministic ordering, manual reorder, archive, and restore.
- Metadata includes team, summary, status, priority, lead, start/target dates, icon, color, structured overview paragraphs, ordered resources, revision, and timestamps.
- Milestones support ordered create, read, edit, keyboard-accessible reorder, archive, restore, descriptions, target dates, issue counts, and derived progress.
- `project-progress-v1` computes completed / non-canceled eligible assignments. Zero eligible assignments produce zero. Progress has no writable API field.
- Accepted mutations record actor, time, revision, field, before/after values, activity, and outbox data in one transaction. Stale and no-op mutations append nothing.
- Projects, resources, milestones, and the CT-8 issue projection boundary use composite workspace constraints and forced RLS. Security-invoker views preserve caller RLS.
- The frontend provides a dense list, unframed project document, properties, progress, resources, milestones, activity, keyboard row entry, keyboard reorder commands, and responsive reduced columns.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass across 8 workspaces |
| `npm test` | Pass, 3 files and 11 tests |
| `npm run build` | Pass; web bundle 283.94 kB, gzip 83.60 kB, no source maps |
| Real PostgreSQL integration | Pass, 2 files and 2 tests, 1.69 s total |
| Exact final migration plan | Pass; 4/4 applied with matching digests |
| Live readiness | HTTP 200 through localhost Nginx ingress |
| Runtime service logs | 0 flagged warning/error/fatal/5xx entries in final API and web tails |
| Browser interaction | Create/edit/reorder/archive/restore/search/filter/activity and keyboard entry pass |
| Browser structure | 0 duplicate IDs and 0 unnamed buttons |
| Responsive review | Pass at 390x844, 768x800, 1024x768, and 1440x900 after tablet correction |
| Dialog behavior | Escape closes and returns focus to the edit trigger |

The Chrome connector available in this run did not expose a console-message stream, so no browser-console count is claimed. Final server/proxy logs, DOM snapshots, screenshots, API responses, and interaction results were inspected instead.

## Integration Coverage

The PostgreSQL suite applies all four migrations to fresh databases and covers member project writes, create replay, full metadata/resources, search/filter/order, stale update rejection, semantic no-op rejection, milestone create replay and reorder, stale milestone reorder, issue projection replay, project and milestone progress, issue status progress refresh, project reorder, project/milestone archive and restore, field-level activity, paired outbox/activity counts, two-workspace hidden reads, cross-workspace team rejection, composite projection constraints, and process restart readback.

The live visual fixture contains two synthetic projects, two synthetic milestones, and four synthetic issue-projection rows. Those projection rows demonstrate 67% project progress, 100% recovery-rehearsal progress, canceled-item exclusion, and 0% operational-baseline progress. They are not evidence that CT-8 issue CRUD exists.

## Requirement Trace

| Requirement | CT-7 evidence |
|---|---|
| R-003 | Project repository/API/UI cover metadata, resources, create/read/edit/archive/restore, search, filters, ordering, derived progress, and unauthorized hidden reads. |
| R-004 | Milestones retain deterministic order, descriptions, dates, issue counts, archive state, and status-driven progress; keyboard reorder commands are exposed. |
| R-007 | Accepted project/milestone writes record actor/time/revision and field before/after values with their outbox event; stale and semantic no-op writes produce no extra record. |

| Planned test | CT-7 evidence |
|---|---|
| P-T06 | Migration 004, fresh PostgreSQL application, forced RLS, security-invoker views, cross-workspace cases, composite FKs, and immutable progress contract pass. |
| P-T07 | Domain progress policy tests and live/integration issue-state changes deterministically update project and milestone percentages. |

## Browser Review

Chrome exercised the running production images at four breakpoints. The run created complete synthetic projects, created/edited/reordered/archived/restored milestones, searched and filtered projects, manually reordered projects, archived/restored a project, used `J` then `Enter` to traverse/open a row, and inspected field-level activity. A status-only full-form save produced one `status` field change after semantic comparison was corrected.

The first 1024px capture revealed horizontal document overflow and a clipped milestone command. The accepted breakpoint wraps the toolbar, hides nonessential list columns, narrows milestone tracks, and collapses the sidebar below 900px. The recaptured 1024px list and overview have no horizontal scrollbar and retain all commands.

| Artifact | SHA-256 |
|---|---|
| `evidence/desktop-projects.jpg` | `8e11393e52d946a823c503a577e9edf2dceb4675826f716491ab34ae4a4acc7b` |
| `evidence/desktop-project-overview.jpg` | `3d903a7b87b68d27ea06cbb45665f2d23cee3d2dfeba1a6176a93932eefdf314` |
| `evidence/tablet-projects.jpg` | `70f5b26b2a2d45a99242100613e252eb9c19a86e121d39f73abf4a9ce59aee0b` |
| `evidence/tablet-project-overview.jpg` | `fb422dbf5f208845c8da793bd523d4b91d30c13300975fe331cb9500785234bc` |
| `evidence/mobile-projects.jpg` | `3f402e9422ca2d094310a2edf06b0b95d9f0b826b7811f66d3ce1e9c5fc21990` |
| `evidence/mobile-project-overview.jpg` | `cbb3e2f44402c4c34d9db750d5b0dcfd81412145fc06e8d55b35aeb65f105c52` |
| `evidence/mobile-project-dialog.jpg` | `56664c4c6a0fae6c1d8984ab1d6c9619d48004ea227908b498da67375757186f` |

Private Linear reference screenshots under `.control-tower/evidence/` were not copied into the application or this public implementation evidence.

## Images and Migrations

Final local images are API `e36666fa3c8c` (309.6 MB), web `2b2a1c906b82` (61.5 MB), operator `c273d8598ec1` (309.5 MB), test `83ef1c46e03d` (428.9 MB), and PostgreSQL `06928dd03c45` (449.9 MB). Running API, web, and database containers resolve to the recorded API, web, and PostgreSQL image digests.

Migration SHA-256 values are `dd1fac4916d38f072f9fd49f31d0a89ff000b9b0d5cce0d588dea1754b0e7a3b`, `79c55276d5be91b4b36cd6fc66135bbb9a2879e529622159f7ba3c135f911f92`, `15e41c9eff8401f6092d43b2c604633c7ac9f6cc2ba515b523648d3bd4fe256b`, and `9539e28e2ae66a1c891e68bb805e24fee2179be92d2203b823c09bd1ad623612`.

## Host Qualification

The CT-6 Docker Desktop 4.15.0 / Engine 20.10.21 mount deadlock remains present on this host. The production Compose definition retains the named PostgreSQL volume and remains the supported topology; live verification used exact images and equivalent internal/edge networks with database state in the container writable layer. Restart persistence passes in integration. Full clean-host named-volume rehearsal remains assigned to CT-10/P-T15 and CT-12/P-T21.

## Handoff

CT-8 may implement the issue aggregate and populate `app.issue_progress_projection` through the exported monotonic repository boundary. CT-9 remains dependency-blocked until CT-8 completes. CT-11 and CT-12 retain independent security, concurrency, accessibility, visual, performance, and recovery acceptance. No Discovery outcome is claimed here.
