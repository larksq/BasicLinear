# User Research

## Decision method

`CT-1` was canceled before recruitment because five interviews could not represent the required variety of projects. `CT-77` replaces that method with a reproducible synthesis of four official large-sample sources, question-level denominators, population coverage, limitations, and vendor conflicts. No outreach, interview, participant data, authenticated competitor access, Linear API, or Linear MCP contributed to the decision.

The evidence base contains a declared survey-sample lower bound of `61,246`, plus Atlassian telemetry from `1 million` platform users and `24 million` Jira tickets. These are separate populations, not a pooled sample, and may overlap.

## Coverage

| Evidence | Population coverage | Relevant signal |
|---|---|---|
| E-020 | More than 49,000 developers in 177 countries; work, personal, and school project questions | Issue/collaboration tools are common; work uses many tools; security/privacy, price, usability, and time cost affect adoption; AI is low priority. |
| E-021 | 2,246 project professionals and 342 leaders worldwide across industries and regions | Predictive, hybrid, and agile approaches all have material use; no single delivery method can define the core. |
| E-022 | More than 5,000 DevSecOps professionals in 39 countries | 64% want toolchain consolidation; 67% report mostly or completely automated lifecycles. |
| E-023 | 5,000 knowledge workers across work management, ITSM, and DevOps, plus large product telemetry | Goal fragmentation, inconsistent tracking, duplicate work, and hard-to-find information are material problems. |

The complete source and statistic register is in [`CT-77/source-register.json`](./CT-77/source-register.json) and [`CT-77/extracted-statistics.csv`](./CT-77/extracted-statistics.csv).

## Strongest-pain segment

The first-release decision unit is one technically capable owner operating one workspace and one team. The owner manages multiple issue-based projects and values a compact, free, self-hostable system with reliable APIs, data ownership, and low interaction cost. The evidence intentionally spans professional and personal software work, work management, ITSM, DevOps, and cross-industry predictive, hybrid, and agile projects.

This is an evidence-backed product inference, not a claim that the source populations are current Linear users or will migrate to BasicLinear. Multi-user collaboration, membership administration, invitations, presence, and multi-team UX do not drive `v0.1.0`.

## Migration-critical ranking

The accepted workflow order is:

1. issue capture and lifecycle;
2. find and focus;
3. project and milestone planning;
4. data ownership and recovery;
5. context and traceability.

The top-three set remains stable under default, equal, prevalence-heavy, and migration-risk-heavy weights. Ownership/recovery and traceability remain release-critical because losing authoritative records, relationships, history, or retrieval paths makes migration unsafe even when those operations are less frequent. The scoring rules and sensitivity table are in [`CT-77/scoring-model.md`](./CT-77/scoring-model.md).

## Urgency evidence

The maintainer's replacement need is direct. Broader statistical pressure is directional: 64% of the GitLab/Omdia sample wanted toolchain consolidation; 54% of Stack Overflow work-tool respondents used at least six tools; security/privacy and pricing were the top two work-project rejection factors; and 55% of Atlassian's knowledge-worker sample found information hard to locate.

These statistics justify a bounded product decision. They do not establish a switching deadline, willingness to pay, self-hosting tolerance, or conversion forecast, and no such claim is made.

## Expected behavior change

The owner deploys the system, creates projects and ordered milestones, captures and updates issues, retrieves focused work through repeatable views, retains context and traceability, and completes export, backup, and restore without a vendor account. The outcome is persisted repeated work, not the presence of screens.

## Remaining evidence boundaries

Online statistics cannot establish exact Linear import-format prevalence, field-level migration loss, pixel fidelity, task-time parity, rendered usability, accessibility, security, or recovery correctness. Import and switching effort remain an explicit partial market-research gap. The other qualities remain governed product tests and outcome measurements rather than user-research claims.

`CT-2` retains only an internal automated benchmark diagnostic and does not validate O-002. `CT-3` continues to quarantine historical authenticated evidence and gate public clean-room claims. `CT-12` and Outcome Review retain independent product acceptance.
