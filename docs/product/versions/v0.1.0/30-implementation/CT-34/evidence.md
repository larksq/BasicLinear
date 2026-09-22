# CT-34 Stateful Control Semantics Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Current navigation and pressed control states are exposed in source and pass every automated gate, but browser acceptance remains open.

## Correction

- The six workspace destinations expose `aria-current="page"` only when their view is active.
- The Issues list and board layout buttons expose their pressed state.
- The filter builder's All and Any join controls expose their pressed state.
- Each rich-text formatting toggle exposes the editor-reported active state.
- No class, CSS rule, dimensions, copy, pointer behavior, keyboard shortcut, data operation, or responsive rule changed.

## Automated Verification

| Check | Result |
|---|---|
| Focused state semantic contract | 1 file, 4 tests passed |
| Combined CT-32/CT-33/CT-34 semantic regression | 3 files, 12 tests passed |
| Complete unit regression | 15 files, 85 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,917 modules; CSS 63,366 bytes; projects 28,758 bytes; index 277,599 bytes; issues 491,086 bytes |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Stateful keyboard-reachable controls now expose their current or pressed state without changing activation behavior. |
| R-104 | Navigation, layout, filter, and editor controls no longer rely on visual styling alone to communicate selection. |
| R-110 | No visual or responsive token changed; final desktop/mobile geometry inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. The required follow-up must verify at 1440x900 and 390x844 that exactly one workspace destination is current; changing destinations updates that state; exactly one Issues layout control is pressed; changing layout updates that state; exactly one filter join operator is pressed; rich-text toggle state follows editor selection; focus remains visible and stable; IDs are unique; and console diagnostics are clean.

## Privacy And Authority

The automated checks use repository source and synthetic fixtures only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-34, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
