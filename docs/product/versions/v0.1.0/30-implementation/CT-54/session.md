# CT-54 Implementation Session

- Issue: `CT-54`, stable ID `12ceee9a-dbb1-4c30-b819-f89e8041a448`, implementation revision `1`.
- Implementation session: `codex-recursive-route-validation` / `CT54-IMPL-20260820T134056Z`.
- Scope: stop Fastify route validation from mutating recursive rich-text and issue-filter union payloads, preserve strict unknown-property rejection, and execute the current PostgreSQL integration and recovery matrix.
- Discovery boundary: the first supported-migrator run reached project creation and returned `VALIDATION_ERROR`. Fastify's default `removeAdditional: true` stripped heading fields while evaluating the text-node branch of `anyOf`. A focused regression then exposed the second default mutation: type coercion changed a JSON filter value from `null` to an empty string.
- Validator boundary: request bodies use a dedicated Ajv compiler with coercion, defaults, and property stripping disabled. URL parameters, query strings, and headers retain Fastify-compatible scalar/array coercion. Both compilers reject rather than strip disallowed properties and keep `allErrors` disabled.
- Dependency boundary: `ajv@8.20.0` and `ajv-formats@3.0.1` are direct API dependencies; the implementation does not rely on Fastify's transitive dependency graph.
- Test boundary: one actual `buildApp` regression proves heading, list, nested text, group-filter, and nullable-condition fields survive validation unchanged while an unknown body property returns `400 VALIDATION_ERROR`.
- Database boundary: all seven integration files and 17 tests pass on PostgreSQL 16.10 inside the existing internal Docker verification network. The suite creates and drops isolated databases and exercises migrations 001 through 010, issue resources, rich project overviews, OIDC identities, milestone-grouped saved views, tenancy, conflicts, export/import, backup/restore, and protected populated upgrades.
- Recovery boundary: the migration test now reconstructs the pre-010 saved-view constraint, rejects a milestone group before migration, blocks an unbacked populated upgrade, accepts a verified backup, applies migration 010, and then persists milestone grouping.
- Automated result: two focused files and four tests pass, all 35 files and 213 complete tests pass, all eight workspaces typecheck, and the 1,930-module production build passes without a chunk warning.
- Fixture boundary: owner and guest shells, sessions, and workspace milestone catalogues at `http://127.0.0.1:4181/` return HTTP 200 after the exact production build. The guest session remains read-only.
- Cleanup boundary: no integration database remains. The unused temporary non-superuser role and the ephemeral in-container source harness were removed. Existing BasicLinear database, API, web, network, and fixture processes were not replaced or reset.
- Browser boundary: no screenshot or rendered interaction assertion is claimed because the approved local browser surface remains unavailable under the active security policy.
- Authority boundary: project-local Control Tower v0.8 is the sole issue and milestone authority. No Linear API, Linear MCP, or Linear UI was used for tracking.
- Status boundary: CT-54 remains In Progress pending independent browser/UAT evidence. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
