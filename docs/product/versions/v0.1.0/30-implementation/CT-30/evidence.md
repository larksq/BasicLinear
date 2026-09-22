# CT-30 Milestone-Scoped Issue Creation Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. Creating an issue from a milestone-scoped project list now preserves the active, assignable milestone by default.

## Correction

- The embedded issue workflow forwards the active milestone alongside its project and milestone collection.
- `contextualMilestoneId` returns the requested milestone only when it is present and not archived. Missing and archived context resolve to no milestone.
- The form visibly selects the active milestone and submits it through the existing `milestoneId` payload field.
- Global creation and project-only creation retain no milestone by default.
- The deterministic `milestone-create` fixture returns 422 unless the submitted milestone matches `Interaction acceptance`.

## Automated Verification

| Check | Result |
|---|---|
| Focused scope/layout tests | 2 files, 16 tests passed |
| Complete unit regression | 12 files, 73 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,916 modules; CSS 63,366 bytes; projects 28,638 bytes; index 276,240 bytes; issues 490,793 bytes |
| Fixture syntax | `node --check scripts/serve-visual-fixture.mjs` passed |
| Context cases | Active selected; missing/archived/project-only/global fail closed to no milestone |

## Final-Bundle Browser Matrix

| Viewport | Dialog | Selected milestone | Geometry | Horizontal overflow | Duplicate IDs |
|---:|---:|---|---|---:|---:|
| 1440x900 | 1 named dialog | Interaction acceptance | 680x722 at 372.5,89 | 0px | 0 |
| 390x844 | 1 named dialog | Interaction acceptance | 341x814 at 17,15 | 0px | 0 |

Both captures use the rebuilt production bundle and show `Product Quality`, `In progress`, `No priority`, `Unassigned`, `Desktop density controls`, and `Interaction acceptance` as the initial selections. Visual inspection found coherent spacing, no horizontal clipping, and no incoherent overlap. The mobile dialog is intentionally vertically scrollable.

The browser submitted `Verify milestone context after dialog labeling`. A missing or incorrect milestone would have produced the fixture's 422 `MILESTONE_CONTEXT_MISSING` response and retained the dialog. Instead, the dialog closed and the fixture response opened. The response intentionally reuses synthetic `QA-1`'s ID, so the post-submit detail read projects the static `QA-1` record. Console diagnostics returned 0 warnings and 0 errors.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-004 | Project and milestone assignment is retained through contextual creation. |
| R-005 | The created issue response opens in the existing issue-detail workflow. |
| R-010 | Desktop and mobile creation preserve visible context without hidden defaults. |

## Privacy And Authority

All captures use the synthetic `Product Studio` fixture and reserved example identities. No authenticated Linear data or user credential appears in the evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This closes CT-30 implementation output only. It does not complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
