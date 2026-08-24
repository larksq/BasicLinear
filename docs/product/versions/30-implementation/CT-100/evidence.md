# CT-100 Cyan Focus-Palette Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. Selection and focus now use a distinct cyan semantic palette in Light, explicit Dark, and System Dark. Primary commands and link accents retain their prior blue palette.

## Token Contract

| Mode | Focus token | Hue | Minimum checked contrast |
| --- | --- | ---: | ---: |
| Light | `#087e8c` | 186.4 degrees | 4.26:1 against Light surface-subtle |
| Explicit Dark | `#6be7f5` | 186.1 degrees | 10.45:1 against Dark surface-subtle; 3.23:1 against Dark primary |
| System Dark | `#6be7f5` | 186.1 degrees | Same token and ratios as explicit Dark |

Light ratios are 4.80:1 against `#ffffff`, 4.49:1 against `#f7f7f8`, and 4.26:1 against `#f1f1f3`. Dark ratios are 12.25:1 against `#171719`, 11.51:1 against `#1d1d20`, 10.45:1 against `#252529`, and 3.23:1 against the Dark primary control `#4f70c5`.

## Preserved Boundary

| Contract | Result |
| --- | --- |
| Light accent / primary | `#3366cc`, `#2451ad`, `#3366cc`, `#2451ad` unchanged |
| Dark accent / primary | `#7d9be8`, `#9cb2ec`, `#4f70c5`, `#4263b8` unchanged |
| Semantic consumers | Global outline, fields, project selection, issue selection, board cards/targets, tabs, editors, drag targets, checkboxes, and recovery banners still use `var(--ol-focus)` |
| Removed values | `#4f79da` and `#92abef` absent from UI tokens and the production CSS bundle |
| Product behavior | Layout, typography, navigation, workflow, API, SQLite, schema, canonical transfer, authentication, and external services unchanged |

## Verification

| Check | Result |
| --- | --- |
| Focused palette/appearance/visual regression | 3 files / 13 tests passed |
| Complete regression | 67 files / 444 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 105 files / 1,890,845 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Isolated loopback | `ready` and `live` on port 4280 with a temporary data directory |
| Served assets | `index-sMPVANbk.js` and `index-uBq3LIZH.css` |
| Source JSON parse | 318 source JSON files parsed |
| Rendered Chrome evidence | 0 captures; required Chrome transport remains unavailable before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `packages/ui/src/tokens.css` | `4bdeb3ca76ae4518494a691d78dd0b57df1b4db46c8d2f4a4a71e225c7dbd1ac` |
| `apps/web/tests/focus-palette.test.ts` | `f3e02db286895d048f99a57952ef94f562b87a6f24803f7bb01480087f8dac8f` |

## Protected Gates

Source hue and contrast math does not establish rendered focus visibility, clipping, native-control paint, color-only independence, or System-mode behavior. CT-12 must execute the current Chrome matrix at every accepted viewport and live breakpoint in pinned Light, pinned Dark, and live System. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
