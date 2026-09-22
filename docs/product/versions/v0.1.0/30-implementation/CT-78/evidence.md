# CT-78 Single-Owner Surface Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. The web client now exposes only the accepted personal owner surface, the automatic owner route is bodyless and loopback-only, and available source, unit, type, build, and local-host checks pass. Database-backed transition/restart execution and rendered browser/UAT acceptance remain pending under CT-80 through CT-82 and CT-12.

## Implemented Contract

- A valid session with exactly one owner workspace enters the application. Missing, multiple, or non-owner workspace context fails closed.
- First run creates fixed owner, workspace, team, and status metadata without user choices. A returning fixed owner can recover a local session after cookie expiry; a non-loopback peer receives `403` before database access.
- The shell exposes only My work, Projects, Issues, Views, and Workflow. There is no login, recovery, workspace picker/creation, team switcher/creation, Teams/Members administration, invitation/member/role UI, identity footer, or collaboration badge.
- Required team, membership, and status metadata loads before feature surfaces. Missing metadata produces an explicit migration error rather than rendering generic multi-team controls.
- Issues and embedded project issues create under the fixed owner. Team and assignee choices are absent in owner mode while internal IDs continue to scope queries and relationships.
- Projects retain their internal team ID but do not render team creation fields, headings, group choices, columns, properties, or activity changes.
- Saved views form one owner library. Creation and rename writes force `private`; Access controls, sharing sections, owner names, and sharing columns are absent.
- Legacy workspace/team/admin URLs clear scoped record state, drop former scope parameters, and canonicalize to a supported owner destination.

## Verification

| Check | Result |
|---|---|
| Focused owner/API/layout/capability suite | 5 files, 31 tests passed |
| Complete unit regression | 55 files, 375 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,946 modules; 1,027,209 bytes; no chunk warning |
| Fixture syntax | Passed |
| Local production host | 4 of 4 requests returned 200; fixed-owner session contained one owner workspace |
| Unsupported built-output scans | No collaboration/admin, setup/login/OIDC, or saved-view Access match |
| Release-audit regression | 2 tests passed |
| Public release audit | `NOT_READY`; independent downstream gates remain open |
| PostgreSQL transition integration | 7 files / 17 tests discovered and skipped because required URL/password are absent; not counted as a pass |
| Rendered browser acceptance | 0 captures and 0 assertions; blocked by the established browser policy |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-001 / R-002 / R-003 | Automatic fixed owner context and one reachable application scope. |
| R-005 / R-008 | Owner-default issue creation and personal saved-view behavior preserve internal record scope. |
| R-009 / R-010 | Searchable owner destinations, named controls, loading geometry, and fail-closed feedback remain accessible in source contracts. |
| R-101 | The automatic endpoint has no request body or external credential and rejects non-loopback peers before database access. |
| R-107 / R-109 / R-110 | Canonical route cleanup, explicit unavailable-state handling, fixed-scope query inputs, and negative control scans fail closed. |

## Review Corrections

1. Treating first bootstrap as sufficient was rejected: a returning local owner without a valid cookie also needs automatic local recovery.
2. Automatic owner recovery on the transitional network-capable API was unsafe without a peer check; the endpoint now rejects non-loopback addresses before any database operation.
3. Hiding team controls only after query completion was insufficient because generic branches could flash during loading; owner-dependent surfaces now wait for the complete context.
4. Keeping disabled Team fields, team headings, team grouping, activity fields, and saved-view Access metadata was not equivalent to removing collaboration choices; those presentations are gone.
5. Historical multi-scope fixture data may remain as negative migration/security input, but the application either filters it into the implicit context or fails closed and never renders its controls.
6. HTTP and string scans are not pixel or accessibility-tree acceptance. No rendered-browser result is claimed.

## Architecture Boundary

The current PostgreSQL setup/auth/OIDC/server routes remain transitional server code until CT-80 and CT-81 complete the SQLite migration and one-process runtime. The production web bundle no longer references them. CT-78 adds no Docker, database server, schema, index, role, RLS, outbox, or remote-access design.

## Privacy And Authority

All evidence uses repository source and deterministic synthetic local fixture data. No Docker process, authenticated Linear observation, Google account, external identity, provider credential, private workspace data, or outbound runtime request was used. Project-local Control Tower v0.8 remains the sole task and milestone authority.

## Acceptance Boundary

This evidence closes implementation only. It does not pass the SQLite migration, restart/recovery, clean-host, network-denied runtime, rendered responsive/a11y, independent UAT, outcome, legal/brand, provenance, or release gates.

## Control Tower Completion

The maintainer authorized CT-78's exact recommendation on 2026-08-21. The project-local v0.8 task store read back CT-78 as `Done@5`, CT-12 as `In Progress@58`, and CT-13 as `Todo@59`, with store health `ready` and provider projection disabled/`not_synced`. Each optimistic update created a private backup; their SHA-256 values are `91145beafdcb5f662ce0cd48344598fe6f9ae9cf5f507da2051c62c8a00ff0d1`, `ff472f80da0e3e6b929a1026e55a3fd13b5ba716f15e3530dad5fc78d2a1670a`, and `4cf8f6ff43f72ec183582c87fac5d501f1b4be7d9ec86961721f17fc9f118218` respectively.
