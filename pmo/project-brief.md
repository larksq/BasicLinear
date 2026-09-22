---
title: "Project Brief"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Project Brief

## Executive summary

BasicLinear is a clean-room, free, self-hostable project-management product centered on projects, issues, and milestones. Its first release aims to reproduce the reference product's operational quality: dense but legible information, fast keyboard workflows, persistent context, predictable editing, and strong progress visibility. The repository uses Control Tower local v0.8 as the sole work ledger. Linear is evidence for product research only and is not a project authority, API dependency, or synchronization target.

## Problem

Product and engineering teams can value Linear's speed and interaction model while still needing open source, self-hosting, data control, extensibility, or a no-license-cost core. Existing open-source products cover large portions of project management, but a maintainer seeking Linear-level interaction fidelity cannot assume that feature breadth translates into the same day-to-day speed or visual discipline. The project must therefore solve both functional replacement and experience parity without copying proprietary code, assets, brand, or private data.

## Opportunity

The opportunity is a deliberately narrow alternative that treats ergonomics as product infrastructure. The v0.1 owner should be able to deploy the application, enter the one workspace/team, define statuses, create projects and milestones, capture issues, find focused work, inspect dependencies, understand progress, and recover data without vendor lock-in. Open data and self-hosting become table stakes; differentiation comes from workflow quality and coherence.

## Users and stakeholders

The supported v0.1 user is one technically capable owner in one workspace and one team. The owner already understands issue trackers, manages multiple projects, and performs planning, issue execution, review, deployment, backup, and restore. CT-77 intentionally tests this narrow product decision against evidence spanning professional and personal software work, work management, ITSM, DevOps, predictive, hybrid, agile, and cross-industry projects. It does not claim that all survey respondents are prospective users.

The maintainer is the initial product owner and outcome authority. The public identity, license, provenance, and clean-room boundary are verified by the technical release audit. Security and test work provide repeatable workspace-isolation, authentication, functional, visual, accessibility, recovery, and migration evidence.

## Outcomes

The first product outcome is successful completion of the defined core workflow suite on a self-hosted deployment. Supporting outcomes cover interaction efficiency relative to the reference, visual-structure fidelity on approved clean-room fixtures, deterministic data round trips, accessibility, and workspace isolation. A shipped screen is an output; the user completing work quickly and correctly is the outcome.

Targets are initially planning hypotheses where no benchmark exists. Discovery records measurement work rather than inventing user or performance baselines. Release is invalidated if core task completion falls below the accepted threshold, workspace data can cross authorization boundaries, private reference assets enter the distribution, or self-hosted recovery cannot restore authoritative records.

## Scope boundaries

The first release exposes one local owner, one workspace, and one team; configurable statuses; projects and milestones; issues, priorities, labels, due dates, relations, and owner context; activity; list and board views; filters, grouping, ordering, saved views, keyboard creation, search, export/import, backup/restore, and one documented self-host deployment path. Generalized tenancy keys and adversarial isolation tests remain internal safeguards, not multi-user UX scope.

Cycles, initiatives, AI agent features, code review, advanced analytics, billing, customer support objects, native mobile apps, Slack, email ingestion, and arbitrary marketplace integrations remain outside the first release. Pixel-level fidelity applies to approved workflow fixtures and layout behavior; it does not authorize copying trademarks, proprietary assets, private content, hidden APIs, or source code.

## Confirmed input

Mission: Reproduce Linear's core project, issue, and milestone management experience with pixel-level UX fidelity as a free, open-source replacement.

Primary user: One technical project owner who values Linear's speed and interaction model but requires a free, self-hostable, open-source system.

First outcome: The owner can self-host BasicLinear and complete the defined core project, issue, milestone, find/focus, and recovery workflows with no critical product failure and near-reference interaction efficiency.

The maintainer also confirmed that all milestones and issues must be tracked in Control Tower without the Linear API or MCP integration. Existing authenticated Chrome and Google sessions may support authorized research and setup, but account access does not grant permission for unrelated provider writes or public disclosure of private data.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register links the confirmed goal, quarantined historical observation, official product and open-source sources, Node/SQLite, Playwright, WCAG 2.2, and CT-77's four large-sample statistical sources. PostgreSQL remains labeled as superseded architecture evidence. The workflow rank is an evidence-backed inference; migration rate, exact switching effort, product performance, and legal posture remain separate claims.
