# CT-39 Project Density Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Project list rows and their loading skeleton now implement the accepted `32px`, `36px`, and `44px` density contract, with a persistent named control. Rendered desktop, tablet, and mobile acceptance remains open.

## Correction

- The project list no longer fixes every data row at `58px`.
- Compact, default, and comfortable project rows now have exact `32px`, `36px`, and `44px` heights.
- The default density is `36px`, matching the accepted UX contract.
- A named density select changes the loaded project table and its loading skeleton from one shared preference.
- The preference persists in local storage and safely falls back to default when the stored value is missing, invalid, or unavailable.
- Project icon and name-cell geometry tighten with dense rows while preserving existing record actions and responsive column rules.

## Automated Verification

| Check | Result |
|---|---|
| Focused project-density contract | 1 file, 7 tests passed |
| Density and layout integration | 5 files, 41 tests passed |
| Combined CT-32 through CT-39 semantic regression | 8 files, 39 tests passed |
| Complete unit regression | 20 files, 112 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,921 modules; CSS 64,663 bytes; projects 29,783 bytes; index 278,310 bytes; issues 493,319 bytes |

The density and layout integration run initially found one stale source assertion for the project loading-skeleton call. The assertion was updated to require the new shared density binding, and the clean focused, combined, complete, typecheck, and build reruns include that correction.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-003 | Project list presentation now exposes a persisted density preference without changing project identity, data mutation, ordering, or row actions. |
| R-105 | Exact accepted project-row heights are encoded in the loaded and loading-state contracts; rendered screenshot comparison remains required. |
| R-110 | Responsive column rules are preserved and compact geometry is bounded in source; rendered text fit, reachability, and overflow inspection remains required. |

## Pending Browser Matrix

No browser result is inferred from source or build output. At `1440x900`, `1024x768`, and `390x844`, the follow-up must measure loaded project rows at exactly `32px`, `36px`, and `44px`; confirm the default is `36px`; measure matching skeleton rows; change and reload each preference; verify every visible label, icon, status, lead, target, progress value, and action remains contained and reachable; verify responsive columns and explicit scrolling; exercise pointer and keyboard row actions; and inspect duplicate IDs, accessible names, focus behavior, horizontal overflow, console warnings, and console errors.

## Privacy And Authority

The automated checks use repository source and synthetic values only. No authenticated Linear data, user credential, or new Chrome activity enters this evidence. Control Tower project-local v0.8 remains the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-39, complete CT-12, pass P-T19 or P-T21, approve CT-13, select a license or public identity, authorize release, or validate O-001 through O-005.
