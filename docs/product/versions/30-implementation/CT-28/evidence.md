# CT-28 Final-Geometry Loading Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. Core loading states now reserve the accepted application geometry and expose one named, noninteractive busy status per rendered loading surface.

## Correction

- `LoadingSkeleton` provides bounded `gate`, `table`, `detail`, `editor`, and `command` variants.
- Project rows reserve 58px geometry; issue rows reserve 44px geometry; both retain a 34px table header and follow the live responsive column rules.
- Direct detail loading retains the final two-column desktop geometry and the one-column, vertically scrollable mobile geometry. Panel, rich-editor, command-list, lazy-route, and application-gate states have fixed dimensions aligned to their final surfaces.
- Application and surface loading fallbacks use skeletons. Compact spinners remain only for mutation buttons and other bounded action feedback.
- Visual blocks are `aria-hidden`; the root is the sole `role=status`, with `aria-live=polite`, `aria-busy=true`, and a screen-reader label. Skeletons contain no controls or focus targets.
- The synthetic fixture recognizes `fixture=issues-loading` and `fixture=issue-detail-loading` and delays only the relevant read requests for deterministic evidence.

## Automated Verification

| Check | Result |
|---|---|
| Focused loading/layout tests | 2 files, 12 tests passed |
| Complete unit regression | 12 files, 57 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,916 modules; CSS 55,190 bytes; projects 28,232 bytes; index 271,336 bytes; issues 490,238 bytes |
| Skeleton semantics | One named busy status; visual children hidden; no controls or tab stops |
| Fixture contracts | Issue-list and exact direct-detail read delays are source-covered |

## Final-Bundle Browser Matrix

| Surface | Viewport | Status | Skeleton focus targets | Positive horizontal overflow | Outside controls | Duplicate IDs | Console |
|---|---:|---:|---:|---:|---:|---:|---:|
| Issue list | 1440x900 | 1, `Loading issues` | 0 | 0px | 0 | 0 | 0 warnings / 0 errors |
| Direct issue detail | 1440x900 | 1, `Loading issue details` | 0 | 0px | 0 | 0 | 0 warnings / 0 errors |
| Issue list | 390x844 | 1, `Loading issues` | 0 | 0px | 0 | 0 | 0 warnings / 0 errors |
| Direct issue detail | 390x844 | 1, `Loading issue details` | 0 | 0px | 0 | 0 | 0 warnings / 0 errors |

The mobile detail skeleton is intentionally taller than one viewport, matching the final detail surface's vertical scroll. All four visual inspections found coherent spacing, stable shell chrome, no clipped horizontal content, and no incoherent overlap. Raw geometry and capture bindings are in `evidence/browser-matrix.json`.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-103 | Named busy status and noninteractive, assistive-technology-hidden visual placeholders. |
| R-104 | Desktop and mobile list/detail final-bundle captures preserve the responsive shell and content geometry. |
| R-105 | Loading blocks use existing palette, border, density, and hierarchy tokens without decorative animation. |
| R-110 | Fixed rows, controls, editor, command results, gate, and detail tracks prevent loading-time layout resize. |

## Privacy And Authority

All captures use the synthetic `Product Studio` fixture and reserved example identities. No authenticated Linear data or user credential appears in the evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This closes CT-28 implementation output only. It does not complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
