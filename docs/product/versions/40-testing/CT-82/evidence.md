# CT-82 Independent Clean-Runtime Evidence

## Verdict

`PASSED`. The independent strict runner accepts P-T21 for exact product revision `f7c362562fdf0657114a862331b893e470b824c0` and tree `7b5f5af4d6f0b5ead0f403f69d4695b82779194c`. All 21 structured checks passed without skips, failures, self-acceptance, outbound-network attempts, or subprocess attempts.

## Test Authority

- Independent actor/session: `codex-independent-testing-ct82-f7c3625` / `CT82-INDEPENDENT-20260822T191944Z`.
- Latest product implementation input: CT-116, with distinct application review by `codex-independent-application-review-ct116` / `CT116-INDEPENDENT-REVIEW-20260822T185649Z`.
- Environment: macOS 25.5 arm64, Node `v24.18.0`, npm `11.16.0`; no Docker, PostgreSQL server, external identity, or paid service.
- Private raw result: `.control-tower/evidence/CT-82/qualification-f7c3625.json`, mode `0600`, 3,923 bytes, SHA-256 `ffc378a4337c24466d04a589a5c811367660e269f1dd9546d2e554b1cebe3734`.
- Tracked receipt: `evidence/qualification-f7c3625.json`, SHA-256 `82851883f97cfadf1057d59e489ca6951ba9ec9c71aea794636a930a156d4c9a`.

## Revision And Artifact Lock

| Surface | Result |
| --- | --- |
| Product revision | `f7c362562fdf0657114a862331b893e470b824c0`; tree `7b5f5af4d6f0b5ead0f403f69d4695b82779194c` |
| Source state | Clean isolated checkout; zero status entries |
| Source set | 1,197 files; SHA-256 `6b765bace3480b63a79fe01b5ac8a2158bff34248c917c82044f9aa4bd0b27fd` |
| Runtime artifact | 111 files / 2,052,706 bytes; SHA-256 `c5d496806136aaf904d480e85c23c38974374a5f79ad0b651b898cc0f1cd3822` |
| Artifact derivation | Independently recomputed from the exact clean product revision |

## Qualification Matrix

| Surface | Result |
| --- | --- |
| Build and single-process runtime | Pass |
| Fresh implicit owner/workspace/team bootstrap | Pass |
| Project, milestone, issue, private-view, search, and derived-progress workflows | Pass |
| Host, Origin, CSRF, multiple-tab, session-rotation, and stable-ID behavior | Pass |
| Outbound network and subprocess denial | Pass; 6 guarded phases, 11 audit records, 0 attempts |
| Crash and clean interruption recovery | Pass for `SIGKILL`, `SIGTERM`, and `SIGINT` |
| Export, import, backup, integrity, restore, and corrupt-restore rejection | Pass; canonical digest `abbf5e28a7c5a52f374cd39435fa744f2cb7e70e6a128893415164737726d5ec` |
| Upgrade and rollback | Pass for schema 1 to 2, future-schema rejection, and malformed-migration rollback |
| Accepted personal scale | Pass for 1,001 projects, 2,001 milestones, 10,001 issues, and 50,006 activity entries in 151.05 ms |
| Database, backup, and export permissions | Pass |
| Legacy transfer compatibility | Pass; no ambiguous target and source unchanged |
| Sidecar and work-directory cleanup | Pass |

## Acceptance Boundary

This evidence accepts only the exact source-bound local-runtime P-T21 gate. Chrome P-T18, P-T19, and P-T20 remain incomplete; cross-platform behavior is not accepted by this macOS-only run. No identity, legal, accountable-release, publication, or outcome decision is implied. Earlier qualification receipts remain immutable historical evidence for their own source revisions only.
