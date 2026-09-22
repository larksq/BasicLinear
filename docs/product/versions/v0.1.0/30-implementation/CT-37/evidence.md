# CT-37 Global Shortcut Safety Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Global issue creation and search shortcuts now require exact, eligible key chords and do not stack Search over another dialog, but rendered browser acceptance remains open.

## Correction

- A pure resolver is now the single policy boundary for global shortcut dispatch.
- Search accepts only exact Command/Ctrl+K chords without Shift or Alt.
- Issue creation accepts only an unmodified `C` outside editable and dialog contexts.
- Default-prevented, repeating, and IME-composition key events are ignored.
- Search may toggle itself while focus is inside Search, but it is ignored inside another dialog or editable surface.
- `preventDefault()` is applied only after a global action is accepted.
- Existing issue-creation routing, mobile behavior, command index reset, labels, focus order, CSS, geometry, and visible copy remain unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused global-shortcut policy and App binding | 1 file, 5 tests passed |
| Combined CT-32 through CT-37 semantic regression | 6 files, 26 tests passed |
| Complete unit regression | 18 files, 99 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,919 modules; CSS 63,366 bytes; projects 28,758 bytes; index 278,211 bytes; issues 492,204 bytes |

The initial focused run caught a null-target context value that could escape as `undefined`; the App binding was corrected to pass strict booleans before the clean focused, combined, and complete reruns.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Global issue creation and command search now dispatch only from their accepted, exact key chords and preserve the existing action outcomes. |
| R-104 | Editable controls, dialogs, composition, repeats, and already-handled events no longer receive conflicting global shortcut behavior. |
| R-110 guard | No CSS, dimensions, responsive rule, or visible copy changed; rendered geometry inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At 1440x900 and 390x844, the follow-up must confirm that unmodified `C` opens exactly one issue dialog outside editable content; Command/Ctrl+C does not create an issue; Shift+C, Alt+C, repeat, composition, and default-prevented events are ignored; Command/Ctrl+K toggles exactly one Search dialog; the same chord inside another modal does not stack Search; and the chord inside Search closes it and restores focus. The run must also inspect responsive geometry, reachable content, unique IDs, and console diagnostics.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-37, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
