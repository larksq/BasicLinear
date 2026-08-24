# CT-6 Foundation and Workspace Core Evidence

## Verdict

`OUTPUT_DONE_FOR_CT7_CT8` on 2026-08-20. CT-6 delivers the accepted production foundation: a locked TypeScript workspace, local authentication and recovery, workspace/team/membership/status management, scoped PostgreSQL RLS, optimistic revisions, idempotent creates, activity/outbox records, health checks, operator commands, and a pinned Compose topology. This is implementation evidence. It does not claim outcome validation, public-release readiness, or the independent CT-11/CT-12 test verdict.

The repository is unborn and has no Git `HEAD`. Evidence is bound to Control Tower issue `CT-6` revision `2`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, exact changed paths in `changed-files.txt`, production-source manifest SHA-256 `e31d737f60764fa528225c667a9e454341a086bb8c32db28e87911a5a5a04f41`, and package lock SHA-256 `12013ae5bc30fba8a5fc2e54e629ca2ed3586c94e24168aed832e5be585217bb`.

## Delivered Boundary

- npm 11 workspace on Node 24 with React/Vite, Fastify, Kysely/PostgreSQL, pure domain/contracts packages, shared UI tokens, and synthetic fixtures.
- One-time setup token, Argon2id passwords, opaque 256-bit sessions stored only as SHA-256 digests, `HttpOnly`/`SameSite=Lax` cookies, login throttling, logout, password rotation, and non-interactive administrative recovery that revokes sessions.
- Workspaces, teams, local memberships, default and custom workflow statuses, stable UUIDs, capability checks, expected revisions, idempotency records, activity entries, and outbox events.
- `FORCE ROW LEVEL SECURITY` with a `NOBYPASSRLS` application role. Workspace-scoped policies require the transaction-local workspace even when the same user belongs to another workspace.
- Three digest-checked migrations. The second enforces the `(workspace_id, team_id)` relationship; the third scopes RLS reads and membership writes to the active workspace context.
- Separate migration/operator and application connections, structured correlation-safe errors, redacted logs, liveness/readiness, pinned images, internal database/API networking, and localhost-only web ingress.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass across 8 workspaces |
| `npm test` | Pass, 3 files and 9 tests |
| `npm run build` | Pass; production web bundle 252.48 kB, gzip 76.95 kB, no source maps |
| Real PostgreSQL integration | Pass, 1 end-to-end test, 644 ms test time, 958 ms total |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| Compose config and build | Pass for the complete pinned stack |
| Migration plan after restart | 3/3 applied with matching digests |
| Operator doctor | Pass; app role is neither superuser nor `BYPASSRLS`; schema ready |
| Network-denied probe | Internal API `200`; outbound HTTPS blocked |
| Service restart | API, web, and PostgreSQL restarted; authenticated readback remained Northstar / 2 teams / 2 members / 11 statuses |
| Browser runtime | 0 warning/error logs, 0 duplicate IDs, 0 unnamed buttons, 0 horizontal document overflow |

The integration suite covers one-time setup rejection on reuse, default statuses, login, session rotation, logout, password recovery, old-password rejection, restart readback, owner/member capability differences, two workspaces, cross-workspace API reads, same-user cross-context RLS reads, direct composite-FK rejection, idempotent replay, accepted and stale revisions, atomic activity/outbox writes, plaintext-session exclusion, column/table permission denial, and normal-role attributes.

## Requirement Trace

| Requirement | CT-6 evidence |
|---|---|
| R-001 | Local setup/login/logout/password change/recovery pass without OIDC or an external identity call. |
| R-002 | Workspace, team, membership, and status records retain stable IDs and read back after restarts. |
| R-014 | Pinned topology, migrations, health, restart, and network-denied core are implemented; the clean-host named-volume rehearsal remains explicitly owned by CT-10/P-T15 and CT-12/P-T21. |
| R-101 | Service capabilities plus same-user and different-user PostgreSQL isolation cases return no cross-context rows. |
| R-102 | Idempotent create replay returns one entity; stale status writes return `409` and preserve revision 2. |
| R-106 | Correlation-safe envelopes, body/cookie redaction, sanitized server failures, CSP, and clean runtime logs pass. |
| R-109 | Runtime source contains no required Linear/Google endpoint; local auth succeeds on an internal network with outbound traffic denied. |

## Browser Review

Chrome exercised the running production images at `1440x900`, `900x700`, and `390x844`. The review created a team and local member, created and edited a custom status, verified duplicate-key handling with a correlation ID, dismissed dialogs with Escape, confirmed trigger-focus restoration, and confirmed forward and reverse focus wrapping. Desktop, tablet, and mobile rows remain stable without overlap or horizontal overflow.

| Artifact | SHA-256 |
|---|---|
| `evidence/desktop-overview.jpg` | `54415e404e827169c2ad12d41e3439e13fa70b51a2ea39812b52334348bb6b4d` |
| `evidence/desktop-workflow.jpg` | `3886c57431e0f99897f4dcfb3ac6c51c85f7fcaa07bb5cfa1b48cd0c4529df79` |
| `evidence/tablet-workflow.jpg` | `6fdbd6d432fd63eec12403a96ced975c6f7a065ec33fe9aae69a6fdad839f4f0` |
| `evidence/mobile-workflow.jpg` | `175bd80134d88ba3dc438e3b9e748c97c938b47170553750369f1ebeb2676723` |

The browser pass found and corrected a mobile status-grid overlap and a dialog focus escape before capture. The closing source review also removed public source maps, avoided logging raw error objects, corrected duplicate proxy security headers, added strict origin/session-TTL validation, and fixed the composite team/status and workspace-context RLS boundaries.

## Images and Migrations

Final local images: API `dcdeb606fb5d` (309 MB), web `c39d5c23808f` (61.5 MB), operator `0df07e94333d` (309 MB), test `fafc29551264` (429 MB), and PostgreSQL `06928dd03c45` (450 MB). Running API, web, and database containers resolve to those exact image digests.

Migration SHA-256 values are `dd1fac4916d38f072f9fd49f31d0a89ff000b9b0d5cce0d588dea1754b0e7a3b`, `79c55276d5be91b4b36cd6fc66135bbb9a2879e529622159f7ba3c135f911f92`, and `15e41c9eff8401f6092d43b2c604633c7ac9f6cc2ba515b523648d3bd4fe256b`.

## Host Qualification

Docker Desktop 4.15.0 / Engine 20.10.21 on this host deadlocks container startup whenever any bind, named-volume, or tmpfs mount is attached. Mount-free containers run normally. The production Compose definition retains its named PostgreSQL volume and validates/builds successfully; verification therefore used the exact production images and equivalent internal/edge networks with PostgreSQL data in the disposable container writable layer. Container restart persistence passed. A full clean-host named-volume start/stop/restore rehearsal remains an explicit CT-10 and CT-12 acceptance item and is not claimed here.

## Handoff

CT-7 and CT-8 may start from this foundation. CT-11 remains the independent security/concurrency review, and CT-12 remains the integrated accessibility, visual, performance, and recovery acceptance owner. O-001 and O-004 remain unclaimed until their governed observation windows and downstream evidence complete.
