# CT-77 Statistical Workflow Scoring Model

## Decision question

Which workflow families must survive a migration into the one-owner, one-workspace, one-team `v0.1.0` product, across software, personal, ITSM, DevOps, predictive, hybrid, agile, and other industry project types?

The sources do not ask that exact product question. The ranking is therefore an inference from registered statistics plus the maintainer's replacement and ownership constraints, not a claimed survey result.

## Criteria

Each family receives an integer score from `0` (no support) through `5` (strong support).

| Criterion | Weight | Meaning |
|---|---:|---|
| Observed prevalence or pressure | 35% | Large-sample evidence shows use, pain, rejection risk, or demand related to the family. |
| Cross-project applicability | 25% | The family remains useful across the represented project types, methods, industries, and work/personal contexts. |
| Migration continuity risk | 25% | Losing the family would break authoritative state, identity, hierarchy, relationships, or recovery after migration. |
| Consolidation leverage | 15% | The family reduces tool switching, information retrieval cost, or fragmented work context. |

The weighted score is `0.35P + 0.25X + 0.25M + 0.15C`. Scores prioritize product scope; they are not estimates of population share.

## Ranking

| Rank | Workflow family | P | X | M | C | Weighted | Primary statistical basis | v0.1 decision |
|---:|---|---:|---:|---:|---:|---:|---|---|
| 1 | Issue capture and lifecycle | 5 | 5 | 5 | 4 | 4.85 | STAT-001, STAT-004, STAT-006, STAT-008 through STAT-010 | Must: fast create/edit; identifiers; status, priority, dates, labels; configurable status order and retirement; archive/restore. |
| 2 | Find and focus | 5 | 5 | 4 | 5 | 4.75 | STAT-002, STAT-004, STAT-013, STAT-014 | Must: list and board, search, filters, grouping, ordering, visible properties, bulk action, saved views, preserved context. |
| 3 | Project and milestone planning | 4 | 5 | 5 | 4 | 4.50 | STAT-008 through STAT-010, STAT-013, STAT-016 | Must: projects, ordered milestones, issue assignment, scope, dates, progress, archive/restore. |
| 4 | Data ownership and recovery | 4 | 5 | 5 | 3 | 4.35 | STAT-003 through STAT-006 plus maintainer ownership constraint | Release-critical: versioned export/import, backup/restore, identifiers and relationship digests, network-denied local operation. |
| 5 | Context and traceability | 4 | 4 | 4 | 5 | 4.15 | STAT-002, STAT-011, STAT-012, STAT-014 through STAT-016 | Must: descriptions, relations, resources, comments where useful to the owner, immutable activity, and progress context. |
| 6 | Multi-user collaboration and team administration | 3 | 2 | 2 | 2 | 2.35 | STAT-015 and STAT-016, limited by maintainer scope | Exclude from supported v0.1 UX: invitations, member administration, presence, multi-team switching, and shared assignments. Retain internal authorization boundaries as regression protection. |
| 7 | AI, advanced analytics, and broad integrations | 1 | 2 | 1 | 2 | 1.40 | STAT-007; STAT-012 only supports future automation readiness | Exclude from v0.1. Preserve stable APIs and activity records so later work is not blocked. |

## Sensitivity

| Weight set | Issue lifecycle | Find/focus | Projects/milestones | Ownership/recovery | Context/traceability | Result |
|---|---:|---:|---:|---:|---:|---|
| Default 35/25/25/15 | 4.85 | 4.75 | 4.50 | 4.35 | 4.15 | Top-three set unchanged. |
| Equal 25/25/25/25 | 4.75 | 4.75 | 4.50 | 4.25 | 4.25 | Top-three set unchanged; ranks 1-2 and 4-5 tie. |
| Prevalence-heavy 50/20/20/10 | 4.90 | 4.80 | 4.40 | 4.30 | 4.10 | Top-three set unchanged. |
| Migration-heavy 25/20/40/15 | 4.85 | 4.60 | 4.60 | 4.45 | 4.15 | Top-three set unchanged; ranks 2-3 tie. |

The stable decision is the top-three set, not false precision between adjacent scores. Ownership/recovery and traceability remain release-critical because migration failure can destroy or disconnect records even when those workflows are less frequent.
