# Backlog

All items are flat top-level issues. `CT-*` mappings are filled from the project-local v0.8 store after creation.

| Plan ID | Local issue | Title | Priority | Depends on | Requirement refs | Outcome refs |
|---|---|---|---|---|---|---|
| I-201 | CT-133 | Instrument hosted outcomes, audit sources, and cost baselines | Urgent | — | R-203, R-215, R-217 | O-201–O-204 |
| I-202 | CT-134 | Deliver Firebase hosting, Google sign-in, and idempotent trial bootstrap | Urgent | I-201 | R-201, R-202, R-203, R-216, R-220 | O-201, O-203, O-204 |
| I-203 | CT-135 | Enforce workspace isolation and owner/member authorization | Urgent | I-202 | R-204, R-206, R-219 | O-202, O-204 |
| I-204 | CT-136 | Add invitation and membership lifecycle | High | I-203 | R-205, R-206, R-215, R-216 | O-202, O-204 |
| I-205 | CT-137 | Add single-assignee tasks and durable comments | High | I-203 | R-207, R-208, R-215, R-216 | O-202, O-204 |
| I-206 | CT-138 | Add 30-day Pro trial, per-seat subscriptions, and Free fallback | Urgent | I-201, I-203 | R-203, R-209, R-210, R-217 | O-201, O-203 |
| I-207 | CT-139 | Publish the scoped PM REST API, token lifecycle, and workspace export | High | I-203, I-205 | R-211, R-212, R-215, R-216, R-218, R-219 | O-204 |
| I-208 | CT-140 | Expose PM-only MCP tools and the reusable skill | High | I-207 | R-213, R-214, R-215, R-219, R-220 | O-204 |
| I-209 | CT-141 | Establish hosted operations, abuse, security, and cost controls | Urgent | I-201, I-202, I-203, I-206, I-207 | R-201, R-217, R-219 | O-203, O-204 |
| I-210 | CT-142 | Run integrated owner/member/billing/API/MCP acceptance | Urgent | I-204, I-205, I-206, I-208, I-209 | R-201–R-220 | O-201–O-204 |

The dependency graph is acyclic. I-201 and I-202 begin the safe sequence; I-210 is the final integrated technical gate. Implementation planning remains independently bounded, but the product is not separately qualified or approved: CT-3 and CT-13 govern the exact combined v0.1 local plus v0.2 hosted candidate.

## Local authority readback

The project-local v0.8 helper created CT-133 through CT-142 on 2026-08-25. The original [creation readback](../../../../../.control-tower/evidence/v0.2.0-planning-issue-readback-2026-08-25.json) is immutable historical evidence and shows the superseded version-specific association. The corrected [shared-stage reconciliation](../../../../../.control-tower/evidence/v0.2.0-shared-stage-reconciliation-2026-08-25.json) records the authoritative readback: CT-133 through CT-141 are Todo at revision 2 in S3 — Implementation; CT-142 is Todo at revision 2 in S4 — Testing; all dependencies are preserved; and Linear projection remains disabled in `not_synced` state. The redundant milestone was deleted only after its issue count reached zero.
