# CT-81 Implementation Session

- Issue: `CT-81`, stable ID `3f54fea5-3822-451b-8300-0baaa8f9d170`, starting revision `2`, intended completion revision `3`.
- Session: `CT81-IMPL-20260821T061533Z`.
- Actor: `codex-loopback-runtime`.
- Mode: code-mutating implementation, verification, live local smoke testing, and second-pass source review.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser authorization, Google account, Docker, database server, or external identity was used.

## Scope

Make the accepted one-owner, one-implicit-workspace/team boundary the only reachable v0.1 runtime. Replace the supported container, PostgreSQL, credential, and identity topology with one Node 24 Fastify process serving the built web application and API on loopback over one embedded SQLite file.

## Execution

1. Added platform-standard local data, database, and backup path resolution with optional local overrides, owner-only directory/file modes, regular-file checks, and actionable path, corruption, and migration errors.
2. Added one `npm start` path that verifies the production web build, opens schema-2 SQLite, serves the SPA and API from one Fastify process, binds only to `127.0.0.1` or `::1`, and closes cleanly on `SIGINT` or `SIGTERM`.
3. Replaced password, setup-token, logout, and OIDC flows with automatic loopback owner bootstrap plus process-memory opaque sessions. Cookies are `HttpOnly`, `SameSite=Strict`, and ephemeral; each tab receives a separate CSRF token accepted by the same session.
4. Enforced exact Host and Origin, same-origin Origin on mutations, JSON-only API mutations, CSRF on authenticated mutations, loopback peer checks on bootstrap, strict CSP, and secret-safe logging.
5. Removed workspace/team/member administration routes and retained only read-only internal scope metadata needed by project, milestone, issue, status, view, search, and activity workflows.
6. Removed Dockerfiles, Compose, Nginx, PostgreSQL adapters and migrations, pg/Kysely, password hashing, OIDC packages and UI/runtime code, the legacy integration runner, and container-era release controls.
7. Retained the versioned canonical backup parser so an old export can still transfer its selected public workspace records. Legacy credentials and identity records are neither imported into runtime tables nor used for local access.
8. Reworked the local operator around SQLite health, canonical import/export, online backup, verification, restore, and path reporting.

## Review Corrections

The final source and live-process review corrected four defects before evidence freeze:

1. Missing asset URLs initially fell through to `index.html`, and the asynchronous not-found handler could report a reply-already-sent error. Extension-bearing misses now return `404`, while extensionless routes retain SPA fallback.
2. TypeScript left deleted PostgreSQL and OIDC modules in `dist`. The root build now removes all generated output with a cross-platform Node cleaner before compilation, and the cleaner is hash-pinned.
3. The initial CSP blocked React inline style attributes used for virtualization geometry and status/label colors. Inline CSS is allowed while script, connection, frame, object, and form policies remain local and restrictive.
4. WAL-mode online backups could leave temporary `-wal` and `-shm` sidecars after atomic promotion. Backup/import artifacts are finalized as standalone files before verification and promotion; runtime re-enables WAL when it opens a restored database.

## Verification

- Focused CT-81 suite: 3 files / 20 tests passed.
- Complete regression: 56 files / 386 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,946 modules and 1,027,388 bytes; no chunk warning and no stale PostgreSQL/OIDC runtime modules.
- Final built-process smoke on Darwin arm64 with Node `24.18.0`: exact loopback listener, health `200`, SPA `200`, missing asset `404`, hostile Host `403`, bootstrap `201`, missing CSRF `403`, valid project mutation `201`, and second-tab CSRF renewal `200`.
- Restart: the stale process-memory session returned `401`, local-owner renewal returned `200`, and the created project remained present.
- Built operator: 12-record canonical export plus a single-file `0600` backup passed at schema 2 with integrity `ok`, zero foreign-key violations, and no sidecars.
- Outbound-denied workflow is covered by replacing global `fetch` with a rejecting spy in the final runtime test; the project workflow still passes.
- Release-audit regression: 2 of 2 tests passed. The live public-release audit correctly remains `NOT_READY` for separate CT-3, CT-82, provenance, revision, and accountable-review gates.

## Handoff

CT-81 implementation is complete. CT-82 and CT-12 retain independent clean-user, cross-platform, last-PostgreSQL-fixture, network observation, rendered browser, recovery, accessibility, and UAT authority. No clean-host setup, workflow outcome, fidelity outcome, or public-release claim is made here.

## Completion Readback

The project-local helper created a pre-update backup with SHA-256 `8837c0ace0613a3ec3f88ad553bb04d60829ee3500fec37fb19c6f189851cbcb` and advanced CT-81 from `In Progress@2` to `Done@3`. Stable ID, S3 milestone, healthy local authority, and disabled/`not_synced` provider projection were preserved. CT-82 read back as `Todo@1`; CT-12 remains `In Progress@58`.
