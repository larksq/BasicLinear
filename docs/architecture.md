# Architecture

BasicLinear is a single-user, local-first application. The supported runtime is
one Node process bound to loopback, a React client served by that process, and
one SQLite database. There is no remote service or required network dependency.

## Request flow

```text
Browser
  -> apps/web (React, Vite-built assets, query/cache state)
  -> apps/api (Fastify routes, cookies, CSRF, validation, events)
  -> packages/contracts (request/response and transfer schemas)
  -> packages/domain (pure rules, validation, error semantics)
  -> packages/db (SQLite repositories, migrations, backup, transfer)
  -> local basiclinear.sqlite3
```

The API also serves the built web directory in production. In split development
mode Vite serves the web assets on `127.0.0.1:5173` and proxies `/api` and
`/health` to the API on `127.0.0.1:4174`.

## Package responsibilities

| Path | Responsibility | Boundary |
| --- | --- | --- |
| `apps/web` | Screens, interaction state, keyboard behavior, views, and responsive UI. | Calls the same-origin API; never writes SQLite. |
| `apps/api` | HTTP routes, session lifecycle, CSRF, rate limits, security headers, and static hosting. | Depends on contracts, domain, and db. |
| `packages/contracts` | TypeBox schemas and canonical transfer contracts. | Shared by API, web, and transfer tests. |
| `packages/domain` | Pure business rules and typed error semantics. | No HTTP, filesystem, or SQLite imports. |
| `packages/db` | SQLite client, migrations, repositories, backup, restore, export, and import. | Owns durable state and file safety. |
| `packages/ui` | Shared UI entry point and semantic design tokens. | No persistence or request side effects. |
| `packages/test-fixtures` | Deterministic fixtures for unit, contract, and browser-equivalent tests. | Test-only data. |
| `ops/cli` | Non-interactive health, backup, transfer, and restore operations. | Uses the same local database rules as the API. |
| `scripts` | Build cleanup, release manifests, provenance, audits, and local fixtures. | Not part of the runtime request path. |

## Durable state

The first local owner session creates one owner, one implicit workspace, one
implicit team, and the default workflow metadata. Project, milestone, issue,
view, relation, comment, activity, and transfer data live in SQLite. Sessions
are process-memory only and are renewed after restart. The database uses
rollback journaling and `FULL` synchronous durability; a transient `-journal`
file during a transaction must be left for SQLite recovery.

The operator creates owner-only backups and canonical exports. Import and
restore validate the complete canonical digest before atomic promotion. See the
[recovery runbook](./operations/recovery.md) for the operational sequence.

## Security boundary

- The host is restricted to `127.0.0.1` or `::1`.
- State-changing requests require same-origin, JSON, SameSite, HttpOnly, and
  per-tab CSRF protections.
- Data directories and generated transfer files use owner-only permissions on
  supported Unix-like hosts.
- No Google account, browser profile, OAuth token, Linear provider, or external
  identity is read or required.
- No Docker, PostgreSQL, or outbound runtime service is part of v0.1.

## Build order

`npm run build` compiles the workspaces in dependency order: domain, contracts,
db, ui, test fixtures, API, operator, then web. The production API expects the
web build at `apps/web/dist`; use `npm run build` before `npm start`.
