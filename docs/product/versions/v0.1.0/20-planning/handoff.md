# Sprint Planning to Implementation Handoff

## Gate decision

The canonical Planning package passed the native Control Tower Planning validator on 2026-08-19 with `0` errors and `3` warnings. CT-76 and CT-79 materially amend its user and runtime boundaries. Readiness remains **yellow**. The original topological scope is historical; current new implementation is authorized only through the replacement sequence:

1. finish `CT-75` and `CT-76`;
2. `CT-78` and `CT-80` after their exact dependencies;
3. `CT-81` after `CT-78` and `CT-80`; and
4. independent `CT-82` before `CT-12` can close.

CT-21 is canceled because Docker-host qualification is no longer a release requirement. `CT-13` is blocked by `CT-3`. `CT-14` waits for `CT-2`, Testing, release audit, and canonical observation windows. `CT-15` follows Outcome Review.

## Integrity binding

| Artifact | SHA-256 |
|---|---|
| Discovery package | `61dc2f6dc797ccf25fd9d102c6a8a9791ad3197f3bd25f600292be643394a723` |
| Planning package | `d078ff629b943dcb66563a8b02f9ef9f3671948d0fceb9e84219c922b4e8fbdc` |

`planning-package.json` carries O-001 through O-005 unchanged in both `discovery_outcomes` and `outcomes`. Implementation cannot alter those objects. A material requirement or contract change returns to Planning or Discovery and regenerates this binding.

## Validator warnings

The validator reports `scoped_outcome_pending_under_accepted_contract` for `CT-7`, `CT-8`, and `CT-9` because they link O-002 while its baseline is missing. `AUTO-O002-IMPLEMENTATION` is narrowly accepted from the Discovery contract: it permits reversible implementation and testing, while baseline collection, threshold acceptance, measurement, and every efficiency claim remain pending under `CT-2`.

CT-77 supersedes CT-1 and resolves workflow rank for the single-owner v0.1 boundary. CT-79 supersedes the Docker/PostgreSQL runtime. Exact legacy import prevalence and switching effort remain unverified. They limit migration claims but do not justify collaboration UX, a generalized tenancy runtime, or invented findings.

## Required inputs

- [PRD](./prd.md)
- [Architecture](./architecture.md)
- [UX design](./ux-design.md)
- [Risk analysis](./risk-analysis.md)
- [Acceptance criteria](./acceptance-criteria.md)
- [Backlog and tests](./backlog.md)
- [Sprint plan](./sprint-plan.md)
- [Quality review](./quality-review.md)
- [Machine package](./planning-package.json)
- [Discovery package](../10-discovery/discovery-package.json)

## Control Tower readback

Fresh local readback for the CT-79 amendment is recorded in [`CT-79/evidence.md`](./CT-79/evidence.md). Every issue projection remains disabled and `not_synced`.

| Issue | Stable ID | Revision | Milestone | Current dependency readback |
|---|---|---:|---|---|
| CT-4 | `c6ce2ff5-54c8-4d70-84c4-8a06d3ad3718` | 1 | S1 Discovery | None |
| CT-6 | `7d88459a-3877-4bc0-b628-0d6ed6031558` | 1 | S3 Implementation | CT-4 |
| CT-7 | `e6494481-51bb-4c90-a148-41eb1d4a92cf` | 1 | S3 Implementation | CT-6 |
| CT-8 | `b69d8b70-f5be-420e-8746-602e0b3bbde7` | 1 | S3 Implementation | CT-6 |
| CT-9 | `5c6dbd22-82bf-46d4-8e0a-098146b45282` | 1 | S3 Implementation | CT-7, CT-8 |
| CT-10 | `fdb1ad84-8628-4ae8-8939-9b61f56a164d` | 1 | S3 Implementation | CT-6, CT-8 |

The Control Tower `blocked_by` edges express both ordinary topological dependencies and release gates. The normalized Planning package separates ordinary sequence into `depends_on` and reserves `blocked_by` for unresolved conditions such as CT-3.

## Implementation rules

1. Start with `CT-4`. Do not mutate a dependent issue before its exact dependencies complete and are read back.
2. Before each issue, read its current revision and declare exact writable files. Work on one issue scope at a time.
3. Record changed files, commands, automated results, manual checks, environment, and residual risk before moving an issue to Done.
4. Use synthetic fixtures. Private authenticated screenshots remain under ignored `.control-tower/evidence/` and cannot enter code, snapshots, documentation images, or public artifacts.
5. Preserve loopback-only same-origin operation, embedded SQLite authority, internal scope metadata, expected revisions, canonical recovery behavior, and one-scope transfer compatibility. Do not expose login/workspace/team/member/invite/role/sharing/non-owner-assignee controls in v0.1.
6. Keep the PostgreSQL build read-only as a canonical-export source until CT-80 passes. Do not dual write or mutate the source during migration.
7. Treat framework, schema, export, local-security, visual-threshold, and runtime-boundary changes as governed decisions with affected requirement and test links.
8. Implementation completion supplies capability evidence only. It cannot mark any outcome achieved.

## Return conditions

Return to Planning if an issue cannot satisfy its test union, a dependency changes, the single-owner UI boundary is violated, a requirement needs new scope, or an implementation choice weakens a protected quality. Return to Discovery if credible population evidence overturns CT-77's workflow set, multi-user/remote/multi-process operation is proposed, the accepted workload no longer fits serialized SQLite, or evidence/outcome meaning changes. Stop the public path if CT-3 is unresolved or clean-room/private-evidence review fails.
