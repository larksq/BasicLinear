---
title: "Success Measures"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Success Measures

## North-star

The north-star metric is the core workflow completion rate: the share of ten fixed, independently reset runs in which the configured owner completes the defined project, milestone, issue, find/focus, and recovery workflow on a self-hosted release without facilitator intervention or a critical error. The population is the supported technical owner; the workload is ten canonical seeded runs; the unit is percent; the aggregation is a rate; and improvement is upward.

The bootstrap repository had no runnable product, so its measured system baseline on 2026-08-19 is zero completed product workflows out of the defined suite. Planning seals the suite and observation protocol before comparison. The initial target is at least 90 percent completion across the ten release-candidate runs; CT-77, rather than interviews, owns any workflow-priority reconsideration.

## Leading indicators

Leading indicators cover implementation and usability readiness. Requirement coverage measures the percent of Must requirements with passing automated and manual evidence. Workflow slice completion measures how many core journeys pass end to end with persisted readback. Keyboard parity measures the percent of core actions reachable through approved shortcuts and the command palette. Visual stability measures screenshot-difference ratios on clean-room fixtures. Migration stability measures successful forward and rollback rehearsal. Scope-evidence integrity measures whether CT-77 source denominators, limitations, scoring, and sensitivity remain reproducible.

These indicators are not product outcomes. They reveal whether the system is ready for outcome measurement. A high screenshot pass rate cannot offset failed task completion; broad unit-test coverage cannot offset workspace leakage; shipped features cannot offset self-host failure.

## Lagging indicators

Lagging indicators begin only after a releasable owner deployment exists. They include seven-day owner return, issues updated per deployment, saved-view reuse, project milestone progression, upgrade success, restore success, and reported critical defects per deployment. No numeric baseline is invented for these measures. Control Tower issues define measurement tasks, data source, owner function, observation window, and earliest review date before Outcome Review treats them as evidence.

Public adoption signals such as stars or downloads may inform reach but do not prove utility. The product should prefer active local owners completing work over vanity counts. Any optional analytics must be disabled by default and privacy-preserving; the owner can produce local reports without sending usage data to the project maintainers.

## Measurement plan

O-001 core workflow completion is measured through ten instrumented owner runs using independently reset synthetic data. O-002 interaction efficiency compares repeated owner task time and interaction count against an approved controlled reference benchmark for the same task definitions. O-003 spatial fidelity compares approved clean-room screenshots using pinned browser, operating system, fonts, viewport, seeded data, deterministic motion, and documented masks. O-004 ownership quality measures export/import and backup/restore round-trip success. O-005 public clean-room readiness uses a release audit of identity, assets, licensing, attributions, and private-evidence exclusion.

Each observation record includes source revision, build identity, environment, owner identity pseudonym, run number, task definition, start/end rules, errors, retries, result, and artifact location. Outcome Review cannot mix measurements from incompatible task definitions or environments without an explicit normalization method.

## Guardrails

The primary guardrails are zero confirmed unauthorized access through remote listeners, hostile browser origins, or unsafe local paths; zero critical data-loss defects; zero private reference assets in the distribution; zero inaccessible core workflows that block keyboard-only use; and a failed-workflow rate below ten percent in the release cohort. Performance guardrails include no regression beyond the Planning-approved p75 interaction latency budget on the seeded dataset. Operational guardrails require a successful SQLite backup before upgrade and a tested restore on the release candidate.

A security or privacy guardrail breach blocks release regardless of feature or fidelity metrics. A visual regression can block an affected screen but does not justify unsafe masking. An adoption metric cannot justify weakening data ownership or silent telemetry.

## Decision rules

Proceed from Discovery when the problem, target segment, first-release boundary, clean-room policy, requirements, outcome contracts, and measurement tasks are traceable. Proceed from Planning when architecture, UX, acceptance, risk controls, test strategy, and issue graph are accepted. Proceed from Implementation when every planned slice has changed-file and check evidence. Proceed from Testing when all Must requirements have independent results and no critical finding remains open.

Release only when the north-star workflow suite is runnable, guardrails pass, restore evidence is current, and public clean-room review is accepted. If core workflow completion remains below 70 percent after two bounded remediation rounds, stop broad implementation and revisit the interaction model or owner workflow. If credible comparative evidence consistently favors an existing open-source alternative, reconsider differentiation rather than adding undirected features.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register establishes the current zero-product baseline through repository inspection, derives workflow content from official product documentation and historical authenticated observation, and supports deterministic visual measurement through Playwright. WCAG 2.2 informs accessibility; official Node and SQLite sources inform the local-runtime decision. PostgreSQL sources remain historical evidence for the superseded build.
