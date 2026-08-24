# CT-107 Project Action ARIA Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_EVIDENCE_RECORDED`. A closed project action trigger no longer references an absent menu; an open trigger controls the exact mounted menu, and closing removes both.

## State Matrix

| State | `aria-expanded` | `aria-controls` | Menu | Focus |
| --- | --- | --- | --- | --- |
| Closed | `false` | absent | absent | row remains reachable |
| Keyboard open | `true` | exact mounted ID | one named menu | first enabled menu item |
| Escape closed | `false` | absent | absent | row with visible 2px focus |

## Verification

| Check | Result |
| --- | --- |
| Focused regression | 1 file / 4 tests passed |
| Complete regression | 70 files / 461 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,949 modules / 105 files / 1,894,235 bytes; no warning |
| Release-audit regression | 10 / 10 passed |
| Independent application review | Passed with no finding |
| Closed/open/closed Chrome check | PASS |
| Page audit | 0 unnamed controls, invalid ARIA references, direct-text contrast failures, or horizontal overflow |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/projects.tsx` | `f5c0bb3be4d608e540f50474b53a89f4369ea988bbaeb1ce1172d6c6ba41c6f5` |
| `apps/web/tests/project-row-interactions.test.ts` | `044a1371a7d412494fd490bf13078053767955513badd81a3eefd4f800667b66` |

## Capture

`evidence/projects-menu-open-light-1440x900.jpg` is 35,021 bytes at SHA-256 `afd612ac974dfb0dd3d9c72bf1edaed661a29ec41dc4c7acbb334d6d92eeaf1b`.

The capture establishes only the exercised open state. The closed/open/closed relationship is bound by live DOM and focus checks; full CT-12 and clean-runtime acceptance remain separate.
