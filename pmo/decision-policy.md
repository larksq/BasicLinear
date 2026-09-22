---
title: "Decision Policy"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Decision Policy

## Decision classes

BasicLinear distinguishes product, technical, quality, operational, legal/brand, and routine execution decisions. Product decisions change the target segment, problem, scope, outcome, or release promise. Technical decisions change architecture, data authority, security posture, migration model, or supported deployment. Quality decisions change acceptance methods or thresholds. Operational decisions change rollout, backup, support, or incident response. Legal/brand decisions change license, name, identity, attribution, or reference-use boundaries. Routine execution decisions select an implementation approach inside accepted contracts.

Material decisions cover problem framing, first-release scope, outcome contracts, acceptance thresholds, security boundary, destructive migrations, license, public name, and release. The maintainer records these decisions; routine reversible work proceeds inside the current technical controls.

## Authority

The maintainer owns product scope, outcomes, release identity, and release readiness. Technical, security, and test checks define whether a candidate is usable and safe enough to publish. The current release audit verifies the public name, license posture, asset provenance, notices, and clean-room boundaries without a sponsor or external reviewer.

Control Tower's project-local v0.8 database is authoritative for issues, milestones, statuses, and dependencies. Repository Markdown is authoritative for accepted product intent after its stage review. Git commits identify technical candidates once Git history exists. Linear has no authority in this project.

## Escalation

Escalation is required when a choice changes a Heavy decision, when evidence contradicts an accepted assumption, when an action creates external provider writes or persistent access not already authorized, when a security or privacy guardrail fails, or when rollback is uncertain. The escalation states a recommendation first, the exact affected scope, alternatives, evidence, reversible next step, owner, and decision deadline.

No global stop is declared when safe work can continue. A legal naming gap blocks public brand publication but not synthetic prototype work. A missing user benchmark blocks final efficiency target acceptance but not data-model investigation. A failed workspace-isolation control blocks all release candidates touching the affected authority path.

## Evidence

A decision record must cite stable evidence references, distinguish verified fact from inference and assumption, and explain why rejected alternatives do not satisfy current constraints. Vendor claims are not accepted as independent performance evidence. Private screenshots cannot be attached to public issues or tracked files. As of 2026-08-20, CT-3 pauses new authenticated competitor observation and quarantines prior authenticated-reference aggregates from publication. Test results identify source revision, environment, dataset, command or method, and artifact location.

If evidence is missing, the record names validation work, owner, due date, and decision point. Access to Chrome, Google, GitHub, or any other account is capability, not authority for unrelated external mutation.

## Cadence

Discovery, Sprint Planning, Implementation, Testing, Outcome Review, and Retrospective organize the work. Each stage records the relevant product, architecture, UX, risk, test, or outcome evidence; none creates a sponsor or external-approval gate. Security and visual changes receive repeatable checks when proposed rather than waiting until release. Urgent incidents can trigger immediate maintainer decisions, with the receipt recorded after containment.

## Decision record

Every material record includes ID, date, decision class, status, owner, question, recommendation, alternatives, evidence references, assumptions, affected requirements and outcomes, risk impact, effective point, and reversal condition. Rejected and superseded decisions remain discoverable. A new record supersedes rather than rewriting history.

The first required decisions include the release license, distinct public name, clean-room visual policy, target-user benchmark protocol, architecture, authentication recovery, and first-release acceptance thresholds. The maintainer's `AGPL-3.0-only` and BasicLinear identity selections are recorded inputs; the technical release audit is the release-readiness control.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register supplies the confirmed Control Tower/Linear authority boundary, historical reference UI observations, open-source license examples, Node/SQLite and Playwright capabilities, accessibility standards, and labeled PostgreSQL history. Technical release readiness is recorded through repeatable audit evidence.
