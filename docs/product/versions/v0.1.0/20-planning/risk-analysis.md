# Planning Risk Analysis

## Decision posture

The project uses a Heavy approval posture for public identity, license, security boundary, acceptance thresholds, destructive data operations, and release. The current user goal authorizes the bounded product build and local Control Tower mutations. It does not supply independent user evidence or qualified legal conclusions. Reversible private implementation can continue under a yellow gate; public distribution cannot.

## Risk register

| ID | Risk | Likelihood / impact | Prevention | Detection and trigger | Owner / issue |
|---|---|---|---|---|---|
| PR-001 | Reference fidelity copies protected identity, assets, copy, or trade dress | Medium / Critical | Clean-room separation, distinct tokens/copy/assets, synthetic fixtures, provenance inventory | Private-evidence scan or unexplained asset stops publication | Product/release owners, CT-3 and CT-13 |
| PR-002 | Working name conflicts with another mark or implies affiliation | High / High | Internal codename only; naming search and qualified review | Any unresolved clearance or confusing identity blocks public name | Product owner, CT-3 |
| PR-003 | Local data is exposed through a remote listener, hostile browser origin, unsafe path, symlink, log, export, or restore | Medium / Critical | Loopback-only bind, exact Host/Origin/CSRF checks, safe paths, restrictive permissions, redaction, verified promotion | Any confirmed unauthorized access blocks affected release and starts incident review | Security owner, CT-81/82 and CT-11 |
| PR-004 | Concurrent edits silently lose work | Medium / High | Expected revisions, ETags, transactions, idempotency keys, explicit conflict UI | Stale-writer test that overwrites data blocks the mutation path | Backend owner, CT-6/8/11 |
| PR-005 | Rich text enables stored XSS or unsafe links | Medium / Critical | Versioned JSON, sanitization, CSP, safe link policy | Security fixture or CSP report blocks issue/comment rendering | Security/frontend owners, CT-8/11 |
| PR-006 | Backup, restore, or migration loses authoritative records | Medium / Critical | Canonical digest, pre-upgrade backup, explicit migrations, empty-target restore | Any digest mismatch or irrecoverable trial blocks release | Operations owner, CT-10/12 |
| PR-007 | Dense fidelity work becomes brittle or inaccessible | High / High | Semantic primitives, stable grid tracks, density tokens, keyboard and AT design | Overlap, hidden focus, serious axe finding, or failed keyboard path blocks screen | Frontend/accessibility owners, CT-9/12 |
| PR-008 | Scope expands toward broad Linear parity | High / High | Fixed exclusions, requirement traceability, vertical slices, change control | New feature without source/outcome link is rejected or returned to Discovery | Product owner, CT-5 |
| PR-009 | Docker, a database server, cloud, identity, or paid service re-enters local operation | Medium / High | One pinned loopback process/file, network-denied test, dependency and command audit | Failed offline workflow or undocumented runtime/credential blocks release | Platform owner, CT-81/82/13 |
| PR-010 | License choice conflicts with adoption or dependencies | Medium / High | CT-3 decision, dependency policy, notices, automated inventory | Incompatible or unknown dependency license blocks merge/release path | Product/legal/release owners, CT-3/13 |
| PR-011 | Benchmarks expose private workspace content | Medium / High | Private evidence directory, synthetic/non-submitted actions, no provider mutation | Privacy scan or fixture provenance gap invalidates benchmark artifact | UX/test owners, CT-2/12 |
| PR-012 | Framework choices fail seeded scale or restart behavior | Medium / High | CT-4 disposable spike before acceptance, explicit reversal decisions | Missed controlled budget, nondeterministic visual run, or unsafe restart triggers re-plan | Technical lead, CT-4 |
| PR-013 | Bounded scan search or saved filters produce unstable ranking or miss the accepted interaction budget | Medium / High | Typed filter AST, deterministic TypeScript ranking/sort, result bounds, accepted workload measurement | Relevance failure or measured budget miss blocks search/view release and may justify one focused index | Backend/test owners, CT-9/80/82 |
| PR-014 | In-process change hints cause stale or duplicated browser state after restart | Medium / Medium | Mutation response authority, bounded refetch, revision comparison, transient cursor reset | Restart/reconnect regression triggers explicit refresh or redesign | Backend/frontend owners, CT-81/9 |
| PR-015 | Online statistics do not predict actual migration or exact import effort | Medium / High | CT-77 denominator/limitation register and sensitivity analysis; bounded one-owner slices; controlled product measurements | Credible new population evidence overturns the stable rank or migration loss invalidates recovery, returning affected scope to Discovery | Product/recovery research, CT-77 and later measurement |
| PR-016 | Historical generalized tenancy leaks unsupported collaboration controls or tables into v0.1 | High / High | Explicit one-owner contract, hidden administration routes/forms, compact SQLite schema, supported-surface tests | Any login/workspace/team/member/invite/role/sharing/non-owner-assignee control blocks current acceptance | Product/frontend/storage/test owners, CT-78/80/12 |
| PR-017 | O-002 target is accepted without a baseline | High / High | Immutable `baseline_needed` contract and CT-2; implementation-only automatic resolution | Any efficiency claim before baseline/window is rejected | UX research, CT-2/14 |
| PR-018 | Node's release-candidate synchronous SQLite API blocks the event loop, changes incompatibly, or fails interruption recovery | Medium / High | Pin Node 24 patch line, isolate storage adapter, bound queries, serialize writes, measure event-loop impact, test interruption/backup/rollback | API drift, long blocking trace, corruption, or failed recovery returns the adapter/runtime to Planning | Technical/test owners, CT-80/82 |
| PR-019 | Automated or AI-generated work bypasses human gates | Medium / High | Same review/test evidence for generated changes; human ownership of protected decisions | Missing human acceptance or provenance blocks protected path | Product/technical/release owners |

## Threat boundary

Protected assets include the local database, process session and CSRF value, projects/issues/comments/rich text, exports and backups, private research evidence, local filesystem paths, and public release provenance. Threat fixtures include a remote listener attempt, hostile web origin, unexpected Host, malicious rich-text payload, corrupt or multi-scope import, symlink/path traversal, stale browser client, and unsafe recovery command. These are security-test constructs, not supported v0.1 roles.

The first release does not claim defense against a compromised local OS account or an attacker who can directly read the owner's files. Documentation must state that boundary. The process cannot bind remotely, accept unexpected origins, or follow unsafe data paths; private content and paths do not enter logs or public artifacts.

## Failure and rollback controls

- A failed SQLite migration leaves the prior file recoverable and emits an actionable plan; no unverified destructive startup promotion.
- A failed optimistic mutation restores confirmed server state in the client and retains the user's draft when feasible.
- A failed event channel degrades to explicit stale indication and bounded refetch; it cannot accept mutations independently.
- A failed restore leaves the previous target untouched and preserves the source, backup, temporary database, and verification evidence.
- A failed visual or accessibility check blocks the affected screen, not unrelated data/operations work.
- A clean-room failure blocks public artifacts while private functional remediation can continue.

## Human gates

`CT-3` requires product-owner and qualified review for public name, license, clean-room publication, and attribution policy. Security release acceptance requires the security owner. Visual baselines require frontend, accessibility, and test ownership. Backup/restore acceptance requires operations and test ownership. The release decision requires product, technical, security, test, operations, and qualified clean-room reviewers. No tool login or existing Google account substitutes for these decisions.

## Residual risk accepted for yellow readiness

CT-77 supports the narrowed workflow rank but does not establish migration rate or exact switching effort. CT-2 has not supplied an accepted reference baseline and CT-3 has not cleared the public boundary. CT-79 establishes a proportionate direction but does not prove the implementation. CT-80, CT-81, and CT-82 must close SQLite parity, runtime, and recovery risk; CT-78 must remove unsupported collaboration controls. CT-13 remains blocked.
