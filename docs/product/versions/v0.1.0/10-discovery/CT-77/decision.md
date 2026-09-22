# CT-77 Workflow Priority Decision

Decision date: 2026-08-21

Control Tower issue: `CT-77`

Supersedes: `CT-1` interview-based workflow-ranking plan

## Decision

Use large-sample online statistics, not five interviews, to choose the first-release workflow boundary. The accepted migration-critical order is:

1. issue capture and lifecycle;
2. find and focus;
3. project and milestone planning;
4. data ownership and recovery;
5. context and traceability.

The top three are the stable daily-work set under every tested weight model. Data ownership/recovery and context/traceability remain release-critical because a migration is not credible when it loses authoritative records, relationships, history, or the ability to find them.

`v0.1.0` supports one owner in one workspace and one team. Invitations, membership administration, multi-team switching, shared assignment, presence, and other multi-user collaboration UX do not drive this release. Internal workspace/team checks remain because they protect data boundaries and future migration compatibility.

AI, advanced analytics, cycles, initiatives, marketplace integrations, and broad automation UX remain outside `v0.1.0`. Stable APIs and durable activity remain inside the architecture so later integrations do not require replacing the core.

## Basis

- Stack Overflow provides broad software work and personal-project coverage, with 30,065 collaboration-tool responses and question-level samples up to 35,897. Issue/collaboration systems are common, security/privacy and price are leading rejection factors, poor usability and time cost matter, and AI ranks ninth of ten endorsement attributes.
- PMI covers 2,246 project professionals across industries and regions. Predictive, hybrid, and agile approaches all have material use, so the core cannot assume a single delivery method.
- GitLab and Omdia cover more than 5,000 DevSecOps professionals in 39 countries. The 64% consolidation signal supports keeping work context together, but vendor maintainership caps its evidentiary weight.
- Atlassian covers 5,000 knowledge workers across work management, ITSM, and DevOps, plus large product telemetry. Goal fragmentation and information retrieval are material problems, but team findings do not expand the one-user release.

The full extraction and limitations are in [source-register.json](./source-register.json) and [extracted-statistics.csv](./extracted-statistics.csv). The reproducible ranking is in [scoring-model.md](./scoring-model.md).

## Evidence boundary

These sources do not directly measure current Linear users' migration intent, switching deadlines, import-file prevalence, self-hosting tolerance, or BasicLinear usability. They also do not validate pixel fidelity, task time, accessibility, security, or recovery. Those remain product acceptance and outcome measurements, not statistical claims.

No participant recruitment, outreach, interview, account access, personal data, Linear API, Linear MCP, or Linear task write was used for this decision.
