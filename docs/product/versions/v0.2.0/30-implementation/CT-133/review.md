# CT-133 implementation review

## Primary self-audit

The primary implementation session re-read the complete CT-133 diff and checked the following boundaries:

- only allowlisted event attributes are accepted; injected `rawToken` or `commentBody` fields fail validation;
- audit changes contain before/after digests rather than raw values;
- identical retries deduplicate and conflicting reuse of a stable ID fails closed;
- workspace, actor, source, occurrence/receipt time, request/correlation, provider, period, and source-reference provenance are mandatory;
- economics use integer micro-USD values;
- synthetic fixtures remain `fixture_only`, empty production cohorts remain `baseline_needed`, and no target evaluation occurs in Implementation;
- O-201 uses a ten-minute correlated journey, O-202 uses a seven-day member loop, O-203 uses a seven-day post-trial conversion, and O-204 keys canonical tasks by collision-free workspace/run/task/surface/role/environment tuples; and
- the package adds no provider credential, deployment, live billing, agent, code-review, repository, or PR capability.

No primary-session defect was found after the targeted and full-workspace checks.

## Independent gate

### Review 1

Reviewer: `/root/ct133_independent_review` (distinct from `codex-primary`).

Decision: failed. The reviewer reproduced seven actionable finding groups:

- P1: false O-202 joins allowed pre-acceptance, wrong-assignee, cross-issue activity and lacked a durable member-action event;
- P1: G-203 included unrelated workspaces and undefined partial-period allocation;
- P1: G-202 and G-204 lacked privacy-safe identity/target facts and stable audit reconciliation;
- P2: colon-delimited O-204 identities collided and omitted role/environment;
- P2: non-empty production data became baseline-ready before window maturity;
- P2: token-shaped actor IDs and inconsistent Stripe/user provenance passed; and
- P2: recoverable bootstrap attempts counted as terminal G-201 errors.

The reviewer ran the targeted test, hosted typecheck, diff validation, adversarial numerical probes, privacy probes, and changed-file/scope checks. No file or CT mutation was made by the reviewer.

### Remediation

The primary implementation added explicit member-action semantics and ordered same-issue joins; cohort-scoped, fully-contained economics; an audited email-match result and principal/target facts with audit references; collision-free role/environment tuples; completeness-watermark maturity; typed opaque actor references with source consistency; final-attempt bootstrap disposition; and adversarial regression fixtures.

### Review 2

Reviewer: `/root/ct133_independent_review` (distinct from `codex-primary`).

Decision: failed. The reviewer found five remaining groups: arbitrary first-match joins could miss a later valid O-202 chain; G-202 reused the first-invite cohort instead of the full invitation ledger; production maturity ignored ten-minute/seven-day outcome tails; audit reconciliation omitted request/timestamp/entity identity; and unsalted email digests plus credential-shaped generic strings violated the stated privacy boundary.

### Remediation 2

The primary implementation now searches every ordered assignment/action/comment candidate, separates the complete invitation ledger from the one-workspace denominator, uses explicit per-outcome maturity timestamps, requires unique exact event-to-audit request/time/entity reconciliation, stores only an audited email-match boolean, and rejects common credential shapes in every validated text field. Regression fixtures cover the reviewer’s reproduced cases.

Status: re-review pending. This file does not claim the remediation author is an independent reviewer. CT-133 remains In Progress until the distinct reviewer passes the remediated changed-file set.

### Review 3

Reviewer: `/root/ct133_independent_review` (distinct from `codex-primary`).

Decision: failed with one remaining P1 boundary defect. G-202 observed acceptances from the window start through its seven-day tail, but its invitation ledger excluded a valid invitation sent immediately before the denominator window.

### Remediation 3

G-202 now reconciles against the complete deduplicated invitation ledger. The O-202 denominator alone applies the eligible-in-window and first-invite-per-workspace filters. A regression fixture proves that a valid audited pre-window invitation accepted inside the guardrail window is accepted by G-202 while leaving the O-202 denominator at zero.

### Review 4

Reviewer: `/root/ct133_independent_review` (distinct from `codex-primary`).

Decision: passed with no actionable findings. The reviewer independently reproduced the pre-window invitation boundary: an invitation at `2026-10-31T23:00:00Z` accepted at `2026-11-01T01:00:00Z` remains outside the O-202 cohort while G-202 reconciles the valid audited acceptance against the complete ledger. The reviewer also regression-checked every Review 1 through Review 3 finding, requirement and acceptance coverage, privacy/audit provenance, outcome maturity, changed-file completeness, and prohibited-scope exclusion.

Independent results: one targeted file and 15 tests passed; the full suite passed 74 files and 499 tests; hosted typecheck, `git diff --check`, and the boundary probe passed. The reviewer changed no file, Control Tower record, commit, or external state.

Status: independent implementation review passed. CT-133 is eligible for Done after the pass is recorded in the checkpoint and the Control Tower mutation receives fresh readback. No outcome success is claimed.
