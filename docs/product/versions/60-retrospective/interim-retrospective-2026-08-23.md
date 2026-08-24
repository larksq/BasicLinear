# v0.1.0 interim retrospective — 2026-08-23

## Decision summary

The main delay was not raw implementation speed. It was rework caused by generating a large S3 backlog before the supported user, collaboration boundary, and runtime were frozen. In four days the project created 113 issues, then CT-76 narrowed the product to one local owner and CT-79 replaced Docker/PostgreSQL with one loopback Node/SQLite process. CT-83 consequently reconciled 43 already-created implementation issues: 38 became Done and five were canceled as removed surfaces.

The release is not ready to close. Technical implementation is nearly complete, but current acceptance, qualified name/clean-room approval, accountable release review, outcome review, and the final retrospective remain open. This is an interim S6 review; it does not close CT-15 or authorize release.

## Snapshot

Snapshot: project-local Control Tower v0.8, 2026-08-23 00:28 CST. No prior tagged or governed version exists; `v0.1.0` is the first release candidate. “Previous version” below therefore means the initial candidate at `a746615`, not a released predecessor.

| Measure | Result |
| --- | --- |
| Issues | 114 total: 101 Done, 7 Canceled, 4 Todo, 2 In Progress |
| Active milestones | S1 3 Done / 1 Canceled / 1 active; S3 90 / 5 / 1; S4 5 / 1 / 1; S5 0 / 0 / 2; S6 0 / 0 / 1 |
| Creation burst | 22 issues on Aug 19, 49 on Aug 20, 26 on Aug 21, 16 on Aug 22; CT-114 was added during this review |
| Candidate churn | 57 commits after `a746615` in about 11 hours; 40 documentation commits, 7 fixes, 6 tests, 4 chores; 316 files changed |
| Task-store amplification | 607 full JSON backups, 144 MB, from Aug 19–22 |

The configured milestone dates run through Nov 20 while most work was executed in four days. They are stage defaults, not credible estimates. “Longer than expected” is therefore inferred from cycle time, reopen/supersession, and revision churn—not from a missed SLA.

## Long-running and incomplete work

| Task(s) | Signal | What happened | Pipeline correction |
| --- | --- | --- | --- |
| CT-3, CT-12, CT-13 | Open about 75 hours; revisions 29, 90, 99; description changed 27, 85, 98 times | Engineering evidence and human/release gates were mixed into rolling task descriptions. CT-3 and CT-13 looked actively engineered while actually waiting for reviewers; CT-12 repeatedly absorbed every new candidate revision. | Separate `In Progress`, `Review ready`, and `Waiting for accountable decision`; keep descriptions stable and append immutable evidence checkpoints. |
| CT-1 | Canceled after 37.2 hours | A small interview sample could not support the requested population-level ranking. CT-77 replaced it with reproducible online statistics; no outreach or PII occurred. | Require a method-fit check before starting research: decision population, minimum coverage, evidence source, and fallback must be accepted first. |
| CT-21 | Canceled after 28.3 hours | Clean-Docker qualification became irrelevant when CT-79 replaced the container/PostgreSQL topology. | Freeze runtime before environment qualification and automatically invalidate runtime-specific test tasks when architecture changes. |
| CT-82 | First terminal result after 26.3 hours, 14 description changes, one reopen | Architecture and source-revision changes repeatedly invalidated clean-runtime qualification. | Bind acceptance to one candidate revision and mark evidence stale automatically on source changes. |
| CT-32–74 | Many remained open for 22–27 hours, then CT-83 changed 38 to Done and five to Canceled in one reconciliation | Status semantics lagged implementation and scope changes. The large speculative fan-out obscured what was actually supported. | Gate S3 fan-out on frozen scope; require same-session result/readback; cap WIP; reconcile the backlog immediately after a governed scope change. |
| Initial RC → current RC | 57 follow-on commits, including seven fixes | The candidate label was applied before implementation and acceptance were stable, causing repeated evidence and audit resealing. | Create an RC only after S3 is terminal and S4 has no open correction; any product change increments the candidate and invalidates dependent evidence. |

## Remaining-task disposition

| Task | Current disposition | Remaining work |
| --- | --- | --- |
| CT-114 | In Progress at the snapshot; implementation and distinct review now pass | Record the Done transition/readback when the Control Tower app is unlocked, reconcile it into CT-12, then recapture the revision-bound acceptance matrix. |
| CT-12 | In Progress; keep as the single revision-bound acceptance verdict | Finish P-T18/P-T19, 36 dynamic P-T20 states, comparable interaction timing, live System response, and fresh P-T21 for the exact final revision. Completed implementation dependencies are historical evidence, not blockers. |
| CT-3 | Revised from In Progress to Todo and retitled | Obtain a real qualified public-name and clean-room disposition. Technical preparation is complete. |
| CT-13 | Revised from In Progress to Todo and retitled; Done blockers CT-10/11 removed | Wait for CT-3 and CT-12, reseal the exact candidate audit, and obtain accountable approval. |
| CT-14 | Todo; Done blocker CT-2 removed | Run outcome review after CT-12/13; use CT-2 as evidence, not a blocker. |
| CT-15 | Todo; keep blocked by CT-14 | Perform final milestone/outcome reconciliation and accept or reject the improvement actions below. This interim document is not its completion evidence. |

CT-110 through CT-113 were independently reviewed during this pass and moved to Done after 39 focused tests, the full 469-test suite, 8/8 typechecks, 10/10 release-audit checks, and a warning-free build. The seven canceled tasks remain Canceled as useful historical decisions; none should be deleted. No active tasks should be merged: CT-3 is qualified legal/brand review, CT-13 is accountable release review, CT-14 is outcome measurement, and CT-15 is process closure. CT-12 should not be split further because its evidence must bind one exact revision; bounded defects such as CT-110–114 are already split out.

## Improvement actions

These actions are proposed for final disposition in CT-15; creating additional implementation issues now would add process work before outcome review.

| ID | Owner / first step | Definition of done and metric |
| --- | --- | --- |
| A1 Scope freeze before fan-out | Product and technical leads: add a Planning gate recording supported user, workload, runtime, exclusions, and supersession impact before generating S3 tasks. | Validator blocks fan-out when any field is open. Target: no implemented task canceled by a later same-cycle scope change; superseded S3 work below 2%. |
| A2 Revision-bound candidate graph | Quality/release engineering: make CT-12/P-T20/P-T21/CT-13 evidence declare the exact source revision and automatically become stale after product changes. | RC creation is blocked while corrections are open; a product commit invalidates affected evidence. Target: zero stale acceptance claims and at most one audit seal per candidate. |
| A3 Stable task ledger and review state | Control Tower pipeline: add `Review ready`/`Waiting for decision`, append-only evidence links, a five-description-rewrite warning, and automatic removal of terminal blockers from active dependency views. | Same-session status/readback is mandatory; reviewer gates do not remain In Progress. Target: no bulk status reconciliation and no active issue with a terminal blocker. |
| A4 Content-addressed backup retention | Control Tower runtime: measure duplicate snapshot blocks, store content-addressed/delta checkpoints, and retain milestone plus daily recovery points. | Export/restore equivalence passes against the current store. Target: an equivalent four-day trace below 25 MB without losing point-in-time recovery. |

## Other current/previous-candidate improvements

- Treat the initial candidate as a development baseline, not a release candidate; there is no previous released version to compare against.
- Keep one canonical current-state document. Historical Docker/PostgreSQL evidence is correctly retained, but prominent lifecycle text must not still name CT-1 as an open gate after CT-77 superseded it.
- Track planned and actual cycle time per task. Current milestone dates cannot distinguish a one-hour correction from a three-day approval wait.
- Report throughput with rework: issue count and terminal count alone hid 43-task reconciliation, 607 backups, and almost 100 edits to one release-audit task.
- Keep correction issues small, but keep acceptance and release decisions as stable aggregators. This preserves auditability without recreating a speculative 40-task fan-out.

## Evidence

- Task history: `.control-tower/backups/tasks-v0.8-before-issue-update-2026-08-22T15-42-26-985Z-33b88512-ac5d-4240-8c4f-140aee59e86c.json` and the current local task store.
- Scope/runtime changes: [CT-79](../20-planning/CT-79/result.json), [CT-83](../30-implementation/CT-83/result.json), and [Discovery handoff](../10-discovery/handoff.md).
- Long-running qualification: [CT-82](../40-testing/CT-82/result.json).
- Current acceptance/release gates: [CT-12](../40-testing/CT-12/result.json) and [CT-13](../50-outcome-review/CT-13/result.json).
- Independent corrective review: [CT-110–113 review](../40-testing/corrective-tranche-review-2026-08-23.md).
