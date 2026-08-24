# CT-88 Implementation Session

- Issue: `CT-88`, stable ID `a3925543-7e44-4b3c-b897-3fdab7b734e1`.
- Starting state: `Todo@1`; implementation state: `In Progress@2`; final state: `Done@3`.
- Actor: `codex-ct88-tooling`.
- Session: `CT88-IMPLEMENT-20260821T0915Z`.
- Authority: project-local Control Tower v0.8; provider projection disabled and `not_synced`.

## Implemented

`scripts/verify-clean-runtime.mjs` is a one-command external qualification runner for the built API, web application, and operator CLI. It hashes 111 built runtime files and package inputs into one artifact identity, records the available Git/source state and exact environment, creates a clean temporary home and data directory, and launches only `node apps/api/dist/index.js`.

`scripts/clean-runtime-network-guard.cjs` is preloaded only into qualification child processes. It permits loopback connections and blocks and records non-loopback HTTP, HTTPS, fetch, TCP, TLS, DNS, UDP, and child-process attempts. It changes no production source or runtime command.

The runner exercises:

- fresh owner, implicit scope, and default-status bootstrap;
- project, milestone, label, issue, private saved view, search, sort, activity, and derived progress;
- hostile Host and Origin rejection, CSRF, strict cookie behavior, and two-tab CSRF separation;
- online export and backup, verification, fresh restore, canonical import, and corrupt-restore rejection;
- idle `SIGKILL`, graceful `SIGTERM`, graceful `SIGINT`, restart session rotation, stable IDs, and sidecar cleanup;
- accepted schema-1 upgrade, future-schema rejection without mutation, and malformed migration rollback;
- 1,001 projects, 2,001 milestones, 10,001 issues, and 50,006 activity entries under the accepted-scale scan/search/sort threshold;
- the locked CT-85 legacy canonical hash, ambiguous-scope preflight, explicit-scope digest, and source immutability.

## Verification

- Focused runner tests: 4/4 passed.
- Complete application regression: 56 files / 389 tests passed.
- Typecheck: all eight workspaces passed.
- Combined runner and release-audit regression: 7/7 passed.
- Clean build: 1,946 Vite modules, no warning, built runtime artifact `2dc6cc5751d136a1c0495e68283f4052066053c850de7094567f456c2478e776` across 111 files / 1,993,170 bytes.
- Final implementation rehearsal: `PASSED_IMPLEMENTATION_REHEARSAL`; six guarded child phases recorded zero outbound or subprocess attempts.

## Acceptance Boundary

This session implements and rehearses the qualification tool. It does not independently accept its own work. The repository has no Git source revision and is not clean, so the runner correctly records `source_revision_bound: false`, leaves P-T21 open, and leaves CT-82 Todo. CT-12 rendered browser/UAT, CT-3 legal and brand review, accountable provenance, release, and outcomes remain separate.

No Linear API, MCP, UI, Google account, Docker, PostgreSQL server, database URL, or external identity was used.

## Control Tower Readback

- `CT-88`: `Done@3`.
- `CT-82`: `Todo@4`; independent revision-bound P-T21 qualification remains open.
- `CT-12`: `In Progress@63`; rendered Chrome/UAT acceptance remains open.
- `CT-13`: `Todo@63`; release audit remains `NOT_READY`.
- Project totals: 6 active, 75 done, 7 canceled, 82 closed, and 0 trashed.
- Provider projection: disabled and `not_synced`.
