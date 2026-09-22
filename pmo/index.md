---
title: "PMO Index"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# PMO Index

## Purpose

This index is the governed entry point for BasicLinear's product-management corpus. The documents turn a broad ambition, replacing Linear's core experience with a free open-source product, into evidence-labeled scope, measurable outcomes, testable requirements, explicit risks, and a staged delivery path. They are decision support rather than implementation completion evidence. Control Tower owns live work state; these files own draft product intent and traceability.

## Document map

| Document | Decision supported |
|---|---|
| [Research and Evidence](./research-and-evidence.md) | Which claims are verified, inferred, assumed, or still missing evidence |
| [Project Brief](./project-brief.md) | Why the project exists, for whom, and which boundaries apply |
| [Product Definition](./product-definition.md) | Which user jobs, value proposition, and principles distinguish the product |
| [First Release](./first-release.md) | Which capabilities constitute the first releasable core and which do not |
| [Requirements](./requirements.md) | Which functional and quality obligations must be tested |
| [User Journey](./user-journey.md) | How setup, planning, execution, recovery, and accessibility should feel |
| [Success Measures](./success-measures.md) | Which outcome, efficiency, quality, and guardrail metrics govern decisions |
| [Risk and Controls](./risk-and-controls.md) | Which product, legal, privacy, security, and delivery risks require controls |
| [Decision Policy](./decision-policy.md) | Who may decide, what evidence is needed, and when escalation is mandatory |
| [Operating Loop](./operating-loop.md) | How Discovery through Retrospective progresses with evidence and review |
| [Roadmap](./roadmap.md) | What happens now, next, and later, with dependency and exit conditions |
| [Feature Log](./feature-log.md) | Which work is active by priority, how roadmap candidates map to Control Tower issues, and which gaps still need Discovery |
| [Assumptions and Open Questions](./assumptions-and-open-questions.md) | Which uncertain claims have owners, validation work, and decision dates |

## Reading order

New contributors should read the project brief, research register, product definition, and first-release boundary first. Designers should then read the user journey, requirements, measures, and risk controls. Engineers should read requirements, operating loop, roadmap, and assumptions before proposing architecture. Anyone checking a disputed claim should start with success measures and risk controls, then trace it through the requirements matrix to its source record.

The corpus uses stable identifiers across documents. Evidence is labeled `E-*`, outcomes `O-*`, requirements `R-*`, risks `RK-*`, and validation work `V-*`. A reference does not make a claim true; it makes the reasoning auditable. Verified facts, maintainer-confirmed input, inference, recommendation, assumption, and evidence gap remain distinguishable.

## Working cadence

The project uses the Control Tower lifecycle. Discovery records the evidence needed for Sprint Planning; Planning defines architecture, acceptance, UX, and the issue graph; Implementation produces bounded candidate slices; Testing verifies functional, visual, accessibility, privacy, and migration behavior; Outcome Review waits for valid observation windows; Retrospective converts repeated friction into bounded improvements. Material scope, legal posture, security boundary, release readiness, and outcome decisions are maintainer decisions supported by current evidence.

Each stage checks document freshness, source accessibility, unresolved assumptions, task readback, requirement-to-test coverage, and whether new evidence invalidates an earlier conclusion. The index changes whenever a governed document is added, retired, or materially re-scoped. Ordinary wording corrections do not alter its purpose.

## Evidence and sources

The centralized [Research and evidence](./research-and-evidence.md) register records first-party product documentation, historical authenticated UI observations, official open-source competitor repositories, Node and SQLite capabilities, Playwright visual testing, and accessibility standards. Superseded PostgreSQL sources remain labeled as historical architecture evidence. This index intentionally summarizes that register rather than duplicating vendor claims.
