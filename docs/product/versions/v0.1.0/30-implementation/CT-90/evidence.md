# CT-90 Appearance Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. BasicLinear now provides deterministic System, Light, and Dark selection, with a prepaint-safe persisted preference and an accessible menu contract.

## Behavior

| Surface | Implementation result |
| --- | --- |
| Appearance choices | Top-bar menu exposes System, Light, and Dark |
| Persistence | Only validated values are stored under `appearance.theme.v1` |
| First paint | Inline head script applies an explicit theme before the application module |
| System mode | Resolves from and responds live to `prefers-color-scheme` |
| Explicit modes | Light and Dark remain pinned across operating-system changes |
| Browser chrome | `theme-color` follows the resolved appearance |
| Tokens | Shared semantic tokens select light, explicit dark, or system dark |
| Accessibility | Menu-radio roles, checked state, focus restoration, Escape, arrows, Home, and End are implemented |

## Verification

| Check | Result |
| --- | --- |
| Focused tests | 1 file / 5 tests passed |
| Complete regression | 57 files / 394 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,947 modules / 109 files / 1,862,186 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Post-build readiness | `ready` on the existing loopback process |
| Served candidate | Current prepaint HTML and generated assets returned from port 4275 |
| Rendered Chrome evidence | 0 captures; blocked before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/index.html` | `c15f7b110fe6e68fde19c588b75de576b689455559414a1b8149450b3018da8c` |
| `apps/web/src/App.tsx` | `40b7a805642a64b74112c841df6bd5a8f343f061f20daec61603815fff841e8e` |
| `apps/web/src/appearance-preferences.ts` | `3699ef5dedb5624f920ab9f436d7d1396afa8fe1cb8e5eadf0aa682ec98700c4` |
| `apps/web/src/styles.css` | `15f83b9265479b9cfa8457061dfa4d561cec168a1cc749e6c74b78d3428593df` |
| `apps/web/tests/appearance-preferences.test.ts` | `1267b6156d51914641c9b775ba945aaeda70a34b02af4f5ed1ca2fdc54bb2529` |
| `packages/ui/src/tokens.css` | `dfe1b517e22d30f3444eb7424b6ddfad3d1aca93913de87b72bc92d4f514cd39` |

## Protected Gates

No rendered acceptance is inferred from source inspection, tests, typechecks, build output, loopback health, or served HTML. CT-12 must inspect both pinned themes and live System behavior in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
