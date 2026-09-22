# CT-106 Mobile Drawer Escape Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_EVIDENCE_RECORDED`. While the mobile drawer is open, Escape closes only that drawer, retains issue-detail context, and restores visible focus to its trigger.

## Behavioral Matrix

| Escape origin | Drawer closed | Exact issue URL retained | Trigger focus restored |
| --- | --- | --- | --- |
| Open-navigation trigger | PASS | PASS | PASS |
| Close-navigation scrim | PASS | PASS | PASS |
| Drawer navigation | PASS | PASS | PASS |
| Subsequently focused issue-detail control | PASS | PASS | PASS |

## Verification

| Check | Result |
| --- | --- |
| Focused regression | 1 file / 1 test passed |
| Complete regression | 70 files / 461 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,949 modules / 105 files / 1,894,235 bytes; no warning |
| Release-audit regression | 10 / 10 passed |
| Independent application review | Passed with no finding |
| Current Chrome | 390x844; exact URL unchanged; trigger gets visible 2px cyan focus |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `30fe497efeeb56b87e0dd250d2eb5455d1945ea7eb3f88c4fce442fd50cdb8de` |
| `apps/web/tests/mobile-navigation-escape.test.ts` | `c275f5fbe1c62e22281d51cedfc65ca51d296a97ae3e33abb996139d41c76d3c` |

## Capture

`evidence/mobile-drawer-open-light-390x844.jpg` is 10,998 bytes at SHA-256 `2d0c049b7058fed95dcf6172d1a521a3d8cc9a625178705834288b522dd4625d`.

The capture shows the exercised open state. The behavioral result comes from the exact URL, focus, visibility, and key-event checks; it does not complete CT-12 or P-T21.
