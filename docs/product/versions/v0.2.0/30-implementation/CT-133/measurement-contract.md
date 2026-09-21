# CT-133 hosted measurement contract

Status: implementation evidence only. This contract makes the four hosted outcome baselines reproducible; it does not supply a production baseline or claim that any target is met.

## Versioned records

`@openlinear/hosted` defines `openlinear.hosted-measurement.v1` records for:

- product events with stable event ID, actor identity, workspace, source (`web`, `rest`, `mcp`, `system`, or `stripe`), occurrence and receipt timestamps, correlation ID, and an event-specific allowlisted payload;
- mutation audits with actor, source, request, entity/revision, result, and before/after SHA-256 semantics; and
- economics records with workspace, Firebase/Stripe provenance, bounded period, integer micro-USD amount, active paid seats, and retrieval source.

Unknown fields are rejected. Event payloads cannot carry raw credentials or comment bodies. Actor IDs are typed opaque references (`user:`, `patref:`, `system:`, or `stripe:event:`), and source/actor combinations are enforced. Audit changes carry only field names and before/after digests. Identical retried records deduplicate by ID; a reused ID with different canonical content is a hard conflict.

## Event dictionary

| Event | Population or role |
|---|---|
| `owner.google_sign_in.completed` | O-201 eligible owner denominator |
| `workspace.bootstrap.completed` / `workspace.bootstrap.failed` | O-201 activation step and final terminal G-201 error state; failures carry attempt and recoverable/terminal disposition |
| `project.created` / `issue.created` | O-201 useful activation completion |
| `invitation.sent` | O-202 eligible trial-workspace denominator and exact invitation audit reference |
| `membership.accepted` | O-202 accepted-member step and G-202 invitation, audited email-match result, first-use, actor, and audit reconciliation; no email or deterministic email digest is stored |
| `issue.assigned` / `issue.member_action.completed` / `comment.created` | O-202 accepted member's same-issue assignment, action, and comment sequence |
| `trial.ended` / `subscription.activated` | O-203 eligible trial denominator and seven-day conversion numerator |
| `automation.task.completed` | O-204 collision-free workspace/run/task/surface/role/environment matrix and success numerator |
| `authorization.checked` | G-204 cross-workspace protected disclosure/state-change count with principal, target, and audit reference |

## Deterministic query rules

The executable implementation is `buildHostedOutcomeReport` in `packages/hosted/src/outcome-report.ts`. In query notation:

```text
O-201 denominator = distinct eligible owner IDs with Google sign-in in the window
O-201 numerator   = denominator journeys with bootstrap + project + issue within 10 minutes
G-201 numerator   = denominator journeys whose final bootstrap outcome within 10 minutes is terminal failure

O-202 denominator = distinct eligible trial workspace IDs with invitation.sent in the window
O-202 numerator   = denominator workspaces with audited matching-email first acceptance, assignment to that member, that member's action, and that member's comment on the same issue in acceptance -> assignment -> action -> comment order within 7 days
G-202 numerator   = audited acceptance attempts with missing invitation, email mismatch, actor mismatch, invalid invitation, or non-first acceptance; reconciliation uses the complete invitation ledger, including invitations before the O-202 denominator window

O-203 denominator = distinct eligible workspace IDs with trial.ended in the window
O-203 numerator   = denominator workspaces with subscription.activated within 7 days
G-203 value       = sum(variable_cost micro-USD) / sum(recognized_revenue micro-USD) for eligible O-203 cohort workspaces and fully contained periods only

O-204 denominator = distinct JSON tuples of workspace + run ID + task ID + surface + role + environment in the approved window
O-204 numerator   = denominator records whose structured result succeeded
G-204 value       = count(cross-workspace AND authorized = false AND operationSucceeded = true AND protected read disclosed or protected state changed), reconciled to audit
```

Every rate returns numerator, denominator, and percentage; zero denominators remain null. Reports distinguish `synthetic_fixture` from `production_baseline`. Synthetic results are always `fixture_only`. Production results stay `collecting` until both report time and an explicit completeness watermark cover the outcome-specific maturity boundary: ten minutes after O-201, seven days after O-202 and O-203, and the O-204 window end. A mature empty cohort is `baseline_needed`; only a mature populated cohort is `baseline_ready`, never automatically “met.”

## Provenance and reconciliation

Reports include the completeness watermark, deduplicated event, audit, and economics counts, plus event-source and provider breakdowns. Invitation, acceptance, and authorization events must reconcile to a uniquely referenced audit with exact workspace, source, actor, request ID, timestamp, action, result, entity type, and entity ID, or report generation fails. Cost and revenue use integer micro-USD values to avoid floating-point reconciliation drift. G-203 rejects a partially overlapping cohort period instead of inventing proration. The first production baselines remain owned by T-BASELINE-201 through T-BASELINE-204 and Outcome Review remains pending.
