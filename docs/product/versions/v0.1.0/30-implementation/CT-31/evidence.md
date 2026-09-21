# CT-31 Named Dialog Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. Every modal rendered through the shared `Dialog` component is now named by its visible heading.

## Correction

- The shared component creates one stable React `useId` value per dialog instance.
- The dialog references that ID through `aria-labelledby`; the visible `h2` owns the same ID.
- No duplicate off-screen label, hard-coded ID, or title-derived selector was introduced.
- Existing modal show, focus, focus-trap, cancel, close, and layout behavior is unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused shared-dialog contract | 1 file, 7 tests passed |
| Combined CT-30/CT-31 focused regression | 2 files, 16 tests passed |
| Complete unit regression | 12 files, 73 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,916 modules; CSS 63,366 bytes; projects 28,638 bytes; index 276,240 bytes; issues 490,793 bytes |

## Final-Bundle Browser Matrix

| Viewport | Named role before | Named role after | Label target | Initial focus | Overflow | Duplicate IDs |
|---:|---:|---:|---|---|---:|---:|
| 1440x900 | 0 | 1 | Visible `New issue for Interaction acceptance` h2 | `input[name=title]` | 0px | 0 |
| 390x844 | 0 | 1 | Visible `New issue for Interaction acceptance` h2 | `input[name=title]` | 0px | 0 |

The close control leaves zero open dialogs and returns focus to the invoking `New issue` button. Both screenshots use the rebuilt production bundle. Visual inspection found unchanged spacing and hierarchy, no clipped horizontal content, and no incoherent overlap. Console diagnostics returned 0 warnings and 0 errors.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Shared modals expose their visible purpose through the dialog role and preserve keyboard focus behavior. |
| R-104 | Desktop and mobile final-bundle dialog geometry remains coherent after the semantic-only correction. |

## Privacy And Authority

All captures use the synthetic `Product Studio` fixture and reserved example identities. No authenticated Linear data or user credential appears in the evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This closes CT-31 implementation output only. It does not complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
