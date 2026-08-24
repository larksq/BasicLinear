# CT-6 Implementation Session

## Scope

- Control Tower issue: `CT-6`, stable ID `7d88459a-3877-4bc0-b628-0d6ed6031558`, revision `2`, status `In Progress`, milestone `S3 Implementation`.
- Completed dependency: `CT-4`, stable ID `c6ce2ff5-54c8-4d70-84c4-8a06d3ad3718`, revision `3`, status `Done`.
- Planning package: `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`.
- Requirements: `R-001`, `R-002`, `R-014`, `R-101`, `R-102`, `R-106`, `R-109`.
- Tests: `P-T03`, `P-T04`, `P-T05`.
- Mode: code-mutating production foundation.

## Allowed paths

- Root workspace controls: `package.json`, `package-lock.json`, `tsconfig.json`, `.npmrc`, `.env.example`, `.gitignore`, and `README.md`.
- Production code and operations: `apps/**`, `packages/**`, and `ops/**`.
- CT-6 evidence: `docs/product/versions/v0.1.0/30-implementation/CT-6/**`.

Existing Discovery, Planning, PMO, Control Tower, and CT-4 prototype artifacts are read-only inputs for this session. Generated dependency and build outputs remain ignored.

## Intended outputs

1. One locked TypeScript npm-workspace monorepo with React/Vite web, Fastify API, pure domain/contracts, PostgreSQL/Kysely data boundary, shared configuration, and synthetic fixtures.
2. Local one-time setup, email/password login, opaque sessions, logout, password change, administrative recovery, and no required OIDC or external service.
3. Workspace, team, membership, and workflow-status core with service capabilities, PostgreSQL RLS, expected revisions, idempotent creates, activity, and outbox foundations.
4. Explicit SQL migrations, separate application and migration roles, liveness/readiness, secret-safe errors/logs, and one supported Docker Compose topology on an internal network.
5. Unit, API, PostgreSQL isolation, conflict, restart, and network-denied evidence plus an implementation handoff.

## Session record

Actor: Codex in the current user-authorized goal. No sub-agent or external coding agent is used. The project-local Control Tower v0.8 store remains the only work authority; all provider projections remain disabled.

## Actual outputs

- Created the locked root workspace, eight application/package workspaces, three SQL migrations, operator CLI, and one pinned Compose topology.
- Implemented one-time setup, local authentication, session rotation, logout, recovery, workspace/team/membership/status workflows, service capabilities, RLS, expected revisions, idempotency, activity, and outbox foundations.
- Built and ran final API, web, operator, test, and PostgreSQL images. The live QA ingress is `http://localhost:4175`.
- Captured synthetic desktop, tablet, and mobile screenshots under `evidence/`; private Discovery screenshots remained untouched and ignored.

## Review and corrections

The browser pass found a mobile status-row grid overlap and focus escaping from modal dialogs; both were corrected and rechecked. The closing security review found a missing composite workspace/team relationship and RLS policies that did not require the transaction workspace for a user with multiple memberships. Migrations `002` and `003`, scoped repository lookups, and adversarial regressions now enforce both boundaries. Source maps, raw error-object logging, duplicate proxy headers, and permissive origin/session-TTL parsing were also corrected before the final build.

## Validation record

- `npm run typecheck`: pass across eight workspaces.
- `npm test`: pass, nine tests across three files.
- `npm run build`: pass; web bundle 252.48 kB / 76.95 kB gzip without source maps.
- Dockerized real-PostgreSQL integration: pass, one end-to-end case with local auth/recovery, two-workspace RLS, composite-FK, replay, conflict, atomic activity/outbox, restart, and least-privilege assertions.
- Compose config/build, three-migration plan, operator doctor, security headers, network-denied internal workflow, dependency audit, and Chrome responsive/focus/runtime checks: pass.
- Exact evidence and hashes are in `evidence.md` and `result.json`; exact mutated paths are in `changed-files.txt`.

## Failure and exception history

The first in-sandbox npm advisory request could not resolve the registry; the required escalated retry passed with zero vulnerabilities. Docker Desktop 4.15.0 / Engine 20.10.21 deadlocks every container with a mount on this host. Production Compose still contains the required named volume and builds/validates; runtime verification used the exact images and equivalent networks without mounts, with restart persistence in the disposable database container. Full clean-host volume rehearsal remains assigned to CT-10/P-T15 and CT-12/P-T21.

## Handoff boundary

CT-6 implementation output is complete. This session does not validate O-001 or O-004 and does not replace the planned independent CT-11/CT-12 gates. CT-7 and CT-8 are the next dependency-closed implementation issues.
