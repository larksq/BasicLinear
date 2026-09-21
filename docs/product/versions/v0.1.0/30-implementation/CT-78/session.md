# CT-78 Implementation Session

- Issue: `CT-78`, stable ID `3e63d5bb-8442-4441-b5bb-99cb3f8cbab9`, starting revision `4`, intended completion revision `5`.
- Session: `CT78-IMPL-20260821T042100Z`.
- Actor: `codex-single-owner-surface`.
- Mode: code-mutating implementation and verification.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, or UI used.

## Scope

Make one owner, one implicit workspace, and one implicit team the only reachable v0.1 product surface. Preserve the internal workspace/team/status IDs used by records and canonical migration while removing account, workspace, team, membership, role, saved-view sharing, and non-owner assignment choices from the rendered client.

## Execution

1. Reduced primary navigation to My work, Projects, Issues, Views, and Workflow, with one fixed OpenLinear brand and no account footer or administrative destinations.
2. Added a bodyless local-owner session endpoint with fixed defaults. First run bootstraps the owner context; a returning fixed owner can receive a fresh session after cookie expiry. Non-loopback peers are rejected before database access.
3. Removed setup, login, logout, password, OIDC, workspace creation, team creation, and membership creation methods from the web client.
4. Canonicalized legacy workspace/team/admin URLs to the owner surface, deleting record-specific state when the former scope is present.
5. Fixed issue creation to the owner, hid team and assignee choices in owner mode, and kept internal team/status scope for queries and relationships.
6. Hid the implicit team from project creation, grouping, visible properties, detail properties, activity fields, headings, and empty states. Embedded project issues inherit owner mode.
7. Collapsed saved views into one owner library and forced create/update sharing scope to private without an Access control or column.
8. Added an owner-context loading/fail-closed gate so generic team controls cannot flash before internal scope queries resolve or when required owner metadata is absent.
9. Removed dead collaboration, administration, overview, and loading selectors and revised the former multi-scope source contracts into fixed-owner regression tests.

## Verification

- Focused owner/capability/layout/API suite: 5 files / 31 tests passed.
- Complete regression: 55 files / 375 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,946 modules and 1,027,209 total bytes, without a chunk warning.
- Fixture syntax: passed.
- Local production fixture: HTML, main JavaScript, stylesheet, and one-owner session requests returned 200 on `127.0.0.1:4201`; final assets matched the build.
- Built-output scans found no unsupported collaboration, setup/login/OIDC, or saved-view Access surface strings.
- Release-audit regression: 2 of 2 tests passed.
- Public release audit: `NOT_READY` for the existing license, identity, notices, provenance, clean-host, revision, and accountable-review gates; not treated as a CT-78 failure.
- Transition integration runner: 7 files / 17 tests discovered and skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Docker was not started.
- Rendered browser captures and assertions: 0.

## Review Record

A final source review corrected three incomplete edges before evidence freeze: returning local owners were stranded without a valid cookie, generic team controls could render transiently while owner metadata loaded, and dead collaboration/overview loading styles survived after their screens were removed. The automatic endpoint is now loopback-only, returning fixed owners recover locally, owner context fails closed, and unreachable selectors/variants are gone. No blocking source finding remains. This is not an independent testing actor and does not replace CT-12 rendered, migration, restart, or UAT acceptance.

## Handoff

CT-78 implementation is complete. CT-80 must preserve the fixed owner/scope behavior in the canonical PostgreSQL-to-SQLite migration, CT-81 must remove the remaining server-side legacy auth/runtime routes and provide the supported one-process loopback runtime, and CT-12 must independently test rendering, restart, migration, local-origin security, and recovery. No Discovery outcome or release claim is made.

## Completion Readback

After explicit sponsor authorization, the local task helper backed up the authoritative store and advanced CT-78 from revision 4 to `Done@5`. Reconciliation then advanced CT-12 to `In Progress@58` and CT-13 to `Todo@59`. All three readbacks retained stable IDs, milestones, healthy local authority, and disabled/`not_synced` provider projection.
