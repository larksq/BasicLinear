# Discovery to Sprint Planning Handoff

## Gate decision

The canonical Discovery package passed the native Control Tower Discovery validator on 2026-08-19. CT-77 amended scope evidence on 2026-08-21 with four official large-sample sources and a reproducible ranking. CT-79 then amended the technical boundary after a repository inventory and official Node/SQLite review. Sprint Planning may use the statistically ranked first-release boundary and the local-runtime architecture amendment.

CT-1 is canceled and superseded by CT-77. Planning shall treat one owner, one automatically provisioned internal workspace/team context, no membership/login/administration/switching/sharing/non-owner-assignment UX, directional urgency, and the migration-critical workflow order as the v0.1 boundary. The supported runtime is one pinned Node 24 loopback process and one embedded SQLite file. Docker, PostgreSQL, OIDC, remote access, RLS, multi-user roles, durable event delivery, and scale search indexes are excluded. Planning must not turn the statistics into a migration-rate, switching-deadline, import-format, or usability claim. O-002 remains unvalidated. The maintainer-selected `AGPL-3.0-only` metadata is applied; public naming, qualified license disposition, and distribution remain gated by `CT-3`.

## Accepted inputs

- Product intent and governance: [`pmo/`](../../../../../pmo/index.md)
- Problem: [`problem.md`](./problem.md)
- User research: [`user-research.md`](./user-research.md)
- Market research: [`market-competitor-research.md`](./market-competitor-research.md)
- Technical investigation: [`technical-investigation.md`](./technical-investigation.md)
- Requirements: [`requirements-analysis.md`](./requirements-analysis.md)
- Outcomes: [`outcomes.md`](./outcomes.md)
- Machine contract: [`discovery-package.json`](./discovery-package.json)
- Source and claim traceability: [`source-index.md`](./source-index.md) and [`evidence-index.md`](./evidence-index.md)
- Statistical scope decision: [`CT-77/decision.md`](./CT-77/decision.md)
- Local-runtime decision: [`../20-planning/CT-79/decision.md`](../20-planning/CT-79/decision.md)

## Immutable outcome contract digests

| Outcome | Contract SHA-256 | Planning condition |
|---|---|---|
| O-001 | `87362bff159a581ea2a738afbf969457798e5a9a43e085ea9a9234f932ff604d` | Preserve exactly; one-owner/ten-run local-runtime contract |
| O-002 | `5d0f045b83987b7da5e5f1c861becc225085b6f42a30ebe0aa6d0eec7f86fd37` | Preserve exactly; status remains `baseline_needed` until qualified matched evidence is accepted |
| O-003 | `4c41f523cf34e292c85ddeb8b0e954e4f47578d5a0fdeae54ab4aaff5b8c669d` | Preserve exactly |
| O-004 | `78aee6a2f909bc3f4387ba41edd640747a3c1304387e0298f9744cfcadfdebce` | Preserve exactly; SQLite round-trip contract |
| O-005 | `6e6b5f819f23d1484769e081c326e813aa2033e43b8a7eef2f8837e1d22f75f6` | Preserve exactly; local runtime artifact and public release remains gated by CT-3 |

Planning may refine supporting implementation detail but cannot silently redefine a metric, population, workload, target, guardrail, invalidation threshold, observation window, or evidence reference. A necessary contract change returns through a recorded Discovery decision and recomputed digest.

## Retained QA warnings

| QA ID | Gap | Owner and action |
|---|---|---|
| `market-research.switching-cost` | CT-77 ranks workflow families, but the prevalence and effort of exact legacy import formats remain unmeasured. | Product/recovery owners retain versioned migration and round-trip acceptance. |

This warning is accepted residual evidence risk. It does not change the workflow ranking and does not authorize an import-compatibility claim.

## Control Tower readback

Read back from `.control-tower/tasks-v0.8.sqlite3` on 2026-08-21 using the local v0.8 task helper:

| Issue | Stable ID | Revision | Milestone | Status | Due | Handoff role |
|---|---|---:|---|---|---|---|
| CT-1 | `7c3fc01c-770b-4b0d-9833-f220355935d1` | 4 | S1 Discovery | Canceled | 2026-08-25 | Superseded interview plan; zero outreach or sessions |
| CT-2 | `8f5a41e2-71a5-4e8b-9947-e30ddc6c2a51` | 3 | S1 Discovery | Done | 2026-08-26 | Internal diagnostic only; O-002 remains unvalidated |
| CT-3 | `a1a09256-3273-4f2f-9f8a-e74f5589325d` | 6 | S1 Discovery | In Progress | 2026-09-02 | AGPL applied; product identity and qualified clean-room release boundary remain open |
| CT-4 | `c6ce2ff5-54c8-4d70-84c4-8a06d3ad3718` | 3 | S1 Discovery | Done | 2026-08-31 | Architecture risk prototypes |
| CT-5 | `a4a0e64b-b4ae-409a-9fd1-1c8dd446e25e` | 3 | S2 Sprint Planning | Done | 2026-09-04 | Accepted Planning package and issue graph |
| CT-77 | `c73592c4-f220-456b-b6d6-8d1940e9e0a6` | 2 | S1 Discovery | Done | 2026-08-22 | Statistical workflow rank and scope evidence |

CT-79 records the current local-task readback for the architecture amendment. Provider projection remains disabled and `not_synced`; no Linear authority, API, MCP, provider issue, or provider task write exists.

## Planning instructions

1. Deep-compare all five outcome objects against `discovery-package.json` before accepting Planning.
2. Convert R-001 through R-015 and R-101 through R-110 into complete Given/When/Then acceptance criteria and independent validation methods.
3. Design vertical workflow slices for the owner workflow and create one flat Control Tower issue per executable action, assigned to exactly one milestone. CT-80 owns the SQLite persistence migration, CT-81 owns the one-process runtime, CT-78 hides unsupported collaboration controls, and CT-82 owns independent local acceptance.
4. Keep Linear screenshots private and untracked; use only synthetic fixtures for implementation and public evidence.
5. Preserve loopback-only, same-origin, network-denied operation without login, OIDC, Docker, PostgreSQL, or a paid service.
6. Keep the PostgreSQL build read-only as a canonical-export source until CT-80 proves one-scope migration; never introduce dual writes or mutate the source during import.
7. Record every framework, license-working-assumption, data-model, security, accessibility, fidelity, and runtime choice with its reversal cost and evidence.

## Re-entry conditions

Return to Discovery if new credible population evidence overturns CT-77's stable top-three set, a later release proposes multi-user, multi-team, remote, multi-process, or hosted operation, the accepted personal workload no longer fits serialized local storage, `CT-2` or later measurement shows the provisional efficiency target is incoherent, `CT-3` makes the public product boundary infeasible, or a material requirement loses its evidence or outcome link.
