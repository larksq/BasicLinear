---
title: "Operating Loop"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Operating Loop

## Lifecycle

BasicLinear follows six Control Tower milestones: S1 Discovery, S2 Sprint Planning, S3 Implementation, S4 Testing, S5 Outcome Review, and S6 Retrospective. The stages are dependency ordered but evidence can evolve. Discovery defines what should change and why. Planning defines the accepted candidate. Implementation changes code. Testing independently establishes behavior. Outcome Review checks user and system outcomes after valid observation windows. Retrospective improves the process.

Each stage ends with a bounded handoff. A handoff includes accepted documents, unchanged outcome contracts, evidence references, unresolved assumptions, blockers, issue readbacks, and residual risk. A stage does not close because time elapsed or code exists.

## Roles

The product owner owns problem, segment, scope, outcome, and release decisions. The discovery owner maintains claims, evidence, source register, and user research. The technical lead owns architecture and candidate boundaries. Implementation owners work only inside issue-defined file scopes and acceptance obligations. The test owner verifies independently. Security and accessibility owners review protected qualities. The release owner verifies manifests, migrations, rollback, licensing, and distribution contents.

One person may hold several roles in the initial project, but evidence must still separate implementation from independent verification. Control Tower issue ownership names a role when a durable individual assignment is not yet available.

## Artifacts

The PMO corpus provides long-lived project intent. Discovery adds problem, user, market, technical, requirements, outcome, evidence, and critical-QA artifacts under the versioned product document family. Planning adds PRD, architecture, UX design, acceptance criteria, risk analysis, sprint plan, backlog, and quality review. Implementation attaches changed-file and check evidence to issues. Testing produces automated, manual, visual, accessibility, security, migration, and UAT results. Outcome Review preserves metric observations. Retrospective records process and AI-session findings.

The local Control Tower database remains the live issue and milestone ledger. No Markdown task mirror is created. Repository documents may reference stable `CT-n` identifiers after readback.

## Quality checks

Discovery records canonical critical-QA answers, material claims, requirements, evidence, outcomes, and normalized package validation. Planning records outcome contracts, architecture and UX decisions, risk controls, test methods, and an implementation-ready issue graph. Implementation records focused tests and readback for each slice. Testing maps Must requirements and critical findings. Release records migration, restore, privacy, security, accessibility, visual, licensing, and clean-room evidence through the technical audit.

Warnings remain explicit residual risk. A partial answer names its owner and gap. Failed or unknown checks identify work that must be resolved before relying on that evidence; they do not create a sponsor or external-approval gate. Validation scripts run from the repository and produce machine-readable output.

## Research refresh

External research refreshes at Discovery start, before Planning accepts architecture or license choices, and before public release. As of 2026-08-20, authenticated Linear reference observation is paused under CT-3; historical private screenshots stay local and quarantined. Competitor research uses public official repositories and documentation. Dependency and standards research uses primary sources. Workflow-scope evidence refreshes through broad online statistics with explicit denominators and limitations; product acceptance comes from controlled measurements and independent testing, not vendor marketing or a narrow interview sample.

A source change does not automatically change a decision. The owner identifies affected claims, requirements, outcomes, tests, and risks, then proposes a decision record. Inaccessible critical sources create blockers or replacement evidence.

## Feedback

Implementation feedback flows through failing tests, review findings, usability observations, performance traces, and issue activity. Product feedback is translated into evidence-labeled claims and bounded issues. Repeated friction becomes a Retrospective candidate only when its pattern, impact, and feasible control are visible.

The operating loop avoids status theater. Every issue has a deliverable, evidence location, due date when required, and one milestone. Dependencies express actual prerequisite closure rather than delivery order preference. Human attention is requested only for product choice, access, safety, provider write, legal, or release authority that cannot be inferred.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register supports the workflow surface, technical verification approach, and protected-quality standards. The Control Tower v0.8 local task contract governs issue and milestone mutations independently of Linear. External sources were accessed on 2026-08-19.
