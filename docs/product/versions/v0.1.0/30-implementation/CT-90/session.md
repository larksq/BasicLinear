# CT-90 Implementation Session

- Issue: `CT-90`, stable ID `105da7ec-be9e-4703-a003-3a79028b59d9`, created and scoped at revision `1`, intended completion revision `2`.
- Session: `CT90-IMPLEMENT-20260821T102258Z`.
- Actor: `codex-application-engineering`.
- Authority: project-local Control Tower v0.8 only; provider projection disabled and `not_synced`; no Linear API, MCP, UI, Docker, PostgreSQL server, external identity, or Google account was used.

## Finding

The retained Linear references are dark, while BasicLinear previously followed only the operating-system color-scheme media query. That made current visual comparison nondeterministic and provided no user-controlled way to inspect or retain light and dark appearances.

## Implementation

1. Added a compact top-bar appearance menu with `System`, `Light`, and `Dark` radio options.
2. Persisted only validated appearance preferences in local storage and resolved `System` from the operating-system preference.
3. Applied an explicit preference before the application module loads to prevent a wrong-theme first paint.
4. Kept `System` live through color-scheme changes while explicit Light and Dark remain pinned.
5. Synchronized the document `color-scheme` and browser `theme-color` metadata with the resolved appearance.
6. Split light, explicit dark, and system-dark token selection without introducing component-specific color overrides.
7. Added menu-radio roles, checked state, Escape and outside dismissal, focus restoration, and wrapped arrow/Home/End navigation.

## Verification

- Focused appearance regression: 1 file, 5 tests passed.
- Complete regression: 57 files, 394 tests passed.
- Typecheck: all 8 workspaces passed.
- Production build: 1,947 modules, 109 output files, and 1,862,186 output bytes, without warnings.
- Release-audit regression: 6 of 6 tests passed.
- Served candidate: existing loopback process returned `{"status":"ready"}` and served the new prepaint script and current assets.
- Rendered browser captures: 0.

## Acceptance Boundary

Source, unit, typecheck, build, and served-asset evidence establish the implementation contract only. Chrome extension transport remained unavailable after the mandated retry. No screenshot, accessibility-tree inspection, responsive measurement, contrast inspection, first-paint observation, or visual-fidelity claim was produced. CT-12 owns that rendered acceptance; CT-82 still owns independent clean-revision runtime acceptance; CT-3 still owns public identity, license, and clean-room review.
