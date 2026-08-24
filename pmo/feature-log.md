---
title: "Feature Log"
status: "current"
source: "roadmap-and-control-tower-local-v0.8"
refreshed_at: "2026-08-24T10:38:06+08:00"
---
# Feature Log

## Authority and ordering

This is the readable feature projection. The project-local Control Tower v0.8 store remains authoritative for issue status, priority, milestone, and dependencies. The snapshot below contains 132 issues and 4 active issues; 121 are Done and 7 are Canceled. The remaining active rows are CT-3, CT-13, CT-14, and CT-15.

Order is `Urgent` → `High` → `Medium` → `Low`. Within one priority, unblocked review and correction work precedes qualification, aggregate acceptance, release review, outcomes, and retrospective. A lower-priority correction may therefore execute before an urgent aggregate gate that depends on it.

## Current v0.1 execution queue

| Priority | Execution order | Feature or gate | Control Tower issue | State and next action |
|---|---:|---|---|---|
| Urgent | 1A | Public name and clean-room approval | CT-3 | Todo; technical packet is complete. Obtain qualified human review in parallel with engineering review. |
| Urgent | 1B | Issue-board metadata keyboard and ARIA semantics | CT-118 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| Urgent | 1B | Primary navigation resets direct issue routes | CT-123 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| Urgent | 1B | CSP-compatible appearance bootstrap and first-party favicon | CT-125 | Done; commit `819e182` passes focused appearance coverage, 8/8 typechecks, a warning-free build, and fresh browser CSP/network review. |
| Urgent | 1B | Keep milestone target dates editable on mobile | CT-126 | Done; commit `9d55621` passes the focused responsive contract, fresh 390x844 target-date readback, and no-overflow browser check. |
| Urgent | 1B | Keep project list actions reachable on mobile | CT-127 | Done; current candidate commit `886e246` passes the focused responsive contract, full regression, and fresh 390x844 action-bound readback. |
| Urgent | 2 | Refresh current clean-runtime qualification | CT-128 | Done; distinct actor passed 4/4 runner contracts and 21/21 strict P-T21 checks for sealed candidate `e701241`, with zero outbound/subprocess attempts and a mode-0600 private receipt. |
| Urgent | 3 | Refresh independent integrated core workflow acceptance | CT-129 | Done; distinct actor passed 13 current-candidate P-T18 browser checks, 73/483 regression tests, and 8/8 typechecks for sealed candidate `e701241`, with a mode-0600 receipt and no product findings. |
| Urgent | 3C | Complete current-candidate P-T19/P-T20 Chrome matrix | CT-131 | Done; independent Chrome 151 evidence passes 23/23 checks, 60/60 named Light/Dark captures, axe/custom accessibility, keyboard, System, forced-state, and protected-performance checks for exact `307983e`. |
| High | 3D | Package v0.1.0 for open-source handoff | CT-132 | Done; README, architecture/configuration/status docs, `.nvmrc`, CI, explicit `.env` setup guidance, corrected split-dev proxy, and fresh install/runtime verification are complete. |
| Urgent | 4 | Clean local install, upgrade, backup, and restore | CT-82 | Historical Done; strict P-T21 qualification is accepted only for exact revision `5a33d28`, with zero outbound attempts. CT-128 owns the current-candidate refresh. |
| Urgent | 5 | Integrated workflow, accessibility, performance, fidelity, and recovery acceptance | CT-12 | Historical Done; complete acceptance is bound to exact revision `5a33d28`. Current-candidate integrated workflow and strict-runtime freshness remain separately bound by CT-129/CT-128, while full current P-T19/P-T20 freshness is bound by CT-131. |
| Urgent | 6 | Accountable source-release audit | CT-13 | Todo; CT-131 full current-candidate P-T19/P-T20 evidence and the qualified/accountable review requests are current for `307983e`; CT-3, provenance approvals, and accountable acceptance remain open. |
| Urgent | 7 | Release-candidate outcome review | CT-14 | Todo; blocked by CT-12/CT-13 current-candidate closure. CT-2 is evidence, not an active blocker. |
| High | 1C | Refresh current-candidate visual and responsive acceptance | CT-130 | Done; bounded independent P-T19/P-T20 evidence covers 27 desktop and 15 mobile Light/Dark/System states, 98 keyboard stops, and mobile milestone date geometry for exact e701241. Full axe/assistive-technology, forced-colors/zoom/cross-platform, retained golden, and comparable-performance coverage remains explicitly unaccepted. |
| High | 1B | Long issue-title auto-sizing | CT-117 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| High | 1B | Saved-view action-cell semantics | CT-119 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| High | 1B | Workflow-action touch targets | CT-120 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| High | 1B | Rich-text multiline textbox semantics | CT-121 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| High | 1B | Selected issue-row metadata contrast | CT-122 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| High | 1B | Remove duplicate screen-reader context | CT-124 | Done; independently reviewed in the CT-117–124 closeout at exact revision `5a33d28`. |
| Medium | 7 | Evidence-backed v0.1 retrospective | CT-15 | Todo; blocked by CT-14. Close only after issue, milestone, release, and outcome reconciliation. |

The eight CT-117–124 corrections form one review wave, but remain separate issues because they change different components and require bounded evidence. CT-12 remains the single exact-revision acceptance verdict rather than being split into competing acceptance states.

## Post-v0.1 candidate features

These priorities are provisional product order derived from the roadmap and CT-77 workflow ranking. `Foundation` means a related capability exists; it does not mean the later feature is implemented. No later-version implementation issue is created until its Discovery boundary and target version are accepted.

| Priority | Candidate feature | Control Tower match | Mapping status |
|---|---|---|---|
| P1 | Generic imports | CT-10, CT-80, CT-85 (Done) | Export, canonical transfer, and scope-selection foundations exist; no generic-import delivery issue yet. |
| P1 | Templates | None | Untracked candidate; needs user/workflow Discovery and a later-version issue. |
| P1 | Project updates | CT-47, CT-68 (Done) | Rich overview and revision-safe editing foundations exist; no project-update feed issue yet. |
| P1 | Richer progress analytics | CT-7, CT-22, CT-53 (Done) | Derived progress and milestone drill-down foundations exist; no analytics issue yet. |
| P1 | Mobile refinement | CT-20, CT-24, CT-102, CT-106, CT-117, CT-120, CT-123 (Done) | Core responsive foundations and current corrections are complete; no separate next-version refinement issue yet. |
| P2 | Timelines | None | Untracked candidate; requires interaction, data-model, and accessibility Discovery. |
| P2 | Calendars | None | Untracked candidate; requires date/workload and accessibility Discovery. |
| P2 | Desktop packaging | CT-81 (Done foundation) | One-process runtime exists; installer, signing, updates, and platform support are untracked. |
| P2 | Local automation | CT-10 (Done foundation) | Operator CLI exists; automation model, permissions, triggers, and recovery are untracked. |
| P3 — new Discovery | Remote access | CT-79, CT-81 (Done exclusion decisions) | Explicitly outside v0.1; requires a new threat model and runtime boundary. |
| P3 — new Discovery | Multiple users | CT-58 (Canceled); CT-76, CT-78 (Done scope decisions) | Explicitly removed from v0.1; do not reopen without new population, permission, and concurrency evidence. |
| P3 — new Discovery | OIDC | CT-48 (Canceled) | Historical implementation issue is not a backlog item; new Discovery is required. |
| P3 — new Discovery | Real-time presence | None | Requires multi-user identity, concurrency, and privacy Discovery. |
| P3 — new Discovery | Webhooks | CT-16 (Done internal event-feed foundation) | No outbound webhook feature exists; delivery, authentication, retry, and privacy need Discovery. |
| P3 — research only | Cycles | None | Create an issue only if new broad evidence shows migration blockage. |
| P3 — research only | Initiatives | None | Create an issue only if new broad evidence shows migration blockage. |
| Deferred | AI agents, code review, customer management, billing, marketplace integrations | None | Outside the current product lifecycle; each requires separate Discovery. |

## Maintenance rules

- Add a feature only with a priority, horizon, decision state, and CT mapping or an explicit `None` gap.
- Never treat a Canceled issue as pending work. Reference it only as a historical scope decision.
- Refresh the current queue from the local task store after task mutations; do not infer status from this Markdown file.
- When a later version is opened, create one bounded top-level issue per accepted feature and replace `None` with its stable CT identifier.
