# CT-1 Target-User Research Plan

> Historical artifact only. `CT-1` was canceled on 2026-08-21 and superseded by the large-sample statistical decision in [`CT-77`](../CT-77/decision.md). No recruitment or interviews will be performed from this plan.

Status: prepared; recruitment and sessions pending

Owner: Discovery research

Due: 2026-08-25

## Decision to Inform

Determine whether three-to-fifty-person product and engineering teams with an openness, self-hosting, data-residency, cost, extensibility, or vendor-independence constraint are the strongest first segment, and whether projects, milestones, issues, views, search, relations, activity, and recovery form a credible first-release boundary.

The study can support, narrow, or invalidate A-001 and A-002. It cannot validate O-001 because that outcome's observation window begins 2026-10-26.

## Research Questions

1. Which issue and project workflows occur daily, weekly, monthly, or rarely?
2. Which workflow failures or missing controls create a real switching trigger?
3. Which objects and data must migrate before a team can trial a replacement?
4. Which deployment, identity, backup, integration, and support constraints are non-negotiable?
5. Can eligible users complete the synthetic core workflow without facilitator intervention or a critical error?
6. Which current alternatives would they choose, and why?
7. What evidence would cause them to reject the proposed segment or first-release scope?

## Sample

Recruit at least five independent eligible participants using [participant-screener.md](./participant-screener.md).

Target coverage:

- at least two product roles and two engineering roles;
- at least one team in the 3-10, 11-20, and 21-50 collaborator bands;
- at least three participants who influence tooling or self-hosting decisions;
- at least three different current issue-tracker contexts across the sample where feasible;
- no project maintainer, current contributor, or person whose employer identity must enter the findings.

The sample is purposive and qualitative. Counts and rankings may inform scope, but they must not be represented as market prevalence.

## Method

Each 50-minute moderated remote or in-person session uses:

1. five minutes for consent and eligibility confirmation;
2. fifteen minutes for current workflow, urgency, and switching evidence;
3. twenty minutes for the fixed synthetic workflow in [task-protocol.md](./task-protocol.md);
4. ten minutes for ranking, alternative preference, and closing questions.

The moderator uses no authenticated competitor account. Participants do not open their employer's tracker or enter work data. The session uses a per-participant synthetic workspace in the local product build. Recording is off by default; anonymized structured notes are sufficient.

## Data Handling

- Assign participant IDs `P01` through `P05+`; do not store names, employer names, email addresses, account identifiers, or raw workspace content in repository artifacts.
- Keep recruitment contact details outside the repository and separate from research notes.
- Store only categorical role and team-size bands plus concise paraphrases.
- Do not store verbatim quotes unless separately consented and scrubbed of identifying content.
- Retain raw private notes only through synthesis plus seven days, then delete them; retain the anonymized findings matrix.
- A participant may withdraw before synthesis by referencing their participant ID.

## Analysis

For each participant, record eligibility, workflow frequency, forced ranking, task success, intervention, critical error, confidence, switching blockers, deployment constraints, alternative preference, and direct evidence for or against A-001 and A-002.

Synthesis rules:

- A workflow is migration-critical only when at least three eligible participants rank it in their top five or provide a concrete trial blocker tied to it.
- A constraint is release-blocking only when it prevents trial or data trust, not merely because a participant prefers it.
- A claim needs a participant count and participant IDs; isolated comments remain individual evidence.
- Missing evidence remains missing. The moderator may not convert silence, confusion, or task success into demand.

## Decision Rules

Recommend retaining the segment when at least four of five eligible participants describe a concrete current impact from their screened hard constraint, identify a plausible trial trigger, and prefer the proposed self-hosted boundary to doing nothing after the synthetic workflow.

Recommend narrowing the segment when one role, team-size band, or hard constraint supplies most of the urgency and others do not identify a trial trigger.

Return scope to Discovery when three or more eligible participants reject the core object model, name a first-release blocker outside the accepted boundary, or prefer a current substitute with no credible ownership or workflow advantage.

These are Discovery decision rules, not O-001 acceptance thresholds.

## Outputs

- completed anonymized [findings-matrix.csv](./findings-matrix.csv);
- one valid private session record per participant using [session-record.schema.json](./session-record.schema.json);
- synthesis with participant counts, disconfirming evidence, and recommended changes;
- updated A-001/A-002 confidence and the three retained Discovery QA gaps;
- local Control Tower readback with CT-1 disposition and any bounded follow-up issues.
