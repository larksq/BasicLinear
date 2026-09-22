# Backlog and Traceability

This file preserves the accepted v0.1 Planning baseline and requirement/test traceability. It is not the live priority queue. See the [current Feature Log](../../../../../pmo/feature-log.md) for priority order, active status, later candidates, and exact Control Tower mappings; the project-local v0.8 task store remains authoritative.

## Executable Control Tower issues

| Issue | Stable local ID | Milestone | Dependencies / blocker | Requirement scope | Outcome scope | Planning state |
|---|---|---|---|---|---|---|
| CT-2 Reference efficiency baseline | `8f5a41e2-71a5-4e8b-9947-e30ddc6c2a51` | S1 | None | R-003/4/5/8/9/10/11/103 | O-002 | Evidence task; not implementation-ready |
| CT-3 License, public name, clean-room boundary | `a1a09256-3273-4f2f-9f8a-e74f5589325d` | S1 | None | R-015, R-108 | O-005 | Human/qualified-review task; not implementation-ready |
| CT-4 Architecture and UX risk prototypes | `c6ce2ff5-54c8-4d70-84c4-8a06d3ad3718` | S1 | None | R-101/102/103/105/110 | O-001, O-003, O-004 | Allowed first |
| CT-6 Foundation and workspace core | `7d88459a-3877-4bc0-b628-0d6ed6031558` | S3 | CT-4 | R-001/2/14/101/102/106/109 | O-001, O-004 | Allowed after CT-4 |
| CT-7 Projects and milestones | `e6494481-51bb-4c90-a148-41eb1d4a92cf` | S3 | CT-6 | R-003/4/7 | O-001, O-002 | Allowed under baseline exception |
| CT-8 Issues, relations, activity, recovery | `b69d8b70-f5be-420e-8746-602e0b3bbde7` | S3 | CT-6 | R-005/6/7/12 | O-001, O-002, O-004 | Allowed under baseline exception |
| CT-9 Views, search, detail, keyboard UX | `5c6dbd22-82bf-46d4-8e0a-098146b45282` | S3 | CT-7, CT-8 | R-008/9/10/11/103/104/105/110 | O-001, O-002, O-003 | Allowed under baseline exception |
| CT-10 Export, recovery, migrations, operator CLI | `fdb1ad84-8628-4ae8-8939-9b61f56a164d` | S3 | CT-6, CT-8 | R-013/14/106/107/109 | O-001, O-004 | Allowed |
| CT-11 Isolation/conflict/security verification | `e041caff-6446-4324-8d43-06fe99421058` | S4 | CT-6, CT-8, CT-9 | R-001/2/5/8/9/101/102/106 | O-001, O-004 | Testing entry after implementation |
| CT-12 Integrated workflow and quality verification | `b6a43ac3-2f25-40d8-aa36-2738d0bb59a9` | S4 | CT-7/8/9/10/11 | R-003 through R-014, R-103/104/105/107/109/110 | O-001/2/3/4 | Testing entry after CT-11 |
| CT-13 Public release audit | `7ac28514-97fb-43e3-aabc-7c12c01129f7` | S5 | CT-10/11/12; blocked by CT-3 | R-015/108/109 | O-005 | Blocked from public path |
| CT-14 Outcome review | `db8ccdde-b365-4cbc-b155-ba661919ba7d` | S5 | CT-12/13; blocked by CT-2 | Outcome-linked requirement union | O-001 through O-005 | Wait for windows and baseline |
| CT-15 Retrospective | `5ff58615-e34e-4e1e-963b-99fd68dcf4d4` | S6 | CT-14 | R-108 | O-005 | Lifecycle close only |
| CT-79 Replace Docker/PostgreSQL plan | `4c50132e-8cbc-477a-939b-7e9946aca7d1` | S2 | CT-5 | R-001/2/9/14/101/102/107/109 | O-001/4/5 | Accepted local-runtime amendment |
| CT-80 Migrate persistence to SQLite | `8fc8bdc7-06e4-4bab-8716-c26d25b445f5` | S3 | CT-75/76/79 | R-002/3/4/5/6/7/8/9/12/13/102/106/107 | O-001/2/4 | Storage and canonical-transfer implementation |
| CT-81 Collapse to one loopback process | `3f54fea5-3822-451b-8300-0baaa8f9d170` | S3 | CT-78/80 | R-001/14/101/106/109 | O-001/4/5 | Runtime and packaging implementation |
| CT-82 Clean local acceptance | `0103a501-2a94-41d2-8db6-751827501b27` | S4 | CT-81 | R-001/2/9/13/14/101/102/107/109 | O-001/4 | Independent install/upgrade/backup/restore gate |

`CT-1` is canceled. `CT-77` owns the statistical workflow ranking and `CT-76` owns the single-owner UX amendment. CT-79 supersedes the Docker/PostgreSQL architecture. CT-21 is canceled because clean-Docker qualification is no longer a release requirement. CT-78 retains internal scope metadata and hides collaboration administration; CT-80 replaces application persistence; CT-81 retires the supported heavy runtime; CT-82 replaces CT-21 as the independent operational gate. Exact import prevalence and switching effort remain residual research risk.

## Test catalog

| Test | Level | Requirement refs | Issue refs | Concrete evidence |
|---|---|---|---|---|
| P-T00 | manual | R-003/4/5/8/9/10/11/103 | CT-2 | Matched reference benchmark worksheet and environment record |
| P-T01 | manual | R-015/108 | CT-3 | Accepted identity/license/clean-room decision record |
| P-T02 | boundary | R-101/102/103/105/110 | CT-4 | Disposable isolation, conflict, density, screenshot, and viewport spike |
| P-T03 | static | R-014/106/109 | CT-6, CT-81 | Pinned Node/runtime/config checks and proof that no Docker, database-server, OIDC, or secret input is required |
| P-T04 | security | R-001/2/101 | CT-6, CT-81 | Owner bootstrap, process session, absent administration UX, loopback Host/Origin/CSRF, and safe-path matrix |
| P-T05 | restart | R-102/106/109 | CT-6 | Retry, revision, health, migration, and network-denied restart proof |
| P-T06 | schema | R-003/4/7 | CT-7 | Project/milestone/activity migration and repository contract |
| P-T07 | unit | R-003/4/7 | CT-7 | Ordering, progress, revision, archive, and activity invariants |
| P-T08 | schema | R-005/6/7/12 | CT-8 | Issue/property/relation/comment/activity/archive schema contract |
| P-T09 | unit | R-005/6/7/12 | CT-8 | Relation integrity, rich-text sanitization, activity, and recovery invariants |
| P-T10 | adapter_contract | R-008/9 | CT-9, CT-80 | Filter AST, saved-view serialization, bounded SQLite scan, deterministic sort, and ranking contract |
| P-T11 | regression | R-010/11 | CT-9 | Keyboard matrix and list/detail context preservation |
| P-T12 | golden | R-105/110 | CT-9 | Pinned clean-room screenshots at approved viewports |
| P-T13 | manual | R-103/104/110 | CT-9 | Controlled interaction trace and keyboard/AT/responsive review |
| P-T14 | cli_integration | R-013/107 | CT-10, CT-80 | Canonical export/import and SQLite online-backup/restore digest round trip |
| P-T15 | ci_release | R-014/106/109 | CT-10, CT-81 | Clean one-process start, migration, health, error, and network-denied run |
| P-T16 | security | R-001/2/5/8/9/101 | CT-11, CT-82 | Independent listener, Host/Origin/CSRF, path/symlink, corrupt-import, and supported-surface suite |
| P-T17 | boundary | R-102/106 | CT-11 | Stale writer, idempotency, XSS/CSP, log-redaction, and failure suite |
| P-T18 | uat | R-003/4/5/6/7/8/9/10/11/12 | CT-12 | Canonical integrated workflow with persisted readback |
| P-T19 | manual | R-010/104/110 | CT-12 | Independent keyboard and assistive-technology matrix |
| P-T20 | golden | R-103/105/110 | CT-12 | Independent performance and screenshot comparison artifacts |
| P-T21 | restart | R-013/14/107/109 | CT-12, CT-82 | Independent clean local start, SQLite upgrade/interruption, backup/restore/rollback, source import, and offline proof |
| P-T22 | ci_release | R-015/108/109 | CT-13 | Source/build/license/provenance/privacy/reproducibility audit |
| P-T23 | uat | R-003/4/5/8/9/10/11/13/15/101/103/104/105/107/108/109/110 | CT-14 | Mature-window O-001 through O-005 observations and decisions |
| P-T24 | manual | R-108 | CT-15 | Evidence-backed lifecycle and AI-session retrospective audit |

## Completion semantics

Every issue description separates output, quality, and outcome boundaries. Output completion means the named artifact or behavior exists. Quality completion means referenced tests pass with environment and source identity. Outcome completion remains pending until the canonical observation window and Outcome Review; no Control Tower `Done` transition may be cited as product-outcome proof.
