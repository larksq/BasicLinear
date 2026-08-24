---
title: "Risk and Controls"
status: "draft"
source: "codex-ai-research"
authored_at: "2026-08-19T13:31:05Z"
research_basis: "live-web-and-confirmed-input"
---
# Risk and Controls

## Risk method

Risks are scored qualitatively by likelihood and impact, then governed by the strongest applicable control. Critical risks can expose private data, destroy authoritative records, create legal release exposure, or invalidate the product's core outcome. High risks can make the first release unusable or unmaintainable. Medium risks degrade adoption or delivery predictability. The Heavy approval posture applies to product scope, acceptance, security boundary, public identity, license, and release decisions.

Controls must be testable. “Be careful” is not a control. Every critical or high risk names a prevention mechanism, detection evidence, accountable role, trigger, and residual risk. Changes that materially weaken a control require a decision record and repeat validation.

## Risk register

| ID | Risk | Likelihood / impact | Control and evidence | Owner role |
|---|---|---|---|---|
| RK-001 | Pixel-level work copies protected brand, assets, copy, or trade dress | Medium / Critical | CT-3 clean-room policy, pause on authenticated competitor observation, distinct identity, private screenshots excluded from Git, asset provenance inventory, qualified pre-release review | Product owner and legal reviewer |
| RK-002 | Working name creates trademark confusion | High / High | Treat OpenLinear as internal codename, run naming search and counsel review, select distinct release brand before publication | Product owner |
| RK-003 | A hostile web origin, remote listener, or unsafe path reaches the owner's local data | Medium / Critical | Loopback-only bind, strict Host/Origin/CSRF, safe-path checks, restrictive permissions, corrupt/import rejection, adversarial local API tests | Security owner |
| RK-004 | Concurrent edits silently overwrite state | Medium / High | Transactional mutations, optimistic revisions, explicit conflict UI, replay tests | Backend owner |
| RK-005 | Rich text or attachments introduce stored XSS or unsafe files | Medium / Critical | Sanitization, allowlisted rendering, content security policy, file-type/size rules, security tests | Security owner |
| RK-006 | Backup or migration failure loses authoritative records | Medium / Critical | Versioned migrations, pre-upgrade backup, restore rehearsal, round-trip digests, rollback runbook | Operations owner |
| RK-007 | Fidelity pursuit creates brittle CSS and inaccessible focus behavior | High / High | Semantic layout primitives, token system, viewport matrix, accessibility tests, controlled visual baselines | Frontend and accessibility owners |
| RK-008 | Scope expands toward all Linear features before core quality is proven | High / High | First-release exclusions, requirement traceability, outcome gates, flat Control Tower issues | Product owner |
| RK-009 | Local use requires undocumented services, credentials, or setup steps | Medium / High | One start command, one documented data path, no runtime secret, clean-user CT-82 test, network-denied runtime, explicit health check | Operations owner |
| RK-010 | Open-source license choice conflicts with adoption or contribution goals | Medium / High | Compare AGPL, MPL, and Apache implications; record sponsor decision and third-party inventory | Product owner and legal reviewer |
| RK-011 | Reference benchmarks use private workspace data | Medium / High | Synthetic fixtures, private evidence directory, `.gitignore`, pre-release secret/privacy scan | Test owner |
| RK-012 | Architecture is overbuilt beyond the one-owner evidence boundary | Low / High | CT-79 replaces Docker/PostgreSQL with one process/file; no dual-dialect runtime, OIDC, RLS, outbox, FTS, or speculative indexes; new scale features require evidence | Technical lead |
| RK-013 | Embedded synchronous SQLite blocks the UI service or loses data during migration | Medium / Critical | Accepted workload ceiling, bounded queries, short immediate transactions, event-loop measurement, verified online backup, temporary migration target, atomic promotion | Data owner, CT-80/82 |

## Controls

The clean-room control separates public requirements research from implementation. As of 2026-08-20, further authenticated Linear observation is paused pending qualified review of the current service terms. Researchers may use public official documentation and record generic functional behavior; implementers use synthetic fixtures, independently written code, and independently chosen libraries. A release audit rejects private screenshots, Linear names or logos, copied microcopy, unlicensed fonts, and unexplained binary assets. The detailed working control is [`CT-3/clean-room-policy.md`](../docs/product/versions/v0.1.0/10-discovery/CT-3/clean-room-policy.md).

The data control uses one local authority, validated internal scope IDs, transaction boundaries, durable activity records, optimistic revisions, versioned migrations, and recoverable deletion. The local-security control uses loopback-only bind, exact Host/Origin/CSRF checks, safe data paths, and restrictive permissions. The runtime control requires health, backup before migration, restore proof, rollback, and network-denied operation.

The quality control pins browser, fonts, viewport, seeded data, and animation state for visual tests while separately testing responsive and accessibility behavior. Visual thresholds are per screen and reviewed; a global lax threshold is prohibited. Component abstractions are accepted only when they preserve stable dimensions and interaction semantics.

## Triggers

Immediate stop triggers include any remote or hostile-origin data access, irreversible data loss, unsafe restore promotion, private-path escape, credential exposure, new authenticated competitor observation without qualified approval, private reference evidence entering tracked files, dependency license incompatibility, or public branding without review. These triggers block only affected paths unless they invalidate the entire release candidate.

Re-planning triggers include credible population evidence overturning CT-77's stable workflow set, two failed remediation rounds below 70 percent task completion, architecture unable to meet latency with the seeded scale, authentication recovery failure, or more than twenty percent of Must requirements changing after Implementation begins. A competitor discovery that removes differentiation triggers a product review, not automatic abandonment.

## Ownership

The product owner owns problem, scope, segment, sponsor license decision, brand decision, outcome targets, and release. The qualified legal or brand reviewer owns public license compatibility, identity, attribution, and clean-room clearance. The technical lead owns architecture, data model, migration design, and operational envelope. The security owner owns authentication, authorization, XSS, secrets, and threat-model controls. The frontend owner owns interaction fidelity and performance. The accessibility owner independently reviews keyboard and assistive-technology behavior. The test owner owns requirement mapping, environment identity, and evidence integrity.

Control Tower issues carry the actionable work and exact milestone. Repository documents carry rationale and contracts. No account access, repository permission, or tool availability silently changes decision authority.

## Residual risk

Even with controls, an independent product can resemble a reference and attract legal challenge; qualified review reduces but does not eliminate that risk. Screenshot comparisons vary across rendering environments; pinned CI reduces noise but manual review remains necessary. Loopback binding does not protect against a compromised local OS account or direct file access. SQLite permits one writer at a time and Node's synchronous API can block the process if work is unbounded. Owners can ignore backup guidance; the product can make safe behavior visible but cannot guarantee operator practice.

Exact switching prevalence, import-format mix, and willingness to migrate remain unmeasured. CT-77 reduces narrow-sample bias for workflow ranking but does not establish those claims. The project accepts bounded private implementation while product benchmarks and release gates run, but it does not accept public positioning or multi-user architecture commitments that depend on unsupported demand claims. These residual risks are reviewed at every stage gate.

## Evidence and sources

The [Research and evidence](./research-and-evidence.md) register records historical authenticated Linear observation, category risks through Plane/OpenProject/Taiga/Vikunja, local-storage feasibility through Node/SQLite, visual controls through Playwright, and accessibility through WCAG 2.2. PostgreSQL row-security evidence is retained as superseded architecture history. Legal conclusions remain outside the evidence claim and require qualified review.
