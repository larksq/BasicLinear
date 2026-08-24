# CT-81 Loopback Runtime Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_TESTING_PENDING`. One locked Node 24 process now serves the built application and API on loopback over embedded SQLite. Source, automated, build, built-process, restart, operator, and recovery-artifact checks pass. Independent clean-user, platform, rendered, and migration-source acceptance remains with CT-82 and CT-12.

## Supported Runtime Contract

- `npm start` is the sole documented runtime command after `npm install` and `npm run build`.
- Fastify serves production assets, extensionless SPA routes, health, and `/api` from the same loopback listener.
- The process accepts only `127.0.0.1` or `::1`; remote bind configuration fails before database or listener startup.
- Defaults require no environment file, token, password, credential, database server, container, TLS proxy, or outbound request.
- Data resolves to a platform-standard directory containing `openlinear.sqlite3` and `backups/`. Optional port, data-directory, web-root, and bounded session-TTL overrides remain local operational controls.
- Automatic bootstrap creates exactly one owner, one implicit workspace/team/membership, five default statuses, and one issue sequence. No collaboration administration route is registered.
- Sessions and CSRF state exist only in process memory. Restart expires the cookie's server-side state, the UI renews locally, and persisted product data is unchanged.

## Security Contract

- Exact Host is required for every request. Present Origin must match exactly; every mutation requires the same Origin.
- Every API mutation requires `application/json`; all authenticated mutations require session cookie plus CSRF.
- The owner-bootstrap endpoint also requires a loopback peer and is rate limited.
- The cookie is opaque, `HttpOnly`, `SameSite=Strict`, path `/`, and has no `Max-Age` or `Expires` attribute.
- CSP permits only same-origin scripts and connections; frames and objects are denied. Inline CSS remains permitted because virtualization position and user-selected colors are expressed as React style attributes.
- Logs redact cookie, authorization, CSRF, set-cookie, and token fields.

## Storage And Recovery

- Schema 2 removes `password_hash` from the schema-1 owner profile inside an atomic migration. No account-credential or session table exists.
- Database opens use foreign keys, defensive mode after migration, a two-second busy timeout, WAL, `synchronous=FULL`, and short `BEGIN IMMEDIATE` writes.
- Corrupt, future-schema, symlink, non-directory, unwritable, and migration-failure cases fail with actionable local errors; migration rollback is asserted.
- Canonical import and backup output are verified, synced, atomically promoted, and mode `0600`. Completed standalone artifacts contain no WAL or shared-memory sidecar.
- The canonical v1 database-backup parser remains for transfer compatibility only. Its legacy users/OIDC arrays are validated as source metadata and discarded from runtime authentication.

## Verification Matrix

| Check | Result |
|---|---|
| Focused local runtime/storage/foundation suite | 3 files, 20 tests passed |
| Complete unit/source regression | 56 files, 386 tests passed; 0 failures |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,946 modules; 1,027,388 bytes; no chunk warning |
| Clean-output scan | 0 pg/Kysely/PostgresDialect/openid-client/Argon matches in API, database, or operator output |
| Retired dependency tree | 0 direct pg, Kysely, openid-client, Argon, or pg-type packages |
| Final listener | One Node process on `127.0.0.1:4275`; no wildcard or remote listener |
| Health / SPA / asset miss | `200` / `200` / `404`; SPA shell 663 bytes |
| Host / Origin / JSON / CSRF | Hostile Host `403`; hostile Origin, non-JSON, missing/invalid CSRF rejected in automated matrix |
| Local owner bootstrap | `201`; exactly one owner, workspace, and team; ephemeral Strict HttpOnly cookie |
| Project workflow | Missing CSRF `403`; valid CSRF `201`; 12 canonical records after write |
| Multiple tabs | Session read `200`; a distinct second CSRF token was issued without invalidating the first |
| Restart | Old session `401`; renewal `200`; created project persisted |
| Canonical export | Digest `ca9a78224dc244b52cbb91af58f9d5c8056a8b2970b532bb5477794faed91399`; SHA-256 `62f6413edd628aa8570d755876a7482e10a11009223fea8cb263df7e5c055109` |
| Online backup | Schema 2, 55 pages, integrity `ok`, 0 FK violations, `0600`, one file, no sidecars |
| Backup SHA-256 | `ac2d7aa0d8063f0ff940196ba9734cdc9c74a134a1b83961d48b335c80f76ee9` |
| Outbound-denied workflow | Passed with global runtime `fetch` forced to reject |
| Release-audit regression | 2 tests passed |
| Public release audit | Expected `NOT_READY`; runtime build inputs pass, downstream gates remain open |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-001 / P-T03 | One locked start path, single listener/process, same-process static/API service, deterministic clean build. |
| R-002 / P-T04 / P-T05 | Automatic sole-owner bootstrap, stable implicit scope metadata, restart persistence, project workflow. |
| R-014 / P-T15 / P-T21 | Platform data paths, schema migration, verified backup/restore primitives, clean local topology, no server/container dependency. |
| R-101 / P-T16 / P-T18 | Loopback-only bind, exact Host/Origin, JSON-only mutation, ephemeral session, per-tab CSRF, no credentials or outbound request. |
| R-106 / R-109 | Fail-closed bind/path/schema/corruption handling, strict local boundary, no reachable collaboration administration. |

## Review Boundary

This was a second-pass review by the implementation actor, not independent acceptance. It found and corrected static fallback, stale-output, CSP, and backup-sidecar defects. No blocking source finding remains. Browser control was unavailable under the active execution policy, so final rendered, responsive, visual-fidelity, keyboard, focus, and accessibility claims were not repeated. CT-82 and CT-12 remain the acceptance owners.

## Authority And Privacy

All issue and milestone state is in `.control-tower/tasks-v0.8.sqlite3`; provider projection is disabled and `not_synced`. Runtime evidence used a synthetic owner and temporary local paths. Cookie and CSRF values were kept in private temporary files and are not present in this package. No Linear API/MCP/UI, Chrome authorization, Google account, Docker process, database server, or external service was used.

## Control Tower Completion

The authoritative local store read back CT-81 as `Done@3`, stable ID `3f54fea5-3822-451b-8300-0baaa8f9d170`, with store health `ready` and provider projection disabled/`not_synced`. The optimistic update backup SHA-256 is `8837c0ace0613a3ec3f88ad553bb04d60829ee3500fec37fb19c6f189851cbcb`. CT-82 remains `Todo@1`, and CT-12 remains `In Progress@58`.
