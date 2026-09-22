# Outcome Contracts

The canonical machine objects, including immutable digests, are in `discovery-package.json`. This document explains the same five contracts for review.

## O-001 Core workflow completion

- **Population:** the configured technical owner using the supported single workspace and team.
- **Workload:** ten independently reset canonical seeded runs.
- **Metric:** percent of runs completing local-runtime entry, project and milestone planning, issue execution, saved view, context-preserving detail edit, and persisted readback without facilitator intervention or a critical error.
- **Baseline:** `0%`, measured from repository inspection on 2026-08-18 through 2026-08-19 because no runnable product existed.
- **Target:** at least `90%` in the 2026-10-26 through 2026-11-09 release-candidate observation window; earliest review 2026-11-10.
- **Guardrail:** confirmed unauthorized local API, remote-listener, or data-path access events must remain `0`.
- **Invalidation:** completion at or below `70%` after two bounded remediation rounds.
- **Status:** ready for Planning; medium confidence.

## O-002 Reference interaction efficiency

- **Population:** the configured owner completing the eight approved project, milestone, issue, view, and detail tasks in matched BasicLinear and approved reference conditions.
- **Metric:** median percentage overhead in task completion time, with interaction count reported as a diagnostic.
- **Baseline:** measurement required; `CT-2` produced an internal diagnostic, but qualified acceptance of the matched reference evidence remains required.
- **Provisional target:** no more than `10%` median time overhead during 2026-09-05 through 2026-10-20; earliest review 2026-10-21. Planning cannot accept this threshold until the baseline is measured.
- **Guardrail:** task error rate no more than `5%`.
- **Invalidation:** median overhead at or above `30%` after two bounded interaction revisions.
- **Status:** baseline needed; low confidence.

## O-003 Structural visual fidelity

- **Population:** approved clean-room project, milestone, issue-list, and issue-detail fixtures at pinned desktop, tablet, and mobile viewports.
- **Metric:** percent of comparable unmasked pixels differing beyond the per-pixel tolerance, aggregated as the worst approved fixture.
- **Baseline:** `100%` difference because no UI existed at bootstrap.
- **Target:** at most `3%` structural difference during 2026-10-10 through 2026-10-23; earliest review 2026-10-24.
- **Guardrail:** serious automated accessibility violations must remain `0` on core screens.
- **Invalidation:** worst-fixture difference at or above `10%` after two bounded visual revisions.
- **Status:** ready for Planning; medium confidence. Planning may tighten per-screen thresholds after the clean-room harness exists.

## O-004 Data ownership and round-trip integrity

- **Population:** supported one-process local releases using the canonical seeded dataset and SQLite upgrade path.
- **Metric:** percent of export/import and backup/restore trials preserving canonical record and relation digests.
- **Baseline:** `0%` because no export, backup, or restore capability existed at bootstrap.
- **Target:** `100%` during 2026-10-15 through 2026-10-23; earliest review 2026-10-24.
- **Guardrail:** critical data-loss defects must remain `0`.
- **Invalidation:** any result below `100%` on the release candidate.
- **Status:** ready for Planning; medium confidence.

## O-005 Clean-room public release readiness

- **Population:** the complete public source, build output, local runtime artifact, documentation, assets, and release manifest.
- **Metric:** percent of mandatory clean-room, identity, license, attribution, private-evidence exclusion, and reproducible-build audit checks passing.
- **Baseline:** `0%` because no public release package existed at bootstrap.
- **Target:** `100%` during 2026-10-24 through 2026-11-12; earliest review 2026-11-13.
- **Guardrail:** private authenticated reference artifacts found in the distribution must remain `0`.
- **Invalidation:** any audit result below `100%` at release decision.
- **Status:** ready for Planning; low confidence until `CT-3` resolves the requested public identity and qualified license/release review ownership. The maintainer-selected `AGPL-3.0-only` metadata is already applied.

## Measurement integrity

Every observation records source revision, build identity, environment, fixture version, owner pseudonym or trial identity, run number, task start/end rule, errors, retries, result, and artifact path. Outcome Review cannot combine incompatible task definitions or environments without an accepted normalization method. Screenshot success cannot substitute for task completion, and capability coverage cannot substitute for any outcome.
