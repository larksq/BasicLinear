# CT-32 Accessible Command Palette Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. The command palette now implements a coherent ARIA combobox contract in source and passes all automated gates, but browser acceptance remains intentionally open.

## Correction

- The focused search input exposes `role=combobox`, list autocomplete, expanded state, a stable controlled listbox, and the currently highlighted option through `aria-activedescendant`.
- Every fixed command and async search result is rendered through one shared option component with a stable ID, `role=option`, `aria-selected`, and `tabIndex=-1`.
- Arrow Up and Arrow Down clamp against the currently available options; Enter activates the same index exposed to assistive technology.
- Result-count changes clamp stale indices before they can reference a missing option.
- The active option scrolls to the nearest visible position inside long result sets.
- Existing pointer highlight, pointer activation, route behavior, recent results, workspace scoping, copy, dimensions, and CSS are unchanged.

## Automated Verification

| Check | Result |
|---|---|
| Focused command-palette contract | 1 file, 4 tests passed |
| Combined command-palette/layout regression | 2 files, 11 tests passed |
| Complete unit regression | 13 files, 77 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,917 modules; CSS 63,366 bytes; projects 28,638 bytes; index 277,149 bytes; issues 490,793 bytes |

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | Keyboard selection and activation now share one bounded active index, and focus remains owned by the search input. |
| R-104 | The declared combobox/listbox relationship and selected option are programmatically observable in source; final desktop/mobile browser inspection is still required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. The required follow-up must verify at 1440x900 and 390x844 that the named Search dialog contains one expanded combobox, `aria-controls` resolves to one listbox, `aria-activedescendant` resolves to the selected option after Arrow Up/Down, Enter and pointer activation remain correct, a long result set scrolls the active option into view, focus stays on the input, horizontal overflow is zero, IDs are unique, and console diagnostics are clean.

## Privacy And Authority

The automated checks use repository source and synthetic fixtures only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-32, complete CT-12, pass P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
