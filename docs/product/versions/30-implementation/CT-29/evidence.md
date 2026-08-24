# CT-29 Remaining Loading-Surface Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. Every visible read surface identified by the completion audit now reserves purpose-specific final geometry instead of collapsing to a compact spinner or transient zero.

## Correction

- `LoadingSkeleton` now covers full project detail, workspace metrics, team/member tables, workflow groups, milestone rows, relation rows, comment rows, and activity timelines in addition to CT-28's existing variants.
- Workspace metrics and project, team, member, milestone, relation, and comment counts render inert inline blocks while their authoritative query is unresolved. No observed loading surface presents a false zero.
- Workflow waits for both team and status reads. Issue activity waits for both activity and milestone context. Compact spinners remain limited to bounded mutation feedback.
- Project loading retains an explicitly named region before `project-title` exists, avoiding a dangling `aria-labelledby` reference.
- Visual blocks are `aria-hidden`; each asynchronous root is a named `role=status` with `aria-live=polite`, `aria-busy=true`, and no controls or focus targets.
- The synthetic fixture provides isolated `workspace-loading`, `teams-loading`, `members-loading`, `workflow-loading`, `project-detail-loading`, `project-sections-loading`, and `issue-sections-loading` modes.

## Automated Verification

| Check | Result |
|---|---|
| Focused loading/layout tests | 2 files, 22 tests passed |
| Complete unit regression | 12 files, 67 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,916 modules; CSS 63,366 bytes; projects 28,638 bytes; index 276,199 bytes; issues 490,607 bytes |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Read-spinner source audit | 0 remaining matches on the audited read queries |
| Skeleton semantics | Named busy roots; visual children hidden; no controls or tab stops |

## Final-Bundle Browser Matrix

| Surface | Viewport | Busy status | Stable geometry | Focus targets | Horizontal overflow | Duplicate IDs |
|---|---:|---:|---:|---:|---:|---:|
| Workspace metrics | 1440x900 | 1, `Loading workspace metrics` | 3 cells, 968x93 | 0 | 0px | 0 |
| Team table | 390x844 | 1, `Loading teams` | 7 rows, 354x311 | 0 | 0px | 0 |
| Workflow groups | 1440x900 | 1, `Loading workflow statuses` | 2 groups / 8 rows, 968x468 | 0 | 0px | 0 |
| Workflow groups | 390x844 | 1, `Loading workflow statuses` | 2 groups / 8 rows, 354x468 | 0 | 0px | 0 |
| Project detail | 1440x900 | 1, `Loading project details` | 1136x620 | 0 | 0px | 0 |
| Project detail | 390x844 | 1, `Loading project details` | 351x714 | 0 | 0px | 0 |
| Project milestones | 1440x900 | 1, `Loading project milestones` | 4 rows, 1121x257 | 0 | 0px | 0 |
| Project activity | 1440x900 | 1, `Loading project activity` | 3 rows, 1136x210 | 0 | 0px | 0 |
| Issue relations/comments/activity | 1440x900 | 3 named statuses | 524x126 / 524x192 / 1100x210 | 0 | 0px | 0 |
| Issue relations/comments/activity | 390x844 | 3 named statuses | 351x126 / 351x192 / 351x210 | 0 | 0px | 0 |

All ten captures use the rebuilt production bundle. Visual inspection found coherent spacing, stable shell chrome, no clipped horizontal content, and no incoherent overlap. Mobile project and issue detail remain intentionally vertically scrollable. Fresh-tab console checks on the final desktop and mobile workflow bundle returned 0 warnings and 0 errors. Raw geometry, fixture names, and screenshot hashes are in `evidence/browser-matrix.json`.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-103 | Named busy status semantics, noninteractive placeholders, valid loading-region naming, and no false empty values. |
| R-104 | Desktop and mobile final-bundle captures preserve the responsive shell and surface-specific tracks. |
| R-105 | Existing palette, border, density, hierarchy, table, section, and timeline tokens are reused. |
| R-110 | Fixed metrics, table rows, project detail, workflow groups, milestones, relations, comments, and activity prevent loading-time collapse. |

## Privacy And Authority

All captures use the synthetic `Product Studio` fixture and reserved example identities. No authenticated Linear data or user credential appears in the evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This closes CT-29 implementation output only. It does not complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
