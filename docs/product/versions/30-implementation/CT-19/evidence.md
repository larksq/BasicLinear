# CT-19 Workspace Search Isolation Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. Command search and recent-result state are now scoped to the active workspace. The original Northstar-to-CT12 Acceptance switch was reproduced against the deployed build: no Northstar issue or project rendered after the switch, while current-workspace search, recent history, keyboard closure, and reload persistence continued to work.

## Root Cause And Correction

The API search query and repository already include `workspaceId` in both the client query key and the default-deny database path. The leak came from one browser-wide `openlinear.recent-search` local-storage key.

The frontend now:

- writes recent results under `openlinear.recent-search:<workspaceId>`;
- ignores the legacy global key;
- validates stored result shape and caps history at six items;
- associates in-memory recent results with their workspace and renders none when that key does not match the active context;
- closes and resets the command palette when the workspace changes; and
- retains result deduplication and current-workspace keyboard behavior.

## Verification

| Check | Result |
|---|---|
| Focused unit | 1 file, 3 tests passed: workspace isolation/legacy-key rejection, deduplication/cap, malformed storage rejection |
| Complete unit | 6 files, 23 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite build passed; 1,911 modules transformed |
| Deployed health | Web root returned 200; `/health/ready` returned `ready` |
| Browser transition | Northstar `PRO-1` was stored and visible only in Northstar; after switching, neither `PRO-1` nor `Release confidence` appeared in CT12 Acceptance |
| Current context | `QA-2` search and recent history worked in CT12 Acceptance |
| Reload | CT12 Acceptance and its `QA-2` recent item persisted; Northstar remained absent |
| Browser diagnostics | Reload and verification added 0 warning/error entries |
| Visual inspection | Command dialog is readable, centered, unclipped, and contains only the CT12 Acceptance result |

The browser retained two older `linkifyjs` warnings dated before this deployment and attributed to the previous issue-bundle asset. Their count did not change during the CT-19 sequence; they are not CT-19 failures.

Screenshot: `evidence/ct12-workspace-scoped-recents.jpg` (SHA-256 `7b33664cfbfae5a3d9720bf922cb7f424c49f31e1037a6e221532a6deef7e208`).

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-009 | Current-workspace issue search returns the expected `QA-2` result after a workspace transition. |
| R-010 | Command-palette recent state remains keyboard reachable and deterministic after context changes and reload. |
| R-011 | Issue and project results from the prior workspace never render in the active workspace palette. |
| R-101 | The client context now matches the already workspace-scoped, default-deny service query. |

## Verification Boundary

This remediation corrects client search context only. It does not claim CT-12 acceptance, visual outcome O-003, efficiency outcome O-002, or release readiness. CT-12 must independently finish its accessibility, performance, fidelity, and recovery gates.
