# CT-86 Implementation Session

- Issue: `CT-86`, stable ID `fe09802e-c156-47ae-98bd-c73f755b3527`, created at revision `1`, implementation revision `2`, intended completion revision `3`.
- Session: `CT86-IMPLEMENT-20260821T082452Z`.
- Actor: `codex-release-tooling`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, browser, Google account, Docker, PostgreSQL server, database URL, or external identity was used.

## Finding

CT-84 deliberately replaced the nested npm workspace start command with the direct `node apps/api/dist/index.js` launcher so Ctrl-C reaches the single Node process and SQLite closes cleanly. The deterministic P-T22 verifier still required the retired workspace command. The reproducible-build manifest also retained the package hash from before CT-84, so the supported source reported a false `reproducible_build_inputs` failure.

## Implementation

1. Added the supported direct launcher to the reproducible-build manifest as `start_command`.
2. Required the manifest command to equal the exact supported direct launcher.
3. Required the root `start` script to equal the manifest command.
4. Retained the exact `single_node_loopback_sqlite` topology and compose-command rejection.
5. Updated the manifest's hash binding for the current root package.
6. Updated the complete fixture to use the direct launcher and added rejection coverage for package drift and unsupported manifest commands.

## Verification

- Focused release-audit regression: 1 file, 3 tests passed.
- Complete regression: 56 files, 387 tests passed.
- Typecheck: all 8 workspaces passed.
- Build: 1,946 modules; 1,027,388 output bytes; no warning.
- Syntax checks: verifier and focused test passed `node --check`.
- Manifest review: all five declared input hashes match; the launcher and root script match exactly; no compose script exists.
- Real P-T22 audit: expected `NOT_READY`, with 5 PASS, 3 FAIL, and 6 BLOCKED controls. `reproducible_build_inputs` is PASS with zero mismatches.
- `git diff --check`: clean. Source revision remains unavailable because the repository has no commit.

## Boundary

This resolves a deterministic release-tooling regression only. Source revision, public identity and license, working-codename removal, third-party notice approval, asset and copy provenance, independent clean-user P-T21, accountable release review, and rendered browser/UAT acceptance remain open. No release or outcome claim is made.
