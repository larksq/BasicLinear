# CT-23 Desktop Density Controls Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. The accepted 232px desktop workspace rail now collapses to a stable 48px icon rail, and contextual issue detail is persistently adjustable from 480px through 640px without changing the tablet or mobile overlay contract.

## Correction

The completion audit found three contract gaps: no rail collapse control, no issue-panel resize control, and an expanded rail inherited as 248px instead of the accepted 232px. The first visual review also found toolbar controls colliding inside the narrowed issue-list pane. The implementation adds:

- named Lucide collapse/expand controls with persisted state;
- a desktop-only, focusable ARIA separator with pointer and keyboard handlers;
- safe parsing, clamping, and persistence helpers for the 480px, 560px, and 640px panel contract;
- desktop-only 232px rail sizing, retaining the existing 248px mobile drawer;
- split-view toolbar wrapping that keeps every control inside the list pane; and
- a read-only synthetic fixture that serves the production bundle without credentials or mutation support.

The initial failure is retained as `evidence/expanded-rail-default-panel-1440x900.jpg`. The corrected state is `evidence/expanded-rail-default-panel-1440x900-fixed.jpg`.

## Verification

| Check | Result |
|---|---|
| Focused unit | 2 files, 7 tests passed: storage failure handling, exact persistence, width clamping, pointer math, keyboard bounds, and source/CSS contracts |
| Complete unit | 9 files, 35 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite passed; 1,913 modules transformed |
| Expanded desktop | 232px rail and 560px panel at configured 1440x900 |
| Collapsed desktop | 48px rail and 560px panel; named icon controls remain available |
| Keyboard separator | `End` produced 640px and `Home` produced 480px; `aria-valuenow` and `aria-valuetext` matched each bound |
| Pointer separator | Pointer translation and both clamps passed focused unit coverage; the component binds the reviewed handler to the named separator |
| Persistence | Reload retained the collapsed 48px rail and 480px panel exactly |
| Split toolbar | Final expanded, collapsed, minimum, and maximum captures show no overlap or horizontal control loss |
| Mobile 390x844 | Separator and desktop collapse control are hidden; detail occupies the 375px visible content width; drawer remains 248px |
| Chrome diagnostics | 0 warning and 0 error console records after the desktop and mobile matrix |

## Screenshots

- `evidence/expanded-rail-default-panel-1440x900-fixed.jpg`, SHA-256 `c4dc335713c4e9c8aea9da6bc34e242cf293e7d37790314c8b5ea1af87b9ccc9`.
- `evidence/collapsed-rail-default-panel-1440x900.jpg`, SHA-256 `b864bb6654d4130d15a169d97bad444f37d0b6637f149fc4351913f9309d9248`.
- `evidence/collapsed-rail-wide-panel-1440x900.jpg`, SHA-256 `8d4841809cb4a509991dff24e23e7569f85032a5c6c9f0edc82235e12accf415`.
- `evidence/collapsed-rail-narrow-panel-1440x900.jpg`, SHA-256 `68e8832bb2bd2288e5389bed2f9a4ec80b365e81e2276bcc11d1bf4d3dc68265`.
- `evidence/mobile-full-width-panel-390x844.jpg`, SHA-256 `9e01baae950ff6f718ab7dae068eda21701cdf15b8cf27ce94bac972407695cc`.
- `evidence/mobile-navigation-drawer-390x844.jpg`, SHA-256 `49f0bd9f3cc5a46ec978268dd786c5875397fffb86e577977bba58333aff8dc9`.

Chrome was configured to 1440x900 and 390x844. The connector encoded JPEG bytes while retaining the requested `.png` filenames; the resulting artifacts are 1425x891 and 375x812, respectively, and the hashes bind the exact reviewed bytes.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | The separator supports ArrowLeft, ArrowRight, Home, and End with a named focusable control. |
| R-011 | Rail and panel changes do not close the issue, reset list state, or discard the originating context. |
| R-104 | The separator exposes orientation, minimum, maximum, current, and text values; focus styling and named icon controls remain present. |
| R-110 | The accepted 232/48px rail and 480/560/640px panel tracks were measured at desktop, while mobile retains its non-overlapping full-width detail and drawer. |

## Privacy And Authority

All captures use deterministic synthetic records from the read-only fixture. No authenticated Linear workspace, credential, private reference artifact, API result, or MCP result enters the evidence. Control Tower project-local v0.8 remains the only issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This is implementation evidence for CT-23 and a focused CT-12 addendum. It makes no product outcome claim, does not accept O-001 through O-005, and does not resolve CT-21's clean-host Docker environment blocker.
