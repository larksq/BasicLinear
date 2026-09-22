# CT-24 Tablet Navigation Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. An unconfigured viewport now uses the accepted responsive navigation modes: 232px expanded desktop at 1200px and above, 48px collapsed tablet rail from 768px through 1199px, and a 248px off-canvas drawer only below 768px.

## Correction

The prior CSS changed to the mobile drawer below 900px and did not derive the tablet rail default from the accepted viewport range. The prior mount effect also wrote the derived state immediately, making a default indistinguishable from an explicit user choice. The correction:

- reads explicit `true` and `false` preferences while treating missing or ambiguous values as unconfigured;
- derives the unconfigured rail mode from exact 768px and 1199px boundaries;
- updates the unconfigured default during live viewport changes;
- writes storage only after the user activates the named rail toggle;
- applies 232px/48px rail styling from 768px upward; and
- moves off-canvas visibility, scrim, menu trigger, and drawer-only focus behavior to the below-768px media query.

## Verification

| Check | Result |
|---|---|
| Focused unit | 2 files, 8 tests passed, including 767/768 and 1199/1200 boundary values, explicit true/false storage, ambiguous/unavailable storage, and source/CSS contracts |
| Complete unit | 9 files, 36 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite passed; 1,913 modules transformed |
| Fresh desktop 1440x900 | 232px rail, 560px contextual panel, no mobile trigger |
| Live unconfigured resize | 1440px/232px to 1024px/48px and back to 1440px/232px without reload |
| Upper boundary | 1199px produced 48px; 1200px produced 232px |
| Fresh tablet 1024x768 | 48px visible rail, named `Expand navigation` control, no mobile trigger, 640px detail overlay |
| Explicit tablet override | Expansion produced 232px and survived reload with the named `Collapse navigation` control |
| Lower tablet 768x1024 | 48px visible rail and no mobile trigger after collapse |
| Below boundary 767px | Closed drawer at x=-248 with hidden visibility and pointer events; open drawer at x=0 with 248px width; desktop toggle hidden |
| Mobile 390x844 | Closed drawer remains outside the accessibility-visible surface, open drawer remains 248px, and detail uses the full 375px visible content width |
| Chrome diagnostics | 0 warning and 0 error console records |

## Screenshots

- `evidence/desktop-default-expanded-1440x900.jpg`, SHA-256 `bc837788b31f4b37688f422db5dd62399ab2f29c64c030e4311cfc47ca24b334`.
- `evidence/tablet-default-collapsed-1024x768.jpg`, SHA-256 `dcddedafa60cf353b75f76b6a32a880e59636697c8e5c631ac6bdbede63172a5`.
- `evidence/tablet-explicit-expanded-1024x768.jpg`, SHA-256 `3d8c9663fcaaa445f8e7a470409e5626b99bfc5c84e367081db1dc178e410a6d`.
- `evidence/tablet-collapsed-768x1024.jpg`, SHA-256 `868683b99c23113c1db673c0fbf2201a70324bc57a746c1d30141e2ed61c077c`.
- `evidence/mobile-drawer-closed-390x844.jpg`, SHA-256 `9e01baae950ff6f718ab7dae068eda21701cdf15b8cf27ce94bac972407695cc`.
- `evidence/mobile-drawer-open-390x844.jpg`, SHA-256 `49f0bd9f3cc5a46ec978268dd786c5875397fffb86e577977bba58333aff8dc9`.

Chrome was configured to the requested viewport dimensions. The connector encoded JPEG bytes while retaining the requested `.png` filenames; the hashes bind the exact reviewed bytes.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-010 | The correct named expand/collapse control remains keyboard reachable in tablet rail mode, while mobile exposes only the named drawer trigger. |
| R-011 | Live mode changes and explicit toggles do not close issue detail or discard the underlying list context. |
| R-104 | Closed mobile navigation remains hidden and non-interactive; visible controls retain names and focus behavior. |
| R-110 | Exact 767/768 and 1199/1200 transitions, baseline screenshots, geometry, and document widths prove the accepted modes without overlap or silent horizontal loss. |

## Privacy And Authority

All retained evidence uses deterministic synthetic records from the read-only fixture. No authenticated Linear workspace, credential, private reference artifact, API result, or MCP result enters the evidence. Control Tower project-local v0.8 remains the only issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence closes the CT-24 implementation output and adds focused R-110 coverage to CT-12. It makes no O-001 through O-005 claim and does not resolve CT-21's clean-host environment gate.
