# Combined v0.1 + v0.2 release gates

## Topology decision

BasicLinear uses one project-level Control Tower lifecycle for the v0.1 local and v0.2 hosted increments. v0.2 creates no version-specific milestone. The six existing stage milestones remain canonical, and unfinished human gates from v0.1 now govern the exact combined candidate.

The superseded `v0.2.0 — Online Collaboration` milestone was emptied and deleted on 2026-08-25 through the supported project-local v0.8 task API. Deletion detached zero issues. The authoritative readback is [v0.2.0 shared-stage reconciliation](../../../../../.control-tower/evidence/v0.2.0-shared-stage-reconciliation-2026-08-25.json).

## Stage binding

| Stage | Stable milestone | Bound work | Current rule |
|---|---|---|---|
| Discovery and qualification | S1 — Discovery (`350612cb-69c9-450e-889c-e8704fc664cc`) | CT-3 | One qualified review of the combined public-name, clean-room, local/hosted authority, commercial, privacy, security, and automation boundary |
| Sprint Planning | S2 — Sprint Planning (`fb0a458a-02de-486d-a86d-4433c6554268`) | Accepted v0.1 planning plus this v0.2 package | Preserve both planning records; do not create a parallel version milestone |
| Implementation | S3 — Implementation (`3d0a4a91-9b7b-468c-909f-07371f42d19f`) | CT-133 through CT-141 | Build only the accepted v0.2 slices while preserving the v0.1 local product |
| Testing | S4 — Testing (`4a88d006-6056-4d53-8026-ddbc70721931`) | Existing v0.1 evidence plus CT-142 | Independently verify both modes; CT-142 is the integrated hosted gate |
| Accountable approval and outcomes | S5 — Outcome Review (`db5d135c-7261-46ba-a3ed-6601f21236b7`) | CT-13 and CT-14 | Approve one exact combined candidate, then review both outcome contracts after valid windows |
| Retrospective | S6 — Retrospective (`2a103e0c-36aa-436a-937f-bd9f17cfe6e6`) | CT-15 | Close and learn from the combined lifecycle only after CT-14 |

## Combined unfinished gates

### CT-3 — qualified boundary review

CT-3 remains Todo and unblocked so qualified review can proceed independently of implementation. Its exact review packet covers:

- the BasicLinear name and clean-room provenance;
- the separate local and Firebase-hosted authorities;
- Google identity, workspace isolation, owner/member access, invitations, assignment, and comments;
- the one-time no-card 30-day Pro trial, USD $2 active-user monthly price, and USD $12 active-user yearly price;
- Firebase/Stripe privacy, billing, terms, security, and data-handling boundaries;
- PM-only REST, MCP, and skill surfaces; and
- the explicit exclusion of AI agents, code review, repositories, and pull-request workflows.

Done requires an explicit qualified decision on the exact combined package or bounded remediation. Historical v0.1 evidence remains input; it is not an independent or inferred approval.

### CT-13 — accountable combined release approval

CT-13 remains Todo and is blocked by CT-3, the completed v0.1 integrated test gate CT-12, and the pending v0.2 integrated test gate CT-142. The reviewer receives one candidate and one evidence manifest covering local and hosted modes together. Done requires an explicit accept, reject, or bounded-remediation decision for that candidate. No prior review or implementation status counts as approval.

### CT-14 — combined outcome review

CT-14 remains Todo and blocked by CT-12 and CT-13. It preserves v0.1 O-001 through O-005 and v0.2 O-201 through O-204 without rewriting baselines, targets, guardrails, or observation rules. The current checkpoint is 2027-02-08, the earliest review date of the latest provisional v0.2 window. If release timing moves the hosted cohorts, CT-14 stays Todo and the checkpoint must move; implementation and release approval are not outcome proof.

### CT-15 — combined retrospective

CT-15 remains Todo, blocked only by CT-14, and has no invented due date. It closes both increments, reconciles any unfinished work, and converts repeated product, process, or AI-session findings into bounded owned actions without altering historical evidence.

## Approval and evidence boundary

The user will qualify and approve v0.1 and v0.2 together. Therefore:

- v0.1 is not independently approved or released while the combined gates are pending;
- v0.2 implementation and CT-142 testing may proceed before human approval, but cannot imply it;
- provider account creation, terms acceptance, production credentials, live billing, deployment, and public release still require their applicable action-time authority;
- accepted prices and trial length cannot be changed by research or implementation without maintainer direction; and
- outcomes remain pending until valid source-backed observation windows mature.

## Current readback

As of 2026-08-25, the local store is healthy, Linear projection is disabled, and task counts remain 14 active, 128 completed, and zero trash. S3 contains 118 issues with 104 complete; S4 contains 13 with 11 complete. CT-133 through CT-142 and CT-3/13/14/15 remain Todo. This records topology and gating only; it claims no hosted implementation, test pass, qualification, approval, release, or outcome success.
